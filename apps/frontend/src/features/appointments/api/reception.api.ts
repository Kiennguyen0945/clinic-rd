import type { ApiSlot } from '../../../entities/slot'
import { apiRequest } from '../../../shared/api'

export interface ApiDoctor {
  id: string
  fullName: string
  departments: Array<{ id: number; name: string }>
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
  receptionSummary: {
    waiting: number
    confirmed: number
    inProgress: number
    completed: number
    cancelled: number
  }
  waitingDoctors: Array<{
    doctorId: string
    doctorName: string
    waitingCount: number
  }>
}

export const mapDoctor = (doctor: ApiDoctor) => ({
  id: doctor.id,
  fullName: doctor.fullName,
  department: doctor.departments[0]?.name || 'Chưa phân khoa',
})

export const receptionApi = {
  context: (date: string) =>
    apiRequest<ReceptionContext>(`/api/appointments/reception-context/?date=${date}`),
}
