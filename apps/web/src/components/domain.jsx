import { Button } from './ui';
export const bookingLabels = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  completed: 'Đã hoàn thành',
  cancelled: 'Đã hủy',
  expired: 'Hết hạn',
};
export const paymentLabels = {
  unpaid: 'Chưa thanh toán',
  pending: 'Đang chờ thanh toán',
  paid: 'Đã thanh toán',
  succeeded: 'Thành công',
  failed: 'Không thành công',
  refund_pending: 'Chờ hoàn tiền',
  refunded: 'Đã hoàn tiền',
};
export const courtLabel = (court) =>
  court.teamSize ? `${court.sportName || 'Bóng đá'} · ${court.teamSize} người` : court.sportName;
export function Status({ value, payment = false }) {
  return (
    <span className={`status ${value}`}>
      {(payment ? paymentLabels : bookingLabels)[value] || value}
    </span>
  );
}
export function Pagination({ result, onPage }) {
  if (!result || (result.meta.totalPages <= 1 && result.meta.page === 1)) return null;
  return (
    <div className="cursor-nav">
      <Button
        variant="outline"
        disabled={!result.links.prev}
        onClick={() => onPage(result.meta.page - 1)}
      >
        Trang trước
      </Button>
      <span>
        Trang {result.meta.page} / {Math.max(1, result.meta.totalPages)}
      </span>
      <Button
        variant="outline"
        disabled={!result.links.next}
        onClick={() => onPage(result.meta.page + 1)}
      >
        Trang sau
      </Button>
    </div>
  );
}
