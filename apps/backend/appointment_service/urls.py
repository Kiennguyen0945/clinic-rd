from django.urls import path

from .views import (
	AppointmentCancelView,
	AppointmentCheckInView,
	AppointmentListView,
	AppointmentQueueView,
	AppointmentReceptionContextView,
	AppointmentStartView,
	AppointmentStatsView,
	AppointmentUpdateView,
	DashboardTodayView,
	DoctorSlotDetailView,
	DoctorSlotListView,
	MedicalRecordCreateView,
)

urlpatterns = [
	path('appointments/', AppointmentListView.as_view(), name='appointment-list'),
	path('appointments/queue/', AppointmentQueueView.as_view(), name='appointment-queue'),
	path('appointments/reception-context/', AppointmentReceptionContextView.as_view(), name='appointment-reception-context'),
	path('doctor-slots/', DoctorSlotListView.as_view(), name='doctor-slot-list'),
	path('doctor-slots/<int:pk>/', DoctorSlotDetailView.as_view(), name='doctor-slot-detail'),
	path('medical-records/', MedicalRecordCreateView.as_view(), name='medical-record-create'),
	path('dashboard/today/', DashboardTodayView.as_view(), name='dashboard-today'),
	path('appointments/stats/', AppointmentStatsView.as_view(), name='appointment-stats'),
	path('appointments/<int:pk>/', AppointmentUpdateView.as_view(), name='appointment-update'),
	path('appointments/<int:pk>/cancel/', AppointmentCancelView.as_view(), name='appointment-cancel'),
	path('appointments/<int:pk>/check-in/', AppointmentCheckInView.as_view(), name='appointment-check-in'),
	path('appointments/<int:pk>/start/', AppointmentStartView.as_view(), name='appointment-start'),
]
