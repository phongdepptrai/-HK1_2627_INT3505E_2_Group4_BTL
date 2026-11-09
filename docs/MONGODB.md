# Thiết kế MongoDB để người làm backend triển khai

> **LEGACY — thiết kế collections `pitches` của phiên bản trước.** Không chạy index hay triển khai nguyên trạng theo bản này cho frontend mới. Nhóm đã chuyển sang `sport_types/venues/courts/bookings/payments/reviews`; xem [FRONTEND_HANDOFF.md](FRONTEND_HANDOFF.md). MongoDB và backend mới chưa triển khai.

**Tình trạng:** thiết kế bàn giao, chưa kết nối MongoDB hay chạy migration. File `database/indexes.mongosh.js` chỉ là đề xuất index để review. Không chứa URI/credential thật.

## Collections

| Collection        | Trường chính                                                                                                                                                                                               | Quy tắc                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `users`           | `_id`, `name`, `emailNormalized`, `passwordHash`, `role`, `createdAt`                                                                                                                                      | Email unique; không trả passwordHash; role không nhận từ signup body                     |
| `venues`          | `_id`, `ownerId`, `name`, `district`, `address`, `description`, `amenities`, `imageKey`, `isActive`, `rating`, `reviewCount`, `version`, `createdAt`                                                       | Một cơ sở có nhiều sân; ownerId là nguồn quyền sở hữu duy nhất                           |
| `pitches`         | `_id`, `venueId`, `name`, `normalizedName`, `type`, `price`, `description`, `imageKey`, `isActive`, `version`, `createdAt`                                                                                 | Một document là một sân vật lý; venueId bắt buộc, bất biến; tên duy nhất trong cơ sở     |
| `bookings`        | `_id`, `userId`, `venueId`, `venueName`, `pitchId`, `pitchName`, `pitchType`, `address`, `imageKey`, `startAt`, `endAt`, `total`, `currency`, `status`, `contactName`, `contactPhone`, `note`, `createdAt` | Snapshot cơ sở/sân/địa chỉ/giá do server tra tại lúc đặt; giữ lịch sử sau hủy và đổi tên |
| `slotClaims`      | `_id`, `pitchId`, `startAt`, `bookingId`                                                                                                                                                                   | Chỉ tồn tại cho booking đang confirmed; unique `(pitchId,startAt)`                       |
| `cancellations`   | `_id`, `bookingId`, `reason`, `createdAt`                                                                                                                                                                  | Một cancellation/booking; lý do đã tạo bất biến                                          |
| `idempotencyKeys` | `_id`, `userId`, `operation`, `key`, `requestHash`, `statusCode`, `responseBody`, `location`, `expiresAt`                                                                                                  | Unique user+operation+key; TTL 24h; expiry vẫn phải kiểm tra trong app                   |
| `sessions`        | `_id`, `tokenHash`, `userId`, `expiresAt`, `revokedAt`                                                                                                                                                     | Nếu backend tiếp tục dùng opaque tokens; hash token trong DB                             |

ObjectId lưu bằng BSON ObjectId trong database, chuyển sang string khi trả API. `startAt/endAt/createdAt/expiresAt` là BSON Date UTC. `price/total` là số nguyên VND. Không lưu ngày/giờ không kèm timezone thành thời điểm chính thức. `rating/reviewCount` hiện là dữ liệu demo; nếu có review service sau này phải tính từ đánh giá đã xác minh.

Ví dụ Hà Đông: một venue chứa ba pitch có tên Sân số 1 (5 người), Sân số 2 (5 người), Sân số 3 (11 người). **Không đặt unique `(venueId,type)`** vì một cơ sở được có nhiều sân cùng loại. `normalizedName` do server tính (NFD bỏ dấu, đ→d, chữ thường, trim/gộp khoảng trắng); unique `(venueId,normalizedName)` chỉ ngăn trùng tên trong cùng cơ sở, áp dụng cả sân inactive. Field này nội bộ, không nhận/trả qua API.

`pitchCount/pitchTypes/minPrice` là DTO tổng hợp từ tất cả sân active; có thể dùng aggregation hoặc lưu projection cập nhật nguyên tử. Không sao chép địa chỉ, tiện ích và ownerId vào pitch. Khi lọc cơ sở theo type + maxPrice, cả hai phải khớp cùng một sân active; kết quả tổng hợp vẫn phản ánh tất cả sân active của cơ sở.

## Vì sao cần slotClaims?

Sai:

```text
find booking trùng → nếu không có → insert booking
```

Hai request đồng thời đều có thể đọc “không có” rồi cùng insert. Frontend disable nút không giải quyết race giữa hai người dùng.

Đúng cho MVP slot cố định 60 phút:

1. Validate thời gian theo lịch slot cố định, chuẩn hóa `startAt` sang UTC.
2. Trong **cùng một transaction**: kiểm idempotency; tra pitch → venue, kiểm cả hai còn nhận đặt/giá hiện hành và ghi chạm cả hai để serialize với đóng/xóa (xem bên dưới); insert claim có unique `(pitchId,startAt)`; insert booking với snapshot cơ sở/sân; ghi kết quả idempotency.
3. Commit trước khi trả 201. Duplicate key trên claim → 409 `SLOT_UNAVAILABLE`. Duplicate key trên idempotency → đọc bản đã commit, so requestHash và replay; không nhầm mọi duplicate key thành slot conflict.
4. Cùng key nhưng transaction kia còn chạy: retry đọc có giới hạn hoặc quy định rõ response in-progress trước khi đổi contract. Không tạo booking lần hai.
5. Tính hash từ payload đã canonicalize, bao gồm mọi field ảnh hưởng nghiệp vụ, scope theo principal và operation. Mock so JSON top-level đã sort vì payload hiện tại chỉ chứa giá trị scalar.

[Unique compound index của MongoDB](https://www.mongodb.com/docs/manual/core/index-unique/) bảo vệ tổ hợp field; [transaction](https://www.mongodb.com/docs/manual/core/transactions/) dùng cho các thay đổi nhiều document. Cần MongoDB replica set (Atlas phù hợp) hoặc topology hỗ trợ transaction; MongoDB standalone không đủ cho thiết kế này.

Không dùng unique `(pitchId,startAt)` để tuyên bố chống overlap của khoảng thời gian tùy ý. Nếu cho đặt 90 phút hoặc startAt tùy ý, phải chia interval thành nhiều slot chuẩn và claim tất cả trong transaction hoặc thiết kế cơ chế khóa lịch khác.

Không khóa theo `(venueId,startAt)` hoặc `(venueId,type,startAt)`: ba sân Hà Đông phải có thể được đặt cùng giờ, kể cả hai sân cùng loại 5 người. Claim gắn đúng pitch; hủy một sân không ảnh hưởng sân bên cạnh.

## Hủy lịch nguyên tử

Transaction đọc booking theo `_id + userId` và cancellation hiện có. Nếu đã hủy cùng lý do, trả lại resource; nếu chưa hủy, kiểm cutoff bằng thời gian server. Cập nhật status `cancelled`, insert cancellation unique và delete đúng claim `{pitchId,startAt,bookingId}` cùng transaction. Không xóa claim chỉ bằng pitchId; có thể xóa slot của booking mới.

## Sửa / ngừng / xóa cơ sở và sân

- Venue update dùng `{_id, ownerId, version}` + `$inc: {version:1}`. Pitch update dùng `{_id, venueId, version}` sau khi kiểm chủ sở hữu trên venue; không có pitch.ownerId. matchedCount 0 cần phân biệt 404/403/412 theo chính sách.
- Tạo/sửa/xóa pitch và tăng version venue trong cùng transaction. Điều này giữ ETag cơ sở đúng khi pitchCount/pitchTypes/minPrice thay đổi. Đọc version + summary trong cùng snapshot, hoặc đọc projection đã commit nguyên tử.
- Không cho sửa venueId qua PUT/PATCH; không triển khai chuyển chủ/chuyển cơ sở trong hợp đồng hiện tại. MongoDB không tự bảo đảm khóa ngoại, app phải kiểm venue tồn tại và khóa cập nhật parent khi tạo child.
- Ngừng sân hoặc cơ sở không tự hủy booking đã confirmed. Cơ sở inactive chặn booking mới trên mọi sân con; lịch cũ giữ snapshot.
- Xóa cơ sở chỉ khi không còn bất kỳ pitch nào (kể cả inactive). Không cascade. Tạo/xóa pitch và xóa venue phải serialize qua cùng document venue để tránh child mồ côi.
- Xóa sân chỉ khi không có booking confirmed có `endAt > now`. Đặt lịch, ngừng/xóa sân và ngừng/xóa cơ sở phải serialize: booking transaction ghi chạm cả pitch và venue (ví dụ trường nội bộ `bookingRevision`) để gây write conflict/retry, hoặc cơ chế khóa tương đương. Cả transaction phải đọc lại sau retry. Chỉ read trạng thái trong snapshot rồi ghi booking không đủ chống write-skew. Khóa chung trên venue có chi phí contention; đo và tối ưu khi triển khai thật, không làm mất khả năng đặt các pitch độc lập.
- Nếu tách Catalog và Booking thành service/DB độc lập, ưu tiên quy trình “ngừng nhận lịch → xác nhận không còn lịch → xóa mềm” có version/event; phải thiết kế bổ sung, không dùng giả định transaction nội bộ.

## Cursor query

Sau cursor `(t,id)` với thứ tự giảm dần:

```javascript
{
  userId: currentUserId,
  ...(status ? { status } : {}),
  $or: [
    { createdAt: { $lt: cursorDate } },
    { createdAt: cursorDate, _id: { $lt: cursorObjectId } }
  ]
}
// sort({createdAt:-1, _id:-1}).limit(limit + 1)
```

Chỉ dựng query từ giá trị đã validate/convert. Không truyền JSON query từ client vào `$where`, regex tùy ý hoặc filter MongoDB nguyên bản. Index catalog trong file đề xuất cần đo bằng `explain()` theo truy vấn thực tế; chưa có benchmark hay đảm bảo index tối ưu cho mọi tổ hợp filter.

## TTL không phải logic bảo mật

TTL dọn dữ liệu bất đồng bộ. App luôn kiểm `expiresAt` khi dùng session/idempotency dù document chưa bị MongoDB xóa. Khi tái sử dụng key đã hết hạn nhưng unique record còn tồn tại, cần xử lý atomically replace/delete theo expiry trong transaction để không bị duplicate key vô hạn.
