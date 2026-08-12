// Temporary compatibility module. Remove after all external consumers migrate.
export { medicalRecordApi as medicalRecordsApi } from '../entities/medical-record'
export type {
  ApiMedicalRecord,
  ApiMedicalRecordHistoryItem,
  ApiPrescriptionItem,
} from '../entities/medical-record'
export { ApiError as MedicalRecordApiError } from '../shared/api/api-error'
