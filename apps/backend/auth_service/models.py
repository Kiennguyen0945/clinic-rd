from django.db import models

class Role(models.Model):
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    
    def __str__(self):
        return self.name

class User(models.Model):
    STATUS_CHOICES = [
        ("ACTIVE", "Active"),
        ("INACTIVE", "Inactive"),
        ("LOCKED", "Locked"),
    ]

    role = models.ForeignKey(
        Role,
        on_delete=models.PROTECT,
        related_name="users"
    )

    username = models.CharField(max_length=100, unique=True)
    password_hash = models.CharField(max_length=255)
    full_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=20)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="ACTIVE"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.full_name



# Create your models here.
