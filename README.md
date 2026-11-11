# Clinic — Quản lý phòng khám | CI/CD & Hạ tầng

![Django](https://img.shields.io/badge/Django-092E20?logo=django&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-2088FF?logo=githubactions&logoColor=white)

Ứng dụng quản lý phòng khám (bệnh nhân, lịch hẹn, báo cáo) gồm backend Django, reporting service
riêng và frontend React — đóng gói bằng Docker, triển khai qua pipeline **CI/CD 4 tầng**.

> Đồ án nhóm. Phần mình làm: **CI/CD và hạ tầng** — Dockerfile, Nginx, docker-compose,
> toàn bộ GitHub Actions workflow và quy trình nhánh / pull request.

## Kiến trúc

```
Trình duyệt ──▶ Nginx (80) ──┬── /            → React build (static)
                             ├── /api/…       → backend (Django + Gunicorn)
                             └── /reporting/… → reporting_service
                                     │
                              PostgreSQL 16
```

| Thư mục | Nội dung |
|---|---|
| `apps/backend/` | Django API: xác thực, bệnh nhân, lịch hẹn, `internal_reporting` |
| `apps/reporting_service/` | Service báo cáo độc lập, đồng bộ dữ liệu từ backend |
| `apps/frontend/` | React SPA, quality gate riêng (`npm run ci`) |
| `apps/docker/` | Dockerfile backend / frontend / reporting / nginx |
| `deploy/`, `cron/` | Cấu hình deploy và tác vụ định kỳ |

## Pipeline CI/CD

```
PR vào main ─▶ ci
               ├─ validate-branch-name  (feat|fix|imp/… + mã ticket Linear cli-<số>)
               ├─ detect-changes        (chỉ build phần thay đổi: backend / reporting / frontend / nginx)
               └─ test từng phần → build & push image lên Docker Hub (tag = commit SHA)

merge vào main ─▶ ci cập nhật biến CURRENT_*_TAG
workflow_dispatch ─▶ staging → production → rollback-production
```

- **Tag SHA + biến `CURRENT_*_TAG`** → rollback chỉ là trỏ về tag cũ, không build lại.
- **Branch protection**: `main` không cho merge khi CI chưa xanh.
- Workflow: [`ci`](.github/workflows/ci.yaml) · [`staging`](.github/workflows/staging.yaml) ·
  [`production`](.github/workflows/production.yaml) ·
  [`rollback-production`](.github/workflows/rollback-production.yaml)

## Kết quả

| Hạng mục | Trước → Sau |
|---|---|
| Image frontend (multi-stage + Nginx serve static) | **341MB → 62,3MB** |
| 500 request phục vụ tĩnh | **2,7s → 1,8s** |

## Chạy dev

```bash
cp .env.example .env
docker compose -f docker-compose.dev.yaml up --build
# http://localhost — Nginx phục vụ frontend và proxy /api/
```

## Liên hệ

Nguyễn Trung Kiên — nguyentrungkienhp202@gmail.com
