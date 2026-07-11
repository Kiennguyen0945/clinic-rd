from rest_framework.decorators import api_view
from django.db.models import Q
from datetime import date
import re
from .models import Patient
from .serializers import PatientSerializer
from backend.response_utils import success_response, error_response


def _require_auth(request):
    """Return error response if not authenticated, else None."""
    if not request.user.is_authenticated:
        return error_response("UNAUTHORIZED", "Vui l\u00f2ng \u0111\u0103ng nh\u1eadp", status=401)
    return None


def _check_role(request, *roles):
    """Check if user has one of the specified roles. Must call _require_auth first."""
    return request.user.role.code in roles


@api_view(['GET', 'POST'])
def patient_list(request):
    auth_err = _require_auth(request)
    if auth_err:
        return auth_err

    if request.method == 'GET':
        # Search - require receptionist, doctor, or manager
        if not _check_role(request, 'RECEPTIONIST', 'DOCTOR', 'MANAGER'):
            return error_response("FORBIDDEN", "B\u1ea1n kh\u00f4ng c\u00f3 quy\u1ec1n truy c\u1eadp", status=403)

        keyword = request.query_params.get('keyword', '')
        if not keyword:
            return error_response(
                "VALIDATION_ERROR",
                "Vui l\u00f2ng cung c\u1ea5p t\u1eeb kh\u00f3a t\u00ecm ki\u1ebfm",
                status=400
            )

        patients = Patient.objects.filter(
            Q(patient_code__icontains=keyword) |
            Q(full_name__icontains=keyword) |
            Q(phone__icontains=keyword)
        )

        serializer = PatientSerializer(patients, many=True)
        return success_response(
            {"patients": serializer.data},
            message="T\u00ecm ki\u1ebfm b\u1ec7nh nh\u00e2n th\u00e0nh c\u00f4ng"
        )

    elif request.method == 'POST':
        # Create - require receptionist only
        if not _check_role(request, 'RECEPTIONIST'):
            return error_response("FORBIDDEN", "B\u1ea1n kh\u00f4ng c\u00f3 quy\u1ec1n th\u1ef1c hi\u1ec7n h\u00e0nh \u0111\u1ed9ng n\u00e0y", status=403)

        phone = request.data.get('phone', '')

        # Validate phone format
        if not re.match(r'^\d{10,11}$', phone):
            return error_response(
                "VALIDATION_ERROR",
                "S\u1ed1 \u0111i\u1ec7n tho\u1ea1i kh\u00f4ng h\u1ee3p l\u1ec7",
                status=400,
                details={"phone": "S\u1ed1 \u0111i\u1ec7n tho\u1ea1i ph\u1ea3i c\u00f3 10-11 ch\u1eef s\u1ed1"}
            )

        # Check duplicate phone
        if Patient.objects.filter(phone=phone).exists():
            return error_response(
                "DUPLICATE_PHONE",
                "S\u1ed1 \u0111i\u1ec7n tho\u1ea1i n\u00e0y c\u00f3 th\u1ec3 \u0111\u00e3 t\u1ed3n t\u1ea1i. Vui l\u00f2ng ki\u1ec3m tra l\u1ea1i.",
                status=400
            )

        # Auto-generate patient code
        today = date.today()
        date_str = today.strftime("%Y%m%d")
        count_today = Patient.objects.filter(
            created_at__date=today
        ).count()
        seq = str(count_today + 1).zfill(3)
        patient_code = f"BN-{date_str}-{seq}"

        serializer = PatientSerializer(data={
            **request.data,
            'patient_code': patient_code
        })

        if serializer.is_valid():
            serializer.save()
            return success_response(
                {"patient": serializer.data},
                message="T\u1ea1o h\u1ed3 s\u01a1 b\u1ec7nh nh\u00e2n th\u00e0nh c\u00f4ng",
                status=201
            )

        return error_response(
            "VALIDATION_ERROR",
            "D\u1eef li\u1ec7u kh\u00f4ng h\u1ee3p l\u1ec7",
            status=400,
            details=serializer.errors
        )


@api_view(['GET', 'PUT'])
def patient_detail(request, pk):
    auth_err = _require_auth(request)
    if auth_err:
        return auth_err

    try:
        patient = Patient.objects.get(pk=pk)
    except Patient.DoesNotExist:
        return error_response(
            "PATIENT_NOT_FOUND",
            "Kh\u00f4ng t\u00ecm th\u1ea5y b\u1ec7nh nh\u00e2n",
            status=404
        )

    if request.method == 'GET':
        # Detail - require receptionist, doctor, or manager
        if not _check_role(request, 'RECEPTIONIST', 'DOCTOR', 'MANAGER'):
            return error_response("FORBIDDEN", "B\u1ea1n kh\u00f4ng c\u00f3 quy\u1ec1n truy c\u1eadp", status=403)

        serializer = PatientSerializer(patient)
        return success_response(
            {"patient": serializer.data},
            message="L\u1ea5y th\u00f4ng tin b\u1ec7nh nh\u00e2n th\u00e0nh c\u00f4ng"
        )

    elif request.method == 'PUT':
        # Update - require receptionist only
        if not _check_role(request, 'RECEPTIONIST'):
            return error_response("FORBIDDEN", "B\u1ea1n kh\u00f4ng c\u00f3 quy\u1ec1n th\u1ef1c hi\u1ec7n h\u00e0nh \u0111\u1ed9ng n\u00e0y", status=403)

        # Only update allowed fields
        allowed_fields = ['full_name', 'phone', 'address']
        update_data = {}
        for field in allowed_fields:
            if field in request.data:
                update_data[field] = request.data[field]

        # Validate phone if provided
        if 'phone' in update_data:
            phone = update_data['phone']
            if not re.match(r'^\d{10,11}$', phone):
                return error_response(
                    "VALIDATION_ERROR",
                    "S\u1ed1 \u0111i\u1ec7n tho\u1ea1i kh\u00f4ng h\u1ee3p l\u1ec7",
                    status=400,
                    details={"phone": "S\u1ed1 \u0111i\u1ec7n tho\u1ea1i ph\u1ea3i c\u00f3 10-11 ch\u1eef s\u1ed1"}
                )

        serializer = PatientSerializer(patient, data=update_data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return success_response(
                {"patient": serializer.data},
                message="C\u1eadp nh\u1eadt th\u00f4ng tin th\u00e0nh c\u00f4ng"
            )

        return error_response(
            "VALIDATION_ERROR",
            "D\u1eef li\u1ec7u kh\u00f4ng h\u1ee3p l\u1ec7",
            status=400,
            details=serializer.errors
        )
