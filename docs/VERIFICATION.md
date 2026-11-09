# Kết quả kiểm tra — 08/11/2026

> **Kết quả lịch sử của phiên bản trước.** Kiểm tra frontend mới và ảnh chụp hiện tại ở [FRONTEND_VERIFICATION.md](FRONTEND_VERIFICATION.md). Các HTTP tests bên dưới chỉ kiểm tra mock legacy, không chứng minh backend mới.

Kết quả sau khi cập nhật mô hình **cơ sở → nhiều sân riêng biệt**, hợp đồng 1.1.0. Môi trường: Windows, Node.js 22.16.0, npm 10.9.2; dependency versions ở `package-lock.json`.

## Tự động

| Kiểm tra                 | Kết quả                                                             |
| ------------------------ | ------------------------------------------------------------------- |
| `npm run contract:check` | OAS 3.1.1 hợp lệ, 22 operationId duy nhất, YAML/JSON đồng bộ với JS |
| `npm test`               | **32/32 pass** qua HTTP server độc lập                              |
| `npm run build`          | Thành công, output `apps/web/dist`                                  |
| `npm run check`          | Cả ba bước trên thành công trong cùng lượt kiểm tra cuối            |

Suite kiểm tra response theo operation/status/content-type; method, schema và validation; offset/composite cursor; role/ownership và BOLA; giá server; idempotency; hủy/cutoff; ETag; media type/payload; login rate limit/logout/expiry. Tất cả **22 operations** có response đã được kiểm tra bằng schema.

Các tình huống bổ sung cho mô hình cơ sở/sân:

- Hà Đông có đúng 2 pitch loại 5 và 1 pitch loại 11; nested pagination/link giữ đúng cơ sở.
- Filter type + maxPrice phải khớp cùng một child; summary tính trên tất cả child active.
- Ba sân cùng cơ sở được đặt đồng thời cùng giờ, giá riêng; đặt trùng một pitch trả 409. Hủy một booking chỉ giải phóng đúng sân đó.
- Venue CRUD và ETag; cơ sở rỗng có minPrice null.
- Không thể tạo/sửa sân trong cơ sở người khác, giả parent hoặc thay venueId; tên riêng duy nhất trong cơ sở.
- Mutation child tăng version parent; xóa cơ sở còn child trả 409, không cascade.
- Đóng cơ sở ẩn và chặn booking mới của các sân con, giữ lịch cũ. Booking snapshot giữ tên cơ sở/sân cũ sau khi catalog đổi tên.

Workflow `.github/workflows/ci.yml` đã chuẩn bị, **chưa chạy trên GitHub** vì project chưa được push. Đây không phải kiểm thử mọi tổ hợp đầu vào hay chứng nhận bảo mật.

## Trình duyệt sau cập nhật

Đã thao tác với web local và mock HTTP, không thay fetch bằng dữ liệu trong trang:

1. Trang chủ hiển thị **9 cơ sở**, các card có số lượng/loại sân và giá từ. Mở “Sân bóng Hà Đông” từ card.
2. Trang cơ sở hiển thị Sân số 1 (5 người, 250.000đ), Sân số 2 (5 người, 280.000đ), Sân số 3 (11 người, 600.000đ). Lọc sân 5 còn đúng Sân số 1 và Sân số 2.
3. Chọn Sân số 1, ngày 09/11/2026, 18:00–19:00; đăng nhập bằng nút tài khoản mẫu; nhập số điện thoại demo; đặt thành công giá **350.000đ** (gồm phụ thu).
4. Quay về cơ sở, mở Sân số 2: **18:00–19:00 vẫn chọn được**, giá 380.000đ. Lịch đặt hiển thị riêng tên cơ sở và “Sân số 1 · Sân 5 người”.
5. Chủ sân: danh sách cơ sở → Hà Đông → bảng ba sân. Tạo sân kiểm thử trong đúng Hà Đông, sửa giá 250.000 → 320.000đ rồi xóa; danh sách trở lại ba sân.
6. Tạo cơ sở kiểm thử không có sân; hiển thị “Chưa có sân hoạt động”; xóa được cơ sở rỗng, tổng trở lại chín cơ sở. Các fixture UI này đã được dọn.
7. Viewport desktop 1366×900, mobile 390×844; trang cơ sở, chi tiết sân và trang chủ mobile có DOM clientWidth bằng scrollWidth (375 hoặc 390 tùy scrollbar). Không ghi nhận console error ở tab ứng dụng trong lượt kiểm tra.
8. Swagger UI hiển thị contract **1.1.0 / OAS 3.1**, nhóm Venues với bảy thao tác và các nhóm Identity/Catalog/Booking/System.

Các luồng hủy qua UI, ngày sai và đăng nhập lại sau refresh đã kiểm tra ở skeleton trước; lượt cập nhật này kiểm tra lại nghiệp vụ hủy/cutoff bằng suite HTTP, không tuyên bố đã chạy lại toàn bộ UI cũ.

Ảnh hiện tại trong `docs/screenshots/`:

- `preview.jpg`, `explore-desktop.jpg`, `explore-mobile.jpg`: trang tìm cơ sở.
- `venue-ha-dong-desktop.jpg`, `venue-ha-dong-mobile.jpg`: Hà Đông và ba sân riêng biệt.
- `pitch-mobile.jpg`: lịch và form của Sân số 1.
- `booking-confirmed.jpg`, `booking-venue-pitch.jpg`: xác nhận và lịch đặt có tên cơ sở/sân.
- `owner-venue-pitches.jpg`: bảng quản lý các sân trong Hà Đông.
- `swagger.jpg`: đặc tả có nhóm cơ sở.

## Giới hạn bằng chứng

- Chưa có MongoDB connection, transaction/index integration test, backend thật, payment hay email/SMS.
- Race test chỉ kiểm tra mock một process; chưa đánh giá nhiều instance hoặc tải lớn.
- Chưa chạy công cụ accessibility chuyên biệt hay toàn bộ trình duyệt/thiết bị.
- Không có đăng ký/refresh/upload/review API; đây là phạm vi đã ghi trong README.
- Dữ liệu và ảnh minh họa không xác nhận tình trạng sân thực tế.
- Booking trong ảnh là lượt kiểm tra mô phỏng. Khởi động lại mock xóa dữ liệu đã thay đổi; không có persistence.

Sau khi tiếp nhận backend thật, chạy lại integration và UI theo `BACKEND_HANDOFF.md`.
