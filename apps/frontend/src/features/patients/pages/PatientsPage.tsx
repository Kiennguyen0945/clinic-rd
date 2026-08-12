import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { CalendarPlus, Pencil, Plus } from 'lucide-react'
import CreatePatientModal from '../components/CreatePatientModal'
import EditPatientModal from '../components/EditPatientModal'
import PatientFilters from '../components/PatientFilters'
import PatientTable from '../components/PatientTable'
import PatientProfileDrawer from '../../../entities/patient/ui/PatientProfileDrawer'
import { mapPatient } from '../../../entities/patient'
import { appointmentApi } from '../../../entities/appointment'
import type { AppointmentDraft, BookingMode, BookingSuggestion } from '../../../entities/appointment'
import { emptyBookingSlot, isSlotAvailable, mapSlot, slotApi } from '../../../entities/slot'
import type { SlotDefinition } from '../../../entities/slot'
import { receptionApi } from '../../appointments/api/reception.api'
import type { ReceptionContext } from '../../appointments/api/reception.api'
import { useAuthStore } from '../../../shared/auth/session-store'
import { todayValue } from '../../../shared/lib/date'
import { CreateAppointmentModal } from '../../appointments/components/booking/AppointmentModals'
import { usePatientFilters } from '../model/use-patient-filters'
import { usePatientsQuery } from '../model/patient.queries'
import { mapApiPatient } from '../model/patient.types'
import type { PatientListItem } from '../model/patient.types'

export default function PatientsPage() {
  const user = useAuthStore((state) => state.user)
  const isDoctor = user?.role === 'doctor'
  const canManagePatients = user?.role === 'receptionist'
  const {
    filters,
    debouncedFilters,
    setKeyword,
    setGender,
    setAge,
    setLastVisit,
    setPage,
  } = usePatientFilters()
  const patientsQuery = usePatientsQuery(debouncedFilters)
  const patients = patientsQuery.data?.patients
  const pagination = patientsQuery.data?.pagination
  const loading = patientsQuery.isFetching
  const error = patientsQuery.error instanceof Error
    ? patientsQuery.error.message
    : patientsQuery.error
      ? 'Không thể tải danh sách bệnh nhân.'
      : ''
  const [selectedPatient, setSelectedPatient] = useState<PatientListItem | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editPatient, setEditPatient] = useState<PatientListItem | null>(null)
  const [appointmentPatient, setAppointmentPatient] = useState<PatientListItem | null>(null)

  const filteredPatients = useMemo(() => (patients || []).filter((patient) => {
    const matchesVisit = filters.lastVisit === 'all' || (filters.lastVisit === 'today' ? patient.lastVisit === '18/07/2026' : patient.lastVisit !== '18/07/2026')
    return matchesVisit
  }), [filters.lastVisit, patients])

  return <div className="patients-mock-page">
    <div className="page-header patient-page-heading">
      <div>
        <div className="page-title">Bệnh nhân</div>
        <div className="page-subtitle">Tra cứu và quản lý thông tin bệnh nhân từng khám tại phòng khám.</div>
      </div>
      {canManagePatients && <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
        <Plus size={17} /> Thêm bệnh nhân
      </button>}
    </div>

    <PatientFilters
      filters={filters}
      onKeywordChange={setKeyword}
      onGenderChange={setGender}
      onAgeChange={setAge}
      onLastVisitChange={setLastVisit}
    />

    {error && <div className="form-error">{error}</div>}
    <PatientTable
      patients={filteredPatients}
      loading={loading}
      canManagePatients={canManagePatients}
      page={filters.page}
      totalItems={pagination?.totalItems || 0}
      totalPages={pagination?.totalPages || 1}
      onPageChange={setPage}
      onSelect={setSelectedPatient}
      onEdit={setEditPatient}
      onCreateAppointment={setAppointmentPatient}
    />

    {selectedPatient && <PatientProfileDrawer patient={{ ...selectedPatient, dob: selectedPatient.rawDob }} showMedicalHistory={isDoctor} onClose={() => setSelectedPatient(null)} actions={canManagePatients ? <><button className="btn btn-secondary" onClick={() => setEditPatient(selectedPatient)}><Pencil size={15} /> Cập nhật thông tin</button><button className="btn btn-primary" onClick={() => setAppointmentPatient(selectedPatient)}><CalendarPlus size={15} /> Tạo lịch hẹn</button></> : undefined} />}
    {canManagePatients && showCreate && <CreatePatientModal
      onClose={() => setShowCreate(false)}
      onCreated={() => {
        setShowCreate(false)
        setPage(1)
      }}
    />}
    {canManagePatients && editPatient && <EditPatientModal patient={editPatient} onClose={() => setEditPatient(null)} onSaved={(updated) => {
      const mapped = mapApiPatient(updated)
      setSelectedPatient((current) => current?.id === mapped.id ? mapped : current)
      setEditPatient(null)
    }} />}
    {canManagePatients && appointmentPatient && <PatientAppointmentModal patient={appointmentPatient} onClose={() => setAppointmentPatient(null)} onCreated={() => setAppointmentPatient(null)} />}
  </div>
}

function PatientAppointmentModal({ patient, onClose, onCreated }: { patient: PatientListItem; onClose: () => void; onCreated: () => void }) {
  const [initialDate] = useState(todayValue)
  const [context, setContext] = useState<ReceptionContext | null>(null)
  const [bookingContext, setBookingContext] = useState<ReceptionContext | null>(null)
  const [slots, setSlots] = useState<SlotDefinition[]>([])
  const [slot, setSlot] = useState<SlotDefinition>(emptyBookingSlot())
  const [mode, setMode] = useState<BookingMode>('SCHEDULED')
  const [suggestion, setSuggestion] = useState<BookingSuggestion | null>(null)
  const [draft, setDraft] = useState<AppointmentDraft>({ patientId: patient.id, patientName: patient.fullName, doctorId: '', department: '', room: '', date: initialDate, slotId: '', service: 'Dịch vụ', insuranceNumber: patient.insuranceNumber, reason: '', note: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    let cancelled = false
    receptionApi.context(initialDate).then((value) => { if (!cancelled) { setContext(value); setBookingContext(value) } }).catch((error) => { if (!cancelled) setFormError(error instanceof Error ? error.message : 'Không thể tải dữ liệu tạo lịch.') })
    return () => { cancelled = true }
  }, [initialDate])

  const loadSlots = async (date: string, doctorId: string) => {
    if (!doctorId) { setSlots([]); return [] }
    const response = await slotApi.list(date, doctorId, 'SCHEDULE')
    const mapped = response.slots.map(mapSlot)
    setSlots(mapped)
    return mapped
  }
  const changeDate = async (date: string) => {
    if (date < todayValue()) return setFormError('Không thể đặt lịch trong quá khứ.')
    setDraft((current) => ({ ...current, date, slotId: '', room: '' }))
    setSlot(emptyBookingSlot()); setSuggestion(null); setFormError('')
    try {
      const nextContext = await receptionApi.context(date)
      setBookingContext(nextContext)
      if (draft.doctorId) {
        const doctorRooms = [...new Set(nextContext.openSlotAssignments.filter((item) => item.doctorId === draft.doctorId).map((item) => item.roomNumber))]
        await loadSlots(date, draft.doctorId)
        setDraft((current) => ({ ...current, room: doctorRooms.length === 1 ? doctorRooms[0] : '' }))
      } else setSlots([])
    } catch (error) { setFormError(error instanceof Error ? error.message : 'Không thể tải khung giờ của ngày đã chọn.') }
  }
  const changeDoctor = async (doctorId: string, preferredDepartment = draft.department) => {
    const source = bookingContext || context
    const doctor = source?.doctors.find((item) => item.id === doctorId)
    const rooms = [...new Set((source?.openSlotAssignments || []).filter((item) => item.doctorId === doctorId).map((item) => item.roomNumber))]
    const department = doctor?.departments.length === 1 ? doctor.departments[0].name : doctor?.departments.some((item) => item.name === preferredDepartment) ? preferredDepartment : ''
    setDraft((current) => ({ ...current, doctorId, department, room: rooms.length === 1 ? rooms[0] : '', slotId: '' }))
    setSlot(emptyBookingSlot()); setSuggestion(null); setFormError('')
    try { await loadSlots(draft.date, doctorId) } catch (error) { setFormError(error instanceof Error ? error.message : 'Không thể tải khung giờ của bác sĩ.') }
  }
  const changeDepartment = async (department: string) => {
    setDraft((current) => ({ ...current, department, slotId: '' }))
    if (draft.doctorId || !department) return
    const source = bookingContext || context
    const openDoctorIds = new Set((source?.openSlotAssignments || []).map((item) => item.doctorId))
    const candidates = (source?.doctors || []).filter((doctor) => openDoctorIds.has(doctor.id) && doctor.departments.some((item) => item.name === department))
    if (candidates.length === 1) await changeDoctor(candidates[0].id, department)
  }
  const changeRoom = async (room: string) => {
    if (draft.doctorId || !room) return
    const source = bookingContext || context
    const doctorIds = [...new Set((source?.openSlotAssignments || []).filter((item) => item.roomNumber === room).map((item) => item.doctorId))]
    if (doctorIds.length === 1) await changeDoctor(doctorIds[0])
    else if (doctorIds.length > 1) setFormError('Có nhiều bác sĩ sử dụng phòng này. Vui lòng chọn bác sĩ trước.')
  }
  const changeSlot = (slotId: string) => {
    const selected = slots.find((item) => item.id === slotId)
    if (!selected) return
    setSlot(selected); setSuggestion(null); setFormError('')
    setDraft((current) => ({ ...current, slotId, room: selected.room }))
  }
  const changeMode = async (nextMode: BookingMode) => {
    setMode(nextMode); setSuggestion(null); setSlot(emptyBookingSlot()); setDraft((current) => ({ ...current, slotId: '' })); setFormError('')
    try { await loadSlots(draft.date, draft.doctorId) } catch (error) { setFormError(error instanceof Error ? error.message : 'Không thể tải khung giờ.') }
  }
  const createAppointment = async (selectedSlot: SlotDefinition, selectedMode: BookingMode) => {
    const doctor = (bookingContext || context)?.doctors.find((item) => item.id === draft.doctorId)
    const department = doctor?.departments.find((item) => item.name === draft.department)
    setSaving(true)
    setFormError('')
    try {
      await appointmentApi.create({
        patientId: Number(patient.id), doctorId: Number(draft.doctorId),
        ...(/^\d+$/.test(selectedSlot.id) ? { slotId: Number(selectedSlot.id) } : { slotKey: selectedSlot.id }),
        departmentId: department?.id, bookingType: selectedMode === 'IMMEDIATE' ? 'WALK_IN' : 'SCHEDULE', patientType: draft.service === 'BHYT' ? 'BHYT' : 'SERVICE',
        bhytNumber: draft.service === 'BHYT' ? draft.insuranceNumber.trim() : undefined, reason: draft.reason.trim(),
      })
      onCreated()
    } catch (error) { setFormError(error instanceof Error ? error.message : 'Không thể tạo lịch hẹn.') } finally { setSaving(false) }
  }
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const submitter = (event.nativeEvent as SubmitEvent).submitter
    const actionMode: BookingMode = submitter?.textContent?.includes('Khám ngay') ? 'IMMEDIATE' : 'SCHEDULED'
    if (!draft.doctorId || !draft.department || !draft.room || !draft.date || !draft.reason.trim() || (draft.service === 'BHYT' && !draft.insuranceNumber.trim())) return setFormError('Vui lòng điền đầy đủ thông tin bắt buộc.')
    const selected = slots.find((item) => item.id === draft.slotId)
    if (selected) {
      if (actionMode === 'SCHEDULED' && !selected.bookable) return setFormError(`Khung ${selected.start} - ${selected.end} không còn hợp lệ.`)
      if (!isSlotAvailable(selected)) return setFormError('Khung giờ đã chọn không còn chỗ.')
      await createAppointment(selected, actionMode)
      return
    }
    setSaving(true)
    try {
      const available = await loadSlots(draft.date, draft.doctorId)
      const candidate = actionMode === 'IMMEDIATE'
        ? available.find((item) => item.state === 'ongoing' && isSlotAvailable(item)) || available.find((item) => item.state === 'available' && isSlotAvailable(item))
        : available.find((item) => item.bookable && isSlotAvailable(item))
      if (!candidate) return setFormError('Không còn slot tiếp nhận phù hợp.')
      setSlot(candidate); setDraft((current) => ({ ...current, room: candidate.room, slotId: '' }))
      setSuggestion({ mode: actionMode, slot: candidate, deferWalkIn: actionMode === 'IMMEDIATE' && candidate.state !== 'ongoing' })
    } catch (error) { setFormError(error instanceof Error ? error.message : 'Không thể tìm khung giờ phù hợp.') } finally { setSaving(false) }
  }

  const patientDirectory = [mapPatient({ id: Number(patient.id), patient_code: patient.code, full_name: patient.fullName, dob: patient.rawDob, gender: patient.gender === 'Nữ' ? 'F' : 'M', phone: patient.phone, email: patient.email, cccd: patient.cccd, address: patient.address, insurance_number: patient.insuranceNumber })]
  const source = bookingContext || context
  return <CreateAppointmentModal patients={patientDirectory} doctors={source?.doctors || []} departments={source?.departments || []} rooms={source?.rooms || []} assignments={source?.openSlotAssignments || []} doctorLocked={false} patientLocked draft={draft} setDraft={setDraft} slots={slots} slot={slot} mode={mode} setMode={changeMode} onDateChange={changeDate} onDoctorChange={changeDoctor} onDepartmentChange={changeDepartment} onRoomChange={changeRoom} onSlotChange={changeSlot} suggestedSlot={suggestion} onConfirmSuggestion={() => { if (suggestion) void createAppointment(suggestion.slot, suggestion.mode) }} onAddPatient={() => undefined} onClose={onClose} onSubmit={handleSubmit} error={formError} saving={saving} />
}
