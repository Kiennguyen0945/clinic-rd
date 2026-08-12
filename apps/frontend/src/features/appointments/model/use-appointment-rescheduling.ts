import { useState } from 'react'
import type { FormEvent } from 'react'

import { mapAppointment } from '../../../entities/appointment'
import type { Appointment, BookingSuggestion } from '../../../entities/appointment'
import type { PatientProfile } from '../../../entities/patient'
import { mapSlot } from '../../../entities/slot'
import type { ApiSlot, SlotDefinition } from '../../../entities/slot'
import { ApiError } from '../../../shared/api'
import type { ReceptionContext } from '../api/reception.api'
import type { useAppointmentMutations } from './appointment.mutations'
import type { useAppointmentReads } from './appointment.queries'
import type { useAppointmentBooking } from './use-appointment-booking'

interface ReschedulingDependencies {
  context: ReceptionContext | null
  patients: PatientProfile[]
  slots: SlotDefinition[]
  setSlots: React.Dispatch<React.SetStateAction<SlotDefinition[]>>
  setAppointments: React.Dispatch<React.SetStateAction<Appointment[]>>
  setSelectedId: React.Dispatch<React.SetStateAction<string>>
  reads: ReturnType<typeof useAppointmentReads>
  mutations: ReturnType<typeof useAppointmentMutations>
  booking: ReturnType<typeof useAppointmentBooking>
  refetch: () => unknown
}

export function useAppointmentRescheduling({
  context, patients, slots, setSlots, setAppointments, setSelectedId,
  reads, mutations, booking, refetch,
}: ReschedulingDependencies) {
  const [target, setTarget] = useState<Appointment | null>(null)
  const [suggestion, setSuggestion] = useState<BookingSuggestion | null>(null)
  const [toast, setToast] = useState('')

  const open = (appointment: Appointment) => {
    booking.setBookingContext(context)
    booking.setBookingMode('SCHEDULED')
    booking.setBookingSuggestion(null)
    booking.setDraft({
      patientId: appointment.patient.id,
      patientName: appointment.patient.fullName,
      doctorId: appointment.doctor.id,
      department: appointment.doctor.department,
      room: appointment.room,
      date: appointment.startTime.slice(0, 10),
      slotId: appointment.slotId,
      service: appointment.insuranceNumber ? 'BHYT' : 'Dịch vụ',
      insuranceNumber: appointment.insuranceNumber || '',
      reason: appointment.reason,
      note: '',
    })
    booking.setFormError('')
    setTarget(appointment)
    setSuggestion(null)
    if (appointment.slotId && !slots.some((item) => item.id === appointment.slotId)) {
      void reads.slots(appointment.startTime.slice(0, 10), appointment.doctor.id)
        .then((response) => setSlots(response.slots.map(mapSlot)))
        .catch((error) => booking.setFormError(
          error instanceof Error ? error.message : 'Không thể tải khung giờ',
        ))
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const targetSlotId = suggestion?.slot.id || booking.draft.slotId
    if (!target || !booking.draft.reason.trim() || !targetSlotId) {
      booking.setFormError('Vui lòng chọn khung giờ và nhập lý do khám.')
      return
    }
    booking.setSaving(true)
    booking.setFormError('')
    try {
      const doctor = context?.doctors.find((item) => item.id === booking.draft.doctorId)
      const body = {
        reason: booking.draft.reason.trim(),
        doctorId: Number(booking.draft.doctorId),
        departmentId: doctor?.departments.find(
          (department) => department.name === booking.draft.department,
        )?.id,
        ...(/^\d+$/.test(targetSlotId)
          ? { slotId: Number(targetSlotId) }
          : { slotKey: targetSlotId }),
      }
      const response = await mutations.update.mutateAsync({ id: Number(target.id), body })
      const updated = mapAppointment(response.appointment, patients, slots)
      setAppointments((current) => current.map((item) => item.id === updated.id ? updated : item))
      setSelectedId(updated.id)
      setTarget(null)
      setSuggestion(null)
    } catch (error) {
      handleFailure(error)
    } finally {
      booking.setSaving(false)
    }
  }

  const handleFailure = (error: unknown) => {
    if (error instanceof ApiError && (
      error.code === 'INVALID_STATUS_FOR_UPDATE' || error.code === 'RESCHEDULE_NOT_ALLOWED'
    )) {
      setTarget(null)
      setToast('Lịch hẹn đã được cập nhật ở nơi khác, vui lòng tải lại')
      void refetch()
      return
    }
    if (error instanceof ApiError && (
      error.code === 'SLOT_NOT_AVAILABLE' || error.code === 'SLOT_RESCHEDULE_CONFLICT'
    )) {
      const suggested = error.details?.suggestedSlot as ApiSlot | undefined
      if (suggested) {
        const mapped = mapSlot(suggested)
        setSuggestion({ mode: 'SCHEDULED', slot: mapped, deferWalkIn: false })
        setSlots((current) => [
          ...current.filter((slot) => slot.id !== mapped.id), mapped,
        ].sort((first, second) =>
          `${first.date}T${first.start}`.localeCompare(`${second.date}T${second.start}`),
        ))
      }
      booking.setFormError(error.message)
      return
    }
    booking.setFormError(error instanceof Error ? error.message : 'Không thể cập nhật lịch hẹn')
  }

  const changeDoctor = (doctorId: string) => {
    setSuggestion(null)
    void booking.changeDoctor(doctorId, booking.draft.department, true, true)
  }
  const changeDate = (date: string) => {
    setSuggestion(null)
    void booking.changeDate(date, true)
  }
  const changeSlot = (slotId: string) => {
    if (suggestion && slotId !== suggestion.slot.id) setSuggestion(null)
    booking.selectSlot(slotId)
  }

  return {
    target, setTarget, suggestion, toast, setToast, open, submit,
    changeDoctor, changeDate, changeSlot,
  }
}
