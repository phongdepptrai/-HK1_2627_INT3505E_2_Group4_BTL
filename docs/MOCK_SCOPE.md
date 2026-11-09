# Phạm vi mock và cách chạy demo

**Project hiện có frontend hoạt động và browser mock; chưa có backend HTTP thật hay MongoDB.** Mặc định, tất cả dữ liệu tài khoản, cơ sở, sân, lịch đặt, thanh toán và đánh giá đều do mock cung cấp. Việc một nút trên giao diện chạy được không có nghĩa endpoint backend đã được triển khai.

## Mã thật và phần mô phỏng nằm ở đâu?

| Thành phần                                          | File                                                                  | Trạng thái                                                                              |
| --------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Giao diện, form, điều hướng, trạng thái loading/lỗi | `apps/web/src/pages/`, `components/`, `context/`                      | Mã frontend thực thi trên trình duyệt                                                   |
| API client và lời gọi nghiệp vụ                     | `apps/web/src/api/client.js`, `services.js`                           | Dùng chung cho hai chế độ `mock` và `http`                                              |
| Dữ liệu mẫu                                         | `apps/web/src/mocks/fixtures.js`                                      | 3 user, 3 môn, 9 cơ sở, 11 sân, 4 booking, 1 payment; review ban đầu rỗng               |
| Phản hồi API và quy tắc demo                        | `apps/web/src/mocks/transport.js`                                     | Mô phỏng 37 operation trong bộ nhớ của tab, trả đối tượng `Response`                    |
| Kết quả thanh toán demo                             | `settlePayment` trong `transport.js`, nút ở `pages/BookingDetail.jsx` | Giả lập thành công/thất bại, không liên hệ cổng thanh toán                              |
| Contract bàn giao                                   | `packages/contracts/frontend-openapi.js`, `.yaml`, `.json`            | Thiết kế input/output cho 37 operation frontend + 1 callback dành cho backend           |
| Tests                                               | `tests/frontend.test.js`                                              | 12 tests scenario và response schema cho mock, không phải integration test backend thật |

Luồng mặc định: **React → services → client → mock trong tab**. Không có request HTTP đến một API server cho các thao tác này, nên không thể dùng Postman gọi browser mock. Network panel vẫn có request tải mã, ảnh, font và tài nguyên Vite; chúng không phải API nghiệp vụ.

## Những API nào đang được mock?

Đường dẫn dưới đây theo contract dự kiến `/api/v1`. Adapter nội bộ nhận phần đường dẫn sau prefix; đây chưa phải các endpoint đang được phục vụ trên một server.

| Nhóm            | Operation được mô phỏng                                                                                                                                   | Hành vi demo                                                                                    |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Auth — 4        | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`                                                                                     | Tạo CUSTOMER tạm, kiểm tra mật khẩu trong bộ nhớ, cấp token tạm, gia hạn và đăng xuất           |
| User — 2        | `GET`, `PUT /users/me`                                                                                                                                    | Đọc/sửa tên, số điện thoại của user đang đăng nhập                                              |
| Sport types — 4 | `GET`, `POST /sport-types`; `PUT`, `DELETE /sport-types/{id}`                                                                                             | Danh mục môn; chỉ ADMIN sửa; không xóa môn có sân sử dụng                                       |
| Venues — 6      | `GET`, `POST /venues`; `GET`, `PUT`, `DELETE /venues/{id}`; `GET /owner/venues`                                                                           | Tìm/lọc/phân trang, thông tin cơ sở, CRUD của OWNER, version/ETag                               |
| Courts — 7      | `GET`, `POST /venues/{venueId}/courts`; `GET`, `PUT`, `DELETE /courts/{id}`; `GET /courts/{id}/availability`; `GET /courts/{id}/quote`                    | Sân riêng biệt trong venue, CRUD, lịch 30 phút và báo giá theo khoảng giờ                       |
| Bookings — 7    | `POST /bookings`; `GET /bookings/{id}`; `GET /users/me/bookings`; `GET /venues/{venueId}/bookings`; `POST /bookings/{id}/cancel`, `/confirm`, `/complete` | Giữ chỗ tạm, trùng giờ 409, giới hạn quyền, vòng đời booking, retry với Idempotency-Key         |
| Payments — 3    | `POST`, `GET /bookings/{id}/payments`; `GET /payments/{id}`                                                                                               | Tạo lần thử pending, lấy amount từ booking, lịch sử và quyền xem                                |
| Reviews — 4     | `GET`, `POST /venues/{venueId}/reviews`; `PUT`, `DELETE /reviews/{id}`                                                                                    | Chỉ đánh giá booking completed của mình, 1 review/booking, sửa/xóa bởi tác giả, tính lại rating |

**Không mock `POST /payments/callback`.** Operation này chỉ được dành chỗ trong OpenAPI. Payload, chữ ký và giao thức callback phải chốt với cổng thanh toán khi làm backend. Nút giả lập thanh toán gọi helper nội bộ, không gọi callback và không chứng minh việc tích hợp cổng thanh toán.

## Giới hạn của từng phần mock

| Phần               | Mock đang làm                                                                   | Backend thật còn phải làm                                                                                         |
| ------------------ | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Lưu dữ liệu        | Array/Map trong một tab                                                         | MongoDB, schema/index, persistence, transaction, backup                                                           |
| Đăng nhập          | Mật khẩu demo hoặc đăng ký được giữ trong bộ nhớ; token tạm hết hạn sau 15 phút | Password hashing, tài khoản thật, session/token store, thu hồi token, chính sách bảo mật                          |
| Refresh            | Biến trong bộ nhớ mô phỏng refresh session                                      | HttpOnly/Secure cookie, rotation, expiry/revocation, CSRF/CORS phù hợp deployment                                 |
| Phân quyền         | Adapter kiểm tra role, userId, ownerId cho các scenario UI                      | Kiểm tra quyền trên server cho mọi request/tài nguyên; code trong trình duyệt không phải ranh giới bảo mật        |
| Validation / lỗi   | Một số quy tắc input, trạng thái và Problem Details để thử UI                   | Validation đầy đủ theo contract, giới hạn payload/rate, xử lý protocol, log/request tracing                       |
| Báo giá            | Giá cơ bản + 100.000 VND/giờ trong 17–22h, tính theo 30 phút                    | Quy tắc giá được nhóm chốt, tính lại giá tin cậy khi tạo booking                                                  |
| Trùng lịch         | So giao nhau `[startTime,endTime)` trong trạng thái của tab                     | Chống đua đặt lịch giữa nhiều user/process bằng thao tác atomic/transaction                                       |
| Hết hạn giữ chỗ    | Kiểm tra pending khi mock nhận request; detail pending có refetch               | Worker/scheduler, giải phóng giữ chỗ và chuyển trạng thái nhất quán                                               |
| Idempotency / ETag | Ghi nhớ lần thử và version trong tab                                            | Lưu bền vững, xử lý đồng thời và retention idempotency ít nhất 24h theo contract                                  |
| Thanh toán         | Tạo pending, nút giả lập succeeded/failed; method cash cũng chỉ là demo         | Tạo phiên thanh toán thật, xác thực callback/amount/currency, xử lý sự kiện trùng/đến muộn, xác nhận thu tiền mặt |
| Hoàn tiền          | Hủy booking đã paid chuyển `refund_pending`                                     | Quy trình, endpoint và UI hoàn tiền cần chốt thêm; chưa chuyển tiền hay xử lý refund thật                         |
| Đánh giá           | Điều kiện completed và rating tổng hợp trong tab                                | Ràng buộc dữ liệu, quyền và cập nhật tổng hợp nhất quán trong DB                                                  |
| Hình ảnh           | Ảnh minh họa local, `imageKey` mẫu                                              | Ảnh sân thật, upload và lưu trữ media nếu nhóm cần                                                                |

Không có dữ liệu dùng chung giữa các tab/người dùng. **Reload, mở tab mới hoặc khởi tạo lại module mock sẽ trở về seed ban đầu.** Chuyển trang bằng link trong app giữ dữ liệu trong tab. Không dùng dữ liệu cá nhân hoặc mật khẩu thật khi thử demo.

## Cách thử mock

Tại thư mục gốc repo:

```powershell
npm install
npm run dev
```

Mở <http://127.0.0.1:5173>. Mặc định đã là `mock`, không cần tạo `.env`. Nếu từng bật HTTP, đặt `VITE_API_MODE=mock` trong `apps/web/.env.local` rồi khởi động lại Vite.

| Tài khoản            | Vai trò  | Mật khẩu     |
| -------------------- | -------- | ------------ |
| `player@keosan.demo` | CUSTOMER | `Demo@12345` |
| `owner@keosan.demo`  | OWNER    | `Demo@12345` |
| `admin@keosan.demo`  | ADMIN    | `Demo@12345` |

Tài khoản owner mẫu quản lý tất cả cơ sở seed. Đăng ký bằng UI chỉ tạo CUSTOMER tạm. Các ngày mẫu được tính theo ngày hiện tại khi tab khởi tạo, không cố định theo ngày tài liệu.

| Luồng cần thử             | Thao tác                                                                                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nhiều sân trong một cơ sở | Mở Hà Đông: Sân số 1 và số 2 đều 5 người, số 3 là 11 người; chọn từng sân để xem giá/lịch riêng                                                          |
| Đặt và xác nhận           | CUSTOMER chọn sân, ngày, giờ, thời lượng; gửi yêu cầu. Đăng xuất rồi đăng nhập OWNER trong cùng tab, mở cơ sở → Yêu cầu & lịch đặt → Xác nhận            |
| Thanh toán                | CUSTOMER mở lịch confirmed mẫu (`demo-confirmed`) hoặc lịch vừa được xác nhận; tạo lượt thanh toán, chọn Giả lập thất bại/thành công. Không có tiền thật |
| Hủy sau thanh toán        | Hủy lịch đủ điều kiện thời gian; trạng thái thanh toán chuyển chờ hoàn tiền, không có refund thật                                                        |
| Hoàn thành                | OWNER mở Thành Phát → lịch đặt → Xem mọi ngày; lịch confirmed trong quá khứ (`demo-ready`) có thể hoàn thành                                             |
| Đánh giá                  | CUSTOMER mở lịch completed mẫu (`demo-completed`), viết/sửa đánh giá; mở cơ sở để xem và xóa đánh giá của mình                                           |
| CRUD sân                  | OWNER mở Hà Đông → Các sân trong cơ sở → thêm/sửa/xóa sân mẫu; thay đổi chỉ nằm trong tab                                                                |
| Quản lý môn               | ADMIN mở Môn thể thao → thêm/sửa/xóa môn chưa được sử dụng                                                                                               |
| Khởi động lại demo        | Reload trang; mọi thay đổi và phiên đăng nhập đều mất                                                                                                    |

Seed còn có một booking pending (`demo-pending`) để xem giữ chỗ/hết hạn. Có thể dùng tests với đồng hồ mô phỏng để kiểm tra expiry mà không chờ 30 phút.

## Khi có backend thật

Tạo `apps/web/.env.local`:

```dotenv
VITE_API_MODE=http
VITE_API_BASE_URL=/api/v1
API_PROXY_TARGET=http://127.0.0.1:8080
```

Khởi động lại Vite. Client sẽ gửi HTTP bằng `fetch`; token, response, status, dữ liệu đến từ backend. Nút đăng nhập tài khoản mẫu và nút giả lập thanh toán không xuất hiện ở chế độ này. Nếu backend chưa chạy, UI báo lỗi; không tự fallback sang mock. Chỉ đổi cấu hình không tạo ra backend.

Xem [FRONTEND_HANDOFF.md](FRONTEND_HANDOFF.md) và [OpenAPI](../packages/contracts/frontend-openapi.yaml) để triển khai endpoint. Kiểm tra mock bằng `npm run test:frontend`, kiểm tra contract/build bằng `npm run check`. Bằng chứng UI và giới hạn kiểm tra ở [FRONTEND_VERIFICATION.md](FRONTEND_VERIFICATION.md).
