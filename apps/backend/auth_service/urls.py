from django.urls import path
from .views import homePageView, role_api, user_api, login_api, refresh_api

urlpatterns = [
    path('home/', homePageView, name='home'),
    path('auth/roles/', role_api, name='role_api'),
    path('auth/users/', user_api, name='user-api'),
    path('auth/login/', login_api, name='login-api'),
    path('auth/refresh/', refresh_api, name='refresh-api'),
]