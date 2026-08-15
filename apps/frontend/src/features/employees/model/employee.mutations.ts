import { useMutation, useQueryClient } from '@tanstack/react-query'
import { synchronizeCurrentReportingSnapshot } from '../../../shared/api'
import { employeeApi } from '../api/employee.api'
import { employeeQueryKeys } from './employee.queries'

export function useEmployeeMutations() {
  const client = useQueryClient()
  const refresh = async () => {
    await synchronizeCurrentReportingSnapshot().catch(() => undefined)
    await client.invalidateQueries({ queryKey: employeeQueryKeys.all })
  }
  return {
    create: useMutation({ mutationFn: employeeApi.create, onSuccess: refresh }),
    update: useMutation({ mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => employeeApi.update(id, body), onSuccess: refresh }),
    toggleLock: useMutation({ mutationFn: ({ id, action }: { id: string; action: 'lock' | 'unlock' }) => employeeApi.toggleLock(id, action), onSuccess: refresh }),
    remove: useMutation({ mutationFn: employeeApi.remove, onSuccess: refresh }),
    allocate: useMutation({ mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => employeeApi.allocate(id, body), onSuccess: refresh }),
  }
}
