from django.urls import path
from .views import homePageView, role_api, user_api

urlpatterns = [
    path('home/', homePageView, name='home'),
    path('roles/', role_api, name='role_api'),
    path('users/', user_api, name='user-api')
]