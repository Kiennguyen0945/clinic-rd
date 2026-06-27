from django.shortcuts import render
from django.http import HttpResponse
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import User, Role
from .serializers import UserSerializer, RoleSerializer
from django.contrib.auth.hashers import check_password
from rest_framework_simplejwt.tokens import RefreshToken



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

@api_view(['POST'])
def login_api(request):
    username = request.data.get('username')
    password = request.data.get('password')
    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        return Response({"errors": "Account is looked"}, status = 401)
    if getattr(user, 'status', '') == 'Locked':
        return Response({"errors": "Account is locked "}, status = 403)
    if not check_password(password, user.password_hash):
        return Response({"errors": "Invalid username or password."}, status = 401)
    refresh = RefreshToken.for_user(user)
    return Response({
        'token': str(refresh.access_token),
        'user': {
            'id': user.id,
            'username': user.username,
            'status': user.status if hasattr(user, 'status') else 'ACTIVE'
        }
    }, status=200)


        


def homePageView(request):
    return HttpResponse('Hello, World')


# Create your views here.
