import { Link } from 'react-router-dom';
import { Search, CalendarCheck2, Goal, ArrowUpRight } from 'lucide-react';
export default function Guide() {
  return (
    <div className="container page guide-page">
      <div className="page-heading">
        <div className="eyebrow muted">TỪ LÊN KÈO ĐẾN RA SÂN</div>
        <h1>
          Ba bước. Một trận bóng hay<span>.</span>
        </h1>
        <p>Ít thời gian tìm sân hơn, nhiều thời gian bên đồng đội hơn.</p>
      </div>
      <div className="guide-grid">
        {[
          [
            Search,
            '01',
            'Chọn cơ sở & sân',
            'Tìm cơ sở theo khu vực và loại sân. Mở cơ sở, chọn một sân cụ thể bên trong: Sân số 1, Sân số 2… Mỗi sân có giá và lịch riêng.',
          ],
          [
            CalendarCheck2,
            '02',
            'Chọn giờ, giữ chỗ',
            'Chọn ngày và thời lượng 30–180 phút, xem báo giá rồi gửi yêu cầu. Chủ sân có tối đa 30 phút để xác nhận giữ chỗ.',
          ],
          [
            Goal,
            '03',
            'Xỏ giày, ra sân',
            'Theo dõi xác nhận trong “Lịch đặt của tôi”, chọn thanh toán và ra sân đúng giờ. Sau khi hoàn thành, chia sẻ đánh giá về cơ sở.',
          ],
        ].map(([Icon, number, title, text]) => (
          <article key={number}>
            <span className="step-number">{number}</span>
            <Icon size={32} />
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </div>
      <div className="guide-policy">
        <h2>Một vài điều trước khi lên kèo</h2>
        <details open>
          <summary>Giá sân được tính thế nào?</summary>
          <p>
            Giá trên thẻ cơ sở là giá thấp nhất trong các sân đang hoạt động. Mỗi sân con có giá
            riêng mỗi giờ. Khung giờ từ 17:00 đến 22:00 có phụ thu 100.000đ/giờ; giá cuối cùng được
            hiển thị khi chọn giờ.
          </p>
        </details>
        <details>
          <summary>Có thể đổi hoặc hủy lịch không?</summary>
          <p>
            Bạn có thể hủy trước giờ bắt đầu ít nhất 2 tiếng. Để đổi giờ, hủy lịch cũ rồi đặt khung
            giờ mới nếu còn trống.
          </p>
        </details>
        <details>
          <summary>Đây có phải lịch đặt sân thực tế không?</summary>
          <p>
            Đây là bản demo đồ án. Sân, hình ảnh, đánh giá và tài khoản là dữ liệu minh họa; việc
            đặt sân không phát sinh giao dịch. Dữ liệu đặt sân được giữ trong bộ nhớ đến khi tải lại
            trang. Thanh toán được mô phỏng, không chuyển tiền thật.
          </p>
        </details>
      </div>
      <Link className="button primary" to="/">
        Tìm sân ngay <ArrowUpRight size={18} />
      </Link>
    </div>
  );
}
