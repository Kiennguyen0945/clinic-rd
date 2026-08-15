import { useMutation, useQueryClient } from '@tanstack/react-query'
import { synchronizeCurrentReportingSnapshot } from '../../../shared/api'
import { organizationApi } from '../api/organization.api'
import type { Department } from '../api/organization.api'
import { organizationQueryKeys } from './organization.queries'

export function useOrganizationMutations() {
  const client = useQueryClient()
  const refresh = async () => {
    await synchronizeCurrentReportingSnapshot().catch(() => undefined)
    await client.invalidateQueries({ queryKey: organizationQueryKeys.all })
  }
  return {
    createDepartment: useMutation({ mutationFn: organizationApi.createDepartment, onSuccess: refresh }),
    updateDepartment: useMutation({ mutationFn: ({ id, body }: { id: number; body: Omit<Department, 'id'> }) => organizationApi.updateDepartment(id, body), onSuccess: refresh }),
    deleteDepartment: useMutation({ mutationFn: organizationApi.deleteDepartment, onSuccess: refresh }),
    createRoom: useMutation({ mutationFn: organizationApi.createRoom, onSuccess: refresh }),
    updateRoom: useMutation({ mutationFn: ({ id, body }: { id: number; body: { room_number: string; description: string; department_id: number } }) => organizationApi.updateRoom(id, body), onSuccess: refresh }),
    deleteRoom: useMutation({ mutationFn: organizationApi.deleteRoom, onSuccess: refresh }),
  }
}
