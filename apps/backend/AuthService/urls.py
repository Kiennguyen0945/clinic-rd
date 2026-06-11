from django.urls import path
from .views import homePageView
from .views import role_api

urlpatterns = [
    path('home/', homePageView, name='home'),
    path('roles/', role_api, name='role-api')
    
]