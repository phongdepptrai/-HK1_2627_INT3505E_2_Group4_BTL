import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Star,
  Users,
  Goal,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import Reviews from '../components/Reviews';
import { courtLabel } from '../components/domain';
import { venueApi } from '../api/services';
import { useResource } from '../hooks/useResource';
import { useAuth } from '../context/AuthContext';
import { ErrorBox, Loading, EmptyState, Field, imageFor, amenities } from '../components/ui';
import { bookingDate, localDate, addDays, money } from '../../../../packages/shared/time';

export default function VenueDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const date = bookingDate(params.get('date')),
    type = params.get('teamSize') || '',
    page = Number(params.get('page')) || 1;
  const venue = useResource((signal) => venueApi.get(id, signal), [id, user?.id]);
  const pitches = useResource(
    (signal) =>
      venueApi.courts(
        id,
        { teamSize: type, sportTypeId: params.get('sportTypeId') || '', page, limit: 6 },
        signal,
      ),
    [id, type, page, params.get('sportTypeId'), user?.id],
  );
  function change(values) {
    const next = new URLSearchParams(params);
    next.delete('page');
    for (const [key, value] of Object.entries(values))
      value ? next.set(key, value) : next.delete(key);
    setParams(next, { preventScrollReset: true });
  }
  if (venue.loading)
    return (
      <div className="container page">
        <Loading />
      </div>
    );
  if (venue.error)
    return (
      <div className="container page">
        <Link className="back-link" to="/">
          <ArrowLeft size={16} /> Danh sách cơ sở
        </Link>
        <ErrorBox error={venue.error} retry={venue.reload} />
      </div>
    );
  const data = venue.data.data;
  return (
    <div className="container page venue-page">
      <Link className="back-link" to="/">
        <ArrowLeft size={16} /> Danh sách cơ sở
      </Link>
      <div className="detail-heading">
        <div>
          <div className="eyebrow muted">CƠ SỞ BÓNG ĐÁ / {data.district.toUpperCase()}</div>
          <h1>{data.name}</h1>
          <p>
            <MapPin size={17} />
            {data.address}
          </p>
        </div>
        <span className="rating-large">
          <Star size={18} fill="currentColor" />
          <strong>{data.rating.toFixed(1)}</strong>
          <span>{data.reviewCount} đánh giá</span>
        </span>
      </div>
      <p className="info-note">
        Mở cửa {data.openTime}–{data.closeTime} · {data.city}
      </p>
      <div className="venue-overview">
        <img src={imageFor(data.imageKey)} alt={`Hình ảnh minh họa ${data.name}`} />
        <div>
          <div className="eyebrow muted">MỘT ĐỊA ĐIỂM, NHIỀU LỰA CHỌN</div>
          <h2>{data.courtCount} sân riêng biệt</h2>
          <div className="venue-types">
            {data.courtTypes.map((item) => (
              <span key={`${item.sportTypeId}-${item.teamSize}`}>
                <Users size={16} />
                {item.count} sân {item.teamSize ? `${item.teamSize} người` : item.sportName}
              </span>
            ))}
          </div>
          <p className="body-copy">{data.description}</p>
          <div className="amenities">
            {data.amenities.map((key) => (
              <span key={key}>{amenities[key]}</span>
            ))}
          </div>
        </div>
      </div>
      <section className="venue-pitches">
        <div className="section-heading">
          <div>
            <div className="eyebrow muted">BƯỚC 1 / CHỌN SÂN TRONG CƠ SỞ</div>
            <h2>Đội bạn chọn sân nào?</h2>
            <p className="muted">Mỗi sân bên dưới có giá và lịch đặt độc lập.</p>
          </div>
          <Field label="Ngày ra sân">
            <input
              type="date"
              min={localDate()}
              max={addDays(localDate(), 30)}
              value={date}
              onChange={(event) => change({ date: event.target.value })}
            />
          </Field>
        </div>
        <div className="tabs" role="group" aria-label="Loại sân trong cơ sở">
          {[
            ['', 'Tất cả sân'],
            ...[...new Set(data.courtTypes.filter((t) => t.teamSize).map((t) => t.teamSize))].map(
              (size) => [String(size), `Sân ${size} người`],
            ),
          ].map(([value, label]) => (
            <button
              key={value}
              className={type === value ? 'active' : ''}
              aria-pressed={type === value}
              onClick={() => change({ teamSize: value, sportTypeId: '' })}
            >
              {label}
            </button>
          ))}
        </div>
        {pitches.loading ? (
          <Loading cards />
        ) : pitches.error ? (
          <ErrorBox error={pitches.error} retry={pitches.reload} />
        ) : !pitches.data.data.length ? (
          <EmptyState icon={Goal} title="Chưa có sân phù hợp">
            Chọn loại sân khác hoặc quay lại sau khi cơ sở cập nhật sân.
          </EmptyState>
        ) : (
          <>
            <div className="venue-pitch-grid">
              {pitches.data.data.map((pitch) => (
                <article className="physical-pitch-card" key={pitch.id}>
                  <div className="physical-pitch-image">
                    <img src={imageFor(pitch.imageKey)} alt={`Ảnh minh họa ${pitch.name}`} />
                    <span className="pitch-type">SÂN {courtLabel(pitch)}</span>
                  </div>
                  <div className="physical-pitch-body">
                    <span className="eyebrow muted">{data.name}</span>
                    <h3>{pitch.name}</h3>
                    <p>{pitch.description}</p>
                    <div className="physical-pitch-price">
                      <span>Giá cơ bản / giờ</span>
                      <strong>{money(pitch.basePricePerHour)}</strong>
                    </div>
                    <Link
                      className="button primary"
                      to={`/san/${pitch.id}?date=${date}`}
                      aria-label={`Chọn ${pitch.name} tại ${data.name}`}
                    >
                      Chọn sân & xem giờ trống <ArrowRight size={17} />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
            {pitches.data.meta.totalPages > 1 && (
              <div className="pagination">
                <span>
                  Trang {page} / {pitches.data.meta.totalPages}
                </span>
                <div>
                  <button
                    className="icon-button"
                    aria-label="Trang sân trước"
                    disabled={!pitches.data.links.prev}
                    onClick={() => change({ page: String(page - 1) })}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Trang sân tiếp theo"
                    disabled={!pitches.data.links.next}
                    onClick={() => change({ page: String(page + 1) })}
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
      <Reviews venueId={id} onChanged={venue.reload} />
    </div>
  );
}
