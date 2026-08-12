import { useEffect, useMemo, useState } from 'react'

import type { Appointment } from '../../../entities/appointment'

export function useAppointmentSelection(appointments: Appointment[]) {
  const [selectedId, setSelectedId] = useState('')
  const [expandedSlotId, setExpandedSlotId] = useState('')
  const [drawerAppointmentId, setDrawerAppointmentId] = useState<string | null>(null)

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setExpandedSlotId('')
    setSelectedId((current) =>
      appointments.some((item) => item.id === current)
        ? current
        : appointments[0]?.id || '',
    )
  }, [appointments])
  /* eslint-enable react-hooks/set-state-in-effect */

  const selectedAppointment = useMemo(
    () => appointments.find((item) => item.id === selectedId) || null,
    [appointments, selectedId],
  )
  const drawerAppointment = useMemo(
    () => appointments.find((item) => item.id === drawerAppointmentId) || null,
    [appointments, drawerAppointmentId],
  )

  return {
    selectedId,
    setSelectedId,
    selectedAppointment,
    expandedSlotId,
    setExpandedSlotId,
    drawerAppointment,
    setDrawerAppointmentId,
  }
}
