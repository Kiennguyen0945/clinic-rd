CLINIC-RD/
│
├── apps/
│   └── backend/                    # Django Backend
│       ├── appointment_service/    # Quản lý lịch hẹn
│       ├── auth_service/           # Xác thực và phân quyền
│       ├── backend/                # Cấu hình Django Project
│       ├── custom_commands/        # Custom management commands
│       ├── patient_service/        # Quản lý bệnh nhân
│       ├── productfiles/           # File upload (media)
│       ├── venv/                   # Python Virtual Environment
│       ├── db.sqlite3              # SQLite Database
│       ├── entrypoint.sh           # Docker Entrypoint
│       ├── manage.py               # Django Management
│       └── requirements.txt        # Python Dependencies
│
├── diagrams/                       # UML, ERD, Sequence Diagram,...
│
├── docker/                         # Docker configuration
│
├── docs/                           # Tài liệu dự án
│   ├── AppointmentService.md
│   ├── AuthService.md
│   └── PatientService.md
    frontend/src/
    │
    ├── components/          # CÁC MẢNH GHÉP NHỎ (Dùng đi dùng lại)
    │   ├── Sidebar.tsx      # Thanh menu điều hướng duy nhất của ông
    │   ├── Header.tsx       # Thanh thanh tiêu đề trên cùng (hiển thị tên user)
    │   └── MainLayout.tsx   # Cái khung ảnh (Gộp Sidebar + Header + lỗ trống <Outlet />)
    │
    ├── pages/               # CÁC TRANG LỚN (Giao diện chính tương ứng với URL)
    │   ├── Login.tsx        # Trang đăng nhập (/login)
    │   ├── Dashboard.tsx    # Trang tổng quan hôm nay (/dashboard)
    │   ├── Appointments.tsx # Trang quản lý lịch hẹn (/appointments)
    │   └── Patients.tsx     # Trang quản lý bệnh nhân (/patients)
    │
    ├── App.tsx              # FILE TRUNG TÂM: Cấu hình Router (Gõ URL nào ra Trang đó)
    ├── main.tsx             # File chạy chính của React
    └── store.ts             # File duy nhất để lưu token và role (Zustand)
