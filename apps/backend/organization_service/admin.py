from django.contrib import admin

from .models import Department, DoctorDepartment, Room


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("code", "name")
    search_fields = ("code", "name")


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ("room_number",)
    search_fields = ("room_number",)


@admin.register(DoctorDepartment)
class DoctorDepartmentAdmin(admin.ModelAdmin):
    list_display = ("doctor", "department")
    list_filter = ("department",)
    search_fields = ("doctor__full_name", "department__name")
