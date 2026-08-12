import { apiRequest } from '../shared/api/http-client'

export interface ApiMedicalRecordHistoryItem {
  id: number
  appointmentId: number
  appointmentCode: string | null
  sequenceNumber: number | null
  visitDate: string
  doctorName: string
  departmentName: string | null
  reason: string
  appointmentStatus: 'COMPLETED'
  bookingType: 'SCHEDULE' | 'WALK_IN'
  startTime: string
  endTime: string
  symptoms: string
  diagnosis: string
  notes: string
  vitalSigns: string
  status: 'SIGNED'
  signedAt: string | null
  prescription: ApiMedicalRecord['prescription']
}

export interface ApiPrescriptionItem {
  id: number
  medicationName: string
  dosage: string
  durationDays: number
  quantity: number
  instructions: string
}

export interface ApiMedicalRecord {
  id: number
  appointmentId: number
  illnessHistory: string
  vitalSigns: string
  examinationNote: string
  diagnosis: string
  status: 'DRAFT' | 'SIGNED'
  signedBy: number | null
  signedAt: string | null
  createdAt: string
  updatedAt: string
  prescription: {
    id: number
    medicalRecordId: number
    prescribedBy: number
    createdAt: string
    items: ApiPrescriptionItem[]
  } | null
}

export { ApiError as MedicalRecordApiError } from '../shared/api/api-error'

async function request(path: string, init?: RequestInit): Promise<ApiMedicalRecord> {
  const data = await apiRequest<{ medicalRecord: ApiMedicalRecord }>(path, init)
  return data.medicalRecord
}

async function requestHistory(patientId: number): Promise<ApiMedicalRecordHistoryItem[]> {
  const data = await apiRequest<{ medicalRecords: ApiMedicalRecordHistoryItem[] }>(`/api/patients/${patientId}/medical-records/`)
  return data.medicalRecords
}

export const medicalRecordsApi = {
  getByAppointment: (appointmentId: number) => request(`/api/appointments/${appointmentId}/medical-record/`),
  update: (medicalRecordId: number, body: { illnessHistory?: string; vitalSigns?: string; examinationNote?: string; diagnosis?: string }) => request(`/api/medical-records/${medicalRecordId}/`, { method: 'PATCH', body: JSON.stringify(body) }),
  replacePrescription: (medicalRecordId: number, items: Array<{ medicationName: string; dosage: string; durationDays: number; quantity: number; instructions: string }>) => request(`/api/medical-records/${medicalRecordId}/prescription/`, { method: 'PUT', body: JSON.stringify({ items }) }),
  sign: (medicalRecordId: number) => request(`/api/medical-records/${medicalRecordId}/sign/`, { method: 'POST' }),
  historyByPatient: requestHistory,
}
