import { X } from 'lucide-react'

import type { Appointment } from '../../../entities/appointment'
import type { PatientProfile } from '../../../entities/patient'
import type { SlotDefinition } from '../../../entities/slot'
import { CreatePatientModal } from '../../patients'
import type { ReceptionContext } from '../api/reception.api'
import type { useAppointmentActions } from '../model/use-appointment-actions'
import type { useAppointmentBooking } from '../model/use-appointment-booking'
import type { useAppointmentRescheduling } from '../model/use-appointment-rescheduling'
import { PrintTicket, ReceptionistPatientDrawer } from './artifacts/PatientArtifacts'
import { CreateAppointmentModal } from './booking/AppointmentModals'
import { AppointmentQuickEditModal, PatientQuickEditModal } from './booking/PatientEditModals'
import { CancellationModal, RescheduleAppointmentModal } from './rescheduling/RescheduleModals'

interface Props {
  context: ReceptionContext | null
  patients: PatientProfile[]
  slots: SlotDefinition[]
  booking: ReturnType<typeof useAppointmentBooking>
  rescheduling: ReturnType<typeof useAppointmentRescheduling>
  actions: ReturnType<typeof useAppointmentActions>
  drawerAppointment: Appointment | null
  closeDrawer: () => void
  printAppointment: Appointment | null
  closePrint: () => void
}

export function AppointmentOverlays({
  context, patients, slots, booking, rescheduling, actions,
  drawerAppointment, closeDrawer, printAppointment, closePrint,
}: Props) {
  const modalContext = booking.bookingContext || context
  return <>
    {booking.bookingSlot && <CreateAppointmentModal
      patients={patients} doctors={modalContext?.doctors || []}
      departments={modalContext?.departments || []} rooms={modalContext?.rooms || []}
      assignments={modalContext?.openSlotAssignments || []} doctorLocked={false} showAllDoctors
      draft={booking.draft} setDraft={booking.setDraft} slots={slots} slot={booking.bookingSlot}
      mode={booking.bookingMode} setMode={booking.changeMode} onDateChange={booking.changeDate}
      onDoctorChange={booking.changeDoctor} onDepartmentChange={booking.changeDepartment}
      onRoomChange={booking.changeRoom} onSlotChange={booking.selectSlot}
      suggestedSlot={booking.bookingSuggestion} onConfirmSuggestion={booking.confirmSuggestion}
      onAddPatient={booking.addPatient} onClose={() => booking.setBookingSlot(null)}
      onSubmit={booking.submit} error={booking.formError} saving={booking.saving}
    />}
    {booking.showCreatePatient && <CreatePatientModal
      onClose={() => booking.setShowCreatePatient(false)} onCreated={booking.selectCreatedPatient}
    />}
    {actions.cancelTarget && <CancellationModal appointment={actions.cancelTarget}
      saving={actions.saving} onClose={() => actions.setCancelTarget(null)} onConfirm={actions.cancel} />}
    {actions.patientEditTarget && <PatientQuickEditModal appointment={actions.patientEditTarget}
      saving={actions.saving} onClose={() => actions.setPatientEditTarget(null)} onSave={actions.savePatient} />}
    {actions.appointmentEditTarget && <AppointmentQuickEditModal appointment={actions.appointmentEditTarget}
      saving={actions.saving} onClose={() => actions.setAppointmentEditTarget(null)} onSave={actions.saveReason} />}
    {rescheduling.target && <RescheduleAppointmentModal
      appointment={rescheduling.target} draft={booking.draft} setDraft={booking.setDraft}
      doctors={modalContext?.doctors || []} departments={modalContext?.departments || []}
      rooms={modalContext?.rooms || []} assignments={modalContext?.openSlotAssignments || []}
      slots={slots} suggestedSlot={rescheduling.suggestion}
      onDoctorChange={rescheduling.changeDoctor} onDepartmentChange={booking.changeDepartment}
      onDateChange={rescheduling.changeDate} onSlotChange={rescheduling.changeSlot}
      onClose={() => rescheduling.setTarget(null)} onSubmit={rescheduling.submit}
      error={booking.formError} saving={booking.saving}
    />}
    {rescheduling.toast && <div className="doctor-toast" role="status">
      {rescheduling.toast}<button type="button" className="icon-button"
        onClick={() => rescheduling.setToast('')} aria-label="Đóng thông báo"><X size={14} /></button>
    </div>}
    {drawerAppointment && <ReceptionistPatientDrawer appointment={drawerAppointment} onClose={closeDrawer} />}
    {printAppointment && <PrintTicket appointment={printAppointment} onClose={closePrint} />}
  </>
}
