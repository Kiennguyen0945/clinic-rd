import { apiRequest, authenticatedFetch } from '@/shared/api'

export type EmployeeRole = 'RECEPTIONIST' | 'DOCTOR'
export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED'

export interface Department { id: number; code: string; name: string }
export interface Room { id: number; room_number: string }
export interface Employee {
  id: string
  username: string
  email: string | null
  fullName: string
  phone: string
  gender: '' | 'M' | 'F' | 'O'
  dateOfBirth: string | null
  address: string
  status: EmployeeStatus
  role: EmployeeRole
  departments: Department[]
  canEdit: boolean
  canDelete: boolean
  scheduleStatus: 'ASSIGNED' | 'UNASSIGNED' | 'NOT_APPLICABLE'
  canReceiveAppointments: boolean
}

interface EmployeeDetail { user: Employee }
interface CreateResult extends EmployeeDetail { generatedPassword: string; allocation: Record<string, unknown> | null }

async function rawList<T>(path: string): Promise<T> {
  const response = await authenticatedFetch(path)
  if (!response.ok) throw new Error(`Không thể tải dữ liệu (${response.status}).`)
  return response.json() as Promise<T>
}

export const employeeApi = {
  list: () => apiRequest<Employee[]>('/api/auth/staff/'),
  detail: (id: string) => apiRequest<EmployeeDetail>(`/api/auth/staff/${id}/`).then((data) => data.user),
  create: (body: Record<string, unknown>) => apiRequest<CreateResult>('/api/auth/staff/', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Record<string, unknown>) => apiRequest<EmployeeDetail>(`/api/auth/staff/${id}/`, { method: 'PATCH', body: JSON.stringify(body) }),
  toggleLock: (id: string, action: 'lock' | 'unlock') => apiRequest<EmployeeDetail>(`/api/auth/staff/${id}/lock/`, { method: 'PATCH', body: JSON.stringify({ action }) }),
  remove: (id: string) => apiRequest<Record<string, never>>(`/api/auth/staff/${id}/`, { method: 'DELETE' }),
  allocate: (id: string, body: Record<string, unknown>) => apiRequest<{ allocation: unknown }>(`/api/auth/staff/${id}/room-allocations/`, { method: 'POST', body: JSON.stringify(body) }),
  departments: () => rawList<Department[]>('/api/departments/'),
  rooms: () => rawList<Room[]>('/api/rooms/'),
}
