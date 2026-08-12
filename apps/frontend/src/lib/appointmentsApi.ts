// Temporary compatibility module. Remove after all external consumers migrate.
import { appointmentApi as appointmentDomainApi } from '../entities/appointment'
import { patientApi } from '../entities/patient'
import { slotApi } from '../entities/slot'
import { receptionApi } from '../features/appointments'

export type { ApiEnvelope } from '../shared/api/api-envelope'
export { ApiError as AppointmentApiError } from '../shared/api/api-error'
export type { ApiAppointment } from '../entities/appointment'
export type { ApiPatient } from '../entities/patient'
export type { ApiSlot } from '../entities/slot'
export type { ApiDoctor, ReceptionContext } from '../features/appointments'

export const appointmentApi = {
  context: receptionApi.context,
  slots: slotApi.list,
  appointments: appointmentDomainApi.list,
  queue: appointmentDomainApi.queue,
  patients: patientApi.list,
  createPatient: patientApi.create,
  updatePatient: patientApi.update,
  create: appointmentDomainApi.create,
  update: appointmentDomainApi.update,
  checkIn: appointmentDomainApi.checkIn,
  start: appointmentDomainApi.start,
  cancel: appointmentDomainApi.cancel,
}
