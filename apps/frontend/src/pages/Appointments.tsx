import { useMemo, useState } from 'react'
import type { Dispatch, FormEvent, SetStateAction } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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

export type AppointmentStatus = 'CONFIRMED' | 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
type AppointmentType = 'SCHEDULED' | 'WALK_IN'
type SlotState = 'available' | 'ongoing' | 'full' | 'ended' | 'closed'

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
}

interface SlotDefinition {
  id: string
  start: string
  end: string
  state: SlotState
  booked: number
  capacity: number
}

type BookingMode = 'IMMEDIATE' | 'SCHEDULED'
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

const doctors = [
  { id: 'doctor-1', fullName: 'BS. Nguyễn Minh Đức', department: 'Nội khoa' },
  { id: 'doctor-2', fullName: 'BS. Trần Thị Mai', department: 'Nhi khoa' },
  { id: 'doctor-3', fullName: 'BS. Lê Hoàng Nam', department: 'Tim mạch' },
]

const patients: PatientProfile[] = [
  { id: 'patient-1', code: 'BN-200128', fullName: 'Nguyễn Văn A', phone: '0901 234 567', email: 'nguyenvana@email.com', gender: 'Nam', age: 34, dob: '1992-01-01', address: '45 Nguyễn Trãi, Quận 1, TP.HCM', lastVisit: { date: '2026-07-01', doctor: 'BS. Nguyễn Minh Đức', reason: 'Đau đầu, chóng mặt' }, insuranceNumber: 'DN-920101-001' },
  { id: 'patient-2', code: 'BN-20260718-005', fullName: 'Phạm Thị D', phone: '0901 456 789', email: 'phamthid@email.com', gender: 'Nữ', age: 34, dob: '1992-05-12', address: '123 Lê Lợi, Quận 1, TP.HCM', lastVisit: { date: '2026-06-22', doctor: 'BS. Trần Thị Mai', reason: 'Đau bụng, đầy hơi' } },
  { id: 'patient-3', code: 'BN-200130', fullName: 'Lê Văn C', phone: '0902 111 222', email: 'levanc@email.com', gender: 'Nam', age: 28, dob: '1998-08-20', address: '18 Hai Bà Trưng, Quận 1, TP.HCM', lastVisit: { date: '2026-07-10', doctor: 'BS. Nguyễn Minh Đức', reason: 'Sốt nhẹ, đau họng' } },
  { id: 'patient-4', code: 'BN-200131', fullName: 'Đỗ Thị H', phone: '0903 333 444', email: 'dothih@email.com', gender: 'Nữ', age: 42, dob: '1984-11-15', address: '72 Võ Văn Tần, Quận 3, TP.HCM', lastVisit: { date: '2026-06-14', doctor: 'BS. Trần Thị Mai', reason: 'Tái khám' } },
  { id: 'patient-5', code: 'BN-200132', fullName: 'Võ Minh K', phone: '0904 555 666', email: 'vominhk@email.com', gender: 'Nam', age: 51, dob: '1975-03-04', address: '9 Nguyễn Văn Cừ, Quận 1, TP.HCM', lastVisit: { date: '2026-07-12', doctor: 'BS. Lê Hoàng Nam', reason: 'Theo dõi huyết áp' } },
]

const initialAppointments: Appointment[] = [
  { id: 'apt-1', patient: patients[0], doctor: doctors[0], appointmentType: 'SCHEDULED', startTime: '2026-07-18T08:00:00', endTime: '2026-07-18T09:00:00', reason: 'Khám định kỳ', status: 'CONFIRMED', sequenceNumber: 1, appointmentCode: 'LH20260718-001', room: 'Phòng 1', insuranceNumber: patients[0].insuranceNumber },
  { id: 'apt-2', patient: patients[2], doctor: doctors[0], appointmentType: 'SCHEDULED', startTime: '2026-07-18T09:00:00', endTime: '2026-07-18T10:00:00', reason: 'Đau đầu, chóng mặt', status: 'WAITING', sequenceNumber: 2, appointmentCode: 'LH20260718-002', room: 'Phòng 1' },
  { id: 'apt-3', patient: patients[4], doctor: doctors[0], appointmentType: 'SCHEDULED', startTime: '2026-07-18T09:00:00', endTime: '2026-07-18T10:00:00', reason: 'Theo dõi huyết áp', status: 'WAITING', sequenceNumber: 3, appointmentCode: 'LH20260718-003', room: 'Phòng 1' },
  { id: 'apt-4', patient: patients[1], doctor: doctors[0], appointmentType: 'SCHEDULED', startTime: '2026-07-18T10:00:00', endTime: '2026-07-18T11:00:00', reason: 'Đau bụng, đầy hơi', status: 'CONFIRMED', sequenceNumber: 4, appointmentCode: 'LH20260718-004', room: 'Phòng 1' },
]

const slotDefinitions: SlotDefinition[] = [
  { id: '07', start: '07:00', end: '08:00', state: 'ended', booked: 4, capacity: 4 },
  { id: '08', start: '08:00', end: '09:00', state: 'ended', booked: 4, capacity: 4 },
  { id: '09', start: '09:00', end: '10:00', state: 'ongoing', booked: 3, capacity: 4 },
  { id: '10', start: '10:00', end: '11:00', state: 'available', booked: 2, capacity: 4 },
  { id: '11', start: '11:00', end: '12:00', state: 'full', booked: 4, capacity: 4 },
  { id: '13', start: '13:00', end: '14:00', state: 'available', booked: 1, capacity: 4 },
  { id: '14', start: '14:00', end: '15:00', state: 'available', booked: 0, capacity: 4 },
  { id: '15', start: '15:00', end: '16:00', state: 'closed', booked: 0, capacity: 4 },
  { id: '16', start: '16:00', end: '17:00', state: 'available', booked: 2, capacity: 4 },
]

const statusConfig: Record<AppointmentStatus, { label: string; className: string }> = {
  CONFIRMED: { label: 'Đã xác nhận', className: 'status-confirmed' },
  WAITING: { label: 'Đang chờ', className: 'status-waiting' },
  IN_PROGRESS: { label: 'Đang khám', className: 'status-progress' },
  COMPLETED: { label: 'Đã hoàn thành', className: 'status-completed' },
  CANCELLED: { label: 'Đã hủy', className: 'status-cancelled' },
}

const timeLabel = (value: string) => value.slice(11, 16)
const dateLabel = (value: string) => new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T12:00:00`))
const shortDateLabel = (value: string) => new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T12:00:00`))
const patientInitials = (name: string) => name.split(' ').slice(-2).map((part) => part[0]).join('').toUpperCase()

export default function AppointmentsPage() {
  const user = useAuthStore((state) => state.user)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedDoctorId = searchParams.get('doctorId')
  const [selectedDate, setSelectedDate] = useState('2026-07-18')
  const [doctorId, setDoctorId] = useState('doctor-1')
  const [department, setDepartment] = useState('all')
  const [status, setStatus] = useState('all')
  const [query, setQuery] = useState('')
  const [patientDirectory, setPatientDirectory] = useState(patients)
  const [appointments, setAppointments] = useState(initialAppointments)
  const [selectedId, setSelectedId] = useState('apt-4')
  const [queueTab, setQueueTab] = useState<'WAITING' | 'CONFIRMED'>('WAITING')
  const [drawerAppointmentId, setDrawerAppointmentId] = useState<string | null>(null)
  const [bookingSlot, setBookingSlot] = useState<SlotDefinition | null>(null)
  const [bookingMode, setBookingMode] = useState<BookingMode>('SCHEDULED')
  const [printAppointment, setPrintAppointment] = useState<Appointment | null>(null)
  const [draft, setDraft] = useState<AppointmentDraft>({ patientId: '', patientName: '', doctorId: 'doctor-1', department: 'Nội khoa', room: 'Phòng 1', date: '2026-07-18', slotId: '09', service: 'Dịch vụ', insuranceNumber: '', reason: '', note: '' })
  const [formError, setFormError] = useState('')
  const activeDoctorId = requestedDoctorId || doctorId
  const selectedDoctor = doctors.find((doctor) => doctor.id === activeDoctorId) || doctors[0]

  const visibleAppointments = useMemo(() => appointments.filter((item) => item.doctor.id === activeDoctorId && item.startTime.startsWith(selectedDate) && (department === 'all' || item.doctor.department === department) && (status === 'all' || item.status === status)), [activeDoctorId, appointments, department, selectedDate, status])
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
    setBookingSlot(slot); setBookingMode('SCHEDULED'); setDraft({ patientId: '', patientName: '', doctorId: activeDoctorId, department: selectedDoctor.department, room: 'Phòng 1', date: selectedDate, slotId: slot.id, service: 'Dịch vụ', insuranceNumber: '', reason: '', note: '' }); setFormError('')
  }
  const openCreateWithoutSlot = () => {
    const fallback = slotDefinitions.find((slot) => slot.state === 'available' || slot.state === 'ongoing') || slotDefinitions[0]
    openCreate(fallback)
  }
  const handleCreate = (event: FormEvent, mode: BookingMode = bookingMode) => {
    event.preventDefault()
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLElement | null
    const actionMode: BookingMode = submitter?.textContent?.includes('Khám ngay') ? 'IMMEDIATE' : mode
    const selectedSlot = slotDefinitions.find((slot) => slot.id === draft.slotId) || bookingSlot
    if (!selectedSlot || selectedSlot.state === 'full' || selectedSlot.state === 'closed' || !draft.patientId || !draft.reason.trim() || !draft.room || (draft.service === 'BHYT' && !draft.insuranceNumber.trim())) { setFormError('Vui lòng điền đầy đủ thông tin bắt buộc.'); return }
    const patient = patientDirectory.find((item) => item.id === draft.patientId)
    const doctor = doctors.find((item) => item.id === draft.doctorId) || selectedDoctor
    if (!patient) return
    const sequenceNumber = appointments.reduce((max, item) => Math.max(max, item.sequenceNumber), 0) + 1
    const id = `apt-${Date.now()}`
    const created: Appointment = { id, patient, doctor, appointmentType: actionMode === 'IMMEDIATE' ? 'WALK_IN' : 'SCHEDULED', startTime: `${draft.date}T${selectedSlot.start}:00`, endTime: `${draft.date}T${selectedSlot.end}:00`, reason: draft.reason.trim(), status: actionMode === 'IMMEDIATE' ? 'WAITING' : 'CONFIRMED', sequenceNumber, appointmentCode: `LH${draft.date.replaceAll('-', '')}-${String(sequenceNumber).padStart(3, '0')}`, room: draft.room, insuranceNumber: draft.service === 'BHYT' ? draft.insuranceNumber.trim() : undefined }
    setAppointments((current) => [...current, created]); setSelectedId(id); setBookingSlot(null); setPrintAppointment(created)
  }
  const addPatient = () => {
    if (!draft.patientName.trim()) return
    const patient: PatientProfile = { id: `patient-${Date.now()}`, code: `BN-${Date.now().toString().slice(-6)}`, fullName: draft.patientName.trim(), phone: 'Chưa cập nhật', email: 'Chưa cập nhật', gender: 'Nam', age: 0, dob: '2000-01-01', address: 'Chưa cập nhật', lastVisit: { date: selectedDate, doctor: selectedDoctor.fullName, reason: 'Bệnh nhân mới' } }
    setPatientDirectory((current) => [...current, patient]); setDraft((current) => ({ ...current, patientId: patient.id, patientName: patient.fullName }))
  }

  if (!requestedDoctorId) {
    return <>
      <AppointmentOverview selectedDate={selectedDate} onDateChange={setSelectedDate} onCreate={openCreateWithoutSlot} onViewDoctor={(id) => setSearchParams({ doctorId: id })} />
      {bookingSlot && <CreateAppointmentModal patients={patientDirectory} draft={draft} setDraft={setDraft} slot={bookingSlot} mode={bookingMode} setMode={setBookingMode} onAddPatient={addPatient} onClose={() => setBookingSlot(null)} onSubmit={handleCreate} error={formError} />}{printAppointment && <PrintTicket appointment={printAppointment} onClose={() => setPrintAppointment(null)} />}
    </>
  }
  const updateStatus = (next: AppointmentStatus) => {
    if (!selectedId) return
    setAppointments((current) => current.map((item) => item.id === selectedId ? { ...item, status: next } : item))
  }

  return <div className="appointments-page appointments-redesign">
    <header className="appointments-heading"><div><button className="appointment-back-button" onClick={() => navigate('/appointments')}>← Tổng quan lịch hẹn</button><h1 className="page-title">Lịch hẹn</h1><p className="page-subtitle">Lịch khám chi tiết của {selectedDoctor.fullName}.</p></div><button className="btn btn-primary appointments-create-btn" onClick={openCreateWithoutSlot}><Plus size={18} /> Tạo lịch hẹn <ChevronDown size={15} /></button></header>
    <nav className="appointment-tabs"><button>Danh sách</button><button className="active">Lịch</button><button>Bảng tuần</button><button>Bảng ngày</button></nav>
    <div className="appointment-toolbar screenshot-toolbar"><div className="date-controls"><button className="btn btn-secondary btn-sm" onClick={() => setSelectedDate('2026-07-18')}>Hôm nay</button><button className="icon-button" onClick={() => moveDate(-1)} aria-label="Ngày trước"><ChevronLeft size={18} /></button><button className="icon-button" onClick={() => moveDate(1)} aria-label="Ngày sau"><ChevronRight size={18} /></button><strong className="toolbar-date"><CalendarDays size={17} /> {dateLabel(selectedDate)}</strong></div><div className="appointment-filters"><label><Stethoscope size={15} /><select value={doctorId} onChange={(event) => setDoctorId(event.target.value)}>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.fullName}</option>)}</select></label><label><Filter size={15} /><select value={department} onChange={(event) => setDepartment(event.target.value)}><option value="all">Khoa: Tất cả</option><option>Nội khoa</option><option>Nhi khoa</option><option>Tim mạch</option></select></label><label><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Trạng thái: Tất cả</option>{Object.entries(statusConfig).map(([key, config]) => <option key={key} value={key}>{config.label}</option>)}</select></label><button className="icon-button" aria-label="Cài đặt bộ lọc"><Settings2 size={17} /></button></div></div>
    <main className="appointments-grid"><section className="slot-panel"><div className="slot-panel-header"><div><h2>{selectedDoctor.fullName}</h2><p>{selectedDoctor.department} · Lịch dự kiến</p></div><div className="slot-refresh"><span><Clock3 size={15} /> Mỗi lần lại: 09:45</span><button className="icon-button" aria-label="Làm mới"><RefreshCw size={16} /></button></div></div><div className="slot-legend"><span><i className="legend-dot available" /> Còn chỗ</span><span><i className="legend-dot full" /> Full</span><span><i className="legend-dot ended" /> Đã qua</span><span><LockKeyhole size={13} /> Đã khóa</span></div><div className="slot-table-head"><span>Khung giờ</span><span>Số suất</span><span>Chi tiết</span><span /></div><div className="slot-list">{slotDefinitions.map((slot) => <SlotRow key={slot.id} slot={slot} onCreate={openCreate} />)}</div><div className="slot-footer-note"><Clock3 size={14} /> Ngừng tiếp nhận bệnh nhân mới từ 16:00 mỗi ngày.</div></section><aside className="appointments-side"><section className="queue-panel"><div className="side-panel-title"><h2>Danh sách chờ</h2></div><label className="queue-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên, SĐT, mã BN hoặc số khám..." /></label><div className="queue-tabs"><button className={queueTab === 'WAITING' ? 'active' : ''} onClick={() => setQueueTab('WAITING')}>Đang chờ ({queue.filter((item) => item.status === 'WAITING').length})</button><button className={queueTab === 'CONFIRMED' ? 'active' : ''} onClick={() => setQueueTab('CONFIRMED')}>Đã xác nhận ({queue.filter((item) => item.status === 'CONFIRMED').length})</button></div><QueueGroup items={queue.filter((item) => item.status === queueTab)} selectedId={selectedId} onSelect={setSelectedId} /><button className="view-all-link">Xem tất cả danh sách chờ <ChevronRight size={15} /></button></section><AppointmentDetail appointment={selectedAppointment} onOpenProfile={(id) => { setSelectedId(id); setDrawerAppointmentId(id) }} onStatusChange={updateStatus} /></aside></main>
    <div className="mock-api-hint"><span className="mock-dot" /> Mock API · Dữ liệu chỉ lưu trong phiên UI này</div><span className="sr-only">Đang đăng nhập: {user?.fullName || 'Lễ tân'}</span>
    {bookingSlot && <CreateAppointmentModal patients={patientDirectory} draft={draft} setDraft={setDraft} slot={bookingSlot} mode={bookingMode} setMode={setBookingMode} onAddPatient={addPatient} onClose={() => setBookingSlot(null)} onSubmit={handleCreate} error={formError} />}{drawerAppointment && <ReceptionistPatientDrawer appointment={drawerAppointment} onClose={() => setDrawerAppointmentId(null)} />}{printAppointment && <PrintTicket appointment={printAppointment} onClose={() => setPrintAppointment(null)} />}
  </div>
}

function AppointmentOverview({ selectedDate, onDateChange, onCreate, onViewDoctor }: { selectedDate: string; onDateChange: (date: string) => void; onCreate: () => void; onViewDoctor: (doctorId: string) => void }) {
  const moveDate = (amount: number) => {
    const date = new Date(`${selectedDate}T12:00:00`)
    date.setDate(date.getDate() + amount)
    onDateChange(date.toISOString().slice(0, 10))
  }
  return <div className="appointments-page appointments-redesign appointment-overview-page"><header className="appointments-heading"><div><h1 className="page-title">Lịch hẹn</h1><p className="page-subtitle">Quản lý lịch khám và điều phối bệnh nhân trong ngày.</p></div><button className="btn btn-primary appointments-create-btn" onClick={onCreate}><Plus size={18} /> Tạo lịch hẹn <ChevronDown size={15} /></button></header><nav className="appointment-tabs"><button className="active">Tổng quan</button><button>Lịch</button><button>Bảng tuần</button><button>Bảng ngày</button></nav><div className="appointment-toolbar screenshot-toolbar"><div className="date-controls"><button className="btn btn-secondary btn-sm" onClick={() => onDateChange('2026-07-18')}>Hôm nay</button><button className="icon-button" onClick={() => moveDate(-1)} aria-label="Ngày trước"><ChevronLeft size={18} /></button><button className="icon-button" onClick={() => moveDate(1)} aria-label="Ngày sau"><ChevronRight size={18} /></button><strong className="toolbar-date"><CalendarDays size={17} /> {dateLabel(selectedDate)}</strong></div><div className="appointment-filters"><label><Filter size={15} /><select><option>Khoa: Tất cả</option></select></label><label><Stethoscope size={15} /><select><option>Bác sĩ: Tất cả</option></select></label><label><select><option>Tình trạng slot: Tất cả</option></select></label><button className="icon-button" aria-label="Cài đặt bộ lọc"><Settings2 size={17} /></button></div></div><div className="overview-info-banner">ⓘ Chọn khoa để lọc bác sĩ. Chọn bác sĩ để xem lịch chi tiết theo khung giờ.</div><div className="overview-layout"><section className="overview-table-card"><div className="overview-card-title"><h2>Tổng quan lịch khám theo bác sĩ</h2></div><div className="overview-table-wrap"><table className="overview-table"><thead><tr><th>Bác sĩ</th><th>Khoa</th><th>Tổng slot</th><th>Đã đặt</th><th>Còn chỗ</th><th>Slot đang diễn ra</th><th>Tình trạng</th><th>Thao tác</th></tr></thead><tbody>{doctors.map((doctor) => { const doctorAppointments = initialAppointments.filter((item) => item.doctor.id === doctor.id); const booked = doctorAppointments.length + (doctor.id === 'doctor-1' ? 14 : doctor.id === 'doctor-2' ? 23 : 24); const capacity = doctor.id === 'doctor-1' ? 32 : doctor.id === 'doctor-2' ? 28 : 24; const remaining = Math.max(capacity - booked, 0); const full = remaining === 0; return <tr key={doctor.id}><td><div className="overview-doctor-cell"><span className={`doctor-initial-avatar avatar-${doctor.id}`}>{doctor.fullName.slice(4, 5)}</span><span><strong>{doctor.fullName}</strong><small>{doctor.department}</small></span></div></td><td>{doctor.id === 'doctor-3' ? 'Tai Mũi Họng' : doctor.department}</td><td>{capacity / 4}</td><td className={full ? 'metric-danger' : 'metric-success'}>{booked} / {capacity}</td><td className={remaining === 0 ? 'metric-danger' : 'metric-success'}>{remaining}</td><td>{full ? <span className="slot-full-text">● FULL</span> : <span>09:00 - 10:00 · {doctor.id === 'doctor-1' ? '3/4' : '1/4'}</span>}</td><td><span className={`overview-status ${full ? 'is-full' : remaining < 6 ? 'is-near' : 'is-open'}`}>{full ? 'Đã đầy' : remaining < 6 ? 'Gần đầy' : 'Đang nhận'}</span></td><td><button className="btn btn-outline-primary btn-sm" onClick={() => onViewDoctor(doctor.id)}>Xem lịch</button></td></tr>})}</tbody></table></div><div className="overview-legend"><span><i className="legend-dot available" /> Đang nhận</span><span><i className="legend-dot near" /> Gần đầy</span><span><i className="legend-dot full" /> Đã đầy</span><span><i className="legend-dot ended" /> Đã khóa</span></div></section><aside className="overview-side"><MiniCalendar selectedDate={selectedDate} onSelect={onDateChange} /><section className="overview-side-card"><h3>Tổng quan tiếp nhận hôm nay</h3><p>Đang chờ <strong className="metric-success">12</strong></p><p>Đã xác nhận <strong className="metric-blue">18</strong></p><p>Đang khám <strong className="metric-orange">3</strong></p><p>Hoàn tất <strong>28</strong></p></section><section className="overview-side-card"><h3>Bác sĩ có bệnh nhân chờ</h3><p>BS. Trần Thị Mai <b>5</b></p><p>BS. Nguyễn Minh Đức <b>4</b></p><p>BS. Lê Hoàng Nam <b>3</b></p><button className="view-all-link">Xem tất cả <ChevronRight size={15} /></button></section></aside></div><div className="overview-empty-state"><CalendarDays size={40} /><strong>Chọn bác sĩ để xem lịch chi tiết theo khung giờ</strong><span>Bạn có thể chọn một bác sĩ ở trên để xem các khung giờ và danh sách bệnh nhân.</span></div><div className="mock-api-hint"><span className="mock-dot" /> Mock API · Dữ liệu chỉ lưu trong phiên UI này</div></div>
}

function MiniCalendar({ selectedDate, onSelect }: { selectedDate: string; onSelect: (date: string) => void }) {
  const year = Number(selectedDate.slice(0, 4)); const month = Number(selectedDate.slice(5, 7)) - 1; const days = new Date(year, month + 1, 0).getDate(); const firstDay = (new Date(year, month, 1).getDay() + 6) % 7
  return <section className="mini-calendar"><div className="mini-calendar-header"><strong>{new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(new Date(year, month, 1))}</strong><span>‹ &nbsp; ›</span></div><div className="mini-calendar-week">{['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => <span key={day}>{day}</span>)}</div><div className="mini-calendar-grid">{Array.from({ length: firstDay }).map((_, index) => <span key={`empty-${index}`} />)}{Array.from({ length: days }).map((_, index) => { const day = index + 1; const value = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; return <button key={value} className={value === selectedDate ? 'selected' : ''} onClick={() => onSelect(value)}>{day}</button>})}</div></section>
}

function SlotRow({ slot, onCreate }: { slot: SlotDefinition; onCreate: (slot: SlotDefinition) => void }) {
  const remaining = slot.capacity - slot.booked
  const description = slot.state === 'closed' ? 'Slot đã khóa' : slot.booked ? `${slot.booked} bệnh nhân` : 'Chưa có bệnh nhân'
  return <div className={`slot-row slot-${slot.state}`}><div className="slot-time"><strong>{slot.start} - {slot.end}</strong><small>{slot.state === 'ended' ? 'Đã kết thúc' : slot.state === 'ongoing' ? 'Đang diễn ra' : slot.state === 'closed' ? 'Đã khóa' : remaining ? `Còn ${remaining} chỗ` : 'Đã đủ chỗ'}</small></div><div className="slot-capacity"><strong>{slot.state === 'closed' ? '—' : `${slot.booked} / ${slot.capacity}`}</strong><small>{slot.state === 'closed' ? 'Đã khóa' : remaining ? `Còn ${remaining} chỗ` : 'Đã đủ chỗ'}</small></div><div className="slot-detail"><span>• &nbsp;{description}</span>{slot.state !== 'closed' && <button type="button">Xem danh sách</button>}</div><div className="slot-action">{slot.state === 'full' ? <span className="full-badge">FULL</span> : slot.state === 'closed' ? <button className="icon-button" disabled aria-label="Slot đã khóa"><LockKeyhole size={15} /></button> : slot.state === 'ended' ? <button className="btn btn-secondary btn-sm">Xem</button> : <button className="btn btn-outline-primary btn-sm" onClick={() => onCreate(slot)}><Plus size={15} /> Tạo lịch</button>}</div></div>
}

function QueueGroup({ items, selectedId, onSelect }: { items: Appointment[]; selectedId: string; onSelect: (id: string) => void }) {
  return <div className="queue-group">{items.map((item) => <div className={`queue-item ${selectedId === item.id ? 'selected' : ''}`} key={item.id}><button className="queue-main-button" onClick={() => onSelect(item.id)}><strong className="queue-number">{String(item.sequenceNumber).padStart(2, '0')}</strong><span><b>{item.patient.fullName}</b><small>{timeLabel(item.startTime)} - {timeLabel(item.endTime)} · {item.doctor.fullName}</small></span></button><span className={`status-badge ${statusConfig[item.status].className}`}>{statusConfig[item.status].label}</span></div>)}{items.length === 0 && <div className="empty-context">Không có lịch trong nhóm này.</div>}</div>
}

function AppointmentDetail({ appointment, onOpenProfile, onStatusChange }: { appointment: Appointment | null; onOpenProfile: (id: string) => void; onStatusChange: (status: AppointmentStatus) => void }) {
  if (!appointment) return <section className="detail-panel"><div className="side-panel-title"><h2>Chi tiết lịch hẹn</h2></div><div className="empty-context">Chọn một lịch hẹn để xem chi tiết.</div></section>
  const status = statusConfig[appointment.status]
  return <section className="detail-panel"><div className="side-panel-title"><h2>Chi tiết lịch hẹn</h2><button className="icon-button" aria-label="Đóng chi tiết"><X size={16} /></button></div><div className="detail-patient"><div className="detail-avatar"><UserRound size={21} /></div><div><strong>{appointment.patient.fullName}</strong><span>{appointment.patient.code}</span><a href={`tel:${appointment.patient.phone}`}><Phone size={13} /> {appointment.patient.phone}</a></div></div><span className={`status-badge ${status.className}`}>{status.label}</span><dl className="detail-list"><DetailRow label="Số khám" value={String(appointment.sequenceNumber).padStart(2, '0')} /><DetailRow label="Mã lịch hẹn" value={appointment.appointmentCode} /><DetailRow label="Khung giờ" value={`${timeLabel(appointment.startTime)} - ${timeLabel(appointment.endTime)}`} /><DetailRow label="Bác sĩ" value={appointment.doctor.fullName} /><DetailRow label="Khoa" value={appointment.doctor.department} /><DetailRow label="Loại đặt lịch" value={appointment.appointmentType === 'SCHEDULED' ? 'Đặt trước' : 'Đến trực tiếp'} /><DetailRow label="Hình thức khám" value="Dịch vụ" /><DetailRow label="Lý do khám" value={appointment.reason} /><DetailRow label="Trạng thái" value={status.label} /></dl><div className="detail-actions"><button className="btn btn-secondary btn-sm" onClick={() => onOpenProfile(appointment.id)}><Search size={15} /> {appointment.status === 'CANCELLED' ? 'Xem chi tiết lý do hủy' : 'Xem hồ sơ'}</button>{appointment.status === 'CONFIRMED' && <><button className="btn btn-primary btn-sm" onClick={() => onStatusChange('WAITING')}>Vào khám</button><button className="btn btn-danger-outline btn-sm" onClick={() => onStatusChange('CANCELLED')}><X size={15} /> Hủy</button></>}{appointment.status === 'WAITING' && <button className="btn btn-danger-outline btn-sm" onClick={() => onStatusChange('CANCELLED')}><X size={15} /> Hủy</button>}{appointment.status === 'IN_PROGRESS' && <span className="detail-state-note">Đang khám</span>}</div></section>
}

function DetailRow({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div> }

function CreateAppointmentModal({ patients, draft, setDraft, slot, mode, setMode, onAddPatient, onClose, onSubmit, error }: { patients: PatientProfile[]; draft: AppointmentDraft; setDraft: Dispatch<SetStateAction<AppointmentDraft>>; slot: SlotDefinition; mode: BookingMode; setMode: (mode: BookingMode) => void; onAddPatient: () => void; onClose: () => void; onSubmit: (event: FormEvent, mode?: BookingMode) => void; error: string }) {
  const suggestions = patients.filter((patient) => `${patient.fullName} ${patient.code} ${patient.phone}`.toLowerCase().includes(draft.patientName.toLowerCase())).slice(0, 5)
  const selectedPatient = patients.find((patient) => patient.id === draft.patientId)
  const updatePatient = (patient: PatientProfile) => setDraft((current) => ({ ...current, patientId: patient.id, patientName: patient.fullName, insuranceNumber: patient.insuranceNumber || '' }))
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><form className="appointment-modal appointment-booking-modal" onSubmit={(event) => onSubmit(event, mode)}><div className="modal-header"><div><h2>{mode === 'IMMEDIATE' ? 'Khám ngay' : 'Tạo lịch hẹn'}</h2><p>{mode === 'IMMEDIATE' ? 'Đăng ký bệnh nhân vào hàng đợi khám ngay.' : `Đặt lịch vào khung ${slot.start} - ${slot.end}.`}</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Đóng"><X size={18} /></button></div>{error && <div className="form-error">{error}</div>}<div className="booking-mode-switch"><button type="button" className={mode === 'IMMEDIATE' ? 'active' : ''} onClick={() => setMode('IMMEDIATE')}>Khám ngay</button><button type="button" className={mode === 'SCHEDULED' ? 'active' : ''} onClick={() => setMode('SCHEDULED')}>Tạo lịch</button></div><div className="booking-form-grid"><label className="booking-field patient-picker">Bệnh nhân *<div className="input-with-action"><input required value={draft.patientName} onChange={(event) => setDraft((current) => ({ ...current, patientName: event.target.value, patientId: '' }))} placeholder="Tìm tên hoặc mã bệnh nhân" /><button type="button" onClick={onAddPatient} aria-label="Tạo bệnh nhân mới"><Plus size={16} /></button></div>{draft.patientName && !selectedPatient && <div className="suggestion-list">{suggestions.map((patient) => <button type="button" key={patient.id} onClick={() => updatePatient(patient)}><strong>{patient.fullName}</strong><small>{patient.code} · {patient.phone}</small></button>)}{suggestions.length === 0 && <button type="button" onClick={onAddPatient}>+ Tạo bệnh nhân mới</button>}</div>}</label><label className="booking-field">Bác sĩ *<SearchableSelect value={draft.doctorId} options={doctors.map((doctor) => ({ value: doctor.id, label: doctor.fullName }))} onChange={(value) => { const doctor = doctors.find((item) => item.id === value); setDraft((current) => ({ ...current, doctorId: value, department: doctor?.department || current.department })) }} /></label><label className="booking-field">Khoa *<SearchableSelect value={draft.department} options={['Nội khoa', 'Nhi khoa', 'Tim mạch'].map((item) => ({ value: item, label: item }))} onChange={(value) => setDraft((current) => ({ ...current, department: value }))} /></label><label className="booking-field">Số phòng *<SearchableSelect value={draft.room} options={['Phòng 1', 'Phòng 2', 'Phòng 3', 'Phòng 5'].map((item) => ({ value: item, label: item }))} onChange={(value) => setDraft((current) => ({ ...current, room: value }))} /></label><label className="booking-field">Ngày *<input type="date" required value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} /></label><label className="booking-field">Dịch vụ *<select value={draft.service} onChange={(event) => setDraft((current) => ({ ...current, service: event.target.value as AppointmentDraft['service'], insuranceNumber: event.target.value === 'BHYT' ? current.insuranceNumber || selectedPatient?.insuranceNumber || '' : '' }))}><option>Dịch vụ</option><option>BHYT</option></select></label>{draft.service === 'BHYT' && <label className="booking-field booking-span-two">Số BHYT *<input required value={draft.insuranceNumber} onChange={(event) => setDraft((current) => ({ ...current, insuranceNumber: event.target.value }))} placeholder="Tự điền nếu bệnh nhân đã có trong hồ sơ" /></label>}</div><div className="slot-picker"><strong>Chọn khung giờ</strong><div className="slot-picker-group"><span>Ca sáng</span><div>{slotDefinitions.slice(0, 5).map((item) => <button type="button" key={item.id} disabled={item.state === 'full' || item.state === 'closed' || item.state === 'ended'} className={item.id === slot.id ? 'selected' : ''} onClick={() => setDraft((current) => ({ ...current, slotId: item.id }))}>{item.start} - {item.end}{item.state === 'full' && ' · Đầy'}</button>)}</div></div><div className="slot-picker-group"><span>Ca chiều</span><div>{slotDefinitions.slice(5).map((item) => <button type="button" key={item.id} disabled={item.state === 'full' || item.state === 'closed' || item.state === 'ended'} className={item.id === slot.id ? 'selected' : ''} onClick={() => setDraft((current) => ({ ...current, slotId: item.id }))}>{item.start} - {item.end}{item.state === 'full' && ' · Đầy'}</button>)}</div></div></div><div className="booking-form-grid"><label className="booking-field booking-span-two">Lý do khám *<input required value={draft.reason} onChange={(event) => setDraft((current) => ({ ...current, reason: event.target.value }))} placeholder="Nhập lý do khám" /></label><label className="booking-field booking-span-two">Ghi chú<textarea rows={2} value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Thông tin bổ sung (không bắt buộc)" /></label></div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button><button type="submit" className="btn btn-secondary"><Clock3 size={16} /> Khám ngay</button><button type="submit" className="btn btn-primary"><CalendarDays size={16} /> Tạo lịch</button></div></form></div>
}

function SearchableSelect({ value, options, onChange }: { value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  const selected = options.find((option) => option.value === value)
  const [query, setQuery] = useState(selected?.label || '')
  const [open, setOpen] = useState(false)
  const suggestions = options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase())).slice(0, 5)
  return <div className="searchable-select"><input value={query} onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true) }} /><ChevronDown size={14} />{open && <div className="suggestion-list searchable-suggestions">{suggestions.map((option) => <button type="button" key={option.value} onClick={() => { onChange(option.value); setQuery(option.label); setOpen(false) }}>{option.label}</button>)}{suggestions.length === 0 && <span>Không có lựa chọn phù hợp</span>}</div>}</div>
}

function PrintTicket({ appointment, onClose }: { appointment: Appointment; onClose: () => void }) {
  return <div className="modal-backdrop print-ticket-backdrop"><section className="print-ticket-modal"><div className="print-ticket"><small>{appointment.room}</small><h2>PHIẾU KHÁM BỆNH</h2><p>Ngày: {shortDateLabel(appointment.startTime.slice(0, 10))}</p><div className="ticket-info"><span>Họ tên:</span><strong>{appointment.patient.fullName}</strong><span>Giới tính:</span><b>{appointment.patient.gender}</b><span>Năm sinh:</span><b>{appointment.patient.dob.slice(0, 4)}</b><span>Khoa:</span><b>{appointment.doctor.department}</b><span>Dịch vụ:</span><b>{appointment.insuranceNumber ? 'BHYT' : 'Dịch vụ'}</b><span>Bác sĩ:</span><b>{appointment.doctor.fullName}</b><span>Khung giờ:</span><b>{timeLabel(appointment.startTime)} - {timeLabel(appointment.endTime)}</b><span>Mã bệnh nhân:</span><b>{appointment.patient.code}</b><span>Mã lịch hẹn:</span><b>{appointment.appointmentCode}</b></div><div className="ticket-number"><span>Phòng số:</span><strong>{appointment.room.replace('Phòng ', '')}</strong><span>Số thứ tự:</span><strong>{String(appointment.sequenceNumber).padStart(3, '0')}</strong></div><small className="ticket-note">Lưu ý: Quý khách vui lòng khám đúng khung giờ đăng ký.</small></div><div className="modal-footer"><button className="btn btn-secondary" onClick={onClose}>Đóng</button><button className="btn btn-primary" onClick={() => window.print()}>In phiếu khám</button></div></section></div>
}

function ReceptionistPatientDrawer({ appointment, onClose }: { appointment: Appointment; onClose: () => void }) {
  const patient = appointment.patient
  const status = statusConfig[appointment.status]
  return <div className="receptionist-patient-drawer-layer"><aside className="receptionist-patient-drawer" aria-label="Hồ sơ bệnh nhân"><header className="receptionist-drawer-header"><div><span>Hồ sơ bệnh nhân</span><h2>Chi tiết bệnh nhân</h2></div><button className="icon-button" onClick={onClose} aria-label="Đóng hồ sơ"><X size={18} /></button></header><section className="receptionist-patient-profile"><div className="receptionist-profile-avatar">{patientInitials(patient.fullName)}</div><div><h3>{patient.fullName}</h3><div className="receptionist-profile-meta"><span className="gender-badge">{patient.gender}</span><span>{patient.age} tuổi</span><span>{shortDateLabel(patient.dob)}</span></div><strong>{patient.code}</strong><a href={`tel:${patient.phone}`}>{patient.phone}</a><p>{patient.address}</p></div></section><div className="receptionist-drawer-body"><DrawerCard title="Thông tin liên hệ"><InfoRow label="Email" value={patient.email} /><InfoRow label="Số điện thoại" value={patient.phone} /><InfoRow label="Địa chỉ" value={patient.address} /></DrawerCard><DrawerCard title="Lần khám gần nhất"><InfoRow label="Ngày khám" value={shortDateLabel(patient.lastVisit.date)} /><InfoRow label="Bác sĩ" value={patient.lastVisit.doctor} /><InfoRow label="Lý do khám" value={patient.lastVisit.reason} /></DrawerCard><DrawerCard title="Lịch hẹn hiện tại" action={<span className={`status-badge ${status.className}`}>{status.label}</span>}><InfoRow label="Thời gian" value={`${timeLabel(appointment.startTime)} - ${timeLabel(appointment.endTime)}`} /><InfoRow label="Bác sĩ" value={appointment.doctor.fullName} /><InfoRow label="Khoa" value={appointment.doctor.department} /><InfoRow label="Lý do khám" value={appointment.reason} /></DrawerCard></div><footer className="receptionist-drawer-footer"><button className="btn btn-primary" onClick={onClose}>Đóng</button></footer></aside></div>
}

function DrawerCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="receptionist-info-card"><div className="receptionist-card-title"><h3>{title}</h3>{action}</div>{children}</section>
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="receptionist-info-row"><span>{label}</span><strong>{value}</strong></div>
}
