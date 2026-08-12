import { apiRequest } from '../shared/api/http-client'

export type { ApiEnvelope } from '../shared/api/api-envelope'
export { ApiError as AppointmentApiError } from '../shared/api/api-error'

export interface ApiPatient {
  id: number | null
  patient_code: string
  full_name: string
  dob: string
  gender: 'M' | 'F' | 'O'
  phone: string
  email?: string | null
  cccd?: string | null
  address: string
  insurance_number?: string | null
}

export interface ApiDoctor { id: string; fullName: string; departments: Array<{ id: number; name: string }> }
export interface ApiSlot {
  id: number | null
  slotKey?: string
  doctorId: string
  roomId: string
  doctor: { id: string; fullName: string }
  room: { id: string; roomNumber: string }
  slotDate: string
  startTime: string
  endTime: string
  capacity: number
  bookedCount: number
  remainingCapacity: number
  isFull: boolean
  isBookable: boolean
  isOngoing: boolean
  isEnded: boolean
  status: 'OPEN' | 'CLOSED'
}

export interface ApiAppointment {
  id: number
  patient: { id: string; patientCode: string; fullName: string; phone: string }
  doctor: { id: string; fullName: string }
  slot: { id: number; slotDate: string; startTime: string; endTime: string; status: string; roomNumber?: string } | null
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
  status: 'PENDING' | 'CONFIRMED' | 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  cancellation_reason: string
  cancellation_note: string | null
}

export interface ReceptionContext {
  doctors: ApiDoctor[]
  departments: Array<{ id: number; name: string }>
  rooms: Array<{ id: string; roomNumber: string }>
  openSlotAssignments: Array<{ doctorId: string; roomId: string; roomNumber: string }>
  overview: Array<{
    doctor: { id: string; fullName: string }
    departments: Array<{ id: number; name: string }>
    totalSlots: number
    capacity: number
    bookedCount: number
    remainingCapacity: number
    ongoingSlot: ApiSlot | null
    status: 'OPEN' | 'NEAR_FULL' | 'FULL'
  }>
  receptionSummary: { waiting: number; confirmed: number; inProgress: number; completed: number; cancelled: number }
  waitingDoctors: Array<{ doctorId: string; doctorName: string; waitingCount: number }>
}

export const appointmentApi = {
  context: (date: string) => apiRequest<ReceptionContext>(`/api/appointments/reception-context/?date=${date}`),
  slots: (date: string, doctorId: string, bookingType = 'SCHEDULE') => apiRequest<{ slots: ApiSlot[] }>(`/api/doctor-slots/?date=${date}&doctorId=${doctorId}&bookingType=${bookingType}`),
  appointments: (date: string, doctorId: string) => apiRequest<{ appointments: ApiAppointment[] }>(`/api/appointments/?date=${date}&doctorId=${doctorId}`),
  queue: (date: string, doctorId?: string, keyword = '') => apiRequest<{ appointments: ApiAppointment[] }>(`/api/appointments/queue/?date=${date}${doctorId ? `&doctorId=${doctorId}` : ''}${keyword ? `&keyword=${encodeURIComponent(keyword)}` : ''}`),
  patients: (options: { keyword?: string; page?: number; pageSize?: number; gender?: string; age?: string } = {}) => {
    const params = new URLSearchParams()
    if (options.keyword) params.set('keyword', options.keyword)
    if (options.page) params.set('page', String(options.page))
    if (options.pageSize) params.set('pageSize', String(options.pageSize))
    if (options.gender && options.gender !== 'all') params.set('gender', options.gender)
    if (options.age && options.age !== 'all') params.set('age', options.age)
    const query = params.toString()
    return apiRequest<{ patients: ApiPatient[]; pagination: { page: number; pageSize: number; totalItems: number; totalPages: number } }>(`/api/patients/${query ? `?${query}` : ''}`)
  },
  createPatient: (body: { full_name: string; phone: string; dob: string; gender: 'M' | 'F' | 'O'; email?: string; cccd?: string; address?: string; insurance_number?: string }) => apiRequest<{ patient: ApiPatient }>('/api/patients/', { method: 'POST', body: JSON.stringify(body) }),
  updatePatient: (id: number, body: { full_name: string; phone: string; email: string; cccd: string; address: string; insurance_number: string }) => apiRequest<{ patient: ApiPatient }>(`/api/patients/${id}/`, { method: 'PUT', body: JSON.stringify(body) }),
  create: (body: { patientId: number; doctorId: number; slotId?: number; slotKey?: string; departmentId?: number; bookingType: 'SCHEDULE' | 'WALK_IN'; patientType: 'SERVICE' | 'BHYT'; bhytNumber?: string; reason: string }) => apiRequest<{ appointment: ApiAppointment }>('/api/appointments/', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: number, body: { reason: string; slotId?: number; slotKey?: string }) => apiRequest<{ appointment: ApiAppointment }>(`/api/appointments/${id}/`, { method: 'PUT', body: JSON.stringify(body) }),
  checkIn: (id: number) => apiRequest<{ appointment: ApiAppointment }>(`/api/appointments/${id}/check-in/`, { method: 'POST' }),
  start: (id: number) => apiRequest<{ appointment: ApiAppointment }>(`/api/appointments/${id}/start/`, { method: 'POST' }),
  cancel: (id: number, cancellationReason: string, cancellationNote = '') => apiRequest<{ appointment: ApiAppointment }>(`/api/appointments/${id}/cancel/`, { method: 'PATCH', body: JSON.stringify({ cancellationReason, cancellationNote }) }),
}
