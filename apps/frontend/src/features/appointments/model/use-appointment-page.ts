import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import { todayValue } from '../../../shared/lib/date'

export function useAppointmentPageState() {
  const [searchParams, setSearchParams] = useSearchParams()
  const serialized = searchParams.toString()
  const state = useMemo(() => {
    const params = new URLSearchParams(serialized)
    return {
      doctorId: params.get('doctorId') || '',
      date: params.get('date') || todayValue(),
      department: params.get('department') || 'all',
      doctor: params.get('doctor') || 'all',
      slotStatus: params.get('slotStatus') || 'all',
      query: params.get('query') || '',
    }
  }, [serialized])

  const update = (changes: Partial<typeof state>) => {
    const next = { ...state, ...changes }
    const params = new URLSearchParams()
    if (next.doctorId) params.set('doctorId', next.doctorId)
    if (next.date !== todayValue()) params.set('date', next.date)
    if (next.department !== 'all') params.set('department', next.department)
    if (next.doctor !== 'all') params.set('doctor', next.doctor)
    if (next.slotStatus !== 'all') params.set('slotStatus', next.slotStatus)
    if (next.query) params.set('query', next.query)
    setSearchParams(params, { replace: true })
  }

  return {
    ...state,
    setDoctorId: (doctorId: string) => update({ doctorId }),
    setDate: (date: string) => update({ date }),
    setDepartment: (department: string) => update({ department }),
    setDoctor: (doctor: string) => update({ doctor }),
    setSlotStatus: (slotStatus: string) => update({ slotStatus }),
    setQuery: (query: string) => update({ query }),
  }
}
