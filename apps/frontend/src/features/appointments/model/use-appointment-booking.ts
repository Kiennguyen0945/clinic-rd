import { useState } from 'react'

import type {
  AppointmentDraft,
  BookingMode,
  BookingSuggestion,
} from '../../../entities/appointment'
import type { SlotDefinition } from '../../../entities/slot'
import type { ReceptionContext } from '../api/reception.api'

export function useAppointmentBooking(selectedDate: string) {
  const [bookingContext, setBookingContext] = useState<ReceptionContext | null>(null)
  const [bookingSlot, setBookingSlot] = useState<SlotDefinition | null>(null)
  const [bookingMode, setBookingMode] = useState<BookingMode>('SCHEDULED')
  const [bookingSuggestion, setBookingSuggestion] = useState<BookingSuggestion | null>(null)
  const [draft, setDraft] = useState<AppointmentDraft>({
    patientId: '',
    patientName: '',
    doctorId: '',
    department: '',
    room: '',
    date: selectedDate,
    slotId: '',
    service: 'Dịch vụ',
    insuranceNumber: '',
    reason: '',
    note: '',
  })
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  return {
    bookingContext,
    setBookingContext,
    bookingSlot,
    setBookingSlot,
    bookingMode,
    setBookingMode,
    bookingSuggestion,
    setBookingSuggestion,
    draft,
    setDraft,
    formError,
    setFormError,
    saving,
    setSaving,
  }
}
