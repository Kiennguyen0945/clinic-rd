export interface PatientFilters {
  keyword: string
  gender: 'all' | 'Nam' | 'Nữ'
  age: 'all' | 'under30' | '30to40' | 'over40'
  lastVisit: 'all' | 'today' | 'older'
  page: number
}

const genders: PatientFilters['gender'][] = ['all', 'Nam', 'Nữ']
const ages: PatientFilters['age'][] = ['all', 'under30', '30to40', 'over40']
const lastVisits: PatientFilters['lastVisit'][] = ['all', 'today', 'older']

function includes<T extends string>(values: T[], value: string): value is T {
  return values.includes(value as T)
}

export const patientFilterSchema = {
  parse(value: Record<string, string | number>): PatientFilters {
    const gender = String(value.gender)
    const age = String(value.age)
    const lastVisit = String(value.lastVisit)
    const page = Number(value.page)
    return {
      keyword: String(value.keyword || ''),
      gender: includes(genders, gender) ? gender : 'all',
      age: includes(ages, age) ? age : 'all',
      lastVisit: includes(lastVisits, lastVisit) ? lastVisit : 'all',
      page: Number.isInteger(page) && page > 0 ? page : 1,
    }
  },
}

export function parsePatientFilters(searchParams: URLSearchParams): PatientFilters {
  return patientFilterSchema.parse({
    keyword: searchParams.get('keyword') || '',
    gender: searchParams.get('gender') || 'all',
    age: searchParams.get('age') || 'all',
    lastVisit: searchParams.get('lastVisit') || 'all',
    page: searchParams.get('page') || 1,
  })
}
