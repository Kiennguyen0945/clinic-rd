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

export interface UpdateMedicalRecordInput {
  illnessHistory?: string
  vitalSigns?: string
  examinationNote?: string
  diagnosis?: string
}

export interface PrescriptionInput {
  medicationName: string
  dosage: string
  durationDays: number
  quantity: number
  instructions: string
}
