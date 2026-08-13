import ast
from pathlib import Path

from django.test import SimpleTestCase

FORBIDDEN_CORE_PACKAGES = {
    "appointment_service",
    "auth_service",
    "medical_records",
    "organization_service",
    "patient_service",
}


class ReportingServiceBoundaryTests(SimpleTestCase):
    def test_reporting_source_does_not_import_clinic_core_domains(self):
        service_root = Path(__file__).resolve().parents[2]
        violations = []

        for source_path in service_root.rglob("*.py"):
            tree = ast.parse(source_path.read_text(encoding="utf-8"))
            for node in ast.walk(tree):
                imported_modules = []
                if isinstance(node, ast.Import):
                    imported_modules = [alias.name for alias in node.names]
                elif isinstance(node, ast.ImportFrom) and node.module:
                    imported_modules = [node.module]

                for module in imported_modules:
                    if module.split(".", maxsplit=1)[0] in FORBIDDEN_CORE_PACKAGES:
                        violations.append(f"{source_path}:{node.lineno} imports {module}")

        self.assertEqual(violations, [])
