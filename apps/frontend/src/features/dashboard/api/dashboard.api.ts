import { apiRequest } from '../../../shared/api'

export interface TodayStats {
  total: number
  pending: number
  confirmed: number
  inProgress: number
  completed: number
  cancelled: number
}

export interface UpcomingAppointment {
  id: string
  patientName: string
  patientCode: string
  doctorName: string
  appointmentTime: string
  status: string
}

export interface DashboardData {
  todayStats: TodayStats
  upcomingAppointments: UpcomingAppointment[]
}

export const dashboardApi = {
  today: () => apiRequest<DashboardData>('/api/dashboard/today/'),
}
