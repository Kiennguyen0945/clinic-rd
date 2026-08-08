"""Tests for shared API primitives."""

from types import SimpleNamespace

from django.test import SimpleTestCase

from core.api.exceptions import ApiError
from core.api.permissions import (
    IsDoctor,
    IsManager,
    IsReceptionist,
    IsReceptionistOrDoctor,
)
from core.api.responses import error_response, success_response


def request_for_role(role_code=None, *, authenticated=True):
    role = SimpleNamespace(code=role_code) if role_code else None
    user = SimpleNamespace(is_authenticated=authenticated, role=role)
    return SimpleNamespace(user=user)


class PermissionTests(SimpleTestCase):
    def test_each_role_can_access_its_own_permission(self):
        self.assertTrue(IsReceptionist().has_permission(
            request_for_role("RECEPTIONIST"), None,
        ))
        self.assertTrue(IsDoctor().has_permission(
            request_for_role("DOCTOR"), None,
        ))
        self.assertTrue(IsManager().has_permission(
            request_for_role("MANAGER"), None,
        ))

    def test_wrong_role_is_denied(self):
        request = request_for_role("DOCTOR")

        self.assertFalse(IsManager().has_permission(request, None))
        self.assertFalse(IsReceptionist().has_permission(request, None))

    def test_unauthenticated_or_roleless_user_is_denied_without_error(self):
        unauthenticated = request_for_role("MANAGER", authenticated=False)
        roleless = request_for_role()

        self.assertFalse(IsManager().has_permission(unauthenticated, None))
        self.assertFalse(IsManager().has_permission(roleless, None))

    def test_receptionist_or_doctor_accepts_only_supported_roles(self):
        permission = IsReceptionistOrDoctor()

        self.assertTrue(permission.has_permission(
            request_for_role("RECEPTIONIST"), None,
        ))
        self.assertTrue(permission.has_permission(
            request_for_role("DOCTOR"), None,
        ))
        self.assertFalse(permission.has_permission(
            request_for_role("MANAGER"), None,
        ))


class ResponseTests(SimpleTestCase):
    def test_success_response_uses_the_standard_envelope(self):
        response = success_response({"id": 7}, message="Đã tạo", status=201)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data, {
            "success": True,
            "data": {"id": 7},
            "message": "Đã tạo",
        })

    def test_error_response_includes_optional_details(self):
        response = error_response(
            "VALIDATION_ERROR",
            "Dữ liệu không hợp lệ",
            status=422,
            details={"name": ["Bắt buộc"]},
        )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.data["error"]["code"], "VALIDATION_ERROR")
        self.assertEqual(
            response.data["error"]["details"],
            {"name": ["Bắt buộc"]},
        )


class ExceptionTests(SimpleTestCase):
    def test_api_error_supports_custom_code_and_status(self):
        error = ApiError(
            "Không tìm thấy bệnh nhân",
            code="PATIENT_NOT_FOUND",
            status_code=404,
        )

        self.assertEqual(error.status_code, 404)
        self.assertEqual(str(error.detail), "Không tìm thấy bệnh nhân")
        self.assertEqual(error.get_codes(), "PATIENT_NOT_FOUND")
