import { useMutation, useQueryClient } from '@tanstack/react-query'

import { appointmentApi } from '../../../entities/appointment'
import type { CreateAppointmentInput } from '../../../entities/appointment'
import { patientApi } from '../../../entities/patient'
import type { UpdatePatientInput } from '../../../entities/patient'
import { patientQueryKeys } from '../../patients/model/patient.queries'
import { appointmentQueryKeys } from './appointment.queries'

export function useAppointmentMutations() {
  const queryClient = useQueryClient()
  const invalidateAppointments = () =>
    queryClient.invalidateQueries({ queryKey: appointmentQueryKeys.all })

  return {
    create: useMutation({
      mutationFn: (body: CreateAppointmentInput) => appointmentApi.create(body),
      onSuccess: invalidateAppointments,
    }),
    update: useMutation({
      mutationFn: ({ id, body }: {
        id: number
        body: { reason: string; slotId?: number; slotKey?: string; doctorId?: number; departmentId?: number }
      }) => appointmentApi.update(id, body),
      onSuccess: invalidateAppointments,
    }),
    checkIn: useMutation({
      mutationFn: (id: number) => appointmentApi.checkIn(id),
      onSuccess: invalidateAppointments,
    }),
    cancel: useMutation({
      mutationFn: ({ id, reason, note }: { id: number; reason: string; note?: string }) =>
        appointmentApi.cancel(id, reason, note),
      onSuccess: invalidateAppointments,
    }),
    updatePatient: useMutation({
      mutationFn: ({ id, body }: { id: number; body: UpdatePatientInput }) =>
        patientApi.update(id, body),
      onSuccess: async () => {
        await Promise.all([
          invalidateAppointments(),
          queryClient.invalidateQueries({ queryKey: patientQueryKeys.all }),
        ])
      },
    }),
  }
}
