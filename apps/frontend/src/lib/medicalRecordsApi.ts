import { authFetch } from './authFetch'

interface ApiEnvelope<T> {
  success: boolean
  data: T
  message?: string
  error?: { code?: string; message?: string; details?: Record<string, unknown> }
}

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

export class MedicalRecordApiError extends Error {
  code?: string
  details?: Record<string, unknown>

  constructor(message: string, code?: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'MedicalRecordApiError'
    this.code = code
    this.details = details
  }
}

async function request(path: string, init?: RequestInit): Promise<ApiMedicalRecord> {
  const response = await authFetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const contentType = response.headers.get('content-type') || ''
  let payload: ApiEnvelope<{ medicalRecord: ApiMedicalRecord }> | null = null
  if (contentType.includes('application/json')) {
    try {
      payload = await response.json() as ApiEnvelope<{ medicalRecord: ApiMedicalRecord }>
    } catch {
      payload = null
    }
  } else {
    await response.text()
  }
  if (!response.ok || !payload?.success) {
    throw new MedicalRecordApiError(
      payload?.error?.message || payload?.message || `Máy chủ không thể xử lý yêu cầu (${response.status})`,
      payload?.error?.code,
      payload?.error?.details,
    )
  }
  return payload.data.medicalRecord
}

async function requestHistory(patientId: number): Promise<ApiMedicalRecordHistoryItem[]> {
  const response = await authFetch(`/api/patients/${patientId}/medical-records/`)
  const contentType = response.headers.get('content-type') || ''
  let payload: ApiEnvelope<{ medicalRecords: ApiMedicalRecordHistoryItem[] }> | null = null
  if (contentType.includes('application/json')) {
    try {
      payload = await response.json() as ApiEnvelope<{ medicalRecords: ApiMedicalRecordHistoryItem[] }>
    } catch {
      payload = null
    }
  } else {
    await response.text()
  }
  if (!response.ok || !payload?.success) {
    throw new MedicalRecordApiError(payload?.error?.message || payload?.message || `Máy chủ không thể xử lý yêu cầu (${response.status})`, payload?.error?.code, payload?.error?.details)
  }
  return payload.data.medicalRecords
}

export const medicalRecordsApi = {
  getByAppointment: (appointmentId: number) => request(`/api/appointments/${appointmentId}/medical-record/`),
  update: (medicalRecordId: number, body: { illnessHistory?: string; vitalSigns?: string; examinationNote?: string; diagnosis?: string }) => request(`/api/medical-records/${medicalRecordId}/`, { method: 'PATCH', body: JSON.stringify(body) }),
  replacePrescription: (medicalRecordId: number, items: Array<{ medicationName: string; dosage: string; durationDays: number; quantity: number; instructions: string }>) => request(`/api/medical-records/${medicalRecordId}/prescription/`, { method: 'PUT', body: JSON.stringify({ items }) }),
  sign: (medicalRecordId: number) => request(`/api/medical-records/${medicalRecordId}/sign/`, { method: 'POST' }),
  historyByPatient: requestHistory,
}
