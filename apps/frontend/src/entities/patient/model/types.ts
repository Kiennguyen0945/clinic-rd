export interface ApiPatient {
  id: number | null
  patient_code: string
  full_name: string
  dob: string
  gender: 'M' | 'F' | 'O'
  phone: string
  email?: string | null
  cccd?: string | null
  address: string
  insurance_number?: string | null
}

export interface PatientProfile {
  id: string
  code: string
  fullName: string
  phone: string
  email: string
  cccd: string
  gender: 'Nam' | 'Nữ'
  age: number
  dob: string
  address: string
  lastVisit: { date: string; doctor: string; reason: string }
  insuranceNumber?: string
}

export interface PatientListOptions {
  keyword?: string
  page?: number
  pageSize?: number
  gender?: string
  age?: string
}

export interface PatientListResult {
  patients: ApiPatient[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
}

export interface CreatePatientInput {
  full_name: string
  phone: string
  dob: string
  gender: 'M' | 'F' | 'O'
  email?: string
  cccd?: string
  address?: string
  insurance_number?: string
}

export interface UpdatePatientInput {
  full_name: string
  phone: string
  email: string
  cccd: string
  address: string
  insurance_number: string
}
