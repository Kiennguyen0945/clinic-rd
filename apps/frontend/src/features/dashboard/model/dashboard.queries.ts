import { useQuery } from '@tanstack/react-query'

import { useAuthStore } from '../../../shared/auth/session-store'
import { dashboardApi } from '../api/dashboard.api'

export const dashboardQueryKeys = {
  all: ['dashboard'] as const,
  today: (token: string | null) => [...dashboardQueryKeys.all, 'today', token] as const,
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
