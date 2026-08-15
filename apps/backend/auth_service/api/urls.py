from django.urls import path

from .views import (
    ChangePasswordView,
    PersonalProfileView,
    StaffCreateView,
    StaffDetailView,
    StaffRoomAllocationView,
    StaffToggleLockView,
    homePageView,
    login_api,
    refresh_api,
    role_api,
    user_api,
)

urlpatterns = [
    path("home/", homePageView, name="home"),
    path("auth/roles/", role_api, name="role_api"),
    path("auth/users/", user_api, name="user-api"),
    path("auth/login/", login_api, name="login-api"),
    path("auth/refresh/", refresh_api, name="refresh-api"),
    path("auth/change-password/", ChangePasswordView.as_view(), name="change-password"),
    path("auth/me/", PersonalProfileView.as_view(), name="personal-profile"),
    path("auth/staff/", StaffCreateView.as_view(), name="staff-create"),
    path("auth/staff/<int:pk>/", StaffDetailView.as_view(), name="staff-detail"),
    path(
        "auth/staff/<int:pk>/room-allocations/",
        StaffRoomAllocationView.as_view(),
        name="staff-room-allocation",
    ),
    path(
        "auth/staff/<int:pk>/lock/",
        StaffToggleLockView.as_view(),
        name="staff-toggle-lock",
    ),
]
