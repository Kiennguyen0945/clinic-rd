import { useEffect, useState } from 'react'

import type { Appointment } from '../../../entities/appointment'
import type { PatientProfile } from '../../../entities/patient'
import type { SlotDefinition } from '../../../entities/slot'
import type { ReceptionContext } from '../api/reception.api'
import { useAppointmentPageQuery } from './appointment.queries'

export function useAppointmentData(date: string, doctorId: string) {
  const pageQuery = useAppointmentPageQuery(date, doctorId)
  const queryKey = `${date}|${doctorId}`
  const [synchronizedKey, setSynchronizedKey] = useState('')
  const [context, setContext] = useState<ReceptionContext | null>(null)
  const [patients, setPatients] = useState<PatientProfile[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [slots, setSlots] = useState<SlotDefinition[]>([])

  // Local mirrors are still required for optimistic edits made by booking and
  // rescheduling. Keeping that bridge here prevents workflow hooks from owning
  // the server-to-local synchronization lifecycle.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!pageQuery.data) return
    setContext(pageQuery.data.context)
    setPatients(pageQuery.data.patients)
    setAppointments(pageQuery.data.appointments)
    setSlots(pageQuery.data.slots)
    setSynchronizedKey(queryKey)
  }, [pageQuery.data, queryKey])
  /* eslint-enable react-hooks/set-state-in-effect */

  return {
    context: synchronizedKey === queryKey
      ? context
      : pageQuery.data?.context ?? null,
    setContext,
    patients: synchronizedKey === queryKey
      ? patients
      : pageQuery.data?.patients ?? [],
    setPatients,
    appointments: synchronizedKey === queryKey
      ? appointments
      : pageQuery.data?.appointments ?? [],
    setAppointments,
    slots: synchronizedKey === queryKey
      ? slots
      : pageQuery.data?.slots ?? [],
    setSlots,
    loading: pageQuery.isFetching,
    error: pageQuery.error instanceof Error
      ? pageQuery.error.message
      : pageQuery.error
        ? 'Không thể tải dữ liệu lịch hẹn'
        : '',
    refetch: pageQuery.refetch,
  }
}
