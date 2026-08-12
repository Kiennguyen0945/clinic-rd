// The patient entity owns the transport contract; the feature consumes it
// through this boundary so feature models do not depend on entity internals.
export { patientApi } from '../../../entities/patient'
export type {
  CreatePatientInput,
  PatientListOptions,
  PatientListResult,
  UpdatePatientInput,
} from '../../../entities/patient'
