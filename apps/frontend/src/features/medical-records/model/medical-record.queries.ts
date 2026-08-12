import { useQuery } from '@tanstack/react-query'

import { appointmentApi, mapAppointment } from '../../../entities/appointment'
import { mapPatient, patientApi } from '../../../entities/patient'
import { mapSlot, slotApi } from '../../../entities/slot'
import { todayValue } from '../../../shared/lib/date'
import { createDemoAppointments, createDemoSlots } from '../demo/medical-record-demo'

export const medicalRecordQueryKeys = {
  all: ['medical-records'] as const,
  doctorQueue: (date: string, doctorId: string) =>
    [...medicalRecordQueryKeys.all, 'doctor-queue', date, doctorId] as const,
}

export function useDoctorQueueQuery(doctorId: string, doctorName: string) {
  const date = todayValue()
  return useQuery({
    queryKey: medicalRecordQueryKeys.doctorQueue(date, doctorId),
    enabled: Boolean(doctorId),
    retry: false,
    refetchInterval: 3_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      try {
        const [slotResponse, appointmentResponse, patientResponse] = await Promise.all([
          slotApi.list(date, doctorId), appointmentApi.list(date, doctorId),
          patientApi.list({ pageSize: 100 }),
        ])
        const slots = slotResponse.slots.map(mapSlot)
        const patients = patientResponse.patients.map(mapPatient)
        const appointments = appointmentResponse.appointments.map((item) =>
          mapAppointment(item, patients, slots),
        )
        if (slots.length && appointments.length) return { slots, appointments, demo: false }
        const displaySlots = slots.length ? slots : createDemoSlots(date)
        return {
          slots: displaySlots,
          appointments: appointments.length
            ? appointments
            : createDemoAppointments(displaySlots, doctorId, doctorName, date),
          demo: true,
        }
      } catch {
        const slots = createDemoSlots(date)
        return {
          slots,
          appointments: createDemoAppointments(slots, doctorId, doctorName, date),
          demo: true,
        }
      }
    },
  })
}
