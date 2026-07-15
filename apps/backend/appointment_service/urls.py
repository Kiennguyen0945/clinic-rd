from django.urls import path

from .views import (
	AppointmentCancelView,
	AppointmentListView,
	AppointmentUpdateView,
	DashboardTodayView,
	MedicalRecordCreateView,
)

urlpatterns = [
	path('appointments/', AppointmentListView.as_view(), name='appointment-list'),
	path('medical-records/', MedicalRecordCreateView.as_view(), name='medical-record-create'),
	path('dashboard/today/', DashboardTodayView.as_view(), name='dashboard-today'),
	path('appointments/<int:pk>/', AppointmentUpdateView.as_view(), name='appointment-update'),
	path('appointments/<int:pk>/cancel/', AppointmentCancelView.as_view(), name='appointment-cancel'),
]
