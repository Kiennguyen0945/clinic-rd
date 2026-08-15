import { useQuery } from '@tanstack/react-query'
import { employeeApi } from '../api/employee.api'

export const employeeQueryKeys = {
  all: ['employees'] as const,
  detail: (id: string) => [...employeeQueryKeys.all, 'detail', id] as const,
  resources: ['employee-resources'] as const,
}

export function useEmployeesQuery() {
  return useQuery({ queryKey: employeeQueryKeys.all, queryFn: employeeApi.list })
}

export function useEmployeeQuery(id: string) {
  return useQuery({ queryKey: employeeQueryKeys.detail(id), queryFn: () => employeeApi.detail(id), enabled: Boolean(id) })
}

export function useEmployeeResourcesQuery() {
  return useQuery({
    queryKey: employeeQueryKeys.resources,
    queryFn: async () => {
      const [departments, rooms] = await Promise.all([employeeApi.departments(), employeeApi.rooms()])
      return { departments, rooms }
    },
  })
}
