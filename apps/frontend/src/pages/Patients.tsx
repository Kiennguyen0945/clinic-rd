import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { CalendarPlus, Eye, Filter, MoreHorizontal, Pencil, Plus, Search, X } from 'lucide-react'
import CreatePatientModal from '../components/CreatePatientModal'
import PatientProfileDrawer from '../entities/patient/ui/PatientProfileDrawer'
import { mapPatient, patientApi } from '../entities/patient'
import type { ApiPatient } from '../entities/patient'
import { appointmentApi } from '../entities/appointment'
import type { AppointmentDraft, BookingMode, BookingSuggestion } from '../entities/appointment'
import { emptyBookingSlot, isSlotAvailable, mapSlot, slotApi } from '../entities/slot'
import type { SlotDefinition } from '../entities/slot'
import { receptionApi } from '../features/appointments'
import type { ReceptionContext } from '../features/appointments'
import { useAuthStore } from '../store'
import { todayValue } from '../shared/lib/date'
import { CreateAppointmentModal } from './appointments/AppointmentModals'

interface Patient {
  id: string
  code: string
  fullName: string
  gender: 'Nam' | 'Nữ'
  dob: string
  rawDob: string
  age: number
  phone: string
  email: string
  cccd: string
  address: string
  lastVisit: string
  lastReason: string
  allergy: string
  bloodType: string
  history: string
  insuranceNumber: string
}

const formatDob = (value: string) => value ? new Intl.DateTimeFormat('vi-VN').format(new Date(`${value}T12:00:00`)) : 'Chưa cập nhật'
const calculateAge = (value: string) => {
  if (!value) return 0
  const birthDate = new Date(`${value}T12:00:00`)
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const hasNotHadBirthday = today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())
  if (hasNotHadBirthday) age -= 1
  return age
}

const mapApiPatient = (patient: ApiPatient): Patient => ({
  id: String(patient.id),
  code: patient.patient_code,
  fullName: patient.full_name,
  gender: patient.gender === 'F' ? 'Nữ' : 'Nam',
  dob: formatDob(patient.dob),
  rawDob: patient.dob,
  age: calculateAge(patient.dob),
  phone: patient.phone,
  email: patient.email || 'Chưa cập nhật',
  cccd: patient.cccd || 'Chưa cập nhật',
  address: patient.address || 'Chưa cập nhật',
  lastVisit: 'Chưa có',
  lastReason: 'Chưa có lịch sử khám',
  allergy: 'Chưa cập nhật',
  bloodType: 'Chưa cập nhật',
  history: 'Chưa cập nhật',
  insuranceNumber: patient.insurance_number || '',
})

export default function PatientsPage() {
  const user = useAuthStore((state) => state.user)
  const isDoctor = user?.role === 'doctor'
  const canManagePatients = user?.role === 'receptionist'
  const [patients, setPatients] = useState<Patient[]>([])
  const [keyword, setKeyword] = useState('')
  const [gender, setGender] = useState('all')
  const [age, setAge] = useState('all')
  const [lastVisit, setLastVisit] = useState('all')
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [showMenu, setShowMenu] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [editPatient, setEditPatient] = useState<Patient | null>(null)
  const [appointmentPatient, setAppointmentPatient] = useState<Patient | null>(null)

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const response = await patientApi.list({
          keyword: keyword.trim(),
          page,
          pageSize: 10,
          gender: gender === 'Nam' ? 'M' : gender === 'Nữ' ? 'F' : undefined,
          age,
        })
        if (!cancelled) {
          setPatients(response.patients.map(mapApiPatient))
          setPage(response.pagination.page)
          setTotalItems(response.pagination.totalItems)
          setTotalPages(response.pagination.totalPages)
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Không thể tải danh sách bệnh nhân.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [age, gender, keyword, page, refreshVersion])

  const filteredPatients = useMemo(() => patients.filter((patient) => {
    const matchesVisit = lastVisit === 'all' || (lastVisit === 'today' ? patient.lastVisit === '18/07/2026' : patient.lastVisit !== '18/07/2026')
    return matchesVisit
  }), [lastVisit, patients])

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

    <section className="patient-toolbar">
      <div className="patient-search">
        <Search size={17} />
        <input value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(1) }} placeholder="Tìm theo tên, mã bệnh nhân hoặc số điện thoại..." />
      </div>
      <select value={gender} onChange={(e) => { setGender(e.target.value); setPage(1) }}>
        <option value="all">Giới tính: Tất cả</option>
        <option>Nam</option>
        <option>Nữ</option>
      </select>
      <select value={age} onChange={(e) => { setAge(e.target.value); setPage(1) }}>
        <option value="all">Độ tuổi: Tất cả</option>
        <option value="under30">Dưới 30 tuổi</option>
        <option value="30to40">30-40 tuổi</option>
        <option value="over40">Trên 40 tuổi</option>
      </select>
      <select value={lastVisit} onChange={(e) => setLastVisit(e.target.value)}>
        <option value="all">Lần khám gần nhất</option>
        <option value="today">Hôm nay</option>
        <option value="older">Trước hôm nay</option>
      </select>
      <button className="btn btn-secondary filter-button"><Filter size={15} /> Bộ lọc</button>
    </section>

    {error && <div className="form-error">{error}</div>}
    <section className="patient-table-card">
      <div className="patient-table-wrap">
        <table className="patient-table">
          <thead>
            <tr>
              <th>Bệnh nhân</th>
              <th>Liên hệ</th>
              <th>Thông tin</th>
              <th>Lần khám gần nhất</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={5}>Đang tải dữ liệu bệnh nhân...</td></tr> : filteredPatients.map((patient) => <tr key={patient.id}>
              <td>
                <div className="patient-cell">
                  <div className={`patient-avatar avatar-${patient.gender === 'Nam' ? 'blue' : 'pink'}`}>{patient.fullName.split(' ').slice(-1)[0][0]}</div>
                  <div>
                    <strong>{patient.fullName}</strong>
                    <span>Mã BN: {patient.code}</span>
                  </div>
                </div>
              </td>
              <td>
                <div className="contact-cell">
                  <strong>{patient.phone}</strong>
                  <span>{patient.email}</span>
                </div>
              </td>
              <td>
                <div className="info-cell">
                  <strong>{patient.gender} · {patient.age || '—'} tuổi</strong>
                  <span>{patient.dob}</span>
                </div>
              </td>
              <td>
                <div className="visit-cell">
                  <strong>{patient.lastVisit}</strong>
                  <span>{patient.lastReason}</span>
                </div>
              </td>
              <td>
                <div className="patient-actions">
                  <button className="btn btn-outline-blue btn-sm" onClick={() => setSelectedPatient(patient)}><Eye size={14} /> Xem hồ sơ</button>
                  {canManagePatients && <button className="icon-button" onClick={() => setShowMenu(showMenu === patient.id ? null : patient.id)} aria-label="Thao tác khác"><MoreHorizontal size={17} /></button>}
                  {canManagePatients && showMenu === patient.id && <div className="patient-row-menu">
                    <button onClick={() => setSelectedPatient(patient)}>Xem chi tiết</button>
                    <button onClick={() => { setEditPatient(patient); setShowMenu(null) }}>Cập nhật thông tin</button>
                    <button onClick={() => { setAppointmentPatient(patient); setShowMenu(null) }}>Tạo lịch hẹn</button>
                  </div>}
                </div>
              </td>
            </tr>)}
          </tbody>
        </table>

        {filteredPatients.length === 0 && <div className="patient-empty">
          <Search size={34} />
          <strong>Không tìm thấy bệnh nhân</strong>
          <span>Thử thay đổi từ khóa hoặc bộ lọc.</span>
        </div>}
      </div>

      <div className="patient-table-footer">
        <span>Hiển thị {totalItems ? (page - 1) * 10 + 1 : 0} đến {Math.min(page * 10, totalItems)} trong tổng số {totalItems} bệnh nhân</span>
        <div className="pagination">
          <span>Hiển thị:</span>
          <select value="10" disabled aria-label="Số bệnh nhân mỗi trang"><option>10</option></select>
          <button className="icon-button" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}>‹</button>
          {Array.from({ length: totalPages }, (_, index) => index + 1).filter((value) => value === 1 || value === totalPages || Math.abs(value - page) <= 1).map((value, index, values) => <span key={value} className="pagination-page-item">{index > 0 && value - values[index - 1] > 1 && <i>…</i>}<button className={`page-number ${value === page ? 'active' : ''}`} onClick={() => setPage(value)} disabled={loading}>{value}</button></span>)}
          <button className="icon-button" disabled={page >= totalPages || loading} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>›</button>
        </div>
      </div>
    </section>

    {selectedPatient && <PatientProfileDrawer patient={{ ...selectedPatient, dob: selectedPatient.rawDob }} showMedicalHistory={isDoctor} onClose={() => setSelectedPatient(null)} actions={canManagePatients ? <><button className="btn btn-secondary" onClick={() => setEditPatient(selectedPatient)}><Pencil size={15} /> Cập nhật thông tin</button><button className="btn btn-primary" onClick={() => setAppointmentPatient(selectedPatient)}><CalendarPlus size={15} /> Tạo lịch hẹn</button></> : undefined} />}
    {canManagePatients && showCreate && <CreatePatientModal
      onClose={() => setShowCreate(false)}
      onCreated={(patient) => {
        if (page === 1) setPatients((current) => [mapApiPatient(patient), ...current].slice(0, 10))
        setTotalItems((current) => current + 1)
        setShowCreate(false)
        setPage(1)
        setRefreshVersion((current) => current + 1)
      }}
    />}
    {canManagePatients && editPatient && <EditPatientModal patient={editPatient} onClose={() => setEditPatient(null)} onSaved={(updated) => {
      const mapped = mapApiPatient(updated)
      setPatients((current) => current.map((item) => item.id === mapped.id ? mapped : item))
      setSelectedPatient((current) => current?.id === mapped.id ? mapped : current)
      setEditPatient(null)
    }} />}
    {canManagePatients && appointmentPatient && <PatientAppointmentModal patient={appointmentPatient} onClose={() => setAppointmentPatient(null)} onCreated={() => setAppointmentPatient(null)} />}
  </div>
}

function EditPatientModal({ patient, onClose, onSaved }: { patient: Patient; onClose: () => void; onSaved: (patient: ApiPatient) => void }) {
  const [values, setValues] = useState({ fullName: patient.fullName, phone: patient.phone, email: patient.email === 'Chưa cập nhật' ? '' : patient.email, cccd: patient.cccd === 'Chưa cập nhật' ? '' : patient.cccd, insuranceNumber: patient.insuranceNumber, address: patient.address === 'Chưa cập nhật' ? '' : patient.address })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!values.fullName.trim()) return setFormError('Vui lòng nhập họ và tên.')
    if (!/^\d{10,11}$/.test(values.phone.trim())) return setFormError('Số điện thoại phải có 10–11 chữ số.')
    if (values.cccd.trim() && !/^\d{9,12}$/.test(values.cccd.trim())) return setFormError('Số CCCD/CMND phải có từ 9 đến 12 chữ số.')
    setSaving(true)
    setFormError('')
    try {
      const response = await patientApi.update(Number(patient.id), {
        full_name: values.fullName.trim(), phone: values.phone.trim(), email: values.email.trim(), cccd: values.cccd.trim(),
        insurance_number: values.insuranceNumber.trim(), address: values.address.trim(),
      })
      onSaved(response.patient)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Không thể cập nhật thông tin bệnh nhân.')
    } finally { setSaving(false) }
  }
  return <div className="modal-backdrop patient-edit-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <form className="patient-edit-modal" onSubmit={submit}>
      <div className="modal-header"><div><h2>Cập nhật thông tin bệnh nhân</h2><p>{patient.code}</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Đóng"><X size={18} /></button></div>
      <div className="patient-edit-notice">ⓘ Thay đổi sẽ được cập nhật vào hồ sơ bệnh nhân.</div>
      <div className="patient-edit-grid">
        <label>Họ và tên *<input value={values.fullName} onChange={(e) => setValues((v) => ({ ...v, fullName: e.target.value }))} /></label>
        <label>Số điện thoại *<input inputMode="numeric" value={values.phone} onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value.replace(/\D/g, '') }))} /></label>
        <label>Email<input type="email" value={values.email} onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))} /></label>
        <label>Số CCCD/CMND<input inputMode="numeric" maxLength={12} value={values.cccd} onChange={(e) => setValues((v) => ({ ...v, cccd: e.target.value.replace(/\D/g, '') }))} /></label>
        <label>Số BHYT<input value={values.insuranceNumber} onChange={(e) => setValues((v) => ({ ...v, insuranceNumber: e.target.value }))} /></label>
        <label>Ngày sinh<input type="date" value={patient.rawDob} disabled /></label>
        <label className="span-two">Địa chỉ<textarea rows={3} value={values.address} onChange={(e) => setValues((v) => ({ ...v, address: e.target.value }))} /></label>
      </div>
      {formError && <div className="form-error patient-edit-error">{formError}</div>}
      <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Hủy bỏ</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</button></div>
    </form>
  </div>
}

function PatientAppointmentModal({ patient, onClose, onCreated }: { patient: Patient; onClose: () => void; onCreated: () => void }) {
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
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLElement | null
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
