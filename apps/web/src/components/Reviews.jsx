import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { reviewApi } from '../api/services';
import { useResource } from '../hooks/useResource';
import { useAuth } from '../context/AuthContext';
import { Button, Field, ErrorBox, Loading, EmptyState, Modal } from './ui';
import { Pagination } from './domain';
import { displayDate } from '../../../../packages/shared/time';
export function ReviewForm({ venueId, bookingId, review, onClose, onSaved }) {
  const [rating, setRating] = useState(review?.rating || 5),
    [comment, setComment] = useState(review?.comment || ''),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (review) await reviewApi.update(review.id, { rating, comment });
      else await reviewApi.create(venueId, { bookingId, rating, comment });
      onSaved();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={review ? 'Sửa đánh giá của bạn' : 'Trận đấu vừa rồi thế nào?'} onClose={onClose}>
      <form className="form-stack" onSubmit={submit}>
        <Field label="Điểm đánh giá">
          <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} sao
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nhận xét">
          <textarea
            required
            rows={4}
            minLength={3}
            maxLength={1000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Chia sẻ về mặt sân, ánh sáng và trải nghiệm của đội bạn…"
          />
        </Field>
        <ErrorBox error={error} />
        <Button type="submit" loading={busy}>
          Lưu đánh giá
        </Button>
      </form>
    </Modal>
  );
}
export default function Reviews({ venueId, onChanged }) {
  const { user } = useAuth();
  const [page, setPage] = useState(1),
    [editing, setEditing] = useState(null),
    [deleting, setDeleting] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  const resource = useResource(
    (signal) => reviewApi.list(venueId, { page, limit: 6 }, signal),
    [venueId, page],
  );
  function saved() {
    setEditing(null);
    resource.reload();
    onChanged?.();
  }
  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await reviewApi.remove(deleting.id);
      setDeleting(null);
      setPage(1);
      resource.reload();
      onChanged?.();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="reviews-section">
      <div className="section-heading">
        <div>
          <div className="eyebrow muted">TỪ NHỮNG TRẬN ĐẤU THẬT</div>
          <h2>Đội bạn nói gì?</h2>
          <p className="muted">Đánh giá gắn với lịch đã hoàn thành.</p>
        </div>
        <Link className="button outline" to="/lich-dat?status=completed">
          Đánh giá từ lịch của tôi
        </Link>
      </div>
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorBox error={resource.error} retry={resource.reload} />
      ) : resource.data.data.length ? (
        <div className="review-grid">
          {resource.data.data.map((r) => (
            <article className="surface review-card" key={r.id}>
              <div className="review-heading">
                <strong>{r.fullName}</strong>
                <span>
                  <Star size={15} fill="currentColor" /> {r.rating}/5
                </span>
              </div>
              <p>{r.comment}</p>
              <small className="muted">{displayDate(r.createdAt)} · Đã trải nghiệm sân</small>
              {user?.id === r.userId && (
                <div className="button-row">
                  <button className="text-button" onClick={() => setEditing(r)}>
                    Sửa đánh giá
                  </button>
                  <button
                    className="text-button danger-text"
                    onClick={() => {
                      setError(null);
                      setDeleting(r);
                    }}
                  >
                    Xóa đánh giá
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="Cơ sở chưa có đánh giá">
          Bạn có thể viết nhận xét sau khi hoàn thành lịch chơi.
        </EmptyState>
      )}
      <Pagination result={resource.data} onPage={setPage} />
      {editing && (
        <ReviewForm
          venueId={venueId}
          review={editing}
          onClose={() => setEditing(null)}
          onSaved={saved}
        />
      )}
      {deleting && (
        <Modal title="Xóa đánh giá của bạn?" onClose={() => setDeleting(null)}>
          <p>Bạn có thể viết lại đánh giá từ lịch đã hoàn thành.</p>
          <ErrorBox error={error} />
          <Button variant="danger" loading={busy} onClick={remove}>
            Xóa đánh giá
          </Button>
        </Modal>
      )}
    </section>
  );
}
