from django.urls import path
from .views import homePageView, role_api, user_api, login_api

urlpatterns = [
    path('home/', homePageView, name='home'),
    path('api/roles/', role_api, name='role_api'),
    path('api/users/', user_api, name='user-api'),
    path('api/login/', login_api, name='login-api')
]