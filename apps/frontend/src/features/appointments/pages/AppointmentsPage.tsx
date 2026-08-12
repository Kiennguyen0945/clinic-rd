import { useState } from 'react'

import type { Appointment } from '../../../entities/appointment'
import { useAuthStore } from '../../../shared/auth/session-store'
import { mapDoctor } from '../api/reception.api'
import { AppointmentOverlays } from '../components/AppointmentOverlays'
import { AppointmentOverviewView } from '../components/overview/AppointmentOverviewView'
import { DoctorScheduleView } from '../components/schedule/DoctorScheduleView'
import { useAppointmentActions } from '../model/use-appointment-actions'
import { useAppointmentBooking } from '../model/use-appointment-booking'
import { useAppointmentData } from '../model/use-appointment-data'
import { useAppointmentMutations } from '../model/appointment.mutations'
import { useAppointmentPageState } from '../model/use-appointment-page'
import { useAppointmentQueue } from '../model/use-appointment-queue'
import { useAppointmentReads } from '../model/appointment.queries'
import { useAppointmentRescheduling } from '../model/use-appointment-rescheduling'
import { useAppointmentSelection } from '../model/use-appointment-selection'

export default function AppointmentsPage() {
  const user = useAuthStore((state) => state.user)
  const page = useAppointmentPageState()
  const data = useAppointmentData(page.date, page.doctorId)
  const reads = useAppointmentReads()
  const mutations = useAppointmentMutations()
  const selection = useAppointmentSelection(data.appointments)
  const [printAppointment, setPrintAppointment] = useState<Appointment | null>(null)

  const booking = useAppointmentBooking({
    selectedDate: page.date,
    activeDoctorId: page.doctorId,
    context: data.context,
    patients: data.patients,
    setPatients: data.setPatients,
    slots: data.slots,
    setSlots: data.setSlots,
    reads,
    mutations,
    onCreated: (created) => {
      selection.setSelectedId(created.id)
      setPrintAppointment(created)
    },
  })
  const actions = useAppointmentActions({
    selectedId: selection.selectedId,
    selectedAppointment: selection.selectedAppointment,
    setAppointments: data.setAppointments,
    setPatients: data.setPatients,
    mutations,
  })
  const rescheduling = useAppointmentRescheduling({
    context: data.context,
    patients: data.patients,
    slots: data.slots,
    setSlots: data.setSlots,
    setAppointments: data.setAppointments,
    setSelectedId: selection.setSelectedId,
    reads,
    mutations,
    booking,
    refetch: data.refetch,
  })
  const queue = useAppointmentQueue(data.appointments, page.doctorId, page.query)
  const error = actions.error || data.error
  const selectedDoctor = mapDoctor(
    data.context?.doctors.find((doctor) => doctor.id === page.doctorId) || {
      id: '', fullName: 'Chưa chọn bác sĩ', departments: [],
    },
  )

  return <>
    {!page.doctorId ? <AppointmentOverviewView
      selectedDate={page.date}
      setSelectedDate={page.setDate}
      onCreate={booking.openWithoutSlot}
      onViewDoctor={page.setDoctorId}
      context={data.context}
      loading={data.loading}
      error={error}
      department={page.department}
      setDepartment={page.setDepartment}
      doctor={page.doctor}
      setDoctor={page.setDoctor}
      slotStatus={page.slotStatus}
      setSlotStatus={page.setSlotStatus}
    /> : <DoctorScheduleView
      userName={user?.fullName || ''}
      doctor={selectedDoctor}
      activeDoctorId={page.doctorId}
      selectedDate={page.date}
      setSelectedDate={page.setDate}
      closeSchedule={() => page.setDoctorId('')}
      openBooking={booking.openWithoutSlot}
      error={error}
      slots={data.slots}
      appointments={data.appointments}
      queue={queue}
      query={page.query}
      setQuery={page.setQuery}
      selectedId={selection.selectedId}
      selectedAppointment={selection.selectedAppointment}
      expandedSlotId={selection.expandedSlotId}
      setExpandedSlotId={selection.setExpandedSlotId}
      setSelectedId={selection.setSelectedId}
      openSlot={booking.open}
      refresh={data.refetch}
      openProfile={(id) => {
        selection.setSelectedId(id)
        selection.setDrawerAppointmentId(id)
      }}
      editPatient={() => selection.selectedAppointment &&
        actions.setPatientEditTarget(selection.selectedAppointment)}
      reschedule={() => selection.selectedAppointment &&
        rescheduling.open(selection.selectedAppointment)}
      updateStatus={actions.updateStatus}
    />}
    <AppointmentOverlays
      context={data.context}
      patients={data.patients}
      slots={data.slots}
      booking={booking}
      rescheduling={rescheduling}
      actions={actions}
      drawerAppointment={selection.drawerAppointment}
      closeDrawer={() => selection.setDrawerAppointmentId(null)}
      printAppointment={printAppointment}
      closePrint={() => setPrintAppointment(null)}
    />
  </>
}
