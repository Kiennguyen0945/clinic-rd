from django.shortcuts import render
from django.http import HttpResponse
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import User, Role
from .serializers import UserSerializer, RoleSerializer



@api_view(['GET', 'POST'])
def role_api(request):
    if request.method == 'GET':
        roles = Role.objects.all()
        serializer = RoleSerializer(roles, many=True)
        return Response(serializer.data)
    if request.method  == 'POST':
        serializer = RoleSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)

@api_view(['GET', 'POST'])
def user_api(request):
    if request.method == 'GET': 
        users = User.objects.all()
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)
    if request.method == 'POST':
        serializer=UserSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)

        


def homePageView(request):
    return HttpResponse('Hello, World')


# Create your views here.
