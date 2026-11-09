# Kèo Sân — Frontend đặt sân online

Frontend **JavaScript / React / Vite** cho đồ án Kiến trúc hướng dịch vụ. Đã chuyển sang mô hình `users → venues → courts → bookings`, cùng `sport_types`, `payments`, `reviews` theo thiết kế nhóm đề xuất. **Backend và MongoDB để triển khai sau.**

## Chạy frontend

Cần Node.js **22.12+** và npm. Mở terminal tại thư mục gốc repo (nơi có `package.json`):

```powershell
npm install
npm run dev
```

Mở <http://127.0.0.1:5173>. Lệnh này chỉ chạy Vite; không cần API server hay MongoDB. `Ctrl+C` để dừng.

Mặc định `VITE_API_MODE=mock`: API client sử dụng **dữ liệu mô phỏng trong bộ nhớ của tab**. Mỗi lần tải lại trang hoặc mở tab mới sẽ đặt lại tài khoản demo, lịch đặt, thanh toán và đánh giá. Chuyển trang bằng các liên kết trong app giữ nguyên dữ liệu. Đây không phải HTTP backend hay cơ chế lưu dữ liệu thật.

**Mock phần nào?** Xem [MOCK_SCOPE.md](docs/MOCK_SCOPE.md): bảng endpoint được mô phỏng, dữ liệu mẫu, cách thử từng luồng và phần backend còn phải làm. Toàn bộ phản hồi dữ liệu/nghiệp vụ trong chế độ mặc định đến từ mock; giao diện, form và API client là mã frontend thực thi.

| Tài khoản demo       | Vai trò                      | Mật khẩu     |
| -------------------- | ---------------------------- | ------------ |
| `player@keosan.demo` | CUSTOMER — người đặt sân     | `Demo@12345` |
| `owner@keosan.demo`  | OWNER — chủ sân              | `Demo@12345` |
| `admin@keosan.demo`  | ADMIN — quản lý môn thể thao | `Demo@12345` |

Hộp đăng nhập có nút điền tài khoản mẫu. Đăng ký tạo CUSTOMER tạm thời; token nằm trong bộ nhớ. Chỉ dùng thông tin giả khi thử bản demo.

## Các màn hình đã nối với contract mới

- Tìm cơ sở theo từ khóa, thành phố, quận/huyện, môn thể thao, số người, giá; sắp xếp và phân trang.
- Chi tiết cơ sở gồm nhiều sân riêng biệt, tiện ích và đánh giá.
- Chi tiết sân: lịch trống theo ngày, thời lượng 30–180 phút, báo giá trước khi gửi yêu cầu.
- Đăng ký, đăng nhập, refresh phiên, đăng xuất và sửa hồ sơ cá nhân.
- Lịch đặt của tôi; chi tiết yêu cầu, trạng thái giữ chỗ, xác nhận, hoàn thành, hủy, hết hạn.
- Tạo lượt thanh toán, xem lịch sử; nút giả lập thành công/thất bại chỉ xuất hiện trong chế độ mock. Không phát sinh tiền thật.
- Viết/sửa/xóa đánh giá gắn với lịch đã hoàn thành.
- Chủ sân quản lý cơ sở, các sân bên trong, danh sách lịch và thao tác xác nhận/hoàn thành/hủy.
- Admin quản lý danh mục môn thể thao.

**Ví dụ Hà Đông:** một `venue` có Sân số 1 (5 người), Sân số 2 (5 người), Sân số 3 (11 người). Mỗi `court` có ID, giá và lịch độc lập; booking gửi `courtId`. Có thể đặt các sân khác nhau cùng giờ. Dữ liệu mẫu: 9 cơ sở, 11 sân.

Quy tắc demo: yêu cầu mới giữ chỗ tối đa 30 phút và chờ chủ sân xác nhận; thanh toán sau xác nhận; khách hủy trước giờ chơi ít nhất 2 tiếng; đánh giá sau hoàn thành. Nhóm có thể điều chỉnh chính sách này khi chốt backend.

## Bàn giao API thật

**Dùng hợp đồng mới:** [frontend-openapi.yaml](packages/contracts/frontend-openapi.yaml) (OpenAPI 3.1.1), nguồn sửa tại [frontend-openapi.js](packages/contracts/frontend-openapi.js). Có **37 operations cho frontend**, thêm **1 operation dành chỗ cho callback thanh toán của backend**; callback cần chốt theo nhà cung cấp.

Đọc [FRONTEND_HANDOFF.md](docs/FRONTEND_HANDOFF.md) để xem DTO, endpoint, quyền và vòng đời dữ liệu. `password_hash` và MongoDB chỉ nằm ở backend; frontend không truy cập DB.

Khi backend mới sẵn sàng, tạo `apps/web/.env.local`:

```dotenv
VITE_API_MODE=http
VITE_API_BASE_URL=/api/v1
API_PROXY_TARGET=http://127.0.0.1:8080
```

Khởi động lại Vite. `api/client.js` chuyển sang `fetch` và giữ nguyên `api/services.js` cùng các trang. HTTP lỗi sẽ hiện lỗi, không tự chuyển về dữ liệu giả. Cookie refresh đi cùng request (`credentials: include`); chi tiết CORS/cookie và quyền cần triển khai phía backend.

## Cấu trúc chính

```text
apps/web/src/
  api/client.js, services.js       # Một điểm nối mock hoặc HTTP
  mocks/fixtures.js, transport.js # Dữ liệu/scenario demo trong tab
  context/AuthContext.jsx         # Phiên đăng nhập, form auth
  components/                    # Form, trạng thái, phân trang, đánh giá
  pages/                         # Explore, VenueDetail, CourtDetail,
                                 # Bookings, BookingDetail, Account,
                                 # Owner, SportsAdmin, Guide
packages/contracts/frontend-openapi.*  # Contract mới để bàn giao
packages/shared/time.js                # Múi giờ, khoảng thời gian, VND
tests/frontend.test.js                 # Scenario mock + response contract
docs/FRONTEND_HANDOFF.md                # Quy ước tích hợp
docs/MOCK_SCOPE.md                      # Mock gì, thử thế nào, giới hạn ở đâu
docs/FRONTEND_VERIFICATION.md           # Bằng chứng và giới hạn kiểm tra
```

## Kiểm tra

```powershell
npm run test:frontend   # 12 tests, response schemas trên 37 operations frontend
npm run contract:check # Kiểm tra contract hiện tại và bản xuất YAML/JSON
npm run check          # Contract + toàn bộ tests + production build
```

Kết quả kiểm tra giao diện desktop/mobile và giới hạn mô phỏng ở [FRONTEND_VERIFICATION.md](docs/FRONTEND_VERIFICATION.md). Backend thật, đồng thời nhiều người dùng, MongoDB, refresh cookie, payment callback và hoàn tiền thật chưa được triển khai/kiểm chứng.
