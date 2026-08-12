import { apiRequest } from '../../../shared/api'
import { mapMedicalRecordHistory } from '../model/mappers'
import type {
  ApiMedicalRecord,
  ApiMedicalRecordHistoryItem,
  PrescriptionInput,
  UpdateMedicalRecordInput,
} from '../model/types'

async function requestMedicalRecord(path: string, init?: RequestInit) {
  const data = await apiRequest<{ medicalRecord: ApiMedicalRecord }>(path, init)
  return data.medicalRecord
}

export const medicalRecordApi = {
  getByAppointment: (appointmentId: number) =>
    requestMedicalRecord(`/api/appointments/${appointmentId}/medical-record/`),
  update: (medicalRecordId: number, body: UpdateMedicalRecordInput) =>
    requestMedicalRecord(`/api/medical-records/${medicalRecordId}/`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  replacePrescription: (medicalRecordId: number, items: PrescriptionInput[]) =>
    requestMedicalRecord(`/api/medical-records/${medicalRecordId}/prescription/`, {
      method: 'PUT',
      body: JSON.stringify({ items }),
    }),
  sign: (medicalRecordId: number) =>
    requestMedicalRecord(`/api/medical-records/${medicalRecordId}/sign/`, {
      method: 'POST',
    }),
  historyByPatient: async (patientId: number) => {
    const data = await apiRequest<{
      medicalRecords: ApiMedicalRecordHistoryItem[]
    }>(`/api/patients/${patientId}/medical-records/`)
    return mapMedicalRecordHistory(data.medicalRecords)
  },
}
