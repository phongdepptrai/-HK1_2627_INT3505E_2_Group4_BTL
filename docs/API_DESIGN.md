# Thiết kế API — Kèo Sân v1

> **LEGACY — không phải contract frontend hiện tại.** Tài liệu bên dưới mô tả HTTP mock cũ (`pitches/startAt`). Bản mới dùng `courts/startTime/endTime`; xem [FRONTEND_HANDOFF.md](FRONTEND_HANDOFF.md) và `packages/contracts/frontend-openapi.yaml`. Backend mới chưa triển khai.

## 1. Phạm vi và nguồn chuẩn

Không có một tiêu chuẩn duy nhất mang tên “đủ mọi chuẩn REST”. Bản này chốt rõ các quy ước có thể kiểm chứng bằng đặc tả và test:

- **HTTP method, status, conditional requests:** [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html).
- **Lỗi có cấu trúc:** [RFC 9457 — Problem Details](https://www.rfc-editor.org/rfc/rfc9457.html), thay thế RFC 7807 được nhắc trong lab.
- **Đặc tả máy đọc được:** [OpenAPI 3.1.1](https://spec.openapis.org/oas/v3.1.1.html); phiên bản lựa chọn cho project, không tuyên bố là phiên bản mới nhất.
- JSON Schema qua OAS 3.1 để tái sử dụng schema request/response.
- Pagination, envelope, version qua URL và `Idempotency-Key` là **quy ước dự án**, không gán nhãn là yêu cầu bắt buộc của REST hay một RFC đã chuẩn hóa.

Lab B4/B6 dùng OAS 3.0.3; project chọn 3.1.1 để dùng JSON Schema hiện đại. Nếu giảng viên yêu cầu đúng 3.0.3, phải chuyển đổi schema (đặc biệt null/const), không chỉ sửa trường `openapi`.

Hợp đồng gốc: `packages/contracts/openapi.js`. YAML/JSON là bản xuất được commit/bàn giao cùng. Mock đọc đúng hợp đồng này để kiểm tra request; test dùng nó để kiểm tra response. `contract:check` phát hiện bản xuất cũ và operationId trùng.

Phiên bản hợp đồng hiện tại là **1.1.0**, gồm **22 operations**. Việc tách venue/pitch thay đổi DTO bắt buộc so với skeleton 1.0.0, là breaking change trong giai đoạn phát triển. Nhóm cập nhật đồng thời mock, frontend và tài liệu, giữ `/api/v1` vì chưa phát hành client/backend độc lập. Không coi đây là thay đổi tương thích ngược; nếu đã có client bên ngoài phải thống nhất migration hoặc version URL mới.

## 2. Tài nguyên và endpoint

Base URL: `/api/v1`. Tên tài nguyên số nhiều, lowercase; không dùng `/getPitch` hoặc `/createBooking`. ID là chuỗi opaque 24 ký tự hex; frontend không phân tích cấu trúc ID.

| Method | URI                                        | Quyền                               | Thành công             | Ý nghĩa                             |
| ------ | ------------------------------------------ | ----------------------------------- | ---------------------- | ----------------------------------- |
| GET    | `/health`                                  | Public                              | 200                    | Kiểm tra mock                       |
| POST   | `/sessions`                                | Public                              | 201 + Location         | Tạo phiên đăng nhập                 |
| DELETE | `/sessions/current`                        | Đăng nhập                           | 204                    | Thu hồi token hiện tại              |
| GET    | `/users/me`                                | Đăng nhập                           | 200                    | Hồ sơ người gọi                     |
| GET    | `/venues`                                  | Public; `scope=mine` cần owner      | 200                    | Danh sách cơ sở và tổng hợp sân con |
| POST   | `/venues`                                  | Owner                               | 201 + Location + ETag  | Tạo cơ sở; ownerId lấy từ token     |
| GET    | `/venues/{venueId}`                        | Public; inactive chỉ owner          | 200 + ETag             | Chi tiết cơ sở                      |
| PUT    | `/venues/{venueId}`                        | Đúng owner                          | 200 + ETag             | Thay toàn bộ trường được sửa        |
| PATCH  | `/venues/{venueId}`                        | Đúng owner                          | 200 + ETag             | Sửa một phần thông tin cơ sở        |
| DELETE | `/venues/{venueId}`                        | Đúng owner                          | 204                    | Xóa cơ sở không còn sân con         |
| GET    | `/venues/{venueId}/pitches`                | Public; `scope=mine` cần đúng owner | 200                    | Các sân vật lý trong cơ sở          |
| GET    | `/pitches`                                 | Public; `scope=mine` cần owner      | 200                    | Danh sách, lọc, sắp xếp, phân trang |
| POST   | `/pitches`                                 | Owner của venueId                   | 201 + Location + ETag  | Tạo sân trong cơ sở được chỉ định   |
| GET    | `/pitches/{pitchId}`                       | Public; sân inactive chỉ owner      | 200 + ETag             | Chi tiết sân                        |
| PUT    | `/pitches/{pitchId}`                       | Đúng owner                          | 200 + ETag             | Thay toàn bộ trường được sửa        |
| PATCH  | `/pitches/{pitchId}`                       | Đúng owner                          | 200 + ETag             | Sửa một phần trường được sửa        |
| DELETE | `/pitches/{pitchId}`                       | Đúng owner                          | 204                    | Xóa sân không còn lịch sắp tới      |
| GET    | `/pitches/{pitchId}/availability?date=...` | Public theo khả năng xem sân        | 200                    | Các slot khả dụng                   |
| GET    | `/bookings`                                | Đăng nhập                           | 200                    | Chỉ booking của người gọi           |
| POST   | `/bookings`                                | Đăng nhập                           | 201 + Location         | Đặt một slot; tính giá phía server  |
| GET    | `/bookings/{bookingId}`                    | Đúng người đặt                      | 200                    | Chi tiết booking                    |
| PUT    | `/bookings/{bookingId}/cancellation`       | Đúng người đặt                      | 201 lần đầu, 200 retry | Tạo tài nguyên hủy                  |

`GET` không thay đổi dữ liệu nghiệp vụ. `PUT` là thay thế đầy đủ phần có thể sửa, `PATCH` chỉ sửa field có mặt. PATCH dùng `application/json` theo schema riêng; **không nhận JSON Patch/Merge Patch**. Trường `null` bị từ chối. `DELETE` thành công không có body. Gửi `DELETE` lần nữa có thể trả 404/401; idempotent nói về tác động, không yêu cầu status luôn giống nhau.

Một `venue` là **cơ sở**, sở hữu tên cơ sở, địa chỉ, tiện ích và ownerId. Một `pitch` là **một sân vật lý**, có venueId, tên riêng trong cơ sở, loại (5/7/11), giá và lịch riêng. Hà Đông có Sân số 1 (5 người), Sân số 2 (5 người), Sân số 3 (11 người): ba pitchId độc lập, có thể được đặt cùng giờ. Không có quan hệ chia/ghép sân trong mô hình này.

POST pitch bắt buộc venueId; PUT/PATCH không nhận venueId, nên không chuyển sân sang cơ sở khác. Tên sân duy nhất trong cùng cơ sở sau chuẩn hóa không dấu, chữ thường và khoảng trắng; cùng tên ở cơ sở khác vẫn hợp lệ. Xóa cơ sở còn sân con (kể cả inactive) trả 409, không cascade. Ngừng cơ sở chặn lượt đặt mới trên mọi sân con, giữ nguyên lịch đã xác nhận. MVP mỗi booking đặt một pitch/slot; không giữ chỗ chờ thanh toán.

## 3. Request và response

- Request body: `Content-Type: application/json`; tối đa 32 KB.
- Response thành công: `application/json`; lỗi: `application/problem+json`.
- `Authorization: Bearer <token>` cho endpoint riêng tư. Không nhận token qua query.
- Mọi response mock có `X-Request-Id` do server tạo và `Cache-Control: no-store`.
- Tiền: số nguyên VND, không dùng float. Thời điểm: RFC 3339/ISO 8601 có offset; response chuẩn hóa UTC `Z`.
- Ngày chọn lịch: `YYYY-MM-DD` theo `Asia/Ho_Chi_Minh` (UTC+7). Frontend luôn hiển thị theo múi giờ này.
- Field không khai báo trong body bị từ chối; các query/filter/sort đều dùng allowlist. Không chuyển thẳng object từ client vào query MongoDB.

Ví dụ danh sách:

```json
{
  "data": [],
  "meta": { "page": 1, "limit": 6, "total": 0, "totalPages": 0 },
  "links": { "self": "/api/v1/pitches?page=1&limit=6", "next": null, "prev": null }
}
```

Tài nguyên đơn: `{ "data": { ... }, "links": { "self": "..." } }`. Venue có `self/pitches`; pitch có `self/venue/availability`; booking có `self/venue/pitch/cancellation`. Collection có `self/next/prev` và giữ filter khi chuyển trang, kể cả đường dẫn nested. Đây là navigation links theo ý tưởng HATEOAS; **không tuyên bố tuân thủ HAL/JSON:API hay một client hoàn toàn khám phá được mọi hành động**. Method/schema của liên kết hủy nằm trong OpenAPI; không có GET cancellation trong MVP.

## 4. Phân trang, lọc và sắp xếp

Catalog nhỏ, cần số trang → offset pagination:

```http
GET /api/v1/pitches?district=C%E1%BA%A7u%20Gi%E1%BA%A5y&type=7&maxPrice=400000&sort=price,name&page=1&limit=6
GET /api/v1/venues?type=5&maxPrice=300000&sort=minPrice,name&page=1&limit=6
GET /api/v1/venues/200000000000000000000005/pitches?type=5&sort=name&page=1&limit=6
```

`limit` 1–50 (mặc định 6), `page` 1–10000. Sort hợp lệ: `-rating,price`, `price,name`, `-price,name`, `name`; cuối cùng luôn so sánh `id` để ổn định khi giá/rating trùng. Query không hợp lệ, query lặp dạng array hay field lạ → 400. Trang vượt cuối trả danh sách rỗng, không phải 404. `maxPrice` là giá cơ bản, không bao gồm phụ thu giờ cao điểm. Search theo ngày trên UI **chỉ chọn trước ngày xem lịch**, danh sách chưa lọc theo slot cụ thể.

Các sort trên áp dụng cho pitch; rating khi sort được lấy từ cơ sở. Venue nhận `-rating,minPrice`, `minPrice,name`, `-minPrice,name`, `name`. Với venue, `type` và `maxPrice` phải cùng khớp **một sân con đang hoạt động**; không kết hợp loại của sân này với giá của sân khác. Các trường tổng hợp `pitchCount`, `pitchTypes`, `minPrice` luôn tính trên **tất cả sân con active**, không chỉ phần khớp filter. Cơ sở không có sân active có count 0, types rỗng và minPrice null (xếp cuối khi sort giá). UI ghi rõ giá từ toàn cơ sở; giá đúng sân/slot nằm ở bước chọn sân/giờ.

`/pitches?venueId=...` là dạng lọc toàn bộ catalog; `/venues/{id}/pitches` diễn đạt quan hệ và trả 404 khi cơ sở không tồn tại/không được xem. Danh sách public chỉ gồm sân active trong cơ sở active. `scope=mine` liệt kê cả inactive nhưng chỉ chủ sở hữu được phép dùng; nested scope này còn kiểm tra đúng chủ cơ sở.

Booking feed thường có bản ghi mới → composite cursor `(createdAt DESC, id DESC)`:

```http
GET /api/v1/bookings?status=confirmed&limit=6
GET /api/v1/bookings?status=confirmed&limit=6&cursor=<nextCursor>
```

Response có `meta.hasMore`, `meta.nextCursor`, `links.next`. Cursor mock là Base64URL JSON chứa tuple và ràng buộc user/status; client phải coi là opaque. Đổi filter/user phải bỏ cursor. Base64 **không phải mã hóa hoặc chữ ký**. Backend nên ký HMAC cursor và vẫn kiểm tra quyền độc lập. Cursor không đảm bảo snapshot toàn bộ dữ liệu khi trạng thái thay đổi giữa hai lần đọc; không sửa `createdAt` khi hủy để tránh đổi thứ tự.

Không thêm sparse fieldsets/offset-cursor song song chỉ để đủ tính năng lab; chúng chưa có use case trong MVP. Nếu rubric yêu cầu, thêm vào hợp đồng và test trước.

## 5. Lỗi và mã trạng thái

```json
{
  "type": "urn:keosan:problem:slot-unavailable",
  "title": "Conflict",
  "status": 409,
  "detail": "Khung giờ này vừa được đặt hoặc đã qua. Vui lòng chọn giờ khác.",
  "instance": "/api/v1/bookings",
  "code": "SLOT_UNAVAILABLE",
  "requestId": "38f7abac-5d26-46e9-8494-60dcda1c32ad"
}
```

`type/title/status/detail/instance` theo Problem Details; `code/requestId/errors` là extension của project. `errors[]` chứa `field/message` cho validation. Client xử lý theo `status/code`, không dựa vào câu tiếng Việt. Không trả stack trace, query DB hoặc password.

| Status | Trường hợp                                                                                                        |
| ------ | ----------------------------------------------------------------------------------------------------------------- |
| 400    | JSON hỏng, thiếu parameter/header thường, ID/query/date sai                                                       |
| 401    | Thiếu/hết hạn token hoặc sai login; có `WWW-Authenticate`                                                         |
| 403    | Đã xác thực nhưng sai role hoặc không sở hữu sân                                                                  |
| 404    | Không có tài nguyên; booking người khác cũng trả 404                                                              |
| 405    | Method không hỗ trợ; có `Allow`                                                                                   |
| 409    | Slot đã có người đặt, hạn hủy, sân còn booking, cơ sở còn sân con, trùng tên sân trong cơ sở, key trùng body khác |
| 412    | `If-Match` không còn đúng version                                                                                 |
| 413    | Body vượt 32 KB                                                                                                   |
| 415    | Sai Content-Type                                                                                                  |
| 422    | JSON đúng cú pháp nhưng sai schema/nghiệp vụ slot                                                                 |
| 428    | Thiếu `If-Match` khi sửa/xóa cơ sở hoặc sân                                                                       |
| 429    | Login vượt 20 lần/phút/IP; có `Retry-After`                                                                       |
| 500    | Lỗi nội bộ; chi tiết chỉ ghi server log                                                                           |

## 6. Đặt sân và concurrency

1. GET availability chỉ là thông tin ở thời điểm đọc, chưa giữ chỗ.
2. Mỗi slot đúng 60 phút, bắt đầu giờ tròn trong 06:00–23:00, không nhận giờ đã qua; tối đa 30 ngày từ ngày hiện tại.
3. POST booking chỉ nhận `pitchId/startAt/contactName/contactPhone/note`. Không nhận `price/userId/status/venueId` từ client. Server tra pitch → venue, kiểm cả hai đang active; response lưu snapshot `venueId/venueName/pitchId/pitchName/pitchType/address` tại lúc đặt.
4. Server tính `endAt/total/userId/status`; 17:00 ≤ giờ bắt đầu < 22:00 phụ thu 100.000đ.
5. `Idempotency-Key` bắt buộc, 8–100 ký tự ASCII `[a-zA-Z0-9_-]`, scope theo user + operation, giữ 24 giờ. Cùng key/cùng payload trả lại booking gốc (201 và Location gốc). Cùng key/khác payload trả 409.
6. Không cache lỗi validation/conflict trong mock. Frontend giữ nguyên key khi retry sau lỗi mạng; thay dữ liệu thì dùng key mới. Không tự retry mutation bằng key mới.
7. Hủy là `PUT /bookings/{id}/cancellation`, body `{reason}`. Lần đầu 201, lần sau cùng reason 200. Reason đã tạo là bất biến, đổi reason trả 409. Hủy được đến thời điểm còn ít nhất 2 giờ; retry lần hủy đã thành công vẫn trả 200 sau mốc này.
8. Khóa lịch theo **pitchId + startAt**, không theo venueId hoặc loại sân. Đặt/hủy Sân số 1 không thay đổi lịch Sân số 2 dù cùng loại và cơ sở. Mock thao tác đồng bộ trong một process. Backend phải dùng unique slot claim và transaction; xem MONGODB.md. Chỉ kiểm tra rồi insert sẽ có race condition.

Hủy thay đổi trạng thái booking sang `cancelled`, giữ lịch sử; không DELETE booking. Chỉ hủy mới giải phóng slot. Bản replay idempotency vẫn phản ánh kết quả **tạo ban đầu**, muốn trạng thái mới đọc GET booking.

## 7. Sửa cơ sở và sân đồng thời

GET venue/pitch trả strong ETag `"1"`. PUT/PATCH/DELETE phải gửi `If-Match: "1"`. Server kiểm tra quyền sở hữu và version, cập nhật thành version 2, trả ETag `"2"`. Client có version cũ nhận 412 và phải tải lại, không ghi đè thay đổi của người khác. Thêm/sửa/xóa sân con tăng cả version cơ sở, vì response cơ sở có các trường tổng hợp sân con. Pitch DTO chỉ chứa venueId và link tới cơ sở, không nhúng thông tin cơ sở đang thay đổi; version pitch không phải tăng chỉ vì cơ sở đổi tên.

Ở backend thật, venue update có filter `{_id, ownerId, version}`; pitch update có `{_id, venueId, version}` và kiểm ownerId trên venue trong cùng transaction. Pitch không lưu ownerId riêng. Thay đổi sân và tăng version cơ sở phải commit cùng nhau; đọc summary + version cơ sở cần cùng snapshot nhất quán. Khi xóa/ngừng phải đồng bộ với booking đang được tạo để không sinh booking mồ côi. Xem MONGODB.md về transaction/write conflict. Mock `Cache-Control: no-store` không triển khai 304/If-None-Match; ETag ở đây phục vụ concurrency.

## 8. Bảo mật và phạm vi chưa triển khai

- Mock dùng token opaque random, sống 15 phút; server lưu session và thu hồi khi logout. Token chỉ ở memory frontend.
- Phân biệt authentication, role và object ownership. UI ẩn nút **không thay thế** kiểm tra phía server.
- Không thể tự gán role, userId, ownerId, total hay trạng thái bằng body.
- Limit/payload cap, whitelist query, giới hạn login và CORS loopback có trong mock.
- Production cần password hashing, TLS, rate limit dùng shared store, audit log, secret management, refresh token rotation/cookie hoặc tái đăng nhập theo chính sách. JWT nếu dùng phải kiểm chữ ký, issuer/audience/expiry và ghim algorithm.
- Không có password hash/refresh/payment/MongoDB đang hoạt động trong skeleton. Không thể dùng kết quả test mock để tuyên bố hệ thống đạt chuẩn bảo mật production.

## 9. Liên hệ nội dung môn học

| Chủ đề lab đã đọc                               | Thể hiện trong project                                                            |
| ----------------------------------------------- | --------------------------------------------------------------------------------- |
| B1: Methods, validation, 201/204/409            | Catalog CRUD, booking conflict, schema guard                                      |
| B2: PUT vs PATCH, Location, cache, links        | PUT đủ field, PATCH một phần, Location, no-store, navigation links                |
| B3: resource tree, problem details, cursor      | Venue/pitches, pitch/availability, booking/cancellation; RFC 9457; booking cursor |
| B4: OAS, reusable schema, operationId, security | 22 operations, schema refs, bearer scheme, YAML/JSON/Swagger                      |
| B5: offset/cursor, multi-key sorting, whitelist | Offset catalog, composite booking cursor, sort allowlist                          |
| B6: AuthN/AuthZ, BOLA                           | 401/403/404 policy, owner check, booking ownership tests                          |

Chưa có rubric bài tập nhóm trong `BTnhom` lúc khởi tạo. Bảng này là mapping chủ đề đã quan sát, không tự đặt thêm yêu cầu môn học.
