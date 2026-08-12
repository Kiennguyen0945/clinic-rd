import { useState } from 'react'
import {
  ChevronDown, ChevronLeft, ChevronRight, Clock3, Filter, LockKeyhole,
  Plus, RefreshCw, Search, Settings2, Stethoscope,
} from 'lucide-react'

import type { Appointment, AppointmentStatus } from '../../../../entities/appointment'
import type { SlotDefinition } from '../../../../entities/slot'
import { todayValue } from '../../../../shared/lib/date'
import { QuickDatePicker } from '../overview/AppointmentOverview'
import { AppointmentDetail, QueueGroup, SlotRow } from './SchedulePanels'

interface Props {
  userName: string
  doctor: { fullName: string; department: string }
  activeDoctorId: string
  selectedDate: string
  setSelectedDate: (date: string) => void
  closeSchedule: () => void
  openBooking: () => void
  error: string
  slots: SlotDefinition[]
  appointments: Appointment[]
  queue: Appointment[]
  query: string
  setQuery: (query: string) => void
  selectedId: string
  selectedAppointment: Appointment | null
  expandedSlotId: string
  setExpandedSlotId: React.Dispatch<React.SetStateAction<string>>
  setSelectedId: React.Dispatch<React.SetStateAction<string>>
  openSlot: (slot: SlotDefinition) => void
  refresh: () => unknown
  openProfile: (id: string) => void
  editPatient: () => void
  reschedule: () => void
  updateStatus: (status: AppointmentStatus) => void
}

export function DoctorScheduleView(props: Props) {
  const [queueTab, setQueueTab] = useState<'WAITING' | 'CONFIRMED'>('WAITING')
  const moveDate = (amount: number) => {
    const date = new Date(`${props.selectedDate}T12:00:00`)
    date.setDate(date.getDate() + amount)
    props.setSelectedDate(date.toISOString().slice(0, 10))
  }

  return <div className="appointments-page appointments-redesign">
    <header className="appointments-heading">
      <div>
        <button className="appointment-back-button" onClick={props.closeSchedule}>← Tổng quan lịch hẹn</button>
        <h1 className="page-title">Lịch hẹn</h1>
        <p className="page-subtitle">Lịch khám chi tiết của {props.doctor.fullName}.</p>
      </div>
      <button className="btn btn-primary appointments-create-btn" onClick={props.openBooking}>
        <Plus size={18} /> Tạo lịch hẹn <ChevronDown size={15} />
      </button>
    </header>
    <nav className="appointment-tabs">
      <button onClick={props.closeSchedule}>Tổng quan lịch hẹn</button>
      <button className="active">Lịch chi tiết</button><button>Bảng tuần</button><button>Bảng ngày</button>
    </nav>
    <div className="appointment-toolbar screenshot-toolbar">
      <div className="date-controls">
        <button className="btn btn-secondary btn-sm" onClick={() => props.setSelectedDate(todayValue())}>Hôm nay</button>
        <button className="icon-button" onClick={() => moveDate(-1)} aria-label="Ngày trước"><ChevronLeft size={18} /></button>
        <button className="icon-button" onClick={() => moveDate(1)} aria-label="Ngày sau"><ChevronRight size={18} /></button>
        <QuickDatePicker selectedDate={props.selectedDate} onSelect={props.setSelectedDate} />
      </div>
      <div className="appointment-filters">
        <label className="locked-filter"><Stethoscope size={15} />
          <select value={props.activeDoctorId} disabled aria-label="Bác sĩ đang xem"><option>{props.doctor.fullName}</option></select>
        </label>
        <label className="locked-filter"><Filter size={15} />
          <select value={props.doctor.department} disabled aria-label="Khoa của bác sĩ đang xem"><option>{props.doctor.department}</option></select>
        </label>
        <button className="icon-button" aria-label="Cài đặt bộ lọc"><Settings2 size={17} /></button>
      </div>
    </div>
    {props.error && <div className="form-error">{props.error}</div>}
    <main className="appointments-grid">
      <section className="slot-panel reception-slot-panel">
        <div className="slot-panel-header"><div><h2>{props.doctor.fullName}</h2><p>{props.doctor.department} · Lịch dự kiến</p></div>
          <div className="slot-refresh"><span><Clock3 size={15} /> Cập nhật tự động mỗi 30 giây</span>
            <button className="icon-button" aria-label="Làm mới" onClick={() => void props.refresh()}><RefreshCw size={16} /></button>
          </div>
        </div>
        <div className="slot-legend">
          <span><i className="legend-dot available" /> Còn chỗ</span><span><i className="legend-dot full" /> Full</span>
          <span><i className="legend-dot ended" /> Đã qua</span><span><LockKeyhole size={13} /> Đã khóa</span>
        </div>
        <div className="slot-table-head"><span>Khung giờ</span><span>Số suất</span><span>Thao tác</span></div>
        <div className="slot-list">{props.slots.map((slot) => <SlotRow
          key={slot.id} slot={slot} appointments={props.appointments.filter((item) => item.slotId === slot.id)}
          expanded={props.expandedSlotId === slot.id}
          onToggle={() => props.setExpandedSlotId((current) => current === slot.id ? '' : slot.id)}
          onSelectAppointment={props.setSelectedId} selectedId={props.selectedId}
          onCreate={props.openSlot} receptionClosed={false}
        />)}</div>
        <div className="slot-footer-note"><Clock3 size={14} /> Ngừng tiếp nhận bệnh nhân mới từ 16:00 mỗi ngày.</div>
      </section>
      <aside className="appointments-side">
        <section className="queue-panel">
          <div className="side-panel-title"><h2>Danh sách chờ</h2></div>
          <label className="queue-search"><Search size={16} /><input value={props.query} onChange={(event) => props.setQuery(event.target.value)} placeholder="Tìm tên, SĐT, mã BN hoặc số khám..." /></label>
          <div className="queue-tabs">
            <button className={queueTab === 'WAITING' ? 'active' : ''} onClick={() => setQueueTab('WAITING')}>Đang chờ ({props.queue.filter((item) => item.status === 'WAITING').length})</button>
            <button className={queueTab === 'CONFIRMED' ? 'active' : ''} onClick={() => setQueueTab('CONFIRMED')}>Đã xác nhận ({props.queue.filter((item) => item.status === 'CONFIRMED').length})</button>
          </div>
          <QueueGroup items={props.queue.filter((item) => item.status === queueTab)} selectedId={props.selectedId} onSelect={props.setSelectedId} />
        </section>
        <AppointmentDetail appointment={props.selectedAppointment} onOpenProfile={props.openProfile}
          onEditPatient={props.editPatient} onEditAppointment={props.reschedule} onStatusChange={props.updateStatus} />
      </aside>
    </main>
    <div className="mock-api-hint"><span className="mock-dot" /> Dữ liệu đồng bộ từ hệ thống</div>
    <span className="sr-only">Đang đăng nhập: {props.userName || 'Lễ tân'}</span>
  </div>
}
