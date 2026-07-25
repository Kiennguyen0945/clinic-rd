import { authFetch } from './authFetch'

export interface ApiEnvelope<T> {
  success: boolean
  data: T
  message?: string
  error?: { code?: string; message?: string; details?: Record<string, string> }
}

export interface ApiPatient {
  id: number
  patient_code: string
  full_name: string
  dob: string
  gender: 'M' | 'F' | 'O'
  phone: string
  address: string
  insurance_number?: string | null
}

export interface ApiDoctor { id: string; fullName: string; departments: Array<{ id: number; name: string }> }
export interface ApiSlot {
  id: number
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authFetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const contentType = response.headers.get('content-type') || ''
  let payload: ApiEnvelope<T> | null = null
  if (contentType.includes('application/json')) {
    try {
      payload = await response.json() as ApiEnvelope<T>
    } catch {
      payload = null
    }
  } else {
    await response.text()
  }
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error?.message || payload?.message || `Máy chủ không thể xử lý yêu cầu (${response.status})`)
  }
  return payload.data
}

export const appointmentApi = {
  context: (date: string) => request<ReceptionContext>(`/api/appointments/reception-context/?date=${date}`),
  slots: (date: string, doctorId: string, bookingType = 'SCHEDULE') => request<{ slots: ApiSlot[] }>(`/api/doctor-slots/?date=${date}&doctorId=${doctorId}&bookingType=${bookingType}`),
  appointments: (date: string, doctorId: string) => request<{ appointments: ApiAppointment[] }>(`/api/appointments/?date=${date}&doctorId=${doctorId}`),
  queue: (date: string, doctorId?: string, keyword = '') => request<{ appointments: ApiAppointment[] }>(`/api/appointments/queue/?date=${date}${doctorId ? `&doctorId=${doctorId}` : ''}${keyword ? `&keyword=${encodeURIComponent(keyword)}` : ''}`),
  patients: (keyword = '') => request<{ patients: ApiPatient[] }>(`/api/patients/${keyword ? `?keyword=${encodeURIComponent(keyword)}` : ''}`),
  create: (body: { patientId: number; doctorId: number; slotId: number; departmentId?: number; bookingType: 'SCHEDULE' | 'WALK_IN'; patientType: 'SERVICE' | 'BHYT'; bhytNumber?: string; deferWalkIn?: boolean; reason: string }) => request<{ appointment: ApiAppointment }>('/api/appointments/', { method: 'POST', body: JSON.stringify(body) }),
  checkIn: (id: number) => request<{ appointment: ApiAppointment }>(`/api/appointments/${id}/check-in/`, { method: 'POST' }),
  cancel: (id: number, cancellationReason: string, cancellationNote = '') => request<{ appointment: ApiAppointment }>(`/api/appointments/${id}/cancel/`, { method: 'PATCH', body: JSON.stringify({ cancellationReason, cancellationNote }) }),
}
