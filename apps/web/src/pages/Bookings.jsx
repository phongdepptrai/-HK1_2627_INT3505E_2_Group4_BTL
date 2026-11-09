import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, Clock3, CalendarCheck2 } from 'lucide-react';
import { bookingApi } from '../api/services';
import { useResource } from '../hooks/useResource';
import { useAuth } from '../context/AuthContext';
import { Button, EmptyState, Loading, ErrorBox, imageFor } from '../components/ui';
import { bookingLabels, Status, Pagination, courtLabel } from '../components/domain';
import { money, clockTime, displayDate } from '../../../../packages/shared/time';
export default function Bookings() {
  const { user, openLogin } = useAuth();
  return (
    <div className="container page bookings-page">
      <div className="page-heading">
        <div className="eyebrow muted">LỊCH CỦA ĐỘI BẠN</div>
        <h1>
          Những cuộc hẹn trên sân<span>.</span>
        </h1>
        <p>Theo dõi xác nhận, thanh toán và đánh giá sau mỗi trận đấu.</p>
      </div>
      {user ? (
        <BookingList key={user.id} />
      ) : (
        <EmptyState
          icon={CalendarCheck2}
          title="Lịch đặt đang đợi bạn"
          action={<Button onClick={openLogin}>Đăng nhập để xem lịch</Button>}
        >
          Đăng nhập để xem những sân bạn đã đặt.
        </EmptyState>
      )}
    </div>
  );
}
function BookingList() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '',
    page = Number(params.get('page')) || 1;
  const resource = useResource(
    (signal) => bookingApi.list({ status, page, limit: 6 }, signal),
    [status, page],
  );
  return (
    <>
      <div className="tabs" role="group" aria-label="Trạng thái lịch đặt">
        {[['', 'Tất cả'], ...Object.entries(bookingLabels)].map(([value, label]) => (
          <button
            key={value}
            className={status === value ? 'active' : ''}
            aria-pressed={status === value}
            onClick={() => setParams(value ? { status: value } : {})}
          >
            {label}
          </button>
        ))}
      </div>
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorBox error={resource.error} retry={resource.reload} />
      ) : !resource.data.data.length ? (
        <EmptyState
          icon={CalendarDays}
          title="Chưa có lịch đặt ở đây"
          action={
            <Link className="button primary" to="/">
              Tìm sân cho cả đội
            </Link>
          }
        >
          Thử trạng thái khác hoặc lên lịch cho trận tiếp theo.
        </EmptyState>
      ) : (
        <div className="booking-list">
          {resource.data.data.map((item) => (
            <article className="booking-card" key={item.id}>
              <img src={imageFor(item.imageKey)} alt="Sân minh họa" />
              <div className="booking-card-main">
                <div className="booking-card-top">
                  <Status value={item.status} />
                  <span className="booking-code">{item.code}</span>
                </div>
                <h2>{item.venueName}</h2>
                <p className="booking-physical-pitch">
                  {item.courtName} · {courtLabel(item)}
                </p>
                <div className="booking-meta">
                  <span>
                    <CalendarDays size={16} />
                    {displayDate(item.startTime)}
                  </span>
                  <span>
                    <Clock3 size={16} />
                    {clockTime(item.startTime)}–{clockTime(item.endTime)}
                  </span>
                </div>
                {item.status === 'pending' && (
                  <small>
                    Giữ chỗ đến {clockTime(item.expiresAt)} ngày {displayDate(item.expiresAt)}
                  </small>
                )}
              </div>
              <div className="booking-card-actions">
                <strong>{money(item.totalPrice)}</strong>
                <Status value={item.paymentStatus} payment />
                <Link className="button outline" to={`/lich-dat/${item.id}`}>
                  Chi tiết lịch đặt →
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
      <Pagination
        result={resource.data}
        onPage={(page) => setParams({ ...(status ? { status } : {}), page })}
      />
    </>
  );
}
