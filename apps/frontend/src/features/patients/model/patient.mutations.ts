import { useMutation, useQueryClient } from '@tanstack/react-query'

import { patientApi } from '../api/patient.api'
import type { CreatePatientInput, UpdatePatientInput } from '../api/patient.api'
import { patientQueryKeys } from './patient.queries'

export function useCreatePatientMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreatePatientInput) => patientApi.create(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: patientQueryKeys.all }),
  })
}

export function useUpdatePatientMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdatePatientInput }) =>
      patientApi.update(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: patientQueryKeys.all }),
  })
}
