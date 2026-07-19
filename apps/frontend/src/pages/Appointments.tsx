import { useMemo, useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { DateSelectArg, EventClickArg, EventContentArg, EventInput } from '@fullcalendar/core'
import {
  CalendarDays, CalendarPlus, ChevronDown, ChevronLeft, ChevronRight, Clock3,
  Filter, Phone, Plus, Search, Settings2, Stethoscope, UserRound, X,
} from 'lucide-react'
import { useAuthStore } from '../store'

export type AppointmentStatus = 'CONFIRMED' | 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
type AppointmentType = 'SCHEDULED' | 'WALK_IN'

interface Appointment {
  id: string
  patient: PatientProfile
  doctor: { id: string; fullName: string; department?: string }
  appointmentType: AppointmentType
  startTime: string
  endTime: string
  reason: string
  note?: string
  status: AppointmentStatus
  checkedInAt?: string | null
  consultationStartedAt?: string | null
  completedAt?: string | null
}

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
  lastVisit: {
    date: string
    doctor: string
    reason: string
  }
}

const statusConfig: Record<AppointmentStatus, { label: string; className: string }> = {
  CONFIRMED: { label: 'Đã xác nhận', className: 'status-confirmed' },
  WAITING: { label: 'Đang chờ', className: 'status-waiting' },
  IN_PROGRESS: { label: 'Đang khám', className: 'status-progress' },
  COMPLETED: { label: 'Hoàn tất', className: 'status-completed' },
  CANCELLED: { label: 'Đã hủy', className: 'status-cancelled' },
}

const doctors = [
  { id: 'doctor-1', fullName: 'BS. Nguyễn Minh Đức', department: 'Nội khoa' },
  { id: 'doctor-2', fullName: 'BS. Trần Thị Mai', department: 'Nhi khoa' },
  { id: 'doctor-3', fullName: 'BS. Lê Hoàng Nam', department: 'Tim mạch' },
]

const patients: PatientProfile[] = [
  { id: 'patient-1', code: 'BN-200128', fullName: 'Nguyễn Văn A', phone: '0901 234 567', email: 'nguyenvana@email.com', gender: 'Nam', age: 34, dob: '1992-01-01', address: '45 Nguyễn Trãi, Phường Bến Thành, Quận 1, TP.HCM', lastVisit: { date: '2026-07-01', doctor: 'BS. Nguyễn Minh Đức', reason: 'Đau đầu, chóng mặt' } },
  { id: 'patient-2', code: 'BN-20260718-005', fullName: 'Phạm Thị D', phone: '0901 456 789', email: 'phamthid@email.com', gender: 'Nữ', age: 34, dob: '1992-05-12', address: '123 Lê Lợi, Phường Bến Nghé, Quận 1, TP.HCM', lastVisit: { date: '2026-06-22', doctor: 'BS. Trần Thị Mai', reason: 'Đau bụng, đầy hơi' } },
  { id: 'patient-3', code: 'BN-200130', fullName: 'Lê Văn C', phone: '0902 111 222', email: 'levanc@email.com', gender: 'Nam', age: 28, dob: '1998-08-20', address: '18 Hai Bà Trưng, Phường Tân Định, Quận 1, TP.HCM', lastVisit: { date: '2026-07-10', doctor: 'BS. Nguyễn Minh Đức', reason: 'Sốt nhẹ, đau họng' } },
  { id: 'patient-4', code: 'BN-200131', fullName: 'Đỗ Thị H', phone: '0903 333 444', email: 'dothih@email.com', gender: 'Nữ', age: 42, dob: '1984-11-15', address: '72 Võ Văn Tần, Phường Võ Thị Sáu, Quận 3, TP.HCM', lastVisit: { date: '2026-06-14', doctor: 'BS. Trần Thị Mai', reason: 'Tái khám' } },
  { id: 'patient-5', code: 'BN-200132', fullName: 'Võ Minh K', phone: '0904 555 666', email: 'vominhk@email.com', gender: 'Nam', age: 51, dob: '1975-03-04', address: '9 Nguyễn Văn Cừ, Phường Cầu Kho, Quận 1, TP.HCM', lastVisit: { date: '2026-07-12', doctor: 'BS. Lê Hoàng Nam', reason: 'Theo dõi huyết áp' } },
]

const INITIAL_APPOINTMENTS: Appointment[] = [
  { id: 'apt-1', patient: patients[0], doctor: doctors[0], appointmentType: 'SCHEDULED', startTime: '2026-07-18T08:00:00', endTime: '2026-07-18T08:30:00', reason: 'Khám định kỳ', status: 'CONFIRMED' },
  { id: 'apt-2', patient: patients[2], doctor: doctors[0], appointmentType: 'SCHEDULED', startTime: '2026-07-18T09:00:00', endTime: '2026-07-18T09:30:00', reason: 'Đau đầu, chóng mặt', status: 'WAITING', checkedInAt: '2026-07-18T08:55:00' },
  { id: 'apt-3', patient: patients[1], doctor: doctors[0], appointmentType: 'SCHEDULED', startTime: '2026-07-18T10:30:00', endTime: '2026-07-18T11:00:00', reason: 'Đau bụng, đầy hơi', status: 'WAITING', checkedInAt: '2026-07-18T10:45:00' },
  { id: 'apt-4', patient: patients[3], doctor: doctors[1], appointmentType: 'SCHEDULED', startTime: '2026-07-18T08:30:00', endTime: '2026-07-18T09:00:00', reason: 'Tái khám', status: 'IN_PROGRESS', checkedInAt: '2026-07-18T08:25:00', consultationStartedAt: '2026-07-18T08:36:00' },
  { id: 'apt-5', patient: patients[4], doctor: doctors[0], appointmentType: 'SCHEDULED', startTime: '2026-07-18T13:30:00', endTime: '2026-07-18T14:00:00', reason: 'Theo dõi huyết áp', status: 'COMPLETED', completedAt: '2026-07-18T14:20:00' },
  { id: 'apt-6', patient: patients[1], doctor: doctors[2], appointmentType: 'SCHEDULED', startTime: '2026-07-18T15:00:00', endTime: '2026-07-18T15:30:00', reason: 'Khám tim mạch', status: 'CANCELLED' },
]

const dateLabel = (value: string) => new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T12:00:00`))
const shortDateLabel = (value: string) => new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T12:00:00`))
const timeLabel = (value: string) => value.slice(11, 16)
const localTimeLabel = (value: Date) => `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
const dateValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const patientInitials = (name: string) => name.split(' ').slice(-2).map((part) => part[0]).join('').toUpperCase()

function mapAppointmentsToCalendarEvents(items: Appointment[], selectedId: string | null): EventInput[] {
  return items.map((item) => ({
    id: item.id, title: item.patient.fullName, start: item.startTime, end: item.endTime,
    classNames: [`appointment-event`, statusConfig[item.status].className, item.id === selectedId ? 'is-selected' : ''],
    extendedProps: { appointment: item },
  }))
}

export default function AppointmentsPage() {
  const user = useAuthStore((s) => s.user)
  const calendarRef = useRef<FullCalendar>(null)
  const [selectedDate, setSelectedDate] = useState('2026-07-18')
  const [doctorId, setDoctorId] = useState('doctor-1')
  const [department, setDepartment] = useState('all')
  const [status, setStatus] = useState<'all' | AppointmentStatus>('all')
  const [patientDirectory, setPatientDirectory] = useState(patients)
  const [appointments, setAppointments] = useState(INITIAL_APPOINTMENTS)
  const [selectedId, setSelectedId] = useState<string | null>('apt-3')
  const [drawerAppointmentId, setDrawerAppointmentId] = useState<string | null>(null)
  const [editingPatient, setEditingPatient] = useState<PatientProfile | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [draft, setDraft] = useState({ patientId: '', doctorId: 'doctor-1', date: '2026-07-18', start: '08:00', end: '08:30', reason: '', note: '' })
  const [formError, setFormError] = useState('')

  const filteredAppointments = useMemo(() => appointments.filter((item) => {
    return item.startTime.startsWith(selectedDate) && item.doctor.id === doctorId &&
      (department === 'all' || item.doctor.department === department) && (status === 'all' || item.status === status)
  }), [appointments, selectedDate, doctorId, department, status])
  const waitingQueue = useMemo(() => appointments.filter((item) => item.status === 'WAITING').sort((a, b) => (a.checkedInAt || '').localeCompare(b.checkedInAt || '')), [appointments])
  const selectedAppointment = appointments.find((item) => item.id === selectedId) || null
  const drawerAppointment = appointments.find((item) => item.id === drawerAppointmentId) || null
  const drawerPatient = drawerAppointment ? patientDirectory.find((item) => item.id === drawerAppointment.patient.id) || drawerAppointment.patient : null
  const selectedDoctor = doctors.find((item) => item.id === doctorId) || doctors[0]
  const events = useMemo(() => mapAppointmentsToCalendarEvents(filteredAppointments, selectedId), [filteredAppointments, selectedId])

  const moveDate = (amount: number) => {
    const api = calendarRef.current?.getApi(); if (!api) return
    if (amount < 0) api.prev(); else api.next()
    setSelectedDate(dateValue(api.getDate()))
  }
  const openCreate = (selection?: { date: string; start: string }) => {
    const start = selection?.start || '08:00'
    const [hour, minute] = start.split(':').map(Number); const endDate = new Date(2026, 6, 18, hour, minute + 30)
    setDraft({ patientId: '', doctorId, date: selection?.date || selectedDate, start, end: `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`, reason: '', note: '' })
    setFormError(''); setIsModalOpen(true)
  }
  const handleSelect = (info: DateSelectArg) => openCreate({ date: dateValue(info.start), start: localTimeLabel(info.start) })
  const handleEventClick = (info: EventClickArg) => { setSelectedId(info.event.id); setDrawerAppointmentId(info.event.id) }
  const openPatientDrawer = (appointmentId: string) => { setSelectedId(appointmentId); setDrawerAppointmentId(appointmentId) }
  const savePatientProfile = (updated: PatientProfile) => {
    setPatientDirectory((current) => current.map((item) => item.id === updated.id ? updated : item))
    setAppointments((current) => current.map((item) => item.patient.id === updated.id ? { ...item, patient: updated } : item))
    setEditingPatient(null)
  }
  const updateStatus = (next: AppointmentStatus) => {
    if (!selectedId) return
    setAppointments((current) => current.map((item) => item.id === selectedId ? { ...item, status: next } : item))
  }
  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault(); const patient = patientDirectory.find((item) => item.id === draft.patientId); const doctor = doctors.find((item) => item.id === draft.doctorId)
    if (!patient || !doctor || !draft.reason.trim()) return setFormError('Vui lòng điền đầy đủ các trường bắt buộc.')
    const start = `${draft.date}T${draft.start}:00`; const end = `${draft.date}T${draft.end}:00`
    if (new Date(end) <= new Date(start)) return setFormError('Giờ kết thúc phải sau giờ bắt đầu.')
    const overlap = appointments.some((item) => item.doctor.id === doctor.id && item.status !== 'CANCELLED' && item.startTime < end && item.endTime > start)
    if (overlap) return setFormError('Khung giờ này đang trùng với một lịch hẹn khác của bác sĩ.')
    const item: Appointment = { id: `apt-${Date.now()}`, patient, doctor, appointmentType: 'SCHEDULED', startTime: start, endTime: end, reason: draft.reason.trim(), note: draft.note.trim(), status: 'CONFIRMED' }
    setAppointments((current) => [...current, item]); setSelectedId(item.id); setSelectedDate(draft.date); setIsModalOpen(false)
  }

  return <div className="appointments-page">
    <div className="appointments-heading"><div><div className="page-title">Lịch hẹn</div><div className="page-subtitle">Quản lý lịch khám và điều phối bệnh nhân trong ngày.</div></div><button className="btn btn-primary" onClick={() => openCreate()}><Plus size={17} /> Tạo lịch hẹn <ChevronDown size={15} /></button></div>
    <div className="appointment-tabs"><button>Danh sách</button><button className="active">Lịch</button><button>Bảng tuần</button><button>Bảng ngày</button></div>
    <div className="appointment-toolbar"><div className="date-controls"><button className="btn btn-secondary btn-sm" onClick={() => { calendarRef.current?.getApi().today(); setSelectedDate('2026-07-18') }}>Hôm nay</button><button className="icon-button" onClick={() => moveDate(-1)} aria-label="Ngày trước"><ChevronLeft size={18} /></button><button className="icon-button" onClick={() => moveDate(1)} aria-label="Ngày sau"><ChevronRight size={18} /></button><span className="toolbar-date"><CalendarDays size={17} /> {dateLabel(selectedDate)}</span></div><div className="appointment-filters"><label><Stethoscope size={15} /><select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>{doctors.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select></label><label><Filter size={15} /><select value={department} onChange={(e) => setDepartment(e.target.value)}><option value="all">Khoa: Tất cả</option><option>Nội khoa</option><option>Nhi khoa</option><option>Tim mạch</option></select></label><label><select value={status} onChange={(e) => setStatus(e.target.value as 'all' | AppointmentStatus)}><option value="all">Trạng thái: Tất cả</option>{Object.entries(statusConfig).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></label><button className="icon-button" aria-label="Cài đặt"><Settings2 size={17} /></button></div></div>
    <div className="appointment-workspace"><section className="calendar-card"><div className="calendar-card-header"><div><strong>{selectedDoctor.fullName}</strong><span>{selectedDoctor.department} · Lịch dự kiến</span></div><span className="calendar-note"><Clock3 size={14} /> Mỗi lịch 30 phút</span></div><div className="fullcalendar-wrap"><FullCalendar ref={calendarRef} plugins={[timeGridPlugin, interactionPlugin]} initialView="timeGridDay" initialDate={selectedDate} headerToolbar={false} allDaySlot={false} slotMinTime="08:00:00" slotMaxTime="18:00:00" slotDuration="00:30:00" slotLabelInterval="00:30:00" nowIndicator editable={false} selectable selectMirror events={events} select={handleSelect} eventClick={handleEventClick} datesSet={(info) => setSelectedDate(dateValue(info.start))} eventContent={(info) => <AppointmentEvent info={info} />} /></div></section><aside className="context-panel"><WaitingQueue items={waitingQueue} selectedId={selectedId} onSelect={setSelectedId} /><AppointmentDetail appointment={selectedAppointment} onStatusChange={updateStatus} onOpenProfile={openPatientDrawer} /></aside></div>
    {drawerAppointment && drawerPatient && <ReceptionistPatientDrawer appointment={drawerAppointment} patient={drawerPatient} onClose={() => setDrawerAppointmentId(null)} onEdit={() => setEditingPatient(drawerPatient)} />}
    {editingPatient && <EditPatientModal patient={editingPatient} onClose={() => setEditingPatient(null)} onSave={savePatientProfile} />}
    {isModalOpen && <CreateAppointmentModal patients={patientDirectory} draft={draft} setDraft={setDraft} onClose={() => setIsModalOpen(false)} onSubmit={handleCreate} error={formError} />}
    <div className="mock-api-hint"><span className="mock-dot" /> Mock API · Dữ liệu chỉ lưu trong phiên UI này</div>
    <span className="sr-only">Đang đăng nhập: {user?.fullName || 'Lễ tân'}</span>
  </div>
}

function AppointmentEvent({ info }: { info: EventContentArg }) { const item = info.event.extendedProps.appointment as Appointment; return <div className="event-content"><strong>{item.patient.fullName}</strong><span>{timeLabel(item.startTime)} – {timeLabel(item.endTime)}</span><em>{statusConfig[item.status].label}</em></div> }
function WaitingQueue({ items, selectedId, onSelect }: { items: Appointment[]; selectedId: string | null; onSelect: (id: string) => void }) { return <section className="queue-section"><div className="context-heading"><div><h3>Danh sách chờ</h3><span>{items.length} bệnh nhân</span></div><button className="text-button">Theo thời gian <ChevronDown size={14} /></button></div><div className="queue-list">{items.map((item, index) => <button key={item.id} className={`queue-item ${selectedId === item.id ? 'selected' : ''}`} onClick={() => onSelect(item.id)}><span className="queue-number">{String(index + 1).padStart(2, '0')}</span><span className="queue-patient"><strong>{item.patient.fullName}</strong><small>{timeLabel(item.startTime)} · {item.doctor.fullName.replace('BS. ', '')}</small></span><span className="queue-wait">Chờ {item.checkedInAt ? '5' : '—'}'</span></button>)}{items.length === 0 && <div className="empty-context">Không có bệnh nhân đang chờ.</div>}</div></section> }
function AppointmentDetail({ appointment, onStatusChange, onOpenProfile }: { appointment: Appointment | null; onStatusChange: (status: AppointmentStatus) => void; onOpenProfile: (appointmentId: string) => void }) {
  if (!appointment) return <section className="detail-section"><div className="context-heading"><h3>Chi tiết lịch hẹn</h3></div><div className="empty-context">Chọn một lịch hẹn để xem chi tiết.</div></section>
  const config = statusConfig[appointment.status]
  return <section className="detail-section"><div className="context-heading"><h3>Chi tiết lịch hẹn</h3><button className="icon-button"><X size={15} /></button></div><div className="detail-patient"><div className="detail-avatar"><UserRound size={21} /></div><div><strong>{appointment.patient.fullName}</strong><span>{appointment.patient.code}</span></div></div><a className="phone-link" href={`tel:${appointment.patient.phone}`}><Phone size={14} /> {appointment.patient.phone}</a><span className={`status-badge ${config.className}`}>{config.label}</span><dl className="detail-list"><div><dt>Giờ hẹn</dt><dd>{timeLabel(appointment.startTime)} – {timeLabel(appointment.endTime)}</dd></div><div><dt>Bác sĩ</dt><dd>{appointment.doctor.fullName}</dd></div><div><dt>Lý do khám</dt><dd>{appointment.reason}</dd></div><div><dt>Vào khám</dt><dd>{appointment.checkedInAt ? timeLabel(appointment.checkedInAt) : 'Chưa vào khám'}</dd></div><div><dt>Thời gian chờ</dt><dd>{appointment.status === 'WAITING' ? '5 phút' : '—'}</dd></div></dl><div className="detail-actions"><button className="btn btn-secondary btn-sm" onClick={() => onOpenProfile(appointment.id)}><Search size={14} /> {appointment.status === 'CANCELLED' ? 'Xem chi tiết lý do hủy' : 'Xem hồ sơ'}</button>{appointment.status === 'CONFIRMED' && <><button className="btn btn-primary btn-sm" onClick={() => onStatusChange('WAITING')}>Vào khám</button><button className="btn btn-secondary btn-sm" onClick={() => onStatusChange('CANCELLED')}>Hủy</button></>}{appointment.status === 'WAITING' && <button className="btn btn-secondary btn-sm" onClick={() => onStatusChange('CANCELLED')}>Hủy</button>}{appointment.status === 'IN_PROGRESS' && <span className="detail-state-note">Đang khám</span>}</div></section>
}

function CreateAppointmentModal({ patients, draft, setDraft, onClose, onSubmit, error }: { patients: PatientProfile[]; draft: { patientId: string; doctorId: string; date: string; start: string; end: string; reason: string; note: string }; setDraft: React.Dispatch<React.SetStateAction<typeof draft>>; onClose: () => void; onSubmit: (event: React.FormEvent) => void; error: string }) { return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><form className="appointment-modal" onSubmit={onSubmit}><div className="modal-header"><div><h2>Tạo lịch hẹn</h2><p>Thêm lịch khám vào lịch của bác sĩ.</p></div><button type="button" className="icon-button" onClick={onClose}><X size={18} /></button></div>{error && <div className="form-error">{error}</div>}<div className="modal-grid"><label>Bệnh nhân *<select value={draft.patientId} onChange={(e) => setDraft((d) => ({ ...d, patientId: e.target.value }))}><option value="">Chọn bệnh nhân</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.fullName}</option>)}</select></label><label>Bác sĩ *<select value={draft.doctorId} onChange={(e) => setDraft((d) => ({ ...d, doctorId: e.target.value }))}>{doctors.map((d) => <option key={d.id} value={d.id}>{d.fullName}</option>)}</select></label><label>Ngày *<input type="date" value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} /></label><label>Giờ bắt đầu *<input type="time" value={draft.start} onChange={(e) => setDraft((d) => ({ ...d, start: e.target.value }))} /></label><label>Giờ kết thúc *<input type="time" value={draft.end} onChange={(e) => setDraft((d) => ({ ...d, end: e.target.value }))} /></label><label className="span-two">Lý do khám *<input value={draft.reason} onChange={(e) => setDraft((d) => ({ ...d, reason: e.target.value }))} placeholder="Nhập lý do khám" /></label><label className="span-two">Ghi chú<textarea value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} rows={3} placeholder="Thông tin bổ sung (không bắt buộc)" /></label></div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button><button type="submit" className="btn btn-primary"><CalendarPlus size={16} /> Tạo lịch hẹn</button></div></form></div> }

function ReceptionistPatientDrawer({ appointment, patient, onClose, onEdit }: { appointment: Appointment; patient: PatientProfile; onClose: () => void; onEdit: () => void }) {
  const config = statusConfig[appointment.status]
  return <div className="receptionist-patient-drawer-layer"><aside className="receptionist-patient-drawer" aria-label="Chi tiết bệnh nhân"><header className="receptionist-drawer-header"><h2>Chi tiết bệnh nhân</h2><button className="icon-button" onClick={onClose} aria-label="Đóng chi tiết bệnh nhân"><X size={18} /></button></header><section className="receptionist-patient-profile"><div className="receptionist-profile-avatar">{patientInitials(patient.fullName)}</div><div><h3>{patient.fullName}</h3><div className="receptionist-profile-meta"><span className="gender-badge">{patient.gender}</span><span>{patient.age} tuổi</span><span>{shortDateLabel(patient.dob)}</span></div><strong>{patient.code}</strong><a href={`tel:${patient.phone}`}>{patient.phone}</a><p>{patient.address}</p></div></section><div className="receptionist-drawer-body"><DrawerCard title="Thông tin liên hệ"><InfoRow label="Email" value={patient.email} /><InfoRow label="Địa chỉ" value={patient.address} /><InfoRow label="Số điện thoại" value={patient.phone} /></DrawerCard><DrawerCard title="Thông tin cơ bản"><InfoRow label="Ngày sinh" value={shortDateLabel(patient.dob)} /><InfoRow label="Giới tính" value={patient.gender} /></DrawerCard><DrawerCard title="Lần khám gần nhất"><InfoRow label="Ngày khám" value={shortDateLabel(patient.lastVisit.date)} /><InfoRow label="Bác sĩ" value={patient.lastVisit.doctor} /><InfoRow label="Lý do khám" value={patient.lastVisit.reason} /><button className="future-link" type="button">Xem chi tiết hồ sơ →</button></DrawerCard><DrawerCard title="Lịch hẹn hiện tại" action={<span className={`status-badge ${config.className}`}>{config.label}</span>}><InfoRow label="Thời gian" value={`${timeLabel(appointment.startTime)} – ${timeLabel(appointment.endTime)}`} /><InfoRow label="Bác sĩ" value={appointment.doctor.fullName} /><InfoRow label="Khoa" value={appointment.doctor.department || 'Chưa phân khoa'} /><InfoRow label="Lý do khám" value={appointment.reason} /></DrawerCard></div><footer className="receptionist-drawer-footer"><button className="btn btn-secondary" onClick={onEdit}>Sửa thông tin</button><button className="btn btn-primary" onClick={onClose}>Đóng</button></footer></aside></div>
}

function DrawerCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="receptionist-info-card"><div className="receptionist-card-title"><h3>{title}</h3>{action}</div>{children}</section>
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="receptionist-info-row"><span>{label}</span><strong>{value}</strong></div>
}

function EditPatientModal({ patient, onClose, onSave }: { patient: PatientProfile; onClose: () => void; onSave: (patient: PatientProfile) => void }) {
  const [form, setForm] = useState(patient)
  const handleSubmit = (event: React.FormEvent) => { event.preventDefault(); onSave(form) }
  return <div className="modal-backdrop patient-edit-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><form className="patient-edit-modal" onSubmit={handleSubmit}><div className="modal-header"><div><h2>Sửa thông tin bệnh nhân</h2><p>Chỉ cập nhật thông tin hành chính trong MVP.</p></div><button type="button" className="icon-button" onClick={onClose}><X size={18} /></button></div><div className="patient-edit-grid"><label>Họ và tên<input value={form.fullName} onChange={(e) => setForm((current) => ({ ...current, fullName: e.target.value }))} /></label><label>Mã bệnh nhân<input value={form.code} onChange={(e) => setForm((current) => ({ ...current, code: e.target.value }))} /></label><label>Giới tính<select value={form.gender} onChange={(e) => setForm((current) => ({ ...current, gender: e.target.value as PatientProfile['gender'] }))}><option>Nam</option><option>Nữ</option></select></label><label>Ngày sinh<input type="date" value={form.dob} onChange={(e) => setForm((current) => ({ ...current, dob: e.target.value }))} /></label><label>Số điện thoại<input value={form.phone} onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))} /></label><label>Email<input value={form.email} onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))} /></label><label className="span-two">Địa chỉ<textarea rows={3} value={form.address} onChange={(e) => setForm((current) => ({ ...current, address: e.target.value }))} /></label></div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button><button type="submit" className="btn btn-primary">Lưu thay đổi</button></div></form></div>
}
