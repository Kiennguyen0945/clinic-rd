from django.db import models

class Role(models.Model):
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    
    def __str__(self):
        return self.name

class User(models.Model):
    role = models.ForeignKey(Role, on_delete=models.RESTRICT, related_name = "users")
    username = models.CharField(max_length=255)
    password_hash = models.CharField(max_length=255)
    full_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=15)
    status = models.CharField(max_length=20, default='Active')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.username




# Create your models here.
