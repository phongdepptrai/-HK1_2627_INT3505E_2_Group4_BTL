import { useEffect, useRef } from 'react';
import { X, AlertCircle, ArrowRight, CircleCheck, LoaderCircle } from 'lucide-react';
export function Button({
  children,
  className = '',
  loading = false,
  variant = 'primary',
  ...props
}) {
  return (
    <button
      className={`button ${variant} ${className}`}
      {...props}
      disabled={props.disabled || loading}
    >
      {loading ? <LoaderCircle size={17} className="spin" /> : null}
      {children}
    </button>
  );
}
export function Modal({ title, onClose, children, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      className={`modal ${wide ? 'wide' : ''}`}
      ref={ref}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      aria-labelledby="modal-title"
    >
      <div className="modal-inner">
        <div className="modal-heading">
          <h2 id="modal-title">{title}</h2>
          <button className="icon-button" aria-label="Đóng" onClick={onClose}>
            <X size={21} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export function ErrorBox({ error, retry }) {
  return error ? (
    <div className="error-box" role="alert">
      <AlertCircle size={20} />
      <div>
        <strong>Chưa thể hoàn tất</strong>
        <p>{error.message || error}</p>
        {error.problem?.requestId && <small>Mã yêu cầu: {error.problem.requestId}</small>}
        {retry && (
          <button onClick={retry} className="text-button">
            Thử lại <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  ) : null;
}
export function Loading({ cards = false }) {
  return (
    <div role="status" aria-label="Đang tải" className={cards ? 'pitch-grid' : 'loading-area'}>
      {cards ? (
        Array.from({ length: 6 }, (_, i) => (
          <div className="skeleton-card" key={i}>
            <div className="skeleton-photo" />
            <div className="skeleton-line" />
            <div className="skeleton-line short" />
          </div>
        ))
      ) : (
        <>
          <LoaderCircle className="spin" size={24} />
          <span>Đang tải dữ liệu…</span>
        </>
      )}
    </div>
  );
}
export function EmptyState({ icon: Icon = CircleCheck, title, children, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={30} />
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export const imageFor = (key) => `/images/${key === 'pitch-3' ? 'hero' : key}.jpg`;
export const districts = [
  'Cầu Giấy',
  'Nam Từ Liêm',
  'Bắc Từ Liêm',
  'Thanh Xuân',
  'Tây Hồ',
  'Hà Đông',
];
export const amenities = {
  parking: 'Bãi đỗ xe',
  lights: 'Đèn chiếu sáng',
  water: 'Nước uống',
  changing: 'Phòng thay đồ',
};
