import type { AppointmentDraft } from '../../../entities/appointment'

export function validateBookingDraft(draft: AppointmentDraft) {
  if (
    !draft.doctorId ||
    !draft.patientId ||
    !draft.department ||
    !draft.room ||
    !draft.date ||
    !draft.reason.trim() ||
    (draft.service === 'BHYT' && !draft.insuranceNumber.trim())
  ) {
    return 'Vui lòng điền đầy đủ thông tin bắt buộc.'
  }
  return null
}
