export { patientApi } from './api/patient.api'
export { ageFromDob, mapPatient, patientInitials } from './model/mappers'
export type {
  ApiPatient,
  CreatePatientInput,
  PatientListOptions,
  PatientListResult,
  PatientProfile,
  UpdatePatientInput,
} from './model/types'
export { default as PatientProfileDrawer } from './ui/PatientProfileDrawer'
export type { DrawerPatient } from './ui/PatientProfileDrawer'
