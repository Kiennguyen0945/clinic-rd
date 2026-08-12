import { useQuery, useQueryClient } from '@tanstack/react-query'

import { appointmentApi, mapAppointment } from '../../../entities/appointment'
import { mapPatient, patientApi } from '../../../entities/patient'
import { mapSlot, slotApi } from '../../../entities/slot'
import { receptionApi } from '../api/reception.api'

export const appointmentQueryKeys = {
  all: ['appointments'] as const,
  page: (date: string, doctorId: string) =>
    [...appointmentQueryKeys.all, 'page', date, doctorId] as const,
  context: (date: string) =>
    [...appointmentQueryKeys.all, 'context', date] as const,
  slots: (date: string, doctorId: string) =>
    [...appointmentQueryKeys.all, 'slots', date, doctorId] as const,
}

export function useAppointmentPageQuery(date: string, doctorId: string) {
  return useQuery({
    queryKey: appointmentQueryKeys.page(date, doctorId),
    queryFn: async () => {
      const [context, patientResponse] = await Promise.all([
        receptionApi.context(date),
        patientApi.list(),
      ])
      const patients = patientResponse.patients.map(mapPatient)

      if (!doctorId) {
        return { context, patients, slots: [], appointments: [] }
      }

      const [slotResponse, appointmentResponse] = await Promise.all([
        slotApi.list(date, doctorId),
        appointmentApi.list(date, doctorId),
      ])
      const slots = slotResponse.slots.map(mapSlot)
      const appointments = appointmentResponse.appointments.map((item) =>
        mapAppointment(item, patients, slots),
      )
      return { context, patients, slots, appointments }
    },
    retry: false,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
    gcTime: 0,
  })
}

export function useAppointmentReads() {
  const queryClient = useQueryClient()
  return {
    context: (date: string) => queryClient.fetchQuery({
      queryKey: appointmentQueryKeys.context(date),
      queryFn: () => receptionApi.context(date),
      staleTime: 0,
    }),
    slots: (date: string, doctorId: string, bookingType = 'SCHEDULE') => queryClient.fetchQuery({
      queryKey: [...appointmentQueryKeys.slots(date, doctorId), bookingType],
      queryFn: () => slotApi.list(date, doctorId, bookingType),
      staleTime: 0,
    }),
  }
}
