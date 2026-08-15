import { authenticatedFetch } from '@/shared/api'

export interface Department {
  id: number
  code: string
  name: string
  description: string | null
  has_appointments?: boolean
}

export interface Room {
  id: number
  room_number: string
  description: string
  department_id: number | null
  department: Department | null
  doctor_id?: number | null
  doctor?: { id: number; username: string; full_name: string } | null
  has_appointments?: boolean
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body) headers.set('Content-Type', 'application/json')
  const response = await authenticatedFetch(path, { ...init, headers })
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null
  if (!response.ok) {
    const envelopeError = payload?.error as Record<string, unknown> | undefined
    const message = typeof envelopeError?.message === 'string'
      ? envelopeError.message
      : typeof payload?.detail === 'string'
        ? payload.detail
        : 'Không thể xử lý yêu cầu. Vui lòng kiểm tra lại dữ liệu.'
    throw new Error(message)
  }
  return payload as T
}

export const organizationApi = {
  departments: () => request<Department[]>('/api/departments/'),
  createDepartment: (body: Omit<Department, 'id'>) => request<Department>('/api/departments/', { method: 'POST', body: JSON.stringify(body) }),
  updateDepartment: (id: number, body: Omit<Department, 'id'>) => request<Department>(`/api/departments/${id}/`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteDepartment: (id: number) => request<void>(`/api/departments/${id}/`, { method: 'DELETE' }),
  rooms: () => request<Room[]>('/api/rooms/'),
  createRoom: (body: { room_number: string; description: string; department_id: number }) => request<Room>('/api/rooms/', { method: 'POST', body: JSON.stringify(body) }),
  updateRoom: (id: number, body: { room_number: string; description: string; department_id: number }) => request<Room>(`/api/rooms/${id}/`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteRoom: (id: number) => request<void>(`/api/rooms/${id}/`, { method: 'DELETE' }),
}
