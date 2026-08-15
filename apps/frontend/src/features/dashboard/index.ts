export { dashboardApi } from './api/dashboard.api'
export type {
  DashboardData,
  TodayStats,
  UpcomingAppointment,
  ManagerDashboardData,
  DailyAppointmentStatistic,
  DoctorStatistic,
} from './api/dashboard.api'
export {
  dashboardQueryKeys,
  useTodayDashboardQuery,
  useManagerDashboardQuery,
} from './model/dashboard.queries'
export { default as DashboardPage } from './pages/DashboardPage'
