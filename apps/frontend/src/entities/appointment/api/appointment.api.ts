import { apiRequest } from '../../../shared/api'
import type { ApiAppointment, CreateAppointmentInput } from '../model/types'

export const appointmentApi = {
  list: (date: string, doctorId: string) =>
    apiRequest<{ appointments: ApiAppointment[] }>(
      `/api/appointments/?date=${date}&doctorId=${doctorId}`,
    ),
  queue: (date: string, doctorId?: string, keyword = '') =>
    apiRequest<{ appointments: ApiAppointment[] }>(
      `/api/appointments/queue/?date=${date}${doctorId ? `&doctorId=${doctorId}` : ''}${keyword ? `&keyword=${encodeURIComponent(keyword)}` : ''}`,
    ),
  create: (body: CreateAppointmentInput) =>
    apiRequest<{ appointment: ApiAppointment }>('/api/appointments/', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  update: (id: number, body: { reason: string; slotId?: number; slotKey?: string }) =>
    apiRequest<{ appointment: ApiAppointment }>(`/api/appointments/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  checkIn: (id: number) =>
    apiRequest<{ appointment: ApiAppointment }>(`/api/appointments/${id}/check-in/`, {
      method: 'POST',
    }),
  start: (id: number) =>
    apiRequest<{ appointment: ApiAppointment }>(`/api/appointments/${id}/start/`, {
      method: 'POST',
    }),
  cancel: (id: number, cancellationReason: string, cancellationNote = '') =>
    apiRequest<{ appointment: ApiAppointment }>(`/api/appointments/${id}/cancel/`, {
      method: 'PATCH',
      body: JSON.stringify({ cancellationReason, cancellationNote }),
    }),
}
