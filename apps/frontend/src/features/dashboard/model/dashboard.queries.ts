import { useQuery } from '@tanstack/react-query'

import { useAuthStore } from '../../../shared/auth/session-store'
import { dashboardApi } from '../api/dashboard.api'

export const dashboardQueryKeys = {
  all: ['dashboard'] as const,
  today: (token: string | null) => [...dashboardQueryKeys.all, 'today', token] as const,
  manager: (date: string, token: string | null) =>
    [...dashboardQueryKeys.all, 'manager', date, token] as const,
}

export function useManagerDashboardQuery(date: string) {
  const token = useAuthStore((state) => state.token)

  return useQuery({
    queryKey: dashboardQueryKeys.manager(date, token),
    queryFn: async () => {
      const [dashboard, doctors, directory] = await Promise.all([
        dashboardApi.manager(date, date),
        dashboardApi.doctors(date, date),
        dashboardApi.doctorDirectory(date),
      ])
      return { dashboard, doctors: doctors.items, doctorDirectory: directory.doctors }
    },
    enabled: Boolean(token && date),
    retry: false,
    refetchOnWindowFocus: false,
  })
}

export function useTodayDashboardQuery() {
  const token = useAuthStore((state) => state.token)

  return useQuery({
    queryKey: dashboardQueryKeys.today(token),
    queryFn: dashboardApi.today,
    enabled: Boolean(token),
    retry: false,
    refetchOnWindowFocus: false,
    gcTime: 0,
  })
}
