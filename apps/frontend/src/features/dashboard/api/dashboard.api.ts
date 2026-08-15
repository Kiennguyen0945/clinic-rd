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

export interface DailyAppointmentStatistic extends TodayStats {
  date: string
  waiting: number
  synchronizedAt: string
}

export interface ManagerDashboardData {
  period: { dateFrom: string; dateTo: string }
  appointments: { total: number; completed: number; cancelled: number }
  employees: { total: number; active: number; locked: number }
  organization: { departments: number; rooms: number }
  dailyAppointments: DailyAppointmentStatistic[]
  lastSynchronizedAt: string | null
}

export interface DoctorStatistic {
  date: string
  doctorId: number
  total: number
  completed: number
  cancelled: number
  synchronizedAt: string
}

export interface DoctorReportData {
  period: { dateFrom: string; dateTo: string }
  items: DoctorStatistic[]
}

export interface DashboardDoctor {
  id: string
  fullName: string
  departments: Array<{ id: number; name: string }>
}

export interface ManagerReceptionContext {
  doctors: DashboardDoctor[]
}

function dateRangeQuery(dateFrom: string, dateTo: string) {
  return new URLSearchParams({ dateFrom, dateTo }).toString()
}

export const dashboardApi = {
  today: () => apiRequest<DashboardData>('/api/dashboard/today/'),
  manager: (dateFrom: string, dateTo: string) =>
    apiRequest<ManagerDashboardData>(
      `/api/reports/dashboard/manager/?${dateRangeQuery(dateFrom, dateTo)}`,
    ),
  doctors: (dateFrom: string, dateTo: string) =>
    apiRequest<DoctorReportData>(
      `/api/reports/doctors/?${dateRangeQuery(dateFrom, dateTo)}`,
    ),
  doctorDirectory: (date: string) =>
    apiRequest<ManagerReceptionContext>(
      `/api/appointments/reception-context/?date=${encodeURIComponent(date)}`,
    ),
}
