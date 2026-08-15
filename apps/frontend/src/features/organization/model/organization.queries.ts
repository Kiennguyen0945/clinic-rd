import { useQuery } from '@tanstack/react-query'
import { organizationApi } from '../api/organization.api'

export const organizationQueryKeys = { all: ['organization'] as const }

export function useOrganizationQuery() {
  return useQuery({
    queryKey: organizationQueryKeys.all,
    queryFn: async () => {
      const [departments, rooms] = await Promise.all([
        organizationApi.departments(), organizationApi.rooms(),
      ])
      return { departments, rooms }
    },
  })
}
