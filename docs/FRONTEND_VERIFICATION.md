# Kiểm tra frontend mới — 09/11/2026

Môi trường: Windows, Node.js 22.16.0, npm 10.9.2. Kiểm tra ứng dụng local, chế độ mock trong tab; không dùng backend mới hoặc MongoDB.

## Kiểm tra tự động

| Kiểm tra                   | Kết quả                                                                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:frontend`    | 12/12 qua; fixture scenario và response schema                                                                                                                |
| `npm run contract:check`   | OpenAPI 3.1.1 hợp lệ; YAML/JSON đồng bộ; 38 operationId mới duy nhất (37 frontend + callback dành chỗ)                                                        |
| `npm run check`            | Qua contract check, 44/44 tests (12 mới + 32 HTTP legacy), production build                                                                                   |
| Build `VITE_API_MODE=http` | Thành công; chỉ main JS/CSS, không sinh chunk transport mock; không có chuỗi tài khoản/mật khẩu demo, nút giả lập thành công hay `frontend.mock` trong assets |

Frontend tests dùng `createMockTransport` độc lập với React/browser, đồng hồ cố định và AJV kiểm tra response theo contract mới. Cả 37 operation frontend đều có response được kiểm tra; không phải kiểm thử HTTP backend hay tất cả tổ hợp input.

Scenario gồm: nhiều sân cùng loại trong một venue; filter cùng khớp một court; quote 90 phút qua ranh giới cao điểm; khoảng giao nhau/tiếp giáp; đặt hai sân cùng giờ; retry idempotency; hết hạn giải phóng lịch; quyền xác nhận; payment pending/succeeded và privacy; hủy đã trả chuyển chờ hoàn tiền; complete không tự đánh dấu paid; review completed/author/unique/aggregate; register/profile/refresh/logout; CRUD venue/court/sport; ETag cũ; no-cascade.

Lệnh build HTTP được chạy từ `apps/web` với biến môi trường `VITE_API_MODE=http`:

```powershell
node ../../node_modules/vite/bin/vite.js build --outDir ../../artifacts/http-build
```

Biến môi trường đã được khôi phục sau kiểm tra. `apps/web/dist` giữ bản build mặc định mock. `artifacts/http-build` chỉ để kiểm tra build, không có API server để kết nối.

## Kiểm tra tương tác trên trình duyệt

- Catalog, trang Hà Đông hiển thị đúng 3 sân: 5/5/11, tên/giá/lịch riêng. Bộ lọc city Đà Nẵng và môn Cầu lông hiển thị trạng thái rỗng với seed hiện tại.
- Chọn Sân số 1, 90 phút 18:00–19:30, báo giá 525.000 VND; đăng nhập khách, gửi yêu cầu, thấy trạng thái pending và hạn giữ chỗ.
- Đổi sang owner bằng UI, mở Hà Đông, tìm yêu cầu vừa tạo, xác nhận và thấy confirmed. Ảnh `owner-bookings.jpg` ghi lại kết quả này.
- Trên lịch confirmed mẫu riêng: tạo payment → giả lập thất bại → tạo lần thử tiếp → giả lập thành công. Hiển thị cả hai lần thử, trạng thái paid. Hủy lịch đã trả hiển thị cancelled + refund_pending.
- Trên completed booking mẫu: viết đánh giá 5 sao, sửa thành 4 sao; trang cơ sở hiển thị nhận xét và tổng hợp 4.0/1 đánh giá.
- Sửa tên hồ sơ, thấy thông báo đã lưu và tên mới. Đăng nhập/đăng xuất các vai trò và route gating hoạt động.
- Owner thêm sân vào Hà Đông, sửa giá 250.000 → 300.000 VND, xóa sân vừa tạo; danh sách trở về 3 sân.
- Admin thêm môn, đổi tên, xóa môn chưa sử dụng; thử xóa Bóng đá nhận lỗi vì có sân đang dùng.
- Desktop 1366×900; mobile viewport 390×844. Các trang venue, booking/payment và owner được kiểm tra; document không tràn ngang (clientWidth = scrollWidth = 375 ở mobile có thanh cuộn). Bảng quản lý sân cuộn ngang bên trong trên mobile.
- Sau tải lại trang ở bản cuối, không có lỗi console mới. Một lỗi Vite HMR từng xuất hiện trong lúc sửa file; bản cuối đã build và tải lại thành công.

Đã xác nhận giới hạn mock: **tải lại trang làm mất booking vừa tạo và phiên đăng nhập**. Các scenario payment/review dùng booking mẫu sau lần tải lại, không được coi là cùng một booking xuyên suốt cả buổi kiểm tra. Chỉ thao tác qua link/router trong app mới giữ dữ liệu demo trong tab.

## Ảnh chụp

Các ảnh dưới `screenshots/frontend-courts/` là dữ liệu demo, ghi lại các thời điểm khác nhau trong kiểm tra:

| Ảnh                                        | Nội dung                                    |
| ------------------------------------------ | ------------------------------------------- |
| `venue-three-courts.jpg`                   | Toàn trang cơ sở và ba sân riêng            |
| `venue-courts-desktop.jpg`                 | Ba thẻ sân với giá độc lập trên desktop     |
| `venue-mobile.jpg`                         | Trang cơ sở trên mobile                     |
| `booking-pending.jpg`                      | Yêu cầu mới chờ xác nhận                    |
| `owner-bookings.jpg`                       | Owner xác nhận yêu cầu                      |
| `owner-courts.jpg`                         | Quản lý ba sân trong cùng cơ sở             |
| `payment-result.jpg`, `payment-mobile.jpg` | Thanh toán mô phỏng thất bại rồi thành công |
| `venue-courts-reviews.jpg`                 | Review sau khi sửa thành 4 sao              |
| `admin-sport-guard.jpg`                    | Chặn xóa môn thể thao đang sử dụng          |

Các ảnh nằm ngoài thư mục này là bằng chứng lịch sử của phiên bản trước, không dùng để chứng minh chức năng mới.

## Chưa xác minh / chưa triển khai

Backend HTTP mới, MongoDB, đa người dùng/đa process, chống đua đặt lịch thật, cookie/token rotation thật, callback/chữ ký thanh toán, tiền mặt/hoàn tiền thực tế, deployment production. Browser fixtures chỉ phục vụ phát triển UI và bàn giao dữ liệu; 32 tests HTTP legacy không chứng minh các phần này.

Dev server và tab kiểm tra tạm đã được dừng/đóng sau khi kiểm tra. Chạy lại `npm run dev` để trải nghiệm từ seed ban đầu.
