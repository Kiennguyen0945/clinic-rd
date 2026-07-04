from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password
from auth_service.models import Role, User


class Command(BaseCommand):
    help = "Seed database với roles và users mặc định"

    def handle(self, *args, **options):
        self.stdout.write("=== Bắt đầu seed dữ liệu ===")

        # ── Roles ──────────────────────────────────────────────
        roles_data = [
            {"code": "MANAGER", "name": "Manager", "description": "Quản lý phòng khám"},
            {"code": "DOCTOR", "name": "Doctor", "description": "Bác sĩ khám chữa bệnh"},
            {"code": "RECEPTIONIST", "name": "Receptionist", "description": "Lễ tân / tiếp tân"},
        ]

        created_roles = {}
        for r in roles_data:
            role, created = Role.objects.get_or_create(
                code=r["code"],
                defaults={"name": r["name"], "description": r["description"]},
            )
            created_roles[role.code] = role
            if created:
                self.stdout.write(self.style.SUCCESS(f"  + Đã tạo role: {role.name}"))
            else:
                self.stdout.write(f"  . Role đã tồn tại: {role.name}")

        # ── Users ──────────────────────────────────────────────
        users_data = [
            {
                "username": "manager",
                "password": "Manager@123",
                "full_name": "Quản lý Nguyễn Văn A",
                "phone": "0900000001",
                "role_code": "MANAGER",
                "status": "ACTIVE",
            },
            {
                "username": "doctor1",
                "password": "Doctor@123",
                "full_name": "Bác sĩ Nguyễn Văn A",
                "phone": "0900000002",
                "role_code": "DOCTOR",
                "status": "ACTIVE",
            },
            {
                "username": "doctor2",
                "password": "Doctor@123",
                "full_name": "Bác sĩ Trần Thị B",
                "phone": "0900000003",
                "role_code": "DOCTOR",
                "status": "ACTIVE",
            },
            {
                "username": "doctor3",
                "password": "Doctor@123",
                "full_name": "Bác sĩ Lê Văn C",
                "phone": "0900000004",
                "role_code": "DOCTOR",
                "status": "ACTIVE",
            },
            {
                "username": "receptionist",
                "password": "Recep@123",
                "full_name": "Lễ tân Phạm Thị D",
                "phone": "0900000005",
                "role_code": "RECEPTIONIST",
                "status": "ACTIVE",
            },
        ]

        for u in users_data:
            role = created_roles.get(u["role_code"])
            if not role:
                self.stdout.write(self.style.WARNING(f"  ! Bỏ qua user {u['username']}: role {u['role_code']} không tồn tại"))
                continue

            _, created = User.objects.get_or_create(
                username=u["username"],
                defaults={
                    "password_hash": make_password(u["password"]),
                    "full_name": u["full_name"],
                    "phone": u["phone"],
                    "role": role,
                    "status": u["status"],
                },
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f"  + Đã tạo user: {u['username']} ({u['full_name']})"))
            else:
                self.stdout.write(f"  . User đã tồn tại: {u['username']}")

        self.stdout.write("=== Seed dữ liệu hoàn tất ===")
