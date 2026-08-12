import type { PatientProfile } from '../../patient'
import type { SlotDefinition } from '../../slot'
import { timeLabel } from '../../../shared/lib/date'
import type { ApiAppointment, Appointment, AppointmentStatus } from './types'

export const statusConfig: Record<
  AppointmentStatus,
  { label: string; className: string }
> = {
  CONFIRMED: { label: 'Đã xác nhận', className: 'status-confirmed' },
  WAITING: { label: 'Đang chờ', className: 'status-waiting' },
  IN_PROGRESS: { label: 'Đang khám', className: 'status-progress' },
  COMPLETED: { label: 'Đã hoàn thành', className: 'status-completed' },
  CANCELLED: { label: 'Đã hủy', className: 'status-cancelled' },
}

export const cancellationReasonLabels: Record<string, string> = {
  PATIENT_REQUEST: 'Bệnh nhân báo bận / Xin dời lịch.',
  PATIENT_WRONG_INFO: 'Đặt nhầm thông tin / Trùng lịch.',
  NO_SHOW: 'Khách không đến / Không liên lạc được.',
  DOCTOR_UNAVAILABLE: 'Bác sĩ nghỉ đột xuất / Có ca cấp cứu.',
  ROOM_ISSUE: 'Phòng khám gặp sự cố kỹ thuật (Hỏng máy móc, mất điện...).',
  OTHER: 'Nhập lý do khác',
}

export function cancellationReasonLabel(reason: string, note = '') {
  return reason === 'OTHER' && note
    ? `${cancellationReasonLabels.OTHER}: ${note}`
    : cancellationReasonLabels[reason] || reason || 'Chưa có lý do hủy'
}

export function mapAppointment(
  appointment: ApiAppointment,
  patients: PatientProfile[],
  slots: SlotDefinition[],
): Appointment {
  const patient = patients.find(
    (item) => item.id === String(appointment.patient.id),
  ) || {
    id: String(appointment.patient.id),
    code: appointment.patient.patientCode,
    fullName: appointment.patient.fullName,
    phone: appointment.patient.phone,
    email: 'Chưa cập nhật',
    cccd: '',
    gender: 'Nam' as const,
    age: 0,
    dob: '',
    address: 'Chưa cập nhật',
    lastVisit: { date: '', doctor: 'Chưa cập nhật', reason: 'Chưa có dữ liệu' },
  }
  const slot = slots.find((item) => item.id === String(appointment.slot_id))
  const date =
    appointment.slot?.slotDate || appointment.appointment_time.slice(0, 10)
  const start = appointment.slot?.startTime || appointment.appointment_time
  const end = appointment.slot?.endTime || start
  return {
    id: String(appointment.id),
    slotId: String(appointment.slot_id || ''),
    patient,
    doctor: {
      id: appointment.doctor.id,
      fullName: appointment.doctor.fullName,
      department: appointment.department?.name || 'Chưa phân khoa',
    },
    appointmentType:
      appointment.booking_type === 'WALK_IN' ? 'WALK_IN' : 'SCHEDULED',
    startTime: `${date}T${timeLabel(start)}:00`,
    endTime: `${date}T${timeLabel(end)}:00`,
    reason: appointment.reason,
    status: appointment.status === 'PENDING' ? 'CONFIRMED' : appointment.status,
    sequenceNumber: appointment.sequence_number || 0,
    appointmentCode: appointment.appointment_code,
    room: slot?.room || appointment.slot?.roomNumber || 'Phòng khám',
    insuranceNumber: appointment.bhyt_number || patient.insuranceNumber,
    cancellationReason: appointment.cancellation_reason,
    cancellationNote: appointment.cancellation_note || '',
  }
}
