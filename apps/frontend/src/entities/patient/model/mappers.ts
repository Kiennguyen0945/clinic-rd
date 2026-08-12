import type { ApiPatient, PatientProfile } from './types'

export const patientInitials = (name: string) =>
  name
    .split(' ')
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

export function ageFromDob(dob: string) {
  const birthDate = new Date(`${dob}T12:00:00`)
  const now = new Date()
  let age = now.getFullYear() - birthDate.getFullYear()
  if (now < new Date(now.getFullYear(), birthDate.getMonth(), birthDate.getDate())) {
    age -= 1
  }
  return Math.max(age, 0)
}

export function mapPatient(patient: ApiPatient): PatientProfile {
  return {
    id: String(patient.id),
    code: patient.patient_code,
    fullName: patient.full_name,
    phone: patient.phone,
    email: patient.email || 'Chưa cập nhật',
    cccd: patient.cccd || '',
    gender: patient.gender === 'F' ? 'Nữ' : 'Nam',
    age: ageFromDob(patient.dob),
    dob: patient.dob,
    address: patient.address || 'Chưa cập nhật',
    lastVisit: { date: '', doctor: 'Chưa cập nhật', reason: 'Chưa có dữ liệu' },
    insuranceNumber: patient.insurance_number || undefined,
  }
}
