from django.contrib import admin
from .models import Role, User

@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'description')
    search_fields = ('code', 'name')


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('username', 'full_name', 'phone', 'role', 'status', 'created_at')
    list_filter = ('status', 'role')
    search_fields = ('username', 'full_name', 'phone')
