import { useMemo } from 'react'

import type { Appointment } from '../../../entities/appointment'

export function useAppointmentQueue(
  appointments: Appointment[],
  doctorId: string,
  query: string,
) {
  return useMemo(() => appointments
    .filter((item) => item.doctor.id === doctorId)
    .filter((item) =>
      (item.status === 'WAITING' || item.status === 'CONFIRMED') &&
      `${item.patient.fullName} ${item.patient.phone} ${item.patient.code} ${item.sequenceNumber}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .sort((first, second) => {
      const firstSequence = first.sequenceNumber > 0
        ? first.sequenceNumber
        : Number.MAX_SAFE_INTEGER
      const secondSequence = second.sequenceNumber > 0
        ? second.sequenceNumber
        : Number.MAX_SAFE_INTEGER
      return firstSequence - secondSequence ||
        first.startTime.localeCompare(second.startTime) ||
        Number(first.id) - Number(second.id)
    }), [appointments, doctorId, query])
}
