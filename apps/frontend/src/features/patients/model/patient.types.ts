import type { ApiPatient } from '../../../entities/patient'

export interface PatientListItem {
  id: string
  code: string
  fullName: string
  gender: 'Nam' | 'Nữ'
  dob: string
  rawDob: string
  age: number
  phone: string
  email: string
  cccd: string
  address: string
  lastVisit: string
  lastReason: string
  allergy: string
  bloodType: string
  history: string
  insuranceNumber: string
}

const formatDob = (value: string) =>
  value
    ? new Intl.DateTimeFormat('vi-VN').format(new Date(`${value}T12:00:00`))
    : 'Chưa cập nhật'

const calculateAge = (value: string) => {
  if (!value) return 0
  const birthDate = new Date(`${value}T12:00:00`)
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const hasNotHadBirthday =
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() < birthDate.getDate())
  if (hasNotHadBirthday) age -= 1
  return age
}

export const mapApiPatient = (patient: ApiPatient): PatientListItem => ({
  id: String(patient.id),
  code: patient.patient_code,
  fullName: patient.full_name,
  gender: patient.gender === 'F' ? 'Nữ' : 'Nam',
  dob: formatDob(patient.dob),
  rawDob: patient.dob,
  age: calculateAge(patient.dob),
  phone: patient.phone,
  email: patient.email || 'Chưa cập nhật',
  cccd: patient.cccd || 'Chưa cập nhật',
  address: patient.address || 'Chưa cập nhật',
  lastVisit: 'Chưa có',
  lastReason: 'Chưa có lịch sử khám',
  allergy: 'Chưa cập nhật',
  bloodType: 'Chưa cập nhật',
  history: 'Chưa cập nhật',
  insuranceNumber: patient.insurance_number || '',
})
