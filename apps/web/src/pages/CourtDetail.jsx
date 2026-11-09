import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Clock3,
  Check,
  ShieldCheck,
  CalendarDays,
  CircleCheck,
} from 'lucide-react';
import { courtApi, venueApi, bookingApi } from '../api/services';
import { useResource } from '../hooks/useResource';
import { useAuth } from '../context/AuthContext';
import { Button, ErrorBox, Loading, Field, imageFor, amenities } from '../components/ui';
import { courtLabel } from '../components/domain';
import {
  localDate,
  addDays,
  money,
  clockTime,
  displayDate,
  bookingDate,
} from '../../../../packages/shared/time';

export default function CourtDetail() {
  const { id } = useParams(),
    [params, setParams] = useSearchParams(),
    { user, openLogin } = useAuth();
  const date = bookingDate(params.get('date'));
  const court = useResource((signal) => courtApi.get(id, signal), [id, user?.id]);
  const venueId = court.data?.data.venueId;
  const venue = useResource(
    (signal) => (venueId ? venueApi.get(venueId, signal) : Promise.resolve(null)),
    [venueId, user?.id],
  );
  const availability = useResource(
    (signal) => courtApi.availability(id, date, signal),
    [id, date, user?.id],
  );
  const [start, setStart] = useState(''),
    [duration, setDuration] = useState(60),
    [note, setNote] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [booking, setBooking] = useState(null);
  const end = start ? new Date(Date.parse(start) + duration * 60000).toISOString() : '';
  const quote = useResource(
    (signal) => (start ? courtApi.quote(id, start, end, signal) : Promise.resolve(null)),
    [id, start, end],
  );
  const attempt = useRef(null);
  useEffect(() => {
    setStart('');
    setBooking(null);
    setError(null);
    attempt.current = null;
  }, [id, date]);
  function selectable(slot) {
    const slots = availability.data?.data.slots || [];
    const a = Date.parse(slot.startTime),
      z = a + duration * 60000;
    const parts = slots.filter((s) => Date.parse(s.startTime) >= a && Date.parse(s.startTime) < z);
    return parts.length === duration / 30 && parts.every((s) => s.available);
  }
  async function book(e) {
    e.preventDefault();
    if (!user) return openLogin();
    if (!quote.data?.data.available || busy || quote.loading) return;
    const body = { courtId: id, startTime: start, endTime: end, note },
      fingerprint = JSON.stringify(body);
    if (attempt.current?.fingerprint !== fingerprint)
      attempt.current = { fingerprint, key: crypto.randomUUID() };
    setBusy(true);
    setError(null);
    try {
      const result = await bookingApi.create(body, attempt.current.key);
      setBooking(result.data);
      availability.reload();
    } catch (e) {
      setError(e);
      if (e.status === 409) {
        availability.reload();
        quote.reload();
      }
    } finally {
      setBusy(false);
    }
  }
  if (court.loading || (!court.error && !venue.error && (!venue.data || venue.loading)))
    return (
      <div className="container page">
        <Loading />
      </div>
    );
  if (court.error || venue.error)
    return (
      <div className="container page">
        <Link className="back-link" to="/">
          ← Tìm cơ sở
        </Link>
        <ErrorBox
          error={court.error || venue.error}
          retry={() => {
            court.reload();
            venue.reload();
          }}
        />
      </div>
    );
  const c = court.data.data,
    v = venue.data.data,
    q = quote.data?.data;
  return (
    <div className="container page detail-page">
      <Link className="back-link" to={`/co-so/${v.id}?date=${date}`}>
        <ArrowLeft size={16} />
        {v.name} · Chọn sân khác
      </Link>
      <div className="detail-heading">
        <div>
          <div className="eyebrow muted">{v.name} / CHỌN GIỜ CHƠI</div>
          <h1>
            {c.name} · {courtLabel(c)}
          </h1>
          <p>
            <MapPin size={17} />
            {v.address}
          </p>
        </div>
        <span className="tiny-badge">
          <Clock3 size={15} /> {v.openTime}–{v.closeTime}
        </span>
      </div>
      <div className="detail-photo">
        <img src={imageFor(c.imageKey)} alt={`Ảnh minh họa ${c.name}`} />
        <span>{courtLabel(c)}</span>
        <small>Ảnh minh họa</small>
      </div>
      <div className="detail-layout">
        <div>
          <section className="detail-section">
            <h2>Một sân tốt cho cả đội</h2>
            <p className="body-copy">{c.description}</p>
            <div className="amenities">
              {v.amenities.map((key) => (
                <span key={key}>
                  <Check size={17} />
                  {amenities[key]}
                </span>
              ))}
            </div>
          </section>
          <section className="detail-section">
            <div className="slot-heading">
              <div>
                <h2>Chọn giờ cho {c.name}</h2>
                <p className="muted">Bước 30 phút · Giờ Việt Nam · Lịch riêng của sân này</p>
              </div>
              <Field label="Ngày chơi">
                <input
                  required
                  type="date"
                  value={date}
                  min={localDate()}
                  max={addDays(localDate(), 30)}
                  onChange={(e) => setParams({ date: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Thời lượng trận đấu">
              <select
                value={duration}
                onChange={(e) => {
                  setDuration(Number(e.target.value));
                  setStart('');
                  setBooking(null);
                  setError(null);
                }}
              >
                {[30, 60, 90, 120, 150, 180].map((n) => (
                  <option key={n} value={n}>
                    {n} phút
                  </option>
                ))}
              </select>
            </Field>
            <div className="slot-legend">
              <span>
                <i className="available" />
                Còn trống
              </span>
              <span>
                <i className="selected" />
                Đang chọn
              </span>
              <span>
                <i />
                Không đủ thời lượng
              </span>
            </div>
            {availability.loading ? (
              <Loading />
            ) : availability.error ? (
              <ErrorBox error={availability.error} retry={availability.reload} />
            ) : (
              <div className="slots">
                {availability.data.data.slots.map((slot) => {
                  const available = selectable(slot);
                  return (
                    <button
                      key={slot.startTime}
                      className={start === slot.startTime ? 'slot selected' : 'slot'}
                      disabled={!available || busy}
                      aria-pressed={start === slot.startTime}
                      onClick={() => {
                        setStart(slot.startTime);
                        setError(null);
                        setBooking(null);
                      }}
                    >
                      <strong>
                        {clockTime(slot.startTime)} –{' '}
                        {clockTime(
                          new Date(Date.parse(slot.startTime) + duration * 60000).toISOString(),
                        )}
                      </strong>
                      <span>{available ? 'Còn trống' : 'Không khả dụng'}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <p className="info-note">
              Giá được báo theo giờ bắt đầu và thời lượng. Giờ cao điểm 17:00–22:00 phụ thu
              100.000đ/giờ.
            </p>
          </section>
          <section className="detail-section policy-section">
            <ShieldCheck size={25} />
            <div>
              <h3>Rõ ràng trước khi ra sân</h3>
              <p>
                Chủ sân xác nhận yêu cầu trước khi bạn thanh toán. Yêu cầu chờ được giữ tối đa 30
                phút. Hủy lịch trước giờ chơi ít nhất 2 tiếng.
              </p>
            </div>
          </section>
        </div>
        <aside className="booking-panel">
          {booking ? (
            <div className="booking-success" role="status">
              <div>
                <CircleCheck size={36} />
              </div>
              <span className="eyebrow">ĐÃ GỬI YÊU CẦU</span>
              <h2>Chờ chủ sân xác nhận.</h2>
              <p>
                {booking.venueName} · {booking.courtName}
              </p>
              <div className="booking-summary">
                <span>
                  <CalendarDays size={16} />
                  {displayDate(booking.startTime)}
                </span>
                <span>
                  <Clock3 size={16} />
                  {clockTime(booking.startTime)}–{clockTime(booking.endTime)}
                </span>
                <strong>{money(booking.totalPrice)}</strong>
              </div>
              <p className="fine-print">
                Giữ chỗ đến {clockTime(booking.expiresAt)} ngày {displayDate(booking.expiresAt)}.
              </p>
              <Link className="button primary" to={`/lich-dat/${booking.id}`}>
                Theo dõi yêu cầu <ArrowRight size={17} />
              </Link>
            </div>
          ) : (
            <>
              <div className="booking-panel-heading">
                <div>
                  <small>Giá cơ bản từ</small>
                  <h2>
                    {money(c.basePricePerHour)}
                    <span> / giờ</span>
                  </h2>
                </div>
                <span className="tiny-badge">{duration} phút</span>
              </div>
              <form onSubmit={book} className="form-stack">
                <div className="selected-summary">
                  <strong>
                    {v.name} · {c.name}
                  </strong>
                  <span>{displayDate(date)}</span>
                  <strong>
                    {start ? `${clockTime(start)}–${clockTime(end)}` : 'Chọn giờ bắt đầu bên cạnh'}
                  </strong>
                </div>
                {user && (
                  <div className="contact-preview">
                    <span>Liên hệ: {user.fullName}</span>
                    <strong>{user.phone || 'Chưa có số điện thoại'}</strong>
                    <Link to="/tai-khoan" className="text-button">
                      Sửa thông tin liên hệ
                    </Link>
                  </div>
                )}
                <Field label="Ghi chú cho chủ sân">
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Đội mình cần thuê thêm áo tập…"
                  />
                </Field>
                {start && quote.loading ? (
                  <Loading />
                ) : (
                  <ErrorBox error={quote.error} retry={quote.reload} />
                )}
                {q && !q.available && (
                  <p className="error-box" role="alert">
                    Giờ này vừa được giữ. Chọn khung giờ khác.
                  </p>
                )}
                <div className="total-row">
                  <span>Tổng báo giá</span>
                  <strong>{q && !quote.loading ? money(q.totalPrice) : '—'}</strong>
                </div>
                <ErrorBox error={error} />
                {user ? (
                  <Button
                    type="submit"
                    loading={busy}
                    disabled={
                      !q?.available || quote.loading || user.role !== 'CUSTOMER' || !user.phone
                    }
                  >
                    Gửi yêu cầu đặt sân <ArrowRight size={17} />
                  </Button>
                ) : (
                  <Button type="button" onClick={openLogin}>
                    Đăng nhập để đặt sân
                  </Button>
                )}
                <p className="fine-print">
                  {user && user.role !== 'CUSTOMER'
                    ? 'Dùng tài khoản người chơi để đặt sân.'
                    : 'Báo giá chưa giữ sân. Thanh toán sau khi được xác nhận.'}
                </p>
              </form>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
