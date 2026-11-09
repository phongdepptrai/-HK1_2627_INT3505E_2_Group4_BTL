# Ảnh và font

Ảnh minh họa tải từ Unsplash, lưu local để frontend không phụ thuộc request ảnh khi demo. Không phải ảnh xác minh của các sân được đặt tên trong seed.

- `hero.jpg`: <https://images.unsplash.com/photo-1459865264687-595d652de67e> — mặt sân và đường biên.
- `pitch-1.jpg`: <https://images.unsplash.com/photo-1551958219-acbc608c6377> — bóng và cầu môn.
- `pitch-2.jpg`: <https://images.unsplash.com/photo-1574629810360-7efbbe195018> — bóng trên mặt cỏ.

Logo `favicon.svg` và hình sân trong banner là vector/CSS tạo trong project. Font Be Vietnam Pro tải qua Google Fonts, có fallback Arial/system; internet gián đoạn chỉ ảnh hưởng font, không ảnh hưởng luồng đặt sân mock.

Thay ảnh bằng ảnh sân thật có quyền sử dụng trước khi công bố sản phẩm. Upload/media service chưa triển khai; mock dùng `imageKey` enum để tránh URL bên ngoài tùy ý.
