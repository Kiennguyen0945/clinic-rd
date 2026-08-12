import { apiRequest } from '../../../shared/api'
import type {
  ApiPatient,
  CreatePatientInput,
  PatientListOptions,
  PatientListResult,
  UpdatePatientInput,
} from '../model/types'

export const patientApi = {
  list: (options: PatientListOptions = {}) => {
    const params = new URLSearchParams()
    if (options.keyword) params.set('keyword', options.keyword)
    if (options.page) params.set('page', String(options.page))
    if (options.pageSize) params.set('pageSize', String(options.pageSize))
    if (options.gender && options.gender !== 'all') params.set('gender', options.gender)
    if (options.age && options.age !== 'all') params.set('age', options.age)
    const query = params.toString()
    return apiRequest<PatientListResult>(`/api/patients/${query ? `?${query}` : ''}`)
  },
  create: (body: CreatePatientInput) =>
    apiRequest<{ patient: ApiPatient }>('/api/patients/', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  update: (id: number, body: UpdatePatientInput) =>
    apiRequest<{ patient: ApiPatient }>(`/api/patients/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
}
