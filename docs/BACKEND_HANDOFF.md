# Bàn giao cho người làm endpoint thật

> **LEGACY — chỉ dùng để tham khảo mock cũ.** Hướng dẫn tích hợp đang áp dụng nằm ở [FRONTEND_HANDOFF.md](FRONTEND_HANDOFF.md); import `packages/contracts/frontend-openapi.yaml` cho frontend hiện tại. Các bước bên dưới sử dụng contract/API cũ.

## Đầu vào cần dùng

1. Import `packages/contracts/openapi.yaml` vào Swagger Editor/Postman, hoặc mở mock `/docs`.
2. Đọc `API_DESIGN.md` và `MONGODB.md` trước khi viết handler.
3. Chạy `npm test` để xem các ví dụ edge case có thể thực thi.
4. Không coi `apps/mock-api` là backend production; có thể tham khảo handler/validation nhưng phải thay persistence, authentication và concurrency.

## Các bước tích hợp

1. Giữ base path `/api/v1`, JSON field names, method, schema, media type, error code và các header đã cam kết.
2. Xây dựng backend module Identity/Catalog/Booking theo stack JavaScript nhóm chọn. MongoDB chỉ được truy cập từ server.
3. Tạo user qua quy trình seed riêng của backend, hash password; không chuyển tài khoản demo sang production.
   Seed cơ sở (`venues`) trước, rồi tạo sân (`pitches`) tham chiếu venueId. Chủ sở hữu ở venue; mọi mutation pitch kiểm quyền qua parent. Contract 1.1.0 thay đổi DTO pitch so với skeleton 1.0.0; không chạy frontend mới trên handler cũ.
4. Đảm bảo response DTO chỉ chứa field public; đổi `_id` → `id`; Date → UTC string; không trả tokenHash/passwordHash.
5. Frontend: copy `.env.example`, đổi `API_PROXY_TARGET`, chạy **chỉ** `npm run dev:web`. Khi deploy static, Vite proxy không tồn tại: cấu hình reverse proxy cùng origin hoặc `VITE_API_BASE_URL=https://api.example.edu/api/v1` lúc build và CORS đúng origin ở server.
6. Server expose `ETag`, `Location`, `X-Request-Id`, `Retry-After`, `WWW-Authenticate` qua CORS nếu gọi khác origin. Chỉ allow origins cần thiết.
7. Chạy cùng kịch bản success/error từ `requests.http` và test hợp đồng lên staging. Suite hiện tại khởi tạo in-memory mock; **nó không tự test backend mới**. Adapt fixture/auth/setup/cleanup hoặc thêm integration suite cho server thật.

## Checklist nhận backend

- [ ] OAS schema/status/header nhất quán, không thay mọi lỗi thành HTTP 200.
- [ ] List validation, allowlist sort/filter, limit cap; cursor ổn định và không bypass ownership.
- [ ] Auth thật, token expiry/logout, role và object checks; BOLA test hai user và hai owner.
- [ ] Một venue có nhiều pitch cùng loại; tên sân duy nhất trong cơ sở; venueId không được sửa; summary/list nested đúng filter và pagination.
- [ ] Hà Đông: đặt Sân số 1, Sân số 2 (đều 5 người) và Sân số 3 (11 người) cùng giờ đều thành công; đặt trùng đúng một pitch trả 409; hủy một sân không mở lịch sân khác.
- [ ] Không nhận venueId/venueName/pitchType từ booking body; server snapshot parent/child và giữ lịch sử khi đổi tên.
- [ ] Server tính tổng tiền; từ chối userId/ownerId/status/total do client đưa lên.
- [ ] Transaction và unique slot claim chịu được request đồng thời **giữa nhiều process**.
- [ ] Idempotency persistent, unique scope, replay sau timeout/restart; expiry/TTL có logic rõ ràng.
- [ ] Hủy, claim release và history cập nhật trong một transaction; hạn hủy theo server clock.
- [ ] ETag update/delete dùng atomic compare-and-update; xử lý 412/428 đúng.
- [ ] Thay đổi child tăng version parent trong transaction; summary và ETag được đọc nhất quán.
- [ ] Xóa/ngừng cơ sở và sân không chạy đua với booking; xóa parent còn child trả 409, không cascade, không có tài nguyên mồ côi.
- [ ] TLS, secret ngoài source, password hash, log không chứa token/password/PII không cần thiết.
- [ ] Rate limit dùng shared store; quan sát requestId; lỗi nội bộ không lộ stack.
- [ ] Smoke frontend: lọc cơ sở → chọn sân cụ thể → login → book → list → cancel → owner quản lý cơ sở/sân; kiểm tra mobile.

Refresh token, payment provider, notification, upload, review hoặc admin dashboard phải được thiết kế thêm vào contract trước khi frontend gọi. Nếu giữ chính sách đăng nhập lại sau 15 phút thì không cần tự thêm refresh API.

## Quy tắc thay đổi contract

- Thêm field optional/endpoint mới: trao đổi nhóm, cập nhật spec/mock/test cùng PR.
- Đổi field bắt buộc, enum, semantics/status mà client đang phụ thuộc: coi là breaking change; thống nhất migration hoặc `/api/v2`.
- Mỗi PR ghi endpoint bị ảnh hưởng, request/response ví dụ, validation và test.
- Không sửa trực tiếp YAML/JSON rồi quên JS source; chạy `npm run contract:export` và `npm run check`.
