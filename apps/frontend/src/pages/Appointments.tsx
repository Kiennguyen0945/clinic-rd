import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, FormEvent, ReactNode, SetStateAction } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock3,
  Filter,
  LockKeyhole,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Stethoscope,
  UserRound,
  X,
} from 'lucide-react'
import { useAuthStore } from '../store'
import { appointmentApi } from '../lib/appointmentsApi'
import type { ApiAppointment, ApiDoctor, ApiPatient, ApiSlot, ReceptionContext } from '../lib/appointmentsApi'

export type AppointmentStatus = 'CONFIRMED' | 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
type AppointmentType = 'SCHEDULED' | 'WALK_IN'
type SlotState = 'available' | 'ongoing' | 'full' | 'ended' | 'closed'
type BookingMode = 'IMMEDIATE' | 'SCHEDULED'

interface PatientProfile {
  id: string
  code: string
  fullName: string
  phone: string
  email: string
  gender: 'Nam' | 'Nữ'
  age: number
  dob: string
  address: string
  lastVisit: { date: string; doctor: string; reason: string }
  insuranceNumber?: string
}

interface Appointment {
  id: string
  slotId: string
  patient: PatientProfile
  doctor: { id: string; fullName: string; department: string }
  appointmentType: AppointmentType
  startTime: string
  endTime: string
  reason: string
  status: AppointmentStatus
  sequenceNumber: number
  appointmentCode: string
  room: string
  insuranceNumber?: string
  cancellationReason: string
  cancellationNote: string
}

interface SlotDefinition {
  id: string
  start: string
  end: string
  state: SlotState
  booked: number
  capacity: number
  bookable: boolean
  room: string
}

interface AppointmentDraft {
  patientId: string
  patientName: string
  doctorId: string
  department: string
  room: string
  date: string
  slotId: string
  service: 'Dịch vụ' | 'BHYT'
  insuranceNumber: string
  reason: string
  note: string
}

interface BookingSuggestion {
  mode: BookingMode
  slot: SlotDefinition
  deferWalkIn: boolean
}

const statusConfig: Record<AppointmentStatus, { label: string; className: string }> = {
  CONFIRMED: { label: 'Đã xác nhận', className: 'status-confirmed' },
  WAITING: { label: 'Đang chờ', className: 'status-waiting' },
  IN_PROGRESS: { label: 'Đang khám', className: 'status-progress' },
  COMPLETED: { label: 'Đã hoàn thành', className: 'status-completed' },
  CANCELLED: { label: 'Đã hủy', className: 'status-cancelled' },
}

const cancellationReasonLabels: Record<string, string> = {
  PATIENT_REQUEST: 'Bệnh nhân báo bận / Xin dời lịch.',
  PATIENT_WRONG_INFO: 'Đặt nhầm thông tin / Trùng lịch.',
  NO_SHOW: 'Khách không đến / Không liên lạc được.',
  DOCTOR_UNAVAILABLE: 'Bác sĩ nghỉ đột xuất / Có ca cấp cứu.',
  ROOM_ISSUE: 'Phòng khám gặp sự cố kỹ thuật (Hỏng máy móc, mất điện...).',
  OTHER: 'Nhập lý do khác',
}

function cancellationReasonLabel(reason: string, note = '') {
  return reason === 'OTHER' && note ? `${cancellationReasonLabels.OTHER}: ${note}` : cancellationReasonLabels[reason] || reason || 'Chưa có lý do hủy'
}

const todayValue = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const timeLabel = (value: string) => value.includes('T') ? value.slice(11, 16) : value.slice(0, 5)
const dateLabel = (value: string) => new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T12:00:00`))
const shortDateLabel = (value: string) => new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T12:00:00`))
const patientInitials = (name: string) => name.split(' ').slice(-2).map((part) => part[0]).join('').toUpperCase()

function ageFromDob(dob: string) {
  const birthDate = new Date(`${dob}T12:00:00`)
  const now = new Date()
  let age = now.getFullYear() - birthDate.getFullYear()
  if (now < new Date(now.getFullYear(), birthDate.getMonth(), birthDate.getDate())) age -= 1
  return Math.max(age, 0)
}

function mapPatient(patient: ApiPatient): PatientProfile {
  return {
    id: String(patient.id),
    code: patient.patient_code,
    fullName: patient.full_name,
    phone: patient.phone,
    email: 'Chưa cập nhật',
    gender: patient.gender === 'F' ? 'Nữ' : 'Nam',
    age: ageFromDob(patient.dob),
    dob: patient.dob,
    address: patient.address || 'Chưa cập nhật',
    lastVisit: { date: '', doctor: 'Chưa cập nhật', reason: 'Chưa có dữ liệu' },
    insuranceNumber: patient.insurance_number || undefined,
  }
}

function mapDoctor(doctor: ApiDoctor) {
  return { id: doctor.id, fullName: doctor.fullName, department: doctor.departments[0]?.name || 'Chưa phân khoa' }
}

function mapSlot(slot: ApiSlot): SlotDefinition {
  const state: SlotState = slot.status === 'CLOSED'
    ? 'closed'
    : slot.isEnded
      ? 'ended'
      : slot.isFull
        ? 'full'
        : slot.isOngoing
          ? 'ongoing'
          : 'available'
  return {
    id: String(slot.id),
    start: timeLabel(slot.startTime),
    end: timeLabel(slot.endTime),
    state,
    booked: slot.bookedCount,
    capacity: slot.capacity,
    bookable: slot.isBookable,
    room: slot.room.roomNumber,
  }
}

function mapAppointment(appointment: ApiAppointment, patients: PatientProfile[], slots: SlotDefinition[]): Appointment {
  const patient = patients.find((item) => item.id === String(appointment.patient.id)) || {
    id: String(appointment.patient.id), code: appointment.patient.patientCode, fullName: appointment.patient.fullName,
    phone: appointment.patient.phone, email: 'Chưa cập nhật', gender: 'Nam', age: 0, dob: '', address: 'Chưa cập nhật',
    lastVisit: { date: '', doctor: 'Chưa cập nhật', reason: 'Chưa có dữ liệu' },
  }
  const slot = slots.find((item) => item.id === String(appointment.slot_id))
  const date = appointment.slot?.slotDate || appointment.appointment_time.slice(0, 10)
  const start = appointment.slot?.startTime || appointment.appointment_time
  const end = appointment.slot?.endTime || start
  return {
    id: String(appointment.id),
    slotId: String(appointment.slot_id || ''),
    patient,
    doctor: { id: appointment.doctor.id, fullName: appointment.doctor.fullName, department: appointment.department?.name || 'Chưa phân khoa' },
    appointmentType: appointment.booking_type === 'WALK_IN' ? 'WALK_IN' : 'SCHEDULED',
    startTime: `${date}T${timeLabel(start)}:00`,
    endTime: `${date}T${timeLabel(end)}:00`,
    reason: appointment.reason,
    status: appointment.status === 'PENDING' ? 'CONFIRMED' : appointment.status,
    sequenceNumber: appointment.sequence_number || 0,
    appointmentCode: appointment.appointment_code,
    room: slot?.room || appointment.slot?.roomNumber || 'Phòng khám',
    insuranceNumber: appointment.bhyt_number || patient.insuranceNumber,
    cancellationReason: appointment.cancellation_reason,
    cancellationNote: appointment.cancellation_note || '',
  }
}

function isSlotAvailable(slot: SlotDefinition) {
  return slot.state !== 'ended' && slot.state !== 'full' && slot.state !== 'closed' && slot.booked < slot.capacity
}

function emptyBookingSlot(): SlotDefinition {
  return { id: '', start: 'Chưa chọn khung giờ', end: '', state: 'available', booked: 0, capacity: 0, bookable: false, room: '' }
}

export default function AppointmentsPage() {
  const user = useAuthStore((state) => state.user)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedDoctorId = searchParams.get('doctorId')
  const [selectedDate, setSelectedDate] = useState(todayValue)
  const [overviewDepartment, setOverviewDepartment] = useState('all')
  const [overviewDoctor, setOverviewDoctor] = useState('all')
  const [overviewSlotStatus, setOverviewSlotStatus] = useState('all')
  const [query, setQuery] = useState('')
  const [context, setContext] = useState<ReceptionContext | null>(null)
  const [bookingContext, setBookingContext] = useState<ReceptionContext | null>(null)
  const [patientDirectory, setPatientDirectory] = useState<PatientProfile[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [slotDefinitions, setSlotDefinitions] = useState<SlotDefinition[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [expandedSlotId, setExpandedSlotId] = useState('')
  const [queueTab, setQueueTab] = useState<'WAITING' | 'CONFIRMED'>('WAITING')
  const [drawerAppointmentId, setDrawerAppointmentId] = useState<string | null>(null)
  const [bookingSlot, setBookingSlot] = useState<SlotDefinition | null>(null)
  const [bookingMode, setBookingMode] = useState<BookingMode>('SCHEDULED')
  const [bookingSuggestion, setBookingSuggestion] = useState<BookingSuggestion | null>(null)
  const [printAppointment, setPrintAppointment] = useState<Appointment | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null)
  const [draft, setDraft] = useState<AppointmentDraft>({ patientId: '', patientName: '', doctorId: '', department: '', room: '', date: selectedDate, slotId: '', service: 'Dịch vụ', insuranceNumber: '', reason: '', note: '' })
  const [formError, setFormError] = useState('')
  const [pageError, setPageError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [saving, setSaving] = useState(false)
  const activeDoctorId = requestedDoctorId || ''
  const selectedDoctor = mapDoctor(context?.doctors.find((doctor) => doctor.id === activeDoctorId) || { id: '', fullName: 'Chưa chọn bác sĩ', departments: [] })
  const isReceptionClosed = false

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setPageError('')
      try {
        const [nextContext, nextPatients] = await Promise.all([
          appointmentApi.context(selectedDate),
          appointmentApi.patients(),
        ])
        if (cancelled) return
        setContext(nextContext)
        setPatientDirectory(nextPatients.patients.map(mapPatient))
        const nextDoctorId = requestedDoctorId || ''
        if (!nextDoctorId) return
        const [nextSlots, nextAppointments] = await Promise.all([
          appointmentApi.slots(selectedDate, nextDoctorId),
          appointmentApi.appointments(selectedDate, nextDoctorId),
        ])
        if (cancelled) return
        const mappedSlots = nextSlots.slots.map(mapSlot)
        const mappedPatients = nextPatients.patients.map(mapPatient)
        const mappedAppointments = nextAppointments.appointments.map((item) => mapAppointment(item, mappedPatients, mappedSlots))
        setSlotDefinitions(mappedSlots)
        setAppointments(mappedAppointments)
        setExpandedSlotId('')
        setSelectedId((current) => mappedAppointments.some((item) => item.id === current) ? current : mappedAppointments[0]?.id || '')
      } catch (error) {
        if (!cancelled) setPageError(error instanceof Error ? error.message : 'Không thể tải dữ liệu lịch hẹn')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    const timer = window.setInterval(() => setRefreshVersion((value) => value + 1), 30000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [selectedDate, requestedDoctorId, refreshVersion])

  const visibleAppointments = useMemo(() => appointments.filter((item) => item.doctor.id === activeDoctorId), [activeDoctorId, appointments])
  const queue = useMemo(() => visibleAppointments.filter((item) => (item.status === 'WAITING' || item.status === 'CONFIRMED') && `${item.patient.fullName} ${item.patient.phone} ${item.patient.code} ${item.sequenceNumber}`.toLowerCase().includes(query.toLowerCase())), [visibleAppointments, query])
  const selectedAppointment = appointments.find((item) => item.id === selectedId) || null
  const drawerAppointment = appointments.find((item) => item.id === drawerAppointmentId) || null

  const moveDate = (amount: number) => {
    const date = new Date(`${selectedDate}T12:00:00`)
    date.setDate(date.getDate() + amount)
    setSelectedDate(date.toISOString().slice(0, 10))
  }

  const openCreate = (slot: SlotDefinition) => {
    if (slot.state === 'ended' || slot.state === 'full' || slot.state === 'closed') return
    if (!activeDoctorId) return
    const assignedRooms = [...new Set((context?.openSlotAssignments || []).filter((item) => item.doctorId === activeDoctorId).map((item) => item.roomNumber))]
    if (assignedRooms.length > 1) {
      const doctor = context?.doctors.find((item) => item.id === activeDoctorId)
      setBookingContext(context)
      setDraft({ patientId: '', patientName: '', doctorId: activeDoctorId, department: doctor?.departments.length === 1 ? doctor.departments[0].name : '', room: '', date: selectedDate, slotId: '', service: 'Dịch vụ', insuranceNumber: '', reason: '', note: '' })
      setFormError('Ngoài phạm vi MVP: bác sĩ đổi phòng nhiều lần trong ngày. Vui lòng điều chỉnh DoctorSlot trước khi tạo lịch.')
      setBookingSlot(emptyBookingSlot())
      return
    }
    setBookingSlot(slot)
    setBookingSuggestion(null)
    setBookingMode('SCHEDULED')
    const doctor = context?.doctors.find((item) => item.id === activeDoctorId)
    setBookingContext(context)
    setDraft({ patientId: '', patientName: '', doctorId: activeDoctorId, department: doctor?.departments.length === 1 ? doctor.departments[0].name : '', room: slot.room, date: selectedDate, slotId: slot.id, service: 'Dịch vụ', insuranceNumber: '', reason: '', note: '' })
    setFormError('')
  }

  const openCreateWithoutSlot = () => {
    setBookingSlot(emptyBookingSlot())
    setBookingSuggestion(null)
    setBookingMode('SCHEDULED')
    const doctor = context?.doctors.find((item) => item.id === activeDoctorId)
    const doctorRooms = [...new Set((context?.openSlotAssignments || []).filter((item) => item.doctorId === activeDoctorId).map((item) => item.roomNumber))]
    setBookingContext(context)
    setDraft({ patientId: '', patientName: '', doctorId: activeDoctorId, department: doctor?.departments.length === 1 ? doctor.departments[0].name : '', room: doctorRooms.length === 1 ? doctorRooms[0] : '', date: selectedDate, slotId: '', service: 'Dịch vụ', insuranceNumber: '', reason: '', note: '' })
    setFormError(doctorRooms.length > 1 ? 'Ngoài phạm vi MVP: bác sĩ đổi phòng nhiều lần trong ngày. Vui lòng điều chỉnh DoctorSlot trước khi tạo lịch.' : '')
  }

  const changeBookingMode = async (mode: BookingMode) => {
    setBookingMode(mode)
    setBookingSuggestion(null)
    setFormError('')
    if (!draft.doctorId) return
    try {
      const response = await appointmentApi.slots(draft.date, draft.doctorId, 'SCHEDULE')
      const nextSlots = response.slots.map(mapSlot)
      setSlotDefinitions(nextSlots)
      setDraft((current) => ({ ...current, slotId: '' }))
      setBookingSlot(emptyBookingSlot())
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Không thể tải khung giờ')
    }
  }

  const changeBookingDate = async (date: string) => {
    if (date < todayValue()) {
      setFormError('Không thể đặt lịch trong quá khứ.')
      return
    }
    setDraft((current) => ({ ...current, date, slotId: '', room: '' }))
    try {
      const nextContext = await appointmentApi.context(date)
      setBookingContext(nextContext)
      if (!draft.doctorId) {
        setSlotDefinitions([])
        setBookingSlot(emptyBookingSlot())
        return
      }
      const doctorRooms = [...new Set(nextContext.openSlotAssignments.filter((item) => item.doctorId === draft.doctorId).map((item) => item.roomNumber))]
      if (doctorRooms.length > 1) {
        setFormError('Ngoài phạm vi MVP: bác sĩ đổi phòng nhiều lần trong ngày. Vui lòng chọn lại theo bác sĩ sau khi điều chỉnh DoctorSlot.')
        return
      }
      const response = await appointmentApi.slots(date, draft.doctorId, 'SCHEDULE')
      const nextSlots = response.slots.map(mapSlot)
      setSlotDefinitions(nextSlots)
      setBookingSlot(emptyBookingSlot())
      setDraft((current) => ({ ...current, slotId: '', room: doctorRooms[0] || '' }))
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Không thể tải khung giờ của ngày đã chọn')
    }
  }

  const changeBookingDoctor = async (nextDoctorId: string, preferredDepartment = draft.department) => {
    if (requestedDoctorId && nextDoctorId !== requestedDoctorId) return
    const currentContext = bookingContext || context
    const doctor = currentContext?.doctors.find((item) => item.id === nextDoctorId)
    const doctorRooms = [...new Set((currentContext?.openSlotAssignments || []).filter((item) => item.doctorId === nextDoctorId).map((item) => item.roomNumber))]
    const department = doctor?.departments.length === 1 ? doctor.departments[0].name : preferredDepartment && doctor?.departments.some((item) => item.name === preferredDepartment) ? preferredDepartment : ''
    setDraft((current) => ({ ...current, doctorId: nextDoctorId, department, room: doctorRooms.length === 1 ? doctorRooms[0] : '', slotId: '' }))
    setBookingSuggestion(null)
    setBookingSlot(emptyBookingSlot())
    setFormError('')
    if (!nextDoctorId) {
      setSlotDefinitions([])
      return
    }
    if (doctorRooms.length > 1) {
      setSlotDefinitions([])
      setFormError('Ngoài phạm vi MVP: bác sĩ đổi phòng nhiều lần trong ngày. Vui lòng chọn theo bác sĩ sau khi điều chỉnh DoctorSlot.')
      return
    }
    try {
      const response = await appointmentApi.slots(draft.date, nextDoctorId, 'SCHEDULE')
      setSlotDefinitions(response.slots.map(mapSlot))
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Không thể tải khung giờ của bác sĩ')
    }
  }

  const changeBookingDepartment = async (department: string) => {
    setDraft((current) => ({ ...current, department, slotId: '' }))
    if (draft.doctorId || !department) return
    const currentContext = bookingContext || context
    const doctorsWithOpenSlots = new Set((currentContext?.openSlotAssignments || []).map((item) => item.doctorId))
    const candidates = (currentContext?.doctors || []).filter((doctor) => doctorsWithOpenSlots.has(doctor.id) && doctor.departments.some((item) => item.name === department))
    if (candidates.length === 1) await changeBookingDoctor(candidates[0].id, department)
  }

  const changeBookingRoom = async (room: string) => {
    if (draft.doctorId || !room) return
    const currentContext = bookingContext || context
    const doctorIds = [...new Set((currentContext?.openSlotAssignments || []).filter((item) => item.roomNumber === room).map((item) => item.doctorId))]
    if (doctorIds.length > 1) {
      setDraft((current) => ({ ...current, doctorId: '', department: '', room: '', slotId: '' }))
      setFormError('Ngoài phạm vi MVP: nhiều bác sĩ luân phiên dùng chung một phòng trong ngày. Vui lòng chọn theo bác sĩ.')
      return
    }
    if (doctorIds.length === 1) await changeBookingDoctor(doctorIds[0])
  }

  const createAppointment = async (selectedSlot: SlotDefinition, actionMode: BookingMode, deferWalkIn = false) => {
    const doctor = context?.doctors.find((item) => item.id === draft.doctorId)
    const departmentOption = doctor?.departments.find((item) => item.name === draft.department)
    if (!draft.doctorId || !draft.patientId || !draft.department || !draft.room || !draft.date || draft.date < todayValue() || !draft.reason.trim() || (draft.service === 'BHYT' && !draft.insuranceNumber.trim())) {
      setFormError('Vui lòng chọn bác sĩ và điền đầy đủ thông tin bắt buộc.')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const response = await appointmentApi.create({
        patientId: Number(draft.patientId), doctorId: Number(draft.doctorId), slotId: Number(selectedSlot.id),
        departmentId: departmentOption?.id, bookingType: actionMode === 'IMMEDIATE' ? 'WALK_IN' : 'SCHEDULE',
        patientType: draft.service === 'BHYT' ? 'BHYT' : 'SERVICE',
        bhytNumber: draft.service === 'BHYT' ? draft.insuranceNumber.trim() : undefined,
        deferWalkIn, reason: draft.reason.trim(),
      })
      const created = mapAppointment(response.appointment, patientDirectory, slotDefinitions)
      setBookingSuggestion(null)
      setBookingSlot(null)
      setSelectedId(created.id)
      setPrintAppointment(created)
      setRefreshVersion((value) => value + 1)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Không thể tạo lịch hẹn')
    } finally {
      setSaving(false)
    }
  }

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLElement | null
    const actionMode: BookingMode = submitter?.textContent?.includes('Khám ngay') || submitter?.textContent?.includes('Xếp vào khung') ? 'IMMEDIATE' : 'SCHEDULED'
    if (!draft.doctorId || !draft.patientId || !draft.department || !draft.room || !draft.date || draft.date < todayValue() || !draft.reason.trim() || (draft.service === 'BHYT' && !draft.insuranceNumber.trim())) {
      setFormError('Vui lòng điền đầy đủ thông tin bắt buộc.')
      return
    }
    const selectedSlot = draft.slotId ? slotDefinitions.find((slot) => slot.id === draft.slotId) : undefined
    if (selectedSlot) {
      if (actionMode === 'SCHEDULED' && !selectedSlot.bookable) {
        setFormError(`Khung ${selectedSlot.start} - ${selectedSlot.end} không còn hợp lệ. Vui lòng chọn khung khác.`)
        return
      }
      if (actionMode === 'IMMEDIATE' && !isSlotAvailable(selectedSlot)) {
        setFormError('Khung giờ đã chọn không còn chỗ. Vui lòng chọn khung khác.')
        return
      }
      await createAppointment(selectedSlot, actionMode, actionMode === 'IMMEDIATE' && selectedSlot.state !== 'ongoing')
      return
    }

    setSaving(true)
    try {
      const response = await appointmentApi.slots(draft.date, draft.doctorId, 'SCHEDULE')
      const nextSlots = response.slots.map(mapSlot)
      setSlotDefinitions(nextSlots)
      const currentSlot = nextSlots.find((slot) => slot.state === 'ongoing' && isSlotAvailable(slot))
      const nextAvailableSlot = nextSlots.find((slot) => slot.state === 'available' && isSlotAvailable(slot))
      const candidate = actionMode === 'IMMEDIATE' ? currentSlot || nextAvailableSlot : nextSlots.find((slot) => slot.bookable && isSlotAvailable(slot))
      if (!candidate) {
        setFormError('Không còn slot tiếp nhận phù hợp.')
        return
      }
      setDraft((current) => ({ ...current, slotId: candidate.id, room: candidate.room }))
      setBookingSlot(candidate)
      setBookingSuggestion({ mode: actionMode, slot: candidate, deferWalkIn: actionMode === 'IMMEDIATE' && candidate.state !== 'ongoing' })
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Không thể tìm khung giờ phù hợp')
    } finally {
      setSaving(false)
    }
  }

  const confirmSuggestedBooking = () => {
    if (!bookingSuggestion) return
    void createAppointment(bookingSuggestion.slot, bookingSuggestion.mode, bookingSuggestion.deferWalkIn)
  }

  const chooseAnotherSlot = () => {
    setBookingSuggestion(null)
    setBookingSlot(emptyBookingSlot())
    setDraft((current) => ({ ...current, slotId: '', room: '' }))
  }

  const addPatient = () => setFormError('Vui lòng tạo hồ sơ bệnh nhân ở trang Bệnh nhân trước khi đặt lịch.')

  const updateStatus = async (next: AppointmentStatus) => {
    if (!selectedId) return
    if (next === 'CANCELLED') {
      setCancelTarget(selectedAppointment)
      return
    }
    try {
      if (next === 'WAITING') await appointmentApi.checkIn(Number(selectedId))
      setRefreshVersion((value) => value + 1)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Không thể cập nhật trạng thái lịch hẹn')
    }
  }

  if (!requestedDoctorId) {
    return <>
      <AppointmentOverview selectedDate={selectedDate} onDateChange={setSelectedDate} onCreate={openCreateWithoutSlot} onViewDoctor={(id) => setSearchParams({ doctorId: id })} context={context} loading={loading} error={pageError} receptionClosed={isReceptionClosed} departmentFilter={overviewDepartment} onDepartmentFilterChange={setOverviewDepartment} doctorFilter={overviewDoctor} onDoctorFilterChange={setOverviewDoctor} slotStatusFilter={overviewSlotStatus} onSlotStatusFilterChange={setOverviewSlotStatus} />
      {bookingSlot && <CreateAppointmentModal patients={patientDirectory} doctors={(bookingContext || context)?.doctors || []} departments={(bookingContext || context)?.departments || []} rooms={(bookingContext || context)?.rooms || []} assignments={(bookingContext || context)?.openSlotAssignments || []} doctorLocked={false} draft={draft} setDraft={setDraft} slots={slotDefinitions} slot={bookingSlot} mode={bookingMode} setMode={changeBookingMode} onDateChange={changeBookingDate} onDoctorChange={changeBookingDoctor} onDepartmentChange={changeBookingDepartment} onRoomChange={changeBookingRoom} suggestedSlot={bookingSuggestion} onConfirmSuggestion={confirmSuggestedBooking} onChooseAnother={chooseAnotherSlot} onAddPatient={addPatient} onClose={() => setBookingSlot(null)} onSubmit={handleCreate} error={formError} saving={saving} />}
      {cancelTarget && <CancellationModal appointment={cancelTarget} saving={saving} onClose={() => setCancelTarget(null)} onConfirm={async (reason, note) => { setSaving(true); try { await appointmentApi.cancel(Number(cancelTarget.id), reason, note); setCancelTarget(null); setRefreshVersion((value) => value + 1) } catch (error) { setPageError(error instanceof Error ? error.message : 'Không thể hủy lịch hẹn') } finally { setSaving(false) } }} />}
      {printAppointment && <PrintTicket appointment={printAppointment} onClose={() => setPrintAppointment(null)} />}
    </>
  }

  return <div className="appointments-page appointments-redesign">
    <header className="appointments-heading"><div><button className="appointment-back-button" onClick={() => navigate('/appointments')}>← Tổng quan lịch hẹn</button><h1 className="page-title">Lịch hẹn</h1><p className="page-subtitle">Lịch khám chi tiết của {selectedDoctor.fullName}.</p></div><button className="btn btn-primary appointments-create-btn" onClick={openCreateWithoutSlot} disabled={isReceptionClosed}><Plus size={18} /> Tạo lịch hẹn <ChevronDown size={15} /></button></header>
    <nav className="appointment-tabs"><button onClick={() => navigate('/appointments')}>Tổng quan lịch hẹn</button><button className="active">Lịch chi tiết</button><button>Bảng tuần</button><button>Bảng ngày</button></nav>
    <div className="appointment-toolbar screenshot-toolbar"><div className="date-controls"><button className="btn btn-secondary btn-sm" onClick={() => setSelectedDate(todayValue())}>Hôm nay</button><button className="icon-button" onClick={() => moveDate(-1)} aria-label="Ngày trước"><ChevronLeft size={18} /></button><button className="icon-button" onClick={() => moveDate(1)} aria-label="Ngày sau"><ChevronRight size={18} /></button><strong className="toolbar-date"><CalendarDays size={17} /> {dateLabel(selectedDate)}</strong></div><div className="appointment-filters"><label className="locked-filter"><Stethoscope size={15} /><select value={activeDoctorId} disabled aria-label="Bác sĩ đang xem"><option>{selectedDoctor.fullName}</option></select></label><label className="locked-filter"><Filter size={15} /><select value={selectedDoctor.department} disabled aria-label="Khoa của bác sĩ đang xem"><option>{selectedDoctor.department}</option></select></label><button className="icon-button" aria-label="Cài đặt bộ lọc"><Settings2 size={17} /></button></div></div>
    {pageError && <div className="form-error">{pageError}</div>}
    <main className="appointments-grid">
      <section className="slot-panel">
        <div className="slot-panel-header"><div><h2>{selectedDoctor.fullName}</h2><p>{selectedDoctor.department} · Lịch dự kiến</p></div><div className="slot-refresh"><span><Clock3 size={15} /> Cập nhật tự động mỗi 30 giây</span><button className="icon-button" aria-label="Làm mới" onClick={() => setRefreshVersion((value) => value + 1)}><RefreshCw size={16} /></button></div></div>
        <div className="slot-legend"><span><i className="legend-dot available" /> Còn chỗ</span><span><i className="legend-dot full" /> Full</span><span><i className="legend-dot ended" /> Đã qua</span><span><LockKeyhole size={13} /> Đã khóa</span></div>
        <div className="slot-table-head"><span>Khung giờ</span><span>Số suất</span><span>Thao tác</span></div>
        <div className="slot-list">{slotDefinitions.map((slot) => <SlotRow key={slot.id} slot={slot} appointments={appointments.filter((item) => item.slotId === slot.id)} expanded={expandedSlotId === slot.id} onToggle={() => setExpandedSlotId((current) => current === slot.id ? '' : slot.id)} onSelectAppointment={setSelectedId} selectedId={selectedId} onCreate={openCreate} receptionClosed={isReceptionClosed} />)}</div>
        <div className="slot-footer-note"><Clock3 size={14} /> Ngừng tiếp nhận bệnh nhân mới từ 16:00 mỗi ngày.</div>
      </section>
      <aside className="appointments-side">
        <section className="queue-panel"><div className="side-panel-title"><h2>Danh sách chờ</h2></div><label className="queue-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên, SĐT, mã BN hoặc số khám..." /></label><div className="queue-tabs"><button className={queueTab === 'WAITING' ? 'active' : ''} onClick={() => setQueueTab('WAITING')}>Đang chờ ({queue.filter((item) => item.status === 'WAITING').length})</button><button className={queueTab === 'CONFIRMED' ? 'active' : ''} onClick={() => setQueueTab('CONFIRMED')}>Đã xác nhận ({queue.filter((item) => item.status === 'CONFIRMED').length})</button></div><QueueGroup items={queue.filter((item) => item.status === queueTab)} selectedId={selectedId} onSelect={setSelectedId} /></section>
        <AppointmentDetail appointment={selectedAppointment} onOpenProfile={(id) => { setSelectedId(id); setDrawerAppointmentId(id) }} onStatusChange={updateStatus} />
      </aside>
    </main>
    <div className="mock-api-hint"><span className="mock-dot" /> Dữ liệu đồng bộ từ hệ thống</div><span className="sr-only">Đang đăng nhập: {user?.fullName || 'Lễ tân'}</span>
    {bookingSlot && <CreateAppointmentModal patients={patientDirectory} doctors={(bookingContext || context)?.doctors || []} departments={(bookingContext || context)?.departments || []} rooms={(bookingContext || context)?.rooms || []} assignments={(bookingContext || context)?.openSlotAssignments || []} doctorLocked={true} draft={draft} setDraft={setDraft} slots={slotDefinitions} slot={bookingSlot} mode={bookingMode} setMode={changeBookingMode} onDateChange={changeBookingDate} onDoctorChange={changeBookingDoctor} onDepartmentChange={changeBookingDepartment} onRoomChange={changeBookingRoom} suggestedSlot={bookingSuggestion} onConfirmSuggestion={confirmSuggestedBooking} onChooseAnother={chooseAnotherSlot} onAddPatient={addPatient} onClose={() => setBookingSlot(null)} onSubmit={handleCreate} error={formError} saving={saving} />}{cancelTarget && <CancellationModal appointment={cancelTarget} saving={saving} onClose={() => setCancelTarget(null)} onConfirm={async (reason, note) => { setSaving(true); try { await appointmentApi.cancel(Number(cancelTarget.id), reason, note); setCancelTarget(null); setRefreshVersion((value) => value + 1) } catch (error) { setPageError(error instanceof Error ? error.message : 'Không thể hủy lịch hẹn') } finally { setSaving(false) } }} />}{drawerAppointment && <ReceptionistPatientDrawer appointment={drawerAppointment} onClose={() => setDrawerAppointmentId(null)} />}{printAppointment && <PrintTicket appointment={printAppointment} onClose={() => setPrintAppointment(null)} />}
  </div>
}

function AppointmentOverview({ selectedDate, onDateChange, onCreate, onViewDoctor, context, loading, error, receptionClosed, departmentFilter, onDepartmentFilterChange, doctorFilter, onDoctorFilterChange, slotStatusFilter, onSlotStatusFilterChange }: { selectedDate: string; onDateChange: (date: string) => void; onCreate: () => void; onViewDoctor: (doctorId: string) => void; context: ReceptionContext | null; loading: boolean; error: string; receptionClosed: boolean; departmentFilter: string; onDepartmentFilterChange: (value: string) => void; doctorFilter: string; onDoctorFilterChange: (value: string) => void; slotStatusFilter: string; onSlotStatusFilterChange: (value: string) => void }) {
  const moveDate = (amount: number) => { const date = new Date(`${selectedDate}T12:00:00`); date.setDate(date.getDate() + amount); onDateChange(date.toISOString().slice(0, 10)) }
  const overview = useMemo(() => (context?.overview || []).filter((item) => (departmentFilter === 'all' || item.departments.some((department) => String(department.id) === departmentFilter)) && (doctorFilter === 'all' || item.doctor.id === doctorFilter) && (slotStatusFilter === 'all' || item.status === slotStatusFilter)), [context, departmentFilter, doctorFilter, slotStatusFilter])
  return <div className="appointments-page appointments-redesign appointment-overview-page"><header className="appointments-heading"><div><h1 className="page-title">Lịch hẹn</h1><p className="page-subtitle">Quản lý lịch khám và điều phối bệnh nhân trong ngày.</p></div><button className="btn btn-primary appointments-create-btn" onClick={onCreate} disabled={receptionClosed}><Plus size={18} /> Tạo lịch hẹn <ChevronDown size={15} /></button></header><nav className="appointment-tabs"><button className="active">Tổng quan lịch hẹn</button><button>Bảng tuần</button><button>Bảng ngày</button></nav><div className="appointment-toolbar screenshot-toolbar"><div className="date-controls"><button className="btn btn-secondary btn-sm" onClick={() => onDateChange(todayValue())}>Hôm nay</button><button className="icon-button" onClick={() => moveDate(-1)} aria-label="Ngày trước"><ChevronLeft size={18} /></button><button className="icon-button" onClick={() => moveDate(1)} aria-label="Ngày sau"><ChevronRight size={18} /></button><strong className="toolbar-date"><CalendarDays size={17} /> {dateLabel(selectedDate)}</strong></div><div className="appointment-filters"><label><Filter size={15} /><select value={departmentFilter} onChange={(event) => onDepartmentFilterChange(event.target.value)}><option value="all">Khoa: Tất cả</option>{(context?.departments || []).map((department) => <option key={department.id} value={String(department.id)}>{department.name}</option>)}</select></label><label><Stethoscope size={15} /><select value={doctorFilter} onChange={(event) => onDoctorFilterChange(event.target.value)}><option value="all">Bác sĩ: Tất cả</option>{(context?.doctors || []).map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.fullName}</option>)}</select></label><label><select value={slotStatusFilter} onChange={(event) => onSlotStatusFilterChange(event.target.value)}><option value="all">Tình trạng slot: Tất cả</option><option value="OPEN">Đang nhận</option><option value="NEAR_FULL">Gần đầy</option><option value="FULL">Đã đầy</option></select></label><button className="icon-button" aria-label="Cài đặt bộ lọc"><Settings2 size={17} /></button></div></div>{error && <div className="form-error">{error}</div>}<div className="overview-info-banner">ⓘ Chọn bác sĩ để xem lịch chi tiết theo khung giờ.</div><div className="overview-layout"><section className="overview-table-card"><div className="overview-card-title"><h2>Tổng quan lịch khám theo bác sĩ</h2></div><div className="overview-table-wrap"><table className="overview-table"><thead><tr><th>Bác sĩ</th><th>Khoa</th><th>Tổng slot</th><th>Đã đặt</th><th>Còn chỗ</th><th>Slot đang diễn ra</th><th>Tình trạng</th><th>Thao tác</th></tr></thead><tbody>{loading && !context ? <tr><td colSpan={8}>Đang tải dữ liệu...</td></tr> : overview.map((item) => { const doctorName = item.doctor.fullName; const departmentName = item.departments[0]?.name || 'Chưa phân khoa'; const full = item.status === 'FULL'; const near = item.status === 'NEAR_FULL'; return <tr key={item.doctor.id}><td><div className="overview-doctor-cell"><span className="doctor-initial-avatar">{doctorName.replace(/^BS\.\s*/, '').slice(0, 1)}</span><span><strong>{doctorName}</strong><small>{departmentName}</small></span></div></td><td>{departmentName}</td><td>{item.totalSlots}</td><td className={full ? 'metric-danger' : 'metric-success'}>{item.bookedCount} / {item.capacity}</td><td className={item.remainingCapacity === 0 ? 'metric-danger' : 'metric-success'}>{item.remainingCapacity}</td><td>{item.ongoingSlot ? <span>{timeLabel(item.ongoingSlot.startTime)} - {timeLabel(item.ongoingSlot.endTime)} · {item.ongoingSlot.bookedCount}/{item.ongoingSlot.capacity}</span> : <span className="slot-full-text">—</span>}</td><td><span className={`overview-status ${full ? 'is-full' : near ? 'is-near' : 'is-open'}`}>{full ? 'Đã đầy' : near ? 'Gần đầy' : 'Đang nhận'}</span></td><td><button className="btn btn-outline-primary btn-sm" onClick={() => onViewDoctor(item.doctor.id)}>Xem lịch</button></td></tr>})}</tbody></table></div><div className="overview-legend"><span><i className="legend-dot available" /> Đang nhận</span><span><i className="legend-dot near" /> Gần đầy</span><span><i className="legend-dot full" /> Đã đầy</span><span><i className="legend-dot ended" /> Đã khóa</span></div></section><aside className="overview-side"><MiniCalendar selectedDate={selectedDate} onSelect={onDateChange} /><section className="overview-side-card"><h3>Tổng quan tiếp nhận hôm nay</h3><p>Đang chờ <strong className="metric-success">{context?.receptionSummary.waiting || 0}</strong></p><p>Đã xác nhận <strong className="metric-blue">{context?.receptionSummary.confirmed || 0}</strong></p><p>Đang khám <strong className="metric-orange">{context?.receptionSummary.inProgress || 0}</strong></p><p>Hoàn tất <strong>{context?.receptionSummary.completed || 0}</strong></p></section><section className="overview-side-card"><h3>Bác sĩ có bệnh nhân chờ</h3>{(context?.waitingDoctors || []).slice(0, 3).map((doctor) => <p key={doctor.doctorId}>{doctor.doctorName} <b>{doctor.waitingCount}</b></p>)}{!context?.waitingDoctors.length && <p>Chưa có bệnh nhân đang chờ</p>}<button className="view-all-link">Xem tất cả <ChevronRight size={15} /></button></section></aside></div><div className="overview-empty-state"><CalendarDays size={40} /><strong>Chọn bác sĩ trong bảng để xem các khung giờ.</strong><span>Danh sách slot và bệnh nhân sẽ được tải theo bác sĩ đã chọn.</span></div><div className="mock-api-hint"><span className="mock-dot" /> Dữ liệu đồng bộ từ hệ thống</div></div>
}

function MiniCalendar({ selectedDate, onSelect }: { selectedDate: string; onSelect: (date: string) => void }) {
  const year = Number(selectedDate.slice(0, 4)); const month = Number(selectedDate.slice(5, 7)) - 1; const days = new Date(year, month + 1, 0).getDate(); const firstDay = (new Date(year, month, 1).getDay() + 6) % 7
  return <section className="mini-calendar"><div className="mini-calendar-header"><strong>{new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(new Date(year, month, 1))}</strong><span>‹ &nbsp; ›</span></div><div className="mini-calendar-week">{['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => <span key={day}>{day}</span>)}</div><div className="mini-calendar-grid">{Array.from({ length: firstDay }).map((_, index) => <span key={`empty-${index}`} />)}{Array.from({ length: days }).map((_, index) => { const day = index + 1; const value = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; return <button key={value} className={value === selectedDate ? 'selected' : ''} onClick={() => onSelect(value)}>{day}</button>})}</div></section>
}

function SlotRow({ slot, appointments, expanded, selectedId, onToggle, onSelectAppointment, onCreate, receptionClosed }: { slot: SlotDefinition; appointments: Appointment[]; expanded: boolean; selectedId: string; onToggle: () => void; onSelectAppointment: (id: string) => void; onCreate: (slot: SlotDefinition) => void; receptionClosed: boolean }) {
  const remaining = slot.capacity - slot.booked
  const canCreate = slot.state !== 'ended' && slot.state !== 'full' && slot.state !== 'closed'
  return <div className={`slot-row-card slot-${slot.state} ${expanded ? 'expanded' : ''}`}><div className="slot-row"><div className="slot-time"><strong>{slot.start} - {slot.end}</strong><small>{slot.state === 'ended' ? 'Đã kết thúc' : slot.state === 'ongoing' ? 'Đang diễn ra' : slot.state === 'closed' ? 'Đã khóa' : remaining ? `Còn ${remaining} chỗ` : 'Đã đủ chỗ'}</small></div><div className="slot-capacity"><strong>{slot.state === 'closed' ? '—' : `${slot.booked} / ${slot.capacity}`}</strong><small>{slot.state === 'closed' ? 'Đã khóa' : remaining ? `Còn ${remaining} chỗ` : 'Đã đủ chỗ'}</small></div><div className="slot-action"><button type="button" className="btn btn-secondary btn-sm" onClick={onToggle}>Xem lịch {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>{canCreate && <button className="btn btn-outline-primary btn-sm" disabled={receptionClosed} onClick={() => onCreate(slot)}><Plus size={15} /> Tạo lịch</button>}</div></div>{expanded && <div className="slot-appointment-panel"><div className="slot-appointment-head"><span>Số khám</span><span>Bệnh nhân</span><span>Trạng thái</span><span /></div>{appointments.map((appointment) => <button type="button" className={`slot-appointment-row ${selectedId === appointment.id ? 'selected' : ''}`} key={appointment.id} onClick={() => onSelectAppointment(appointment.id)}><strong>{String(appointment.sequenceNumber).padStart(2, '0')}</strong><span><b>{appointment.patient.fullName}</b><small>{appointment.patient.code}</small></span><span className={`status-badge ${statusConfig[appointment.status].className}`}>{statusConfig[appointment.status].label}</span><ChevronRight size={17} /></button>)}{appointments.length === 0 && <div className="slot-appointment-empty">Chưa có bệnh nhân trong khung giờ này.</div>}<div className="slot-appointment-summary"><span>Tổng: <b>{appointments.length} bệnh nhân</b></span><span>Đang chờ: {appointments.filter((item) => item.status === 'WAITING').length}</span><span>Đã xác nhận: {appointments.filter((item) => item.status === 'CONFIRMED').length}</span><span>Đang khám: {appointments.filter((item) => item.status === 'IN_PROGRESS').length}</span></div></div>}</div>
}

function QueueGroup({ items, selectedId, onSelect }: { items: Appointment[]; selectedId: string; onSelect: (id: string) => void }) {
  return <div className="queue-group">{items.map((item) => <div className={`queue-item ${selectedId === item.id ? 'selected' : ''}`} key={item.id}><button className="queue-main-button" onClick={() => onSelect(item.id)}><strong className="queue-number">{String(item.sequenceNumber).padStart(2, '0')}</strong><span><b>{item.patient.fullName}</b><small>{timeLabel(item.startTime)} - {timeLabel(item.endTime)} · {item.doctor.fullName}</small></span></button><span className={`status-badge ${statusConfig[item.status].className}`}>{statusConfig[item.status].label}</span></div>)}{items.length === 0 && <div className="empty-context">Không có lịch trong nhóm này.</div>}</div>
}

function AppointmentDetail({ appointment, onOpenProfile, onStatusChange }: { appointment: Appointment | null; onOpenProfile: (id: string) => void; onStatusChange: (status: AppointmentStatus) => void }) {
  if (!appointment) return <section className="detail-panel"><div className="side-panel-title"><h2>Chi tiết lịch hẹn</h2></div><div className="empty-context">Chọn một lịch hẹn để xem chi tiết.</div></section>
  const status = statusConfig[appointment.status]
  return <section className="detail-panel"><div className="side-panel-title"><h2>Chi tiết lịch hẹn</h2><button className="icon-button" aria-label="Đóng chi tiết"><X size={16} /></button></div><div className="detail-patient"><div className="detail-avatar"><UserRound size={21} /></div><div><strong>{appointment.patient.fullName}</strong><span>{appointment.patient.code}</span><a href={`tel:${appointment.patient.phone}`}><Phone size={13} /> {appointment.patient.phone}</a></div></div><span className={`status-badge ${status.className}`}>{status.label}</span><dl className="detail-list"><DetailRow label="Số khám" value={String(appointment.sequenceNumber).padStart(2, '0')} /><DetailRow label="Mã lịch hẹn" value={appointment.appointmentCode} /><DetailRow label="Khung giờ" value={`${timeLabel(appointment.startTime)} - ${timeLabel(appointment.endTime)}`} /><DetailRow label="Bác sĩ" value={appointment.doctor.fullName} /><DetailRow label="Khoa" value={appointment.doctor.department} /><DetailRow label="Loại đặt lịch" value={appointment.appointmentType === 'SCHEDULED' ? 'Đặt trước' : 'Đến trực tiếp'} /><DetailRow label="Hình thức khám" value={appointment.insuranceNumber ? 'BHYT' : 'Dịch vụ'} /><DetailRow label="Lý do khám" value={appointment.reason} />{appointment.status === 'CANCELLED' && <DetailRow label="Lý do hủy" value={cancellationReasonLabel(appointment.cancellationReason, appointment.cancellationNote)} />}<DetailRow label="Trạng thái" value={status.label} /></dl><div className="detail-actions"><button className="btn btn-secondary btn-sm" onClick={() => onOpenProfile(appointment.id)}><Search size={15} /> {appointment.status === 'CANCELLED' ? 'Xem chi tiết lý do hủy' : 'Xem hồ sơ'}</button>{appointment.status === 'CONFIRMED' && <><button className="btn btn-primary btn-sm" onClick={() => onStatusChange('WAITING')}>Tiếp nhận</button><button className="btn btn-danger-outline btn-sm" onClick={() => onStatusChange('CANCELLED')}><X size={15} /> Hủy</button></>}{appointment.status === 'WAITING' && <button className="btn btn-danger-outline btn-sm" onClick={() => onStatusChange('CANCELLED')}><X size={15} /> Hủy</button>}{appointment.status === 'IN_PROGRESS' && <span className="detail-state-note">Đang khám</span>}</div></section>
}

function DetailRow({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div> }

function CancellationModal({ appointment, saving, onClose, onConfirm }: { appointment: Appointment; saving: boolean; onClose: () => void; onConfirm: (reason: string, note: string) => Promise<void> }) {
  const [reason, setReason] = useState('PATIENT_REQUEST')
  const [note, setNote] = useState('')
  const isOther = reason === 'OTHER'
  const canConfirm = !saving && (!isOther || Boolean(note.trim()))
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (canConfirm) void onConfirm(reason, isOther ? note.trim() : '')
  }
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><form className="appointment-modal cancellation-modal" onSubmit={submit}><div className="modal-header"><div><h2>Hủy lịch hẹn</h2><p>{appointment.patient.fullName} · {appointment.appointmentCode}</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Đóng"><X size={18} /></button></div><div className="cancellation-form"><label className="booking-field">Chi tiết lý do hủy{isOther ? ' *' : ''}<textarea rows={4} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nhập thông tin chi tiết (không bắt buộc, trừ khi chọn lý do khác)" />{isOther && <small className="field-error">{note.trim() ? '' : 'Vui lòng nhập chi tiết lý do hủy'}</small>}</label><label className="booking-field">Lý do hủy *<select value={reason} onChange={(event) => setReason(event.target.value)}>{Object.entries(cancellationReasonLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Đóng</button><button type="submit" className="btn btn-danger-outline" disabled={!canConfirm}><X size={16} /> {saving ? 'Đang lưu...' : 'Xác nhận hủy'}</button></div></form></div>
}

function CreateAppointmentModal({ patients, doctors, departments, rooms, assignments, doctorLocked, draft, setDraft, slots, slot, mode, setMode, onDateChange, onDoctorChange, onDepartmentChange, onRoomChange, suggestedSlot, onConfirmSuggestion, onChooseAnother, onAddPatient, onClose, onSubmit, error, saving }: { patients: PatientProfile[]; doctors: ApiDoctor[]; departments: ReceptionContext['departments']; rooms: ReceptionContext['rooms']; assignments: ReceptionContext['openSlotAssignments']; doctorLocked: boolean; draft: AppointmentDraft; setDraft: Dispatch<SetStateAction<AppointmentDraft>>; slots: SlotDefinition[]; slot: SlotDefinition; mode: BookingMode; setMode: (mode: BookingMode) => void; onDateChange: (date: string) => void; onDoctorChange: (doctorId: string) => void; onDepartmentChange: (department: string) => void; onRoomChange: (room: string) => void; suggestedSlot: BookingSuggestion | null; onConfirmSuggestion: () => void; onChooseAnother: () => void; onAddPatient: () => void; onClose: () => void; onSubmit: (event: FormEvent) => void; error: string; saving: boolean }) {
  const [submitted, setSubmitted] = useState(false)
  const suggestions = patients.filter((patient) => `${patient.fullName} ${patient.code} ${patient.phone}`.toLowerCase().includes(draft.patientName.toLowerCase())).slice(0, 5)
  const selectedPatient = patients.find((patient) => patient.id === draft.patientId)
  const updatePatient = (patient: PatientProfile) => setDraft((current) => ({ ...current, patientId: patient.id, patientName: patient.fullName, insuranceNumber: patient.insuranceNumber || '' }))
  const doctorsWithOpenSlots = new Set(assignments.map((item) => item.doctorId))
  const doctorOptions = doctors.filter((doctor) => doctorLocked
    ? doctor.id === draft.doctorId
    : doctorsWithOpenSlots.has(doctor.id) && (Boolean(draft.doctorId) || !draft.department || doctor.departments.some((item) => item.name === draft.department))
  ).map((doctor) => ({ value: doctor.id, label: doctor.fullName }))
  const selectedDoctor = doctors.find((doctor) => doctor.id === draft.doctorId)
  const availableDoctorIds = new Set(assignments.map((item) => item.doctorId))
  const departmentOptions = (selectedDoctor?.departments.length ? selectedDoctor.departments : departments.filter((department) => doctors.some((doctor) => availableDoctorIds.has(doctor.id) && doctor.departments.some((item) => item.id === department.id)))).map((item) => ({ value: item.name, label: item.name }))
  const assignmentRooms = [...new Set(assignments.filter((item) => !draft.doctorId || item.doctorId === draft.doctorId).map((item) => item.roomNumber))]
  const roomOptions = (draft.doctorId && assignmentRooms.length !== 1 ? [] : rooms.filter((room) => assignmentRooms.includes(room.roomNumber))).map((room) => ({ value: room.roomNumber, label: room.roomNumber }))
  const handledDepartment = useRef('')
  const handledRoom = useRef('')
  useEffect(() => {
    if (!draft.department) handledDepartment.current = ''
    if (!draft.doctorId && draft.department && handledDepartment.current !== draft.department) {
      handledDepartment.current = draft.department
      void onDepartmentChange(draft.department)
    }
  }, [draft.department, draft.doctorId, onDepartmentChange])
  useEffect(() => {
    if (!draft.room) handledRoom.current = ''
    if (!draft.doctorId && draft.room && handledRoom.current !== draft.room) {
      handledRoom.current = draft.room
      void onRoomChange(draft.room)
    }
  }, [draft.doctorId, draft.room, onRoomChange])
  const activeSlot = slots.find((item) => item.id === draft.slotId) || slot
  const selectSlot = (slotId: string) => {
    const nextSlot = slots.find((item) => item.id === slotId)
    setDraft((current) => ({ ...current, slotId, room: nextSlot?.room || current.room }))
  }
  const fieldErrors = submitted ? {
    patient: !draft.patientId ? 'Vui lòng chọn bệnh nhân' : '',
    doctor: !draft.doctorId ? 'Vui lòng chọn bác sĩ' : '',
    department: !draft.department ? 'Vui lòng chọn khoa' : '',
    room: !draft.room ? 'Vui lòng chọn số phòng' : '',
    date: !draft.date || draft.date < todayValue() ? 'Vui lòng chọn ngày hôm nay hoặc ngày sau đó' : '',
    insurance: draft.service === 'BHYT' && !draft.insuranceNumber.trim() ? 'Vui lòng nhập số bảo hiểm y tế' : '',
    reason: !draft.reason.trim() ? 'Vui lòng nhập lý do khám' : '',
  } : { patient: '', doctor: '', department: '', room: '', date: '', insurance: '', reason: '' }
  const submitForm = (event: FormEvent) => { setSubmitted(true); onSubmit(event) }
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><form className="appointment-modal appointment-booking-modal" onSubmit={submitForm}><div className="modal-header"><div><h2>{mode === 'IMMEDIATE' ? 'Khám ngay' : 'Tạo lịch hẹn'}</h2><p>{mode === 'IMMEDIATE' ? 'Đăng ký bệnh nhân vào hàng đợi khám ngay.' : `Đặt lịch vào khung ${activeSlot.start} - ${activeSlot.end}.`}</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Đóng"><X size={18} /></button></div>{error && <div className="form-error">{error}</div>}{suggestedSlot && <div className="booking-suggestion-panel"><strong>{suggestedSlot.mode === 'IMMEDIATE' && suggestedSlot.deferWalkIn ? 'Khung hiện tại đã hết chỗ.' : 'Khung phù hợp gần nhất'}</strong><span>Bệnh nhân sẽ được xếp vào khung <b>{suggestedSlot.slot.start} - {suggestedSlot.slot.end}</b>, {suggestedSlot.slot.room}.</span>{suggestedSlot.mode === 'IMMEDIATE' && suggestedSlot.deferWalkIn && <small>Bệnh nhân chưa được đưa vào hàng chờ khám hiện tại.</small>}<div><button type="button" className="btn btn-secondary btn-sm" onClick={onChooseAnother}>Chọn khung khác</button><button type="button" className="btn btn-primary btn-sm" onClick={onConfirmSuggestion}>Xác nhận xếp lịch</button></div></div>}<div className="booking-mode-switch"><button type="button" className={mode === 'IMMEDIATE' ? 'active' : ''} onClick={() => setMode('IMMEDIATE')}>Khám ngay</button><button type="button" className={mode === 'SCHEDULED' ? 'active' : ''} onClick={() => setMode('SCHEDULED')}>Tạo lịch</button></div><div className="booking-form-grid"><label className="booking-field patient-picker">Bệnh nhân *<div className="input-with-action"><input aria-invalid={Boolean(fieldErrors.patient)} value={draft.patientName} onChange={(event) => setDraft((current) => ({ ...current, patientName: event.target.value, patientId: '' }))} placeholder="Tìm tên hoặc mã bệnh nhân" /><button type="button" onClick={onAddPatient} aria-label="Tạo bệnh nhân mới"><Plus size={16} /></button></div>{draft.patientName && !selectedPatient && <div className="suggestion-list">{suggestions.map((patient) => <button type="button" key={patient.id} onClick={() => updatePatient(patient)}><strong>{patient.fullName}</strong><small>{patient.code} · {patient.phone}</small></button>)}{suggestions.length === 0 && <button type="button" onClick={onAddPatient}>+ Tạo bệnh nhân mới</button>}</div>}{fieldErrors.patient && <small className="field-error">{fieldErrors.patient}</small>}</label><label className="booking-field">Bác sĩ *<SearchableSelect value={draft.doctorId} options={doctorOptions} onChange={onDoctorChange} />{fieldErrors.doctor && <small className="field-error">{fieldErrors.doctor}</small>}</label><label className="booking-field">Khoa *<SearchableSelect value={draft.department} options={departmentOptions} onChange={(value) => setDraft((current) => ({ ...current, department: value }))} />{fieldErrors.department && <small className="field-error">{fieldErrors.department}</small>}</label><label className="booking-field">Số phòng *<SearchableSelect value={draft.room} options={roomOptions} onChange={(value) => setDraft((current) => ({ ...current, room: value }))} />{fieldErrors.room && <small className="field-error">{fieldErrors.room}</small>}</label><label className="booking-field">Ngày *<input type="date" min={todayValue()} aria-invalid={Boolean(fieldErrors.date)} value={draft.date} onChange={(event) => onDateChange(event.target.value)} />{fieldErrors.date && <small className="field-error">{fieldErrors.date}</small>}</label><label className="booking-field">Dịch vụ *<select value={draft.service} onChange={(event) => setDraft((current) => ({ ...current, service: event.target.value as AppointmentDraft['service'], insuranceNumber: event.target.value === 'BHYT' ? current.insuranceNumber || selectedPatient?.insuranceNumber || '' : '' }))}><option>Dịch vụ</option><option>BHYT</option></select></label>{draft.service === 'BHYT' && <label className="booking-field booking-span-two">Số BHYT *<input aria-invalid={Boolean(fieldErrors.insurance)} value={draft.insuranceNumber} onChange={(event) => setDraft((current) => ({ ...current, insuranceNumber: event.target.value }))} placeholder="Tự điền nếu bệnh nhân đã có trong hồ sơ" />{fieldErrors.insurance && <small className="field-error">{fieldErrors.insurance}</small>}</label>}</div><div className="slot-picker"><strong>Chọn khung giờ</strong><div className="slot-picker-group"><span>Ca sáng</span><div>{slots.slice(0, 6).map((item) => <SlotChoice key={item.id} item={item} selectedId={draft.slotId} onSelect={selectSlot} mode={mode} />)}</div></div><div className="slot-picker-group"><span>Ca chiều</span><div>{slots.slice(6).map((item) => <SlotChoice key={item.id} item={item} selectedId={draft.slotId} onSelect={selectSlot} mode={mode} />)}</div></div></div><div className="booking-form-grid"><label className="booking-field booking-span-two">Lý do khám *<input aria-invalid={Boolean(fieldErrors.reason)} value={draft.reason} onChange={(event) => setDraft((current) => ({ ...current, reason: event.target.value }))} placeholder="Nhập lý do khám" />{fieldErrors.reason && <small className="field-error">{fieldErrors.reason}</small>}</label><label className="booking-field booking-span-two">Ghi chú<textarea rows={2} value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Thông tin bổ sung (không bắt buộc)" /></label></div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button><button type="submit" className="btn btn-secondary" disabled={saving}><Clock3 size={16} /> {mode === 'IMMEDIATE' && draft.slotId && activeSlot.state !== 'ongoing' ? 'Xếp vào khung' : 'Khám ngay'}</button><button type="submit" className="btn btn-primary" disabled={saving}><CalendarDays size={16} /> {saving ? 'Đang lưu...' : 'Tạo lịch'}</button></div></form></div>
}

function SlotChoice({ item, selectedId, onSelect, mode }: { item: SlotDefinition; selectedId: string; onSelect: (id: string) => void; mode: BookingMode }) {
  const disabled = item.state === 'full' || item.state === 'closed' || item.state === 'ended' || (mode === 'SCHEDULED' && !item.bookable)
  return <button type="button" disabled={disabled} className={item.id === selectedId ? 'selected' : ''} onClick={() => onSelect(item.id)}>{item.start} - {item.end}{item.state === 'full' && ' · Đầy'}</button>
}

function SearchableSelect({ value, options, onChange }: { value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.value === value)
  const [query, setQuery] = useState(selected?.label || '')
  const [open, setOpen] = useState(false)
  const locked = Boolean(value) && options.length === 1 && !/^\d+$/.test(value)
  const displayValue = value ? selected?.label || query : query
  const suggestions = options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase())).slice(0, 5)
  useEffect(() => {
    const closeWhenClickingOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', closeWhenClickingOutside)
    return () => document.removeEventListener('mousedown', closeWhenClickingOutside)
  }, [])
  return <div className="searchable-select" ref={containerRef}><input disabled={locked} value={displayValue} placeholder="Chọn" onFocus={() => { setQuery(''); setOpen(true) }} onChange={(event) => { setQuery(event.target.value); if (value) onChange(''); setOpen(true) }} /><ChevronDown size={14} />{open && !locked && <div className="suggestion-list searchable-suggestions">{suggestions.map((option) => <button type="button" key={option.value} onClick={() => { onChange(option.value); setQuery(option.label); setOpen(false) }}>{option.label}</button>)}{suggestions.length === 0 && <span>Không có lựa chọn phù hợp</span>}</div>}</div>
}

function PrintTicket({ appointment, onClose }: { appointment: Appointment; onClose: () => void }) {
  return <div className="modal-backdrop print-ticket-backdrop"><section className="print-ticket-modal"><div className="print-ticket"><small>{appointment.room}</small><h2>PHIẾU KHÁM BỆNH</h2><p>Ngày: {shortDateLabel(appointment.startTime.slice(0, 10))}</p><div className="ticket-info"><span>Họ tên:</span><strong>{appointment.patient.fullName}</strong><span>Giới tính:</span><b>{appointment.patient.gender}</b><span>Năm sinh:</span><b>{appointment.patient.dob.slice(0, 4)}</b><span>Khoa:</span><b>{appointment.doctor.department}</b><span>Dịch vụ:</span><b>{appointment.insuranceNumber ? 'BHYT' : 'Dịch vụ'}</b><span>Bác sĩ:</span><b>{appointment.doctor.fullName}</b><span>Khung giờ:</span><b>{timeLabel(appointment.startTime)} - {timeLabel(appointment.endTime)}</b><span>Mã bệnh nhân:</span><b>{appointment.patient.code}</b><span>Mã lịch hẹn:</span><b>{appointment.appointmentCode}</b></div><div className="ticket-number"><span>Phòng số:</span><strong>{appointment.room.replace('Phòng ', '')}</strong><span>Số thứ tự:</span><strong>{String(appointment.sequenceNumber).padStart(3, '0')}</strong></div><small className="ticket-note">Lưu ý: Quý khách vui lòng khám đúng khung giờ đăng ký.</small></div><div className="modal-footer"><button className="btn btn-secondary" onClick={onClose}>Đóng</button><button className="btn btn-primary" onClick={() => window.print()}>In phiếu khám</button></div></section></div>
}

function ReceptionistPatientDrawer({ appointment, onClose }: { appointment: Appointment; onClose: () => void }) {
  const patient = appointment.patient
  const status = statusConfig[appointment.status]
  return <div className="receptionist-patient-drawer-layer"><aside className="receptionist-patient-drawer" aria-label="Hồ sơ bệnh nhân"><header className="receptionist-drawer-header"><div><span>Hồ sơ bệnh nhân</span><h2>Chi tiết bệnh nhân</h2></div><button className="icon-button" onClick={onClose} aria-label="Đóng hồ sơ"><X size={18} /></button></header><section className="receptionist-patient-profile"><div className="receptionist-profile-avatar">{patientInitials(patient.fullName)}</div><div><h3>{patient.fullName}</h3><div className="receptionist-profile-meta"><span className="gender-badge">{patient.gender}</span><span>{patient.age} tuổi</span><span>{patient.dob && shortDateLabel(patient.dob)}</span></div><strong>{patient.code}</strong><a href={`tel:${patient.phone}`}>{patient.phone}</a><p>{patient.address}</p></div></section><div className="receptionist-drawer-body"><DrawerCard title="Thông tin liên hệ"><InfoRow label="Email" value={patient.email} /><InfoRow label="Số điện thoại" value={patient.phone} /><InfoRow label="Địa chỉ" value={patient.address} /></DrawerCard><DrawerCard title="Lịch hẹn hiện tại" action={<span className={`status-badge ${status.className}`}>{status.label}</span>}><InfoRow label="Thời gian" value={`${timeLabel(appointment.startTime)} - ${timeLabel(appointment.endTime)}`} /><InfoRow label="Bác sĩ" value={appointment.doctor.fullName} /><InfoRow label="Khoa" value={appointment.doctor.department} /><InfoRow label="Lý do khám" value={appointment.reason} /></DrawerCard></div><footer className="receptionist-drawer-footer"><button className="btn btn-primary" onClick={onClose}>Đóng</button></footer></aside></div>
}

function DrawerCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) { return <section className="receptionist-info-card"><div className="receptionist-card-title"><h3>{title}</h3>{action}</div>{children}</section> }
function InfoRow({ label, value }: { label: string; value: string }) { return <div className="receptionist-info-row"><span>{label}</span><strong>{value}</strong></div> }
