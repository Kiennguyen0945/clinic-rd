import { useMutation, useQueryClient } from '@tanstack/react-query'

import { appointmentApi } from '../../../entities/appointment'
import { medicalRecordApi } from '../../../entities/medical-record'
import type { PrescriptionInput, UpdateMedicalRecordInput } from '../../../entities/medical-record'
import { medicalRecordQueryKeys } from './medical-record.queries'

export function useMedicalRecordMutations() {
  const queryClient = useQueryClient()
  const invalidateQueue = () => queryClient.invalidateQueries({ queryKey: medicalRecordQueryKeys.all })
  return {
    startVisit: useMutation({ mutationFn: (id: number) => appointmentApi.start(id), onSuccess: invalidateQueue }),
    update: useMutation({ mutationFn: ({ id, body }: { id: number; body: UpdateMedicalRecordInput }) => medicalRecordApi.update(id, body) }),
    replacePrescription: useMutation({ mutationFn: ({ id, items }: { id: number; items: PrescriptionInput[] }) => medicalRecordApi.replacePrescription(id, items) }),
    sign: useMutation({ mutationFn: (id: number) => medicalRecordApi.sign(id), onSuccess: invalidateQueue }),
  }
}
