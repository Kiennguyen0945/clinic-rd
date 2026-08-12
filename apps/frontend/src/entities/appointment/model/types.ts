import type { PatientProfile } from '../../patient'
import type { SlotDefinition } from '../../slot'

export type AppointmentStatus =
  | 'CONFIRMED'
  | 'WAITING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
export type AppointmentType = 'SCHEDULED' | 'WALK_IN'
export type BookingMode = 'IMMEDIATE' | 'SCHEDULED'

export interface ApiAppointment {
  id: number
  patient: { id: string; patientCode: string; fullName: string; phone: string }
  doctor: { id: string; fullName: string }
  slot: {
    id: number
    slotDate: string
    startTime: string
    endTime: string
    status: string
    roomNumber?: string
  } | null
  slot_id: number | null
  appointment_code: string
  department_id: number | null
  department: { id: number; name: string } | null
  sequence_number: number | null
  booking_type: 'SCHEDULE' | 'WALK_IN'
  patient_type: 'SERVICE' | 'BHYT'
  bhyt_number: string | null
  appointment_time: string
  reason: string
  status:
    | 'PENDING'
    | 'CONFIRMED'
    | 'WAITING'
    | 'IN_PROGRESS'
    | 'COMPLETED'
    | 'CANCELLED'
  cancellation_reason: string
  cancellation_note: string | null
}

export interface Appointment {
  id: string
  slotId: string
  patient: PatientProfile
  doctor: { id: string; fullName: string; department: string }
  appointmentType: AppointmentType
  startTime: string
  endTime: string
  reason: string
  status: AppointmentStatus
  sequenceNumber: number
  appointmentCode: string
  room: string
  insuranceNumber?: string
  cancellationReason: string
  cancellationNote: string
}

export interface AppointmentDraft {
  patientId: string
  patientName: string
  doctorId: string
  department: string
  room: string
  date: string
  slotId: string
  service: 'Dịch vụ' | 'BHYT'
  insuranceNumber: string
  reason: string
  note: string
}

export interface BookingSuggestion {
  mode: BookingMode
  slot: SlotDefinition
  deferWalkIn: boolean
}

export interface CreateAppointmentInput {
  patientId: number
  doctorId: number
  slotId?: number
  slotKey?: string
  departmentId?: number
  bookingType: 'SCHEDULE' | 'WALK_IN'
  patientType: 'SERVICE' | 'BHYT'
  bhytNumber?: string
  reason: string
}
