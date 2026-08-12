import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { parsePatientFilters } from './patient-filter.schema'
import type { PatientFilters } from './patient-filter.schema'

const defaults: PatientFilters = {
  keyword: '',
  gender: 'all',
  age: 'all',
  lastVisit: 'all',
  page: 1,
}

export function usePatientFilters() {
  const [searchParams, setSearchParams] = useSearchParams()
  const serializedParams = searchParams.toString()
  const filters = useMemo(
    () => parsePatientFilters(new URLSearchParams(serializedParams)),
    [serializedParams],
  )
  const [debouncedFilters, setDebouncedFilters] = useState(filters)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedFilters(filters), 250)
    return () => window.clearTimeout(timer)
  }, [filters])

  const updateFilters = (updates: Partial<PatientFilters>) => {
    const next = { ...filters, ...updates }
    const params = new URLSearchParams()
    for (const key of Object.keys(defaults) as Array<keyof PatientFilters>) {
      if (next[key] !== defaults[key]) params.set(key, String(next[key]))
    }
    setSearchParams(params, { replace: true })
  }

  return {
    filters,
    debouncedFilters,
    setKeyword: (keyword: string) => updateFilters({ keyword, page: 1 }),
    setGender: (gender: PatientFilters['gender']) => updateFilters({ gender, page: 1 }),
    setAge: (age: PatientFilters['age']) => updateFilters({ age, page: 1 }),
    setLastVisit: (lastVisit: PatientFilters['lastVisit']) => updateFilters({ lastVisit }),
    setPage: (page: number) => updateFilters({ page }),
  }
}
