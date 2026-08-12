import type { ApiMedicalRecord } from '../../../entities/medical-record'

export type AppointmentStatus = 'WAITING' | 'IN_PROGRESS' | 'COMPLETED'
export type OrderType = 'LAB_TEST' | 'IMAGING' | 'PROCEDURE' | 'OTHER'

export interface Patient {
  id: string
  code: string
  fullName: string
  gender: string
  dob?: string
  age: number
  phone: string
  email?: string
  cccd?: string
  insuranceNumber?: string
  address: string
  allergy: string
  bloodType: string
  history: string
  chronic: string
  note: string
}

export interface WaitingAppointment {
  id: string
  patient: Patient
  date: string
  time: string
  endTime: string
  reason: string
  status: AppointmentStatus
  appointmentCode: string
  sequenceNumber: number
  appointmentType: 'SCHEDULED' | 'WALK_IN'
}

export interface Prescription {
  id: string
  medicationName: string
  dosage: string
  durationDays: number
  quantity: number
  unit: string
  instructions: string
}

export interface MedicalOrder {
  id: string
  orderType: OrderType
  name: string
  purpose: string
  instructions: string
}

export interface ConsultationDraft {
  illnessHistory: string
  symptoms: string
  diagnosis: string
  icdCode: string
  treatmentPlan: string
  notes: string
  pulse: string
  systolic: string
  diastolic: string
  temperature: string
  spo2: string
  weight: string
  height: string
  prescriptions: Prescription[]
  orders: MedicalOrder[]
}

export type MedicationDraft = {
  medicationName: string
  dosage: string
  durationDays: string
  quantity: string
  unit: string
  instructions: string
}

export type OrderDraft = {
  orderType: OrderType
  name: string
  purpose: string
  instructions: string
}

export const EMPTY_MEDICATION: MedicationDraft = {
  medicationName: '', dosage: '', durationDays: '3', quantity: '1', unit: 'viên', instructions: '',
}

export const EMPTY_CONSULTATION_DRAFT: ConsultationDraft = {
  illnessHistory: '', symptoms: '', diagnosis: '', icdCode: '', treatmentPlan: '', notes: '',
  pulse: '78', systolic: '120', diastolic: '80', temperature: '36.7', spo2: '98',
  weight: '', height: '', prescriptions: [], orders: [],
}

export function parseVitalSigns(value: string): Partial<ConsultationDraft> {
  if (!value.trim()) return {}
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    const result: Record<string, string> = {}
    for (const key of ['pulse', 'systolic', 'diastolic', 'temperature', 'spo2', 'weight', 'height']) {
      const field = parsed[key]
      if (typeof field === 'string' || typeof field === 'number') result[key] = String(field)
    }
    return result
  } catch {
    return {}
  }
}

export function draftFromMedicalRecord(record: ApiMedicalRecord): ConsultationDraft {
  return {
    ...EMPTY_CONSULTATION_DRAFT,
    ...parseVitalSigns(record.vitalSigns),
    illnessHistory: record.illnessHistory || '',
    symptoms: record.examinationNote || '',
    diagnosis: record.diagnosis || '',
    prescriptions: record.prescription?.items.map((item) => ({
      ...item, id: String(item.id), unit: 'viên',
    })) || [],
  }
}

export function validateConsultation(draft: ConsultationDraft) {
  return draft.diagnosis.trim() ? {} : { diagnosis: 'Chẩn đoán là bắt buộc' }
}
