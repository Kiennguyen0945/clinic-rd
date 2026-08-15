from django.db import models

from .role import Role


class User(models.Model):
    STATUS_CHOICES = (
        ("ACTIVE", "Active"),
        ("INACTIVE", "Inactive"),
        ("LOCKED", "Locked"),
    )

    is_authenticated = True

    role = models.ForeignKey(Role, on_delete=models.PROTECT, related_name="users")
    username = models.CharField(max_length=100, unique=True)
    email = models.EmailField(max_length=254, unique=True, null=True, blank=True)
    password_hash = models.CharField(max_length=255)
    full_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=20)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="ACTIVE",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.full_name
