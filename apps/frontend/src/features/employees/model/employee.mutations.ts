import { useMutation, useQueryClient } from '@tanstack/react-query'
import { employeeApi } from '../api/employee.api'
import { employeeQueryKeys } from './employee.queries'

export function useEmployeeMutations() {
  const client = useQueryClient()
  const refresh = () => client.invalidateQueries({ queryKey: employeeQueryKeys.all })
  return {
    create: useMutation({ mutationFn: employeeApi.create, onSuccess: refresh }),
    update: useMutation({ mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => employeeApi.update(id, body), onSuccess: refresh }),
    remove: useMutation({ mutationFn: employeeApi.remove, onSuccess: refresh }),
    allocate: useMutation({ mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => employeeApi.allocate(id, body), onSuccess: refresh }),
  }
}
