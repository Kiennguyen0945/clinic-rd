import { useRef, useState } from 'react'
import type { FormEvent } from 'react'

import { mapAppointment } from '../../../entities/appointment'
import type { Appointment, AppointmentDraft, BookingMode, BookingSuggestion } from '../../../entities/appointment'
import { mapPatient } from '../../../entities/patient'
import type { ApiPatient, PatientProfile } from '../../../entities/patient'
import { emptyBookingSlot, isSlotAvailable, mapSlot } from '../../../entities/slot'
import type { SlotDefinition } from '../../../entities/slot'
import { todayValue } from '../../../shared/lib/date'
import type { ReceptionContext } from '../api/reception.api'
import { validateBookingDraft } from './booking.schema'
import type { useAppointmentMutations } from './appointment.mutations'
import type { useAppointmentReads } from './appointment.queries'

interface BookingDependencies {
  selectedDate: string
  activeDoctorId: string
  context: ReceptionContext | null
  patients: PatientProfile[]
  setPatients: React.Dispatch<React.SetStateAction<PatientProfile[]>>
  slots: SlotDefinition[]
  setSlots: React.Dispatch<React.SetStateAction<SlotDefinition[]>>
  reads: ReturnType<typeof useAppointmentReads>
  mutations: ReturnType<typeof useAppointmentMutations>
  onCreated: (appointment: Appointment) => void
}

export function useAppointmentBooking({
  selectedDate, activeDoctorId, context, patients, setPatients, slots, setSlots,
  reads, mutations, onCreated,
}: BookingDependencies) {
  const [bookingContext, setBookingContext] = useState<ReceptionContext | null>(null)
  const [bookingSlot, setBookingSlot] = useState<SlotDefinition | null>(null)
  const [bookingMode, setBookingMode] = useState<BookingMode>('SCHEDULED')
  const [bookingSuggestion, setBookingSuggestion] = useState<BookingSuggestion | null>(null)
  const [draft, setDraft] = useState<AppointmentDraft>(() => emptyDraft(selectedDate))
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showCreatePatient, setShowCreatePatient] = useState(false)
  const suggestionRequestRef = useRef(0)

  const findNextScheduleSlot = async (sourceSlot: SlotDefinition, doctorId: string) => {
    const sameDay = slots.find((candidate) =>
      candidate.date === sourceSlot.date && candidate.start >= sourceSlot.end &&
      candidate.bookable && isSlotAvailable(candidate),
    )
    if (sameDay) return sameDay
    const date = new Date(`${sourceSlot.date}T12:00:00`)
    for (let offset = 1; offset <= 60; offset += 1) {
      date.setDate(date.getDate() + 1)
      const response = await reads.slots(date.toISOString().slice(0, 10), doctorId)
      const candidate = response.slots.map(mapSlot).find((item) => item.bookable && isSlotAvailable(item))
      if (candidate) return candidate
    }
    return undefined
  }

  const updateSuggestionForSlot = async (selectedSlot: SlotDefinition, doctorId: string) => {
    const requestId = ++suggestionRequestRef.current
    setBookingSuggestion(null)
    if (selectedSlot.state !== 'ongoing' || selectedSlot.bookable) return
    try {
      const suggestion = await findNextScheduleSlot(selectedSlot, doctorId)
      if (requestId !== suggestionRequestRef.current) return
      if (suggestion) setBookingSuggestion({ mode: 'SCHEDULED', slot: suggestion, deferWalkIn: false })
      else setFormError('Không còn khung giờ phù hợp trong 60 ngày tới.')
    } catch (error) {
      if (requestId === suggestionRequestRef.current) {
        setFormError(error instanceof Error ? error.message : 'Không thể tìm khung giờ đề xuất.')
      }
    }
  }

  const open = (slot: SlotDefinition) => {
    if (!activeDoctorId || !isSlotAvailable(slot)) return
    const doctor = context?.doctors.find((item) => item.id === activeDoctorId)
    const rooms = assignedRooms(context, activeDoctorId)
    setBookingContext(context)
    setBookingMode('SCHEDULED')
    setBookingSuggestion(null)
    setDraft({
      ...emptyDraft(selectedDate), doctorId: activeDoctorId,
      department: doctor?.departments.length === 1 ? doctor.departments[0].name : '',
      room: rooms.length === 1 ? rooms[0] : '', slotId: rooms.length > 1 ? '' : slot.id,
    })
    setBookingSlot(rooms.length > 1 ? emptyBookingSlot() : slot)
    setFormError(rooms.length > 1 ? multipleRoomMessage : '')
    if (rooms.length <= 1) void updateSuggestionForSlot(slot, activeDoctorId)
  }

  const openWithoutSlot = () => {
    const doctor = context?.doctors.find((item) => item.id === activeDoctorId)
    const rooms = assignedRooms(context, activeDoctorId)
    setBookingContext(context)
    setBookingSlot(emptyBookingSlot())
    setBookingMode('SCHEDULED')
    setBookingSuggestion(null)
    setDraft({
      ...emptyDraft(selectedDate), doctorId: activeDoctorId,
      department: doctor?.departments.length === 1 ? doctor.departments[0].name : '',
      room: rooms.length === 1 ? rooms[0] : '',
    })
    setFormError(rooms.length > 1 ? multipleRoomMessage : '')
  }

  const selectSlot = (slotId: string) => {
    const selected = slots.find((item) => item.id === slotId)
    if (!selected) return
    setDraft((current) => ({ ...current, slotId, room: selected.room }))
    setFormError('')
    void updateSuggestionForSlot(selected, draft.doctorId)
  }

  const loadSlots = async (date: string, doctorId: string) => {
    const response = await reads.slots(date, doctorId)
    const nextSlots = response.slots.map(mapSlot)
    setSlots(nextSlots)
    return nextSlots
  }

  const changeMode = async (mode: BookingMode) => {
    setBookingMode(mode); setBookingSuggestion(null); setFormError('')
    if (!draft.doctorId) return
    try {
      await loadSlots(draft.date, draft.doctorId)
      setDraft((current) => ({ ...current, slotId: '' }))
      setBookingSlot(emptyBookingSlot())
    } catch (error) { setFormError(errorMessage(error, 'Không thể tải khung giờ')) }
  }

  const changeDate = async (date: string, preserveModal = false) => {
    if (date < todayValue()) return setFormError('Không thể đặt lịch trong quá khứ.')
    setDraft((current) => ({ ...current, date, slotId: '', room: '' }))
    try {
      const nextContext = await reads.context(date)
      setBookingContext(nextContext)
      if (!draft.doctorId) { setSlots([]); if (!preserveModal) setBookingSlot(emptyBookingSlot()); return }
      const rooms = assignedRooms(nextContext, draft.doctorId)
      if (rooms.length > 1) return setFormError(multipleRoomMessage)
      await loadSlots(date, draft.doctorId)
      if (!preserveModal) setBookingSlot(emptyBookingSlot())
      setDraft((current) => ({ ...current, slotId: '', room: rooms[0] || '' }))
    } catch (error) { setFormError(errorMessage(error, 'Không thể tải khung giờ của ngày đã chọn')) }
  }

  const changeDoctor = async (
    doctorId: string, preferredDepartment = draft.department,
    allowMultipleRooms = false, preserveModal = false,
  ) => {
    const source = bookingContext || context
    const doctor = source?.doctors.find((item) => item.id === doctorId)
    const rooms = assignedRooms(source, doctorId)
    const department = doctor?.departments.length === 1 ? doctor.departments[0].name
      : doctor?.departments.some((item) => item.name === preferredDepartment) ? preferredDepartment : ''
    setDraft((current) => ({ ...current, doctorId, department, room: rooms.length === 1 ? rooms[0] : '', slotId: '' }))
    setBookingSuggestion(null); if (!preserveModal) setBookingSlot(emptyBookingSlot()); setFormError('')
    if (!doctorId) return setSlots([])
    if (rooms.length > 1 && !allowMultipleRooms) { setSlots([]); return setFormError(multipleRoomMessage) }
    try { await loadSlots(draft.date, doctorId) }
    catch (error) { setFormError(errorMessage(error, 'Không thể tải khung giờ của bác sĩ')) }
  }

  const changeDepartment = async (department: string) => {
    setDraft((current) => ({ ...current, department, slotId: '' }))
    if (draft.doctorId || !department) return
    const source = bookingContext || context
    const openDoctors = new Set((source?.openSlotAssignments || []).map((item) => item.doctorId))
    const candidates = (source?.doctors || []).filter((doctor) =>
      openDoctors.has(doctor.id) && doctor.departments.some((item) => item.name === department),
    )
    if (candidates.length === 1) await changeDoctor(candidates[0].id, department)
  }

  const changeRoom = async (room: string) => {
    if (draft.doctorId || !room) return
    const source = bookingContext || context
    const doctorIds = [...new Set((source?.openSlotAssignments || [])
      .filter((item) => item.roomNumber === room).map((item) => item.doctorId))]
    if (doctorIds.length > 1) {
      setDraft((current) => ({ ...current, doctorId: '', department: '', room: '', slotId: '' }))
      return setFormError('Ngoài phạm vi MVP: nhiều bác sĩ luân phiên dùng chung một phòng trong ngày. Vui lòng chọn theo bác sĩ.')
    }
    if (doctorIds.length === 1) await changeDoctor(doctorIds[0])
  }

  const create = async (selectedSlot: SlotDefinition, mode: BookingMode) => {
    if (validateBookingDraft(draft) || draft.date < todayValue()) {
      return setFormError('Vui lòng chọn bác sĩ và điền đầy đủ thông tin bắt buộc.')
    }
    const doctor = context?.doctors.find((item) => item.id === draft.doctorId)
    const department = doctor?.departments.find((item) => item.name === draft.department)
    setSaving(true); setFormError('')
    try {
      const response = await mutations.create.mutateAsync({
        patientId: Number(draft.patientId), doctorId: Number(draft.doctorId),
        ...(/^\d+$/.test(selectedSlot.id) ? { slotId: Number(selectedSlot.id) } : { slotKey: selectedSlot.id }),
        departmentId: department?.id, bookingType: mode === 'IMMEDIATE' ? 'WALK_IN' : 'SCHEDULE',
        patientType: draft.service === 'BHYT' ? 'BHYT' : 'SERVICE',
        bhytNumber: draft.service === 'BHYT' ? draft.insuranceNumber.trim() : undefined,
        reason: draft.reason.trim(),
      })
      const created = mapAppointment(response.appointment, patients, slots)
      setBookingSuggestion(null); setBookingSlot(null); onCreated(created)
    } catch (error) { setFormError(errorMessage(error, 'Không thể tạo lịch hẹn')) }
    finally { setSaving(false) }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const submitter = (event.nativeEvent as SubmitEvent).submitter
    const mode: BookingMode = submitter?.textContent?.includes('Khám ngay') || submitter?.textContent?.includes('Xếp vào khung') ? 'IMMEDIATE' : 'SCHEDULED'
    if (validateBookingDraft(draft) || draft.date < todayValue()) return setFormError('Vui lòng điền đầy đủ thông tin bắt buộc.')
    const selected = slots.find((slot) => slot.id === draft.slotId)
    if (selected) {
      if (mode === 'SCHEDULED' && !selected.bookable) return setFormError(`Khung ${selected.start} - ${selected.end} không còn hợp lệ. Vui lòng chọn khung khác.`)
      if (mode === 'IMMEDIATE' && !isSlotAvailable(selected)) return setFormError('Khung giờ đã chọn không còn chỗ. Vui lòng chọn khung khác.')
      return create(selected, mode)
    }
    setSaving(true)
    try {
      const available = await loadSlots(draft.date, draft.doctorId)
      const candidate = mode === 'IMMEDIATE'
        ? available.find((item) => item.state === 'ongoing' && isSlotAvailable(item)) || available.find((item) => item.state === 'available' && isSlotAvailable(item))
        : available.find((item) => item.bookable && isSlotAvailable(item))
      if (!candidate) return setFormError('Không còn slot tiếp nhận phù hợp.')
      setDraft((current) => ({ ...current, slotId: '', room: candidate.room }))
      setBookingSlot(candidate)
      setBookingSuggestion({ mode, slot: candidate, deferWalkIn: mode === 'IMMEDIATE' && candidate.state !== 'ongoing' })
    } catch (error) { setFormError(errorMessage(error, 'Không thể tìm khung giờ phù hợp')) }
    finally { setSaving(false) }
  }

  const selectCreatedPatient = (patient: ApiPatient) => {
    const created = mapPatient(patient)
    setPatients((current) => [created, ...current.filter((item) => item.id !== created.id)])
    setDraft((current) => ({ ...current, patientId: created.id, patientName: created.fullName, insuranceNumber: created.insuranceNumber || '' }))
    setShowCreatePatient(false); setFormError('')
  }

  return {
    bookingContext, setBookingContext, bookingSlot, setBookingSlot,
    bookingMode, setBookingMode, bookingSuggestion, setBookingSuggestion,
    draft, setDraft, formError, setFormError, saving, setSaving,
    showCreatePatient, setShowCreatePatient, open, openWithoutSlot, selectSlot,
    changeMode, changeDate, changeDoctor, changeDepartment, changeRoom, create,
    submit, confirmSuggestion: () => bookingSuggestion && void create(bookingSuggestion.slot, bookingSuggestion.mode),
    addPatient: () => { setFormError(''); setShowCreatePatient(true) },
    selectCreatedPatient,
  }
}

const multipleRoomMessage = 'Ngoài phạm vi MVP: bác sĩ đổi phòng nhiều lần trong ngày. Vui lòng điều chỉnh DoctorSlot trước khi tạo lịch.'
const emptyDraft = (date: string): AppointmentDraft => ({
  patientId: '', patientName: '', doctorId: '', department: '', room: '', date,
  slotId: '', service: 'Dịch vụ', insuranceNumber: '', reason: '', note: '',
})
const assignedRooms = (context: ReceptionContext | null, doctorId: string) =>
  [...new Set((context?.openSlotAssignments || []).filter((item) => item.doctorId === doctorId).map((item) => item.roomNumber))]
const errorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback
