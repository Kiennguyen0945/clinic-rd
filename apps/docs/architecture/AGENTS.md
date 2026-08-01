# AGENTS.md

Tài liệu này mô tả ngắn gọn kiến trúc của Clinic RD để dùng làm ngữ cảnh mặc định cho các phiên chat trong workspace này.

## Ngữ cảnh mặc định

- Ưu tiên đọc `docker-compose.dev.yaml` và `docker-compose.prod.yaml` trước khi suy luận về luồng chạy của hệ thống.
- Xem Docker Compose là nguồn sự thật cho cách các service được ghép nối, port, biến môi trường và phụ thuộc runtime.
- Nếu có mâu thuẫn giữa tài liệu cũ và Compose hiện tại, ưu tiên Compose và cấu trúc code thực tế.

## Kiến trúc tổng quan

- `apps/backend/` chứa Django backend.
- `apps/frontend/` chứa frontend React + Vite.
- `docker/` chứa Dockerfile và cấu hình Nginx cho dev/prod.

## Backend

- Backend được chia theo service domain: `auth_service`, `patient_service`, `appointment_service` và `custom_commands`.
- Django project chính nằm trong `apps/backend/backend/`.
- SQLite hiện có ở `apps/backend/db.sqlite3`.
- Các endpoint và luồng xác thực nên được đối chiếu với tài liệu API trong `docs/api/` khi cần.

## Frontend

- Frontend dùng React, TypeScript và Vite.
- Cấu trúc giao diện nằm trong `apps/frontend/src/` với `components/`, `pages/`, `lib/` và `store.ts`.
- Nếu cần bối cảnh UI, ưu tiên tài liệu trong `docs/rules/CodePractice.md` và ghi chú UI hiện có của repo.

## Cách làm việc khi chat

- Khi trả lời về kiến trúc hoặc cách chạy dự án, bắt đầu từ Compose rồi mới đi vào từng service.
- Khi cần xác nhận hành vi, kiểm tra code trong service tương ứng thay vì suy đoán từ tài liệu tĩnh.
- Giữ câu trả lời bám vào cấu trúc repo hiện tại, không thêm giả định về dịch vụ hoặc thư mục chưa xuất hiện trong cây thư mục.