# Auth API Contract

## 1. Login (Obtain Token)

```
POST /api/auth/login/
Auth: None (public endpoint)
```
Request body:
```json
{
  "username": "string (required)",
  "password": "string (required)"
}
```
Success `200 OK`:
```json
{
  "success": true,
  "data": {
    "token": "string (JWT)",
    "user": {
      "id": "string (uuid)",
      "username": "string",
      "fullName": "string",
      "role": {
        "code": "string",
        "name": "string"
      },
      "status": "string (ACTIVE|INACTIVE|LOCKED)"
    }
  },
  "message": "Đăng nhập thành công"
}
```
Errors:
- `401` – `code: "INVALID_CREDENTIALS"`, `message: "Sai tên đăng nhập hoặc mật khẩu"`
- `403` – `code: "ACCOUNT_LOCKED"`, `message: "Tài khoản đã bị khóa"`

Business rules:
- Kiểm tra `username` có tồn tại trong `Users`.
- Kiểm tra `password` khớp với `passwordHash`.
- Kiểm tra `status = "ACTIVE"` (không phải `"LOCKED"`).
- Token payload chứa thông tin user và permissions.
- Token có thời gian hết hạn cấu hình được.

---

## 2. Change Personal Password

```
PUT /api/auth/change-password/
Auth: Bearer <token>
```
Request body:
```json
{
  "currentPassword": "string (required)",
  "newPassword": "string (required)",
  "confirmNewPassword": "string (required)"
}
```
Success `200 OK`:
```json
{
  "success": true,
  "message": "Đổi mật khẩu thành công"
}
```
Errors:
- `400` – `code: "PASSWORD_MISMATCH"`, `message: "Mật khẩu mới không khớp"`
- `400` – `code: "WEAK_PASSWORD"`, `message: "Mật khẩu mới không đủ mạnh (tối thiểu 8 ký tự, bao gồm chữ hoa, chữ thường và số)"`
- `401` – `code: "UNAUTHORIZED"`
- `403` – `code: "FORBIDDEN"`
- `404` – `code: "USER_NOT_FOUND"`
- `400` – `code: "INCORRECT_CURRENT_PASSWORD"`, `message: "Mật khẩu hiện tại không đúng"`

Business rules:
- Xác thực user qua token.
- `currentPassword` phải khớp với `passwordHash` hiện tại.
- `newPassword` phải bằng `confirmNewPassword`.
- `newPassword` phải đáp ứng yêu cầu độ mạnh (độ dài, ký tự đặc biệt, v.v.).
- Hash `newPassword` và cập nhật `passwordHash`, `updatedAt`.

---

## 3. Create Staff Account

```
POST /api/auth/users/
Auth: Bearer <token> (role=manager)
```
Request body:
```json
{
  "username": "string (required)",
  "fullName": "string (required)",
  "phone": "string (optional)",
  "roleCode": "string (required, role code: receptionist|doctor|manager)",
  "password": "string (optional, auto-generated if omitted)"
}
```
Success `201 Created`:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "string (uuid)",
      "username": "string",
      "fullName": "string",
      "phone": "string",
      "role": {
        "code": "string",
        "name": "string"
      },
      "status": "ACTIVE",
      "createdAt": "string (ISO datetime)"
    }
  },
  "message": "Tạo tài khoản nhân viên thành công"
}
```
Errors:
- `400` – `code: "VALIDATION_ERROR"`, `details: {field: "error message"}`
- `400` – `code: "DUPLICATE_USERNAME"`, `message: "Tên đăng nhập đã tồn tại"`
- `400` – `code: "INVALID_ROLE"`, `message: "Role không hợp lệ"`
- `403` – `code: "FORBIDDEN"`

Business rules:
- `username` phải là duy nhất trong `Users`.
- `roleCode` phải tham chiếu đến `Role` có sẵn.
- Nếu không cung cấp `password`, hệ thống tự sinh mật khẩu mặc định.
- `status` mặc định = `"ACTIVE"`.
- `password` được hash trước khi lưu.

---

## 4. List Staff Accounts (Manager only)

```
GET /api/auth/users/?status={status}&roleCode={roleCode}
Auth: Bearer <token> (role=manager)
```
Query params (all optional):
- `status` – Lọc theo trạng thái: ACTIVE | INACTIVE | LOCKED.
- `roleCode` – Lọc theo role: receptionist | doctor | manager.

Success `200 OK`:
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "string (uuid)",
        "username": "string",
        "fullName": "string",
        "phone": "string",
        "role": {
          "code": "string",
          "name": "string"
        },
        "status": "string (ACTIVE|INACTIVE|LOCKED)",
        "createdAt": "string (ISO datetime)",
        "updatedAt": "string (ISO datetime)"
      }
    ]
  },
  "message": "Lấy danh sách tài khoản thành công"
}
```
Errors:
- `401` – `code: "UNAUTHORIZED"`
- `403` – `code: "FORBIDDEN"`

Business rules:
- Chỉ manager mới có quyền xem danh sách tài khoản.
- Sắp xếp theo `created_at` DESC.

---

## 5. Get Staff Account Detail

```
GET /api/auth/users/{userId}/
Auth: Bearer <token> (role=manager)
```
Success `200 OK`:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "string (uuid)",
      "username": "string",
      "fullName": "string",
      "phone": "string",
      "role": {
        "code": "string",
        "name": "string"
      },
      "status": "string (ACTIVE|INACTIVE|LOCKED)",
      "createdAt": "string (ISO datetime)",
      "updatedAt": "string (ISO datetime)"
    }
  },
  "message": "Lấy thông tin tài khoản thành công"
}
```
Errors:
- `403` – `code: "FORBIDDEN"`
- `404` – `code: "USER_NOT_FOUND"`, `message: "Không tìm thấy tài khoản"`

---

## 6. Lock / Unlock Account

```
PATCH /api/auth/users/{userId}/status/
Auth: Bearer <token> (role=manager)
```
Request body:
```json
{
  "action": "string (required, lock|unlock)"
}
```
Success `200 OK`:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "string (uuid)",
      "username": "string",
      "fullName": "string",
      "status": "string (LOCKED|ACTIVE)",
      "updatedAt": "string (ISO datetime)"
    }
  },
  "message": "Khóa tài khoản thành công"
}
```
Hoặc (khi unlock):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "string",
      "username": "string",
      "fullName": "string",
      "status": "ACTIVE",
      "updatedAt": "string"
    }
  },
  "message": "Mở khóa tài khoản thành công"
}
```
Errors:
- `400` – `code: "SELF_LOCK"`, `message: "Không thể khóa tài khoản của chính mình"`
- `400` – `code: "INVALID_ACTION"`, `message: "Hành động không hợp lệ, chỉ chấp nhận lock hoặc unlock"`
- `403` – `code: "FORBIDDEN"`
- `404` – `code: "USER_NOT_FOUND"`, `message: "Không tìm thấy tài khoản"`

Business rules:
- `action = "lock"` → set `status = "LOCKED"`.
- `action = "unlock"` → set `status = "ACTIVE"`.
- Không cho phép manager khóa chính tài khoản của mình.
- Nếu có cơ chế blacklist, thu hồi token khi khóa tài khoản.

---

## Common Error Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Mô tả lỗi tiếng Việt",
    "details": {}
  }
}
```
