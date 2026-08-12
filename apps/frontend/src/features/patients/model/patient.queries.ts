import { useQuery } from '@tanstack/react-query'

import { patientApi } from '../api/patient.api'
import type { PatientFilters } from './patient-filter.schema'
import { mapApiPatient } from './patient.types'

export const patientQueryKeys = {
  all: ['patients'] as const,
  list: (filters: PatientFilters) => [...patientQueryKeys.all, 'list', filters] as const,
}

export function usePatientsQuery(filters: PatientFilters) {
  return useQuery({
    queryKey: patientQueryKeys.list(filters),
    queryFn: () => patientApi.list({
      keyword: filters.keyword.trim(),
      page: filters.page,
      pageSize: 10,
      gender: filters.gender === 'Nam' ? 'M' : filters.gender === 'Nữ' ? 'F' : undefined,
      age: filters.age,
    }),
    select: (response) => ({
      patients: response.patients.map(mapApiPatient),
      pagination: response.pagination,
    }),
    retry: false,
    refetchOnWindowFocus: false,
    gcTime: 0,
  })
}
