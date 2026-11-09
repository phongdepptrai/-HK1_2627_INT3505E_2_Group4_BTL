import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Building2, ArrowLeft, CalendarDays } from 'lucide-react';
import { venueApi, courtApi, sportApi, bookingApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import { useResource } from '../hooks/useResource';
import { Button, Field, Modal, ErrorBox, EmptyState, Loading, amenities } from '../components/ui';
import { Status, Pagination, bookingLabels, courtLabel } from '../components/domain';
import {
  money,
  localDate,
  addDays,
  clockTime,
  displayDate,
} from '../../../../packages/shared/time';

export default function Owner() {
  const { user, openLogin } = useAuth();
  return (
    <div className="container page">
      <div className="page-heading">
        <div className="eyebrow muted">KHÔNG GIAN CHỦ SÂN</div>
        <h1>
          Quản lý cơ sở & lịch chơi<span>.</span>
        </h1>
        <p>Chăm sóc từng sân, theo dõi yêu cầu và sẵn sàng đón đội bóng tiếp theo.</p>
      </div>
      {user?.role === 'OWNER' ? (
        <VenueList key={user.id} />
      ) : (
        <EmptyState
          icon={Building2}
          title="Dành cho chủ cơ sở"
          action={!user && <Button onClick={openLogin}>Đăng nhập tài khoản chủ sân</Button>}
        >
          Bạn cần tài khoản chủ sân để quản lý cơ sở.
        </EmptyState>
      )}
    </div>
  );
}
function VenueList() {
  const [page, setPage] = useState(1),
    [selected, setSelected] = useState(''),
    [editing, setEditing] = useState(null),
    [deleting, setDeleting] = useState(null);
  const resource = useResource(
    (signal) => venueApi.mine({ page, limit: 6, sort: 'name' }, signal),
    [page],
  );
  if (selected)
    return (
      <VenuePanel
        id={selected}
        onBack={() => {
          setSelected('');
          resource.reload();
        }}
      />
    );
  return (
    <>
      <div className="owner-toolbar">
        <span>{resource.data?.meta.total ?? '…'} cơ sở của bạn</span>
        <Button onClick={() => setEditing({})}>
          <Plus size={17} />
          Thêm cơ sở
        </Button>
      </div>
      {resource.loading ? (
        <Loading cards />
      ) : resource.error ? (
        <ErrorBox error={resource.error} retry={resource.reload} />
      ) : !resource.data.data.length ? (
        <EmptyState title="Chưa có cơ sở">
          Tạo cơ sở đầu tiên rồi thêm từng sân bên trong.
        </EmptyState>
      ) : (
        <div className="owner-venue-grid">
          {resource.data.data.map((v) => (
            <article className="owner-venue-card" key={v.id}>
              <Building2 size={25} />
              <span className={`status ${v.status === 'active' ? 'confirmed' : 'cancelled'}`}>
                {v.status === 'active' ? 'Đang hoạt động' : 'Tạm ngừng'}
              </span>
              <h2>{v.name}</h2>
              <p>{v.address}</p>
              <small>
                {v.city} · {v.openTime}–{v.closeTime}
              </small>
              <div className="venue-types">
                {v.courtTypes.map((t) => (
                  <span key={`${t.sportTypeId}:${t.teamSize}`}>
                    {t.count} sân {t.teamSize ? `${t.teamSize} người` : t.sportName}
                  </span>
                ))}
                {!v.courtCount && <span>Chưa có sân hoạt động</span>}
              </div>
              <div className="owner-venue-actions">
                <Button variant="outline" onClick={() => setSelected(v.id)}>
                  Sân & lịch đặt
                </Button>
                <button
                  className="icon-button"
                  aria-label={`Sửa ${v.name}`}
                  onClick={() => setEditing(v)}
                >
                  <Pencil size={17} />
                </button>
                <button
                  className="icon-button danger-text"
                  aria-label={`Xóa ${v.name}`}
                  onClick={() => setDeleting(v)}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      <Pagination result={resource.data} onPage={setPage} />
      {editing && (
        <VenueForm
          venue={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setPage(1);
            resource.reload();
          }}
        />
      )}
      {deleting && (
        <DeleteDialog
          title="Xóa cơ sở?"
          item={deleting}
          description="Cơ sở còn sân con không thể xóa. Bạn có thể sửa trạng thái thành tạm ngừng."
          remove={() => venueApi.remove(deleting.id, `"${deleting.version}"`)}
          onClose={() => setDeleting(null)}
          onSaved={() => {
            setDeleting(null);
            setPage(1);
            resource.reload();
          }}
        />
      )}
    </>
  );
}
function VenuePanel({ id, onBack }) {
  const [tab, setTab] = useState('bookings'),
    [page, setPage] = useState(1),
    [editing, setEditing] = useState(null),
    [deleting, setDeleting] = useState(null);
  const venue = useResource((signal) => venueApi.get(id, signal), [id]);
  const courts = useResource(
    (signal) => venueApi.courts(id, { page, limit: 12 }, signal),
    [id, page],
  );
  function reload() {
    venue.reload();
    courts.reload();
  }
  return (
    <>
      <button className="back-link text-button" onClick={onBack}>
        <ArrowLeft size={16} />
        Tất cả cơ sở
      </button>
      {venue.error && <ErrorBox error={venue.error} retry={venue.reload} />}
      <div className="owner-toolbar">
        <div>
          <h2>{venue.data?.data.name || 'Đang tải cơ sở…'}</h2>
          <p className="muted">{venue.data?.data.address}</p>
        </div>
        {venue.data && (
          <Link className="button outline" to={`/co-so/${id}`}>
            Xem cơ sở →
          </Link>
        )}
      </div>
      {venue.data?.data.status === 'inactive' && (
        <p className="info-note">Cơ sở tạm ngừng nhận đặt mới; lịch đã xác nhận vẫn được giữ.</p>
      )}
      <div className="tabs" role="group" aria-label="Quản lý cơ sở">
        <button
          className={tab === 'bookings' ? 'active' : ''}
          aria-pressed={tab === 'bookings'}
          onClick={() => setTab('bookings')}
        >
          Yêu cầu & lịch đặt
        </button>
        <button
          className={tab === 'courts' ? 'active' : ''}
          aria-pressed={tab === 'courts'}
          onClick={() => setTab('courts')}
        >
          Các sân trong cơ sở
        </button>
      </div>
      {tab === 'bookings' ? (
        <OwnerBookings venueId={id} />
      ) : (
        <>
          <div className="owner-toolbar">
            <span>{courts.data?.meta.total ?? '…'} sân riêng biệt</span>
            <Button disabled={!venue.data} onClick={() => setEditing({})}>
              <Plus size={17} />
              Thêm sân vào cơ sở
            </Button>
          </div>
          {courts.loading ? (
            <Loading />
          ) : courts.error ? (
            <ErrorBox error={courts.error} retry={courts.reload} />
          ) : !courts.data.data.length ? (
            <EmptyState title="Cơ sở chưa có sân">
              Thêm sân và thiết lập môn thể thao, giá, trạng thái.
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tên sân</th>
                    <th>Môn / loại sân</th>
                    <th>Giá cơ bản / giờ</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {courts.data.data.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.name}</strong>
                      </td>
                      <td>{courtLabel(c)}</td>
                      <td>{money(c.basePricePerHour)}</td>
                      <td>{c.status === 'active' ? 'Đang hoạt động' : 'Tạm ngừng'}</td>
                      <td>
                        <div className="table-actions">
                          <Link className="text-button" to={`/san/${c.id}`}>
                            Xem lịch
                          </Link>
                          <button
                            className="icon-button"
                            aria-label={`Sửa ${c.name}`}
                            onClick={() => setEditing(c)}
                          >
                            <Pencil size={17} />
                          </button>
                          <button
                            className="icon-button danger-text"
                            aria-label={`Xóa ${c.name}`}
                            onClick={() => setDeleting(c)}
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination result={courts.data} onPage={setPage} />
        </>
      )}
      {editing && (
        <CourtForm
          court={editing}
          venue={venue.data.data}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setPage(1);
            reload();
          }}
        />
      )}
      {deleting && (
        <DeleteDialog
          title="Xóa sân khỏi cơ sở?"
          item={deleting}
          description="Sân có yêu cầu đang giữ chỗ hoặc lịch sắp tới không thể xóa."
          remove={() => courtApi.remove(deleting.id, `"${deleting.version}"`)}
          onClose={() => setDeleting(null)}
          onSaved={() => {
            setDeleting(null);
            setPage(1);
            reload();
          }}
        />
      )}
    </>
  );
}
function OwnerBookings({ venueId }) {
  const [date, setDate] = useState(addDays(localDate(), 1)),
    [status, setStatus] = useState(''),
    [page, setPage] = useState(1),
    [busy, setBusy] = useState(''),
    [error, setError] = useState(null);
  const resource = useResource(
    (signal) => bookingApi.forVenue(venueId, { date, status, page, limit: 8 }, signal),
    [venueId, date, status, page],
  );
  async function act(id, action) {
    setBusy(id);
    setError(null);
    try {
      await bookingApi[action](id);
      resource.reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy('');
    }
  }
  return (
    <>
      <div className="owner-booking-filters">
        <Field label="Ngày chơi">
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setPage(1);
            }}
          />
        </Field>
        <Field label="Trạng thái">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(bookingLabels).map(([v, name]) => (
              <option key={v} value={v}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        <Button
          variant="outline"
          onClick={() => {
            setDate('');
            setStatus('');
            setPage(1);
          }}
        >
          Xem mọi ngày
        </Button>
        <button className="text-button" onClick={resource.reload}>
          Làm mới
        </button>
      </div>
      <ErrorBox error={error} />
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorBox error={resource.error} retry={resource.reload} />
      ) : !resource.data.data.length ? (
        <EmptyState icon={CalendarDays} title="Chưa có lịch trong bộ lọc này">
          Chọn ngày khác hoặc xem mọi ngày.
        </EmptyState>
      ) : (
        <div className="owner-booking-list">
          {resource.data.data.map((b) => (
            <article className="surface owner-booking-card" key={b.id}>
              <div>
                <div className="booking-card-top">
                  <Status value={b.status} />
                  <small>{b.code}</small>
                </div>
                <h3>
                  {b.courtName} · {courtLabel(b)}
                </h3>
                <p>
                  {displayDate(b.startTime)} · {clockTime(b.startTime)}–{clockTime(b.endTime)}
                </p>
                <small>
                  {b.contactName} · {b.contactPhone}
                </small>
              </div>
              <div className="owner-booking-actions">
                <strong>{money(b.totalPrice)}</strong>
                <Status value={b.paymentStatus} payment />
                <div className="button-row">
                  {b.status === 'pending' && (
                    <Button
                      loading={busy === b.id}
                      disabled={!!busy}
                      onClick={() => act(b.id, 'confirm')}
                    >
                      Xác nhận
                    </Button>
                  )}
                  {b.status === 'confirmed' && Date.parse(b.endTime) <= Date.now() && (
                    <Button
                      loading={busy === b.id}
                      disabled={!!busy}
                      onClick={() => act(b.id, 'complete')}
                    >
                      Hoàn thành
                    </Button>
                  )}
                  <Link className="button outline" to={`/lich-dat/${b.id}`}>
                    Chi tiết
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <Pagination result={resource.data} onPage={setPage} />
    </>
  );
}
function DeleteDialog({ title, item, description, remove, onClose, onSaved }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await remove();
      onSaved();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={title} onClose={onClose}>
      <p>
        <strong>{item.name}</strong>
      </p>
      <p>{description}</p>
      <ErrorBox error={error} />
      <div className="button-row">
        <Button variant="outline" onClick={onClose}>
          Quay lại
        </Button>
        <Button variant="danger" loading={busy} onClick={submit}>
          Xác nhận xóa
        </Button>
      </div>
    </Modal>
  );
}
function VenueForm({ venue: v, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: v.name || '',
    address: v.address || '',
    city: v.city || 'Hà Nội',
    district: v.district || '',
    description: v.description || '',
    openTime: v.openTime || '06:00',
    closeTime: v.closeTime || '23:00',
    timezone: v.timezone || 'Asia/Ho_Chi_Minh',
    status: v.status || 'active',
    amenities: v.amenities || ['parking', 'lights'],
    imageKey: v.imageKey || 'pitch-1',
  });
  const [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  const change = (k, val) => setForm((f) => ({ ...f, [k]: val }));
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (v.id) await venueApi.update(v.id, form, `"${v.version}"`);
      else await venueApi.create(form);
      onSaved();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={v.id ? 'Sửa thông tin cơ sở' : 'Thêm cơ sở thể thao'} onClose={onClose} wide>
      <form className="form-stack" onSubmit={submit}>
        <Field label="Tên cơ sở">
          <input
            required
            minLength={3}
            maxLength={100}
            value={form.name}
            onChange={(e) => change('name', e.target.value)}
          />
        </Field>
        <div className="form-columns">
          <Field label="Thành phố">
            <input required value={form.city} onChange={(e) => change('city', e.target.value)} />
          </Field>
          <Field label="Khu vực / quận">
            <input
              required
              value={form.district}
              onChange={(e) => change('district', e.target.value)}
            />
          </Field>
        </div>
        <Field label="Địa chỉ">
          <input
            required
            minLength={5}
            maxLength={250}
            value={form.address}
            onChange={(e) => change('address', e.target.value)}
          />
        </Field>
        <div className="form-columns">
          <Field label="Giờ mở cửa">
            <input
              required
              type="time"
              step={1800}
              value={form.openTime}
              onChange={(e) => change('openTime', e.target.value)}
            />
          </Field>
          <Field label="Giờ đóng cửa">
            <input
              required
              type="time"
              step={1800}
              value={form.closeTime}
              onChange={(e) => change('closeTime', e.target.value)}
            />
          </Field>
        </div>
        <small className="muted">Giờ Việt Nam, mở/đóng cùng ngày, bước 30 phút.</small>
        <Field label="Giới thiệu">
          <textarea
            required
            minLength={10}
            maxLength={2000}
            rows={3}
            value={form.description}
            onChange={(e) => change('description', e.target.value)}
          />
        </Field>
        <fieldset className="amenity-checkboxes">
          <legend>Tiện ích chung</legend>
          {Object.entries(amenities).map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={form.amenities.includes(key)}
                onChange={(e) =>
                  change(
                    'amenities',
                    e.target.checked
                      ? [...form.amenities, key]
                      : form.amenities.filter((x) => x !== key),
                  )
                }
              />
              {label}
            </label>
          ))}
        </fieldset>
        <Field label="Trạng thái cơ sở">
          <select value={form.status} onChange={(e) => change('status', e.target.value)}>
            <option value="active">Đang hoạt động</option>
            <option value="inactive">Tạm ngừng nhận đặt mới</option>
          </select>
        </Field>
        <ErrorBox error={error} />
        <Button type="submit" loading={busy}>
          Lưu cơ sở
        </Button>
      </form>
    </Modal>
  );
}
function CourtForm({ court: c, venue, onClose, onSaved }) {
  const sports = useResource((signal) => sportApi.list(signal), []);
  const [form, setForm] = useState({
    name: c.name || '',
    sportTypeId: c.sportTypeId || '',
    teamSize: c.teamSize ?? null,
    basePricePerHour: c.basePricePerHour || 250000,
    description: c.description || '',
    imageKey: c.imageKey || venue.imageKey,
    status: c.status || 'active',
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  const change = (k, val) => setForm((f) => ({ ...f, [k]: val }));
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (c.id) await courtApi.update(c.id, form, `"${c.version}"`);
      else await courtApi.create(venue.id, form);
      onSaved();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={c.id ? 'Sửa sân trong cơ sở' : 'Thêm sân riêng biệt'} onClose={onClose} wide>
      <p className="muted">Thuộc {venue.name}</p>
      <form className="form-stack" onSubmit={submit}>
        <Field label="Tên sân">
          <input
            required
            minLength={3}
            maxLength={100}
            value={form.name}
            onChange={(e) => change('name', e.target.value)}
            placeholder="Sân số 1"
          />
        </Field>
        <div className="form-columns">
          <Field label="Môn thể thao">
            <select
              required
              value={form.sportTypeId}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  sportTypeId: e.target.value,
                  teamSize: null,
                }))
              }
            >
              <option value="">Chọn môn thể thao</option>
              {sports.data?.data.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Số người mỗi đội">
            <select
              value={form.teamSize || ''}
              onChange={(e) => change('teamSize', e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Không áp dụng</option>
              {[5, 7, 11].map((n) => (
                <option key={n} value={n}>
                  {n} người
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Giá cơ bản / giờ (VND)">
          <input
            required
            type="number"
            min={50000}
            max={3000000}
            step={1000}
            value={form.basePricePerHour}
            onChange={(e) => change('basePricePerHour', Number(e.target.value))}
          />
        </Field>
        <Field label="Mô tả riêng của sân">
          <textarea
            required
            minLength={10}
            maxLength={2000}
            rows={3}
            value={form.description}
            onChange={(e) => change('description', e.target.value)}
          />
        </Field>
        <Field label="Trạng thái sân">
          <select value={form.status} onChange={(e) => change('status', e.target.value)}>
            <option value="active">Đang hoạt động</option>
            <option value="inactive">Tạm ngừng</option>
          </select>
        </Field>
        <ErrorBox error={sports.error || error} />
        <Button loading={busy} disabled={!sports.data} type="submit">
          Lưu sân
        </Button>
      </form>
    </Modal>
  );
}
