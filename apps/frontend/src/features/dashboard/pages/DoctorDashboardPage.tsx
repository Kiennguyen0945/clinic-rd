import { useNavigate } from 'react-router-dom'
import { CalendarDays, CheckCircle2, ChevronRight, Clock3, Play, Stethoscope } from 'lucide-react'

import type { Appointment } from '../../../entities/appointment'
import type { SlotDefinition } from '../../../entities/slot'
import { patientInitials } from '../../../entities/patient'
import { useAuthStore } from '../../../shared/auth/session-store'
import { timeLabel } from '../../../shared/lib/date'
import { useDoctorQueueQuery } from '../../medical-records/model/medical-record.queries'

const HOURS = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '13:00', '14:00']

function dateLabel() {
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date())
}

function statusClass(appointments: Appointment[]) {
  if (appointments.some((item) => item.status === 'IN_PROGRESS')) return 'progress'
  if (appointments.some((item) => item.status === 'WAITING' || item.status === 'CONFIRMED')) return 'waiting'
  if (appointments.some((item) => item.status === 'COMPLETED')) return 'completed'
  return 'empty'
}

function PatientCard({ appointment, action, onOpen }: { appointment: Appointment; action: string; onOpen: () => void }) {
  return <button className="doctor-today-patient" onClick={onOpen}>
    <span className="doctor-today-avatar">{patientInitials(appointment.patient.fullName)}</span>
    <span className="doctor-today-patient-copy">
      <span><strong>{appointment.patient.fullName}</strong><i>{appointment.status === 'IN_PROGRESS' ? 'Đang khám' : 'Chờ khám'}</i></span>
      <small>{appointment.patient.gender} · {appointment.patient.age} tuổi · {appointment.patient.code}</small>
      <small><Clock3 size={13} /> {timeLabel(appointment.startTime)} - {timeLabel(appointment.endTime)} · {appointment.reason || 'Khám tổng quát'}</small>
    </span>
    <span className="doctor-today-action">{action} <ChevronRight size={15} /></span>
  </button>
}

export default function DoctorDashboardPage() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const query = useDoctorQueueQuery(user?.id || '')
  const appointments = query.data?.appointments ?? []
  const slots = query.data?.slots ?? []
  const active = appointments.filter((item) => item.status === 'IN_PROGRESS')
  const waiting = appointments.filter((item) => item.status === 'WAITING')
  const completed = appointments.filter((item) => item.status === 'COMPLETED')
  const relevantTotal = appointments.filter((item) => item.status !== 'CANCELLED').length

  const schedule = HOURS.map((start) => {
    const slot = slots.find((item) => item.start.slice(0, 5) === start)
    const end = `${String(Number(start.slice(0, 2)) + 1).padStart(2, '0')}:00`
    const items = appointments.filter((item) => timeLabel(item.startTime) >= start && timeLabel(item.startTime) < end)
    return { start, end, slot, items, state: statusClass(items) }
  })

  const openAppointment = (appointment: Appointment) => navigate(`/medical-records?appointmentId=${appointment.id}`)
  const openSlot = (slot?: SlotDefinition, start?: string) => navigate(`/medical-records?tab=schedule&${slot ? `slotId=${slot.id}` : `slotStart=${start}`}`)
  const completionRate = relevantTotal ? Math.round(completed.length / relevantTotal * 100) : 0

  return <div className="doctor-today-dashboard">
    <div className="doctor-today-heading">
      <div><h1>Xin chào, BS. {user?.fullName || 'Bác sĩ'} 👋</h1><p>{dateLabel()}</p></div>
      <button className="btn btn-secondary" onClick={() => navigate('/medical-records')}><CalendarDays size={17} /> Xem lịch khám hôm nay</button>
    </div>

    <div className="doctor-today-stats">
      {[
        { Icon: CalendarDays, label: 'Lịch hôm nay', value: relevantTotal, unit: 'Lượt khám', tone: 'blue' },
        { Icon: Clock3, label: 'Đang chờ khám', value: waiting.length, unit: 'Bệnh nhân', tone: 'orange' },
        { Icon: Stethoscope, label: 'Đang khám', value: active.length, unit: 'Bệnh nhân', tone: 'green' },
        { Icon: CheckCircle2, label: 'Đã hoàn thành', value: completed.length, unit: 'Lượt khám', tone: 'purple' },
      ].map(({ Icon, label, value, unit, tone }) => <div className="doctor-today-stat" key={label}>
        <span className={`doctor-today-stat-icon ${tone}`}><Icon size={21} /></span><span><small>{label}</small><strong>{value}</strong><em>{unit}</em></span><ChevronRight size={19} />
      </div>)}
    </div>

    <div className="doctor-today-main">
      <div className="doctor-today-left">
        <section className="doctor-today-panel"><h2>Đang khám ({active.length})</h2><div className="doctor-active-list fixed-two">
          {active.length ? active.map((item) => <PatientCard key={item.id} appointment={item} action="Tiếp tục khám" onOpen={() => openAppointment(item)} />) : <div className="doctor-today-empty">Không có bệnh nhân</div>}
        </div></section>
        <section className="doctor-today-panel"><h2>Danh sách chờ khám ({waiting.length})</h2><div className="doctor-waiting-list fixed-three">
          {waiting.length ? waiting.map((item) => <button key={item.id} className="doctor-waiting-row" onClick={() => openAppointment(item)}><b>{String(item.sequenceNumber).padStart(2, '0')}</b><span><strong>{item.patient.fullName}</strong><small>{item.patient.gender} · {item.patient.age} tuổi · {item.patient.code}</small></span><span>{timeLabel(item.startTime)} - {timeLabel(item.endTime)}</span><span>{item.reason || 'Khám tổng quát'}</span><i><Play size={13} /> Bắt đầu khám</i></button>) : <div className="doctor-today-empty">Không có bệnh nhân</div>}
        </div></section>
      </div>

      <section className="doctor-today-panel doctor-today-schedule"><div className="doctor-today-panel-title"><h2>Lịch trình khám hôm nay</h2><div className="doctor-schedule-legend"><span className="completed">Đã hoàn thành</span><span className="progress">Đang khám</span><span className="waiting">Chờ khám</span><span className="empty">Chưa có lịch</span></div></div><div className="doctor-schedule-list">
        {schedule.map((row) => <button key={row.start} className={`doctor-schedule-row ${row.state}`} onClick={() => openSlot(row.slot, row.start)}><span className="schedule-dot" /><strong>{row.start} - {row.end}</strong><span><b>{row.items.length} / {row.slot?.capacity ?? 4} bệnh nhân</b><small>{row.state === 'completed' ? 'Đã hoàn thành' : row.state === 'progress' ? `${row.items.filter((i) => i.status === 'IN_PROGRESS').length} đang khám` : row.state === 'waiting' ? `${row.items.filter((i) => i.status === 'WAITING').length} đang chờ` : 'Chưa có lịch'}</small></span><ChevronRight size={17} /></button>)}
      </div></section>
    </div>

    <button className="doctor-today-progress" onClick={() => navigate('/medical-records')}>
      <span className="doctor-progress-ring" style={{ '--progress': `${completionRate * 3.6}deg` } as React.CSSProperties}><strong>{completionRate}%</strong></span>
      <span><strong>{completed.length} / {relevantTotal}</strong><small>Lượt khám đã hoàn thành</small></span>
      <span className="doctor-progress-detail"><i className="total">Tổng lượt khám <b>{relevantTotal}</b></i><i className="completed">Đã hoàn thành <b>{completed.length}</b></i><i className="progress">Đang khám <b>{active.length}</b></i><i className="waiting">Đang chờ <b>{waiting.length}</b></i><i className="empty">Chưa đến lượt <b>{appointments.filter((a) => a.status === 'CONFIRMED').length}</b></i></span><ChevronRight size={20} />
    </button>
  </div>
}
