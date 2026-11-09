import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  CreditCard,
  RefreshCw,
  Star,
  ShieldCheck,
} from 'lucide-react';
import { bookingApi, paymentApi } from '../api/services';
import { API_MODE } from '../api/client';
import { useResource } from '../hooks/useResource';
import { useAuth } from '../context/AuthContext';
import { Button, ErrorBox, Loading, EmptyState, Modal, Field, imageFor } from '../components/ui';
import { Status, courtLabel } from '../components/domain';
import { ReviewForm } from '../components/Reviews';
import { money, clockTime, displayDate } from '../../../../packages/shared/time';

export default function BookingDetail() {
  const { id } = useParams(),
    { user, openLogin } = useAuth();
  return (
    <div className="container page">
      <Link className="back-link" to={user?.role === 'OWNER' ? '/chu-san' : '/lich-dat'}>
        <ArrowLeft size={16} />
        {user?.role === 'OWNER' ? 'Quản lý cơ sở' : 'Lịch đặt của tôi'}
      </Link>
      {user ? (
        <Detail key={`${id}:${user.id}`} id={id} user={user} />
      ) : (
        <EmptyState
          title="Đăng nhập để xem lịch đặt"
          action={<Button onClick={openLogin}>Đăng nhập</Button>}
        />
      )}
    </div>
  );
}
function Detail({ id, user }) {
  const booking = useResource((signal) => bookingApi.get(id, signal), [id]);
  const payments = useResource((signal) => paymentApi.list(id, signal), [id]);
  const [cancel, setCancel] = useState(false),
    [review, setReview] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [success, setSuccess] = useState(''),
    [method, setMethod] = useState('bank_transfer');
  const paymentAttempt = useRef(null);
  const b = booking.data?.data;
  useEffect(() => {
    if (b?.status !== 'pending') return;
    const timer = setTimeout(
      () => booking.reload(),
      Math.min(30000, Math.max(1000, Date.parse(b.expiresAt) - Date.now() + 100)),
    );
    return () => clearTimeout(timer);
  }, [b, booking.reload]);
  function reload() {
    booking.reload();
    payments.reload();
  }
  async function act(fn, message) {
    setBusy(true);
    setError(null);
    setSuccess('');
    try {
      await fn();
      setSuccess(message);
      reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function pay() {
    if (paymentAttempt.current?.method !== method)
      paymentAttempt.current = { method, key: crypto.randomUUID() };
    await act(
      () => paymentApi.create(id, method, paymentAttempt.current.key),
      'Đã tạo lượt thanh toán. Theo dõi kết quả bên dưới.',
    );
  }
  async function settle(paymentId, outcome) {
    await act(
      async () => {
        const { mockTransport } = await import('../mocks/transport.js');
        mockTransport.settlePayment(paymentId, outcome);
        paymentAttempt.current = null;
      },
      outcome === 'succeeded'
        ? 'Đã mô phỏng thanh toán thành công; không phát sinh tiền thật.'
        : 'Đã mô phỏng thất bại. Bạn có thể thử lại.',
    );
  }
  if (booking.loading) return <Loading />;
  if (booking.error) return <ErrorBox error={booking.error} retry={booking.reload} />;
  const mine = b.userId === user.id,
    owner = user.role === 'OWNER' && !mine;
  const cancellable =
    ['pending', 'confirmed'].includes(b.status) &&
    Date.parse(b.startTime) - Date.now() >= (owner ? 0 : 7200000);
  return (
    <>
      <div className="detail-heading">
        <div>
          <div className="eyebrow muted">LỊCH ĐẶT / {b.code}</div>
          <h1>{b.venueName}</h1>
          <p>
            {b.courtName} · {courtLabel(b)}
          </p>
        </div>
        <Status value={b.status} />
      </div>
      <div className="reservation-layout">
        <div>
          <article className="surface reservation-card">
            <img className="reservation-image" src={imageFor(b.imageKey)} alt="Ảnh sân minh họa" />
            <div className="reservation-body">
              <div className="booking-meta">
                <span>
                  <CalendarDays size={18} />
                  {displayDate(b.startTime)}
                </span>
                <span>
                  <Clock3 size={18} />
                  {clockTime(b.startTime)}–{clockTime(b.endTime)}
                </span>
              </div>
              <p>{b.address}</p>
              <dl className="detail-list">
                <div>
                  <dt>Người liên hệ</dt>
                  <dd>{b.contactName}</dd>
                </div>
                <div>
                  <dt>Điện thoại</dt>
                  <dd>{b.contactPhone}</dd>
                </div>
                <div>
                  <dt>Ghi chú</dt>
                  <dd>{b.note || 'Không có ghi chú'}</dd>
                </div>
                <div>
                  <dt>Trạng thái thanh toán</dt>
                  <dd>
                    <Status value={b.paymentStatus} payment />
                  </dd>
                </div>
              </dl>
              {b.status === 'pending' && (
                <p className="info-note">
                  Chờ chủ sân xác nhận. Giữ chỗ đến {clockTime(b.expiresAt)} ngày{' '}
                  {displayDate(b.expiresAt)}; sau thời điểm này yêu cầu hết hạn.
                </p>
              )}
              {b.status === 'cancelled' && (
                <p className="info-note">Lý do hủy: {b.cancelReason || 'Lịch đã được hủy.'}</p>
              )}
              {b.paymentStatus === 'refund_pending' && (
                <p className="info-note">Khoản đã trả đang chờ chủ sân xử lý hoàn tiền.</p>
              )}
              <Link className="text-button" to={`/san/${b.courtId}`}>
                Xem sân và lịch trống →
              </Link>
            </div>
          </article>
          <section className="surface payment-history">
            <div className="section-heading">
              <h2>Lịch sử thanh toán</h2>
              <button className="text-button" onClick={reload}>
                <RefreshCw size={15} /> Cập nhật
              </button>
            </div>
            {payments.loading ? (
              <Loading />
            ) : payments.error ? (
              <ErrorBox error={payments.error} retry={payments.reload} />
            ) : !payments.data.data.length ? (
              <p className="muted">Chưa có lượt thanh toán nào.</p>
            ) : (
              payments.data.data.map((p) => (
                <div className="payment-row" key={p.id}>
                  <div>
                    <strong>{money(p.amount)}</strong>
                    <p>
                      {p.method === 'cash' ? 'Thanh toán tại sân' : 'Chuyển khoản'} ·{' '}
                      {displayDate(p.createdAt)}
                    </p>
                    <small>{p.transactionRef || 'Chưa có mã giao dịch'}</small>
                  </div>
                  <div>
                    <Status value={p.status} payment />
                    {p.status === 'pending' && /^https?:\/\//.test(p.checkoutUrl || '') && (
                      <a
                        className="button outline"
                        href={p.checkoutUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Mở trang thanh toán
                      </a>
                    )}
                    {API_MODE === 'mock' && p.status === 'pending' && mine && (
                      <div className="demo-payment-actions">
                        <small>Mô phỏng · không thu tiền</small>
                        <Button
                          variant="outline"
                          loading={busy}
                          onClick={() => settle(p.id, 'succeeded')}
                        >
                          Giả lập thành công
                        </Button>
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() => settle(p.id, 'failed')}
                        >
                          Giả lập thất bại
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </section>
        </div>
        <aside className="surface reservation-actions">
          <div className="eyebrow muted">CHI TIẾT CHI PHÍ</div>
          <div className="total-row">
            <span>Tổng tiền</span>
            <strong>{money(b.totalPrice)}</strong>
          </div>
          <Status value={b.paymentStatus} payment />
          <p className="muted">Giá đã chốt cho sân và thời lượng trong lịch này.</p>
          {owner && b.status === 'pending' && (
            <Button
              loading={busy}
              onClick={() => act(() => bookingApi.confirm(id), 'Đã xác nhận lịch đặt.')}
            >
              Xác nhận yêu cầu
            </Button>
          )}
          {owner && b.status === 'confirmed' && (
            <>
              <Button
                loading={busy}
                disabled={Date.parse(b.endTime) > Date.now()}
                onClick={() => act(() => bookingApi.complete(id), 'Đã đánh dấu hoàn thành.')}
              >
                Đánh dấu hoàn thành
              </Button>
              {Date.parse(b.endTime) > Date.now() && (
                <small className="muted">Có thể hoàn thành sau giờ kết thúc.</small>
              )}
            </>
          )}
          {mine && b.status === 'confirmed' && b.paymentStatus === 'unpaid' && (
            <div className="form-stack">
              <Field label="Phương thức thanh toán">
                <select value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="bank_transfer">Chuyển khoản</option>
                  <option value="cash">Thanh toán tại sân</option>
                </select>
              </Field>
              <Button loading={busy} onClick={pay}>
                <CreditCard size={17} />
                Tạo lượt thanh toán
              </Button>
            </div>
          )}
          {mine && b.status === 'pending' && (
            <p className="info-note">Thanh toán sẽ mở khi chủ sân xác nhận yêu cầu.</p>
          )}
          {cancellable && (
            <Button variant="outline" disabled={busy} onClick={() => setCancel(true)}>
              Hủy lịch đặt
            </Button>
          )}
          {mine && b.status === 'completed' && (
            <Button variant="outline" onClick={() => setReview(true)}>
              <Star size={17} />
              {b.review ? 'Sửa đánh giá' : 'Viết đánh giá'}
            </Button>
          )}
          {mine && b.review && (
            <Link to={`/co-so/${b.venueId}`} className="text-button">
              Xem đánh giá tại cơ sở →
            </Link>
          )}
          <p className="fine-print">
            <ShieldCheck size={15} />
            {API_MODE === 'mock'
              ? 'Đây là lịch và thanh toán mô phỏng.'
              : 'Kết quả thanh toán được xác nhận bởi hệ thống.'}
          </p>
          <ErrorBox error={error} />
          {success && (
            <p className="success-notice" role="status">
              {success}
            </p>
          )}
        </aside>
      </div>
      {cancel && (
        <CancelModal
          booking={b}
          owner={owner}
          onClose={() => setCancel(false)}
          onSaved={() => {
            setCancel(false);
            setSuccess('Đã hủy lịch đặt.');
            setError(null);
            reload();
          }}
        />
      )}
      {review && (
        <ReviewForm
          venueId={b.venueId}
          bookingId={b.id}
          review={b.review}
          onClose={() => setReview(false)}
          onSaved={() => {
            setReview(false);
            booking.reload();
            setSuccess('Đã lưu đánh giá của bạn.');
          }}
        />
      )}
    </>
  );
}
export function CancelModal({ booking, owner, onClose, onSaved }) {
  const [reason, setReason] = useState(''),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await bookingApi.cancel(booking.id, reason);
      onSaved();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Hủy lịch đặt này?" onClose={onClose}>
      <p>
        {booking.venueName} · {booking.courtName} · {displayDate(booking.startTime)}{' '}
        {clockTime(booking.startTime)}
      </p>
      <p className="muted">
        {owner
          ? 'Chủ sân được hủy trước giờ bắt đầu.'
          : 'Có thể hủy trước giờ chơi ít nhất 2 tiếng.'}
        {booking.paymentStatus === 'paid' && ' Khoản đã trả sẽ chuyển sang chờ hoàn tiền.'}
      </p>
      <form className="form-stack" onSubmit={submit}>
        <Field label="Lý do hủy">
          <textarea
            required
            minLength={3}
            maxLength={300}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <ErrorBox error={error} />
        <Button variant="danger" type="submit" loading={busy}>
          Xác nhận hủy
        </Button>
      </form>
    </Modal>
  );
}
