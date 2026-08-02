import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, Check, CheckCircle2, ClipboardList, Clock3,
  FileClock, FileText, FlaskConical, History, LockKeyhole, MoreHorizontal,
  Plus, RefreshCw, Save, Search, Stethoscope, Trash2, UserRound, X,
} from 'lucide-react'
import { appointmentApi } from '../lib/appointmentsApi'
import { useAuthStore } from '../store'
import { QueueGroup, SlotRow } from './appointments/SchedulePanels'
import {
  mapAppointment,
  mapPatient,
  mapSlot,
  statusConfig,
  timeLabel,
  todayValue,
} from './appointments/model'
import type { Appointment, SlotDefinition } from './appointments/model'

type AppointmentStatus = 'WAITING' | 'IN_PROGRESS' | 'COMPLETED'
type OrderType = 'LAB_TEST' | 'IMAGING' | 'PROCEDURE' | 'OTHER'
interface Patient { id: string; code: string; fullName: string; gender: string; dob?: string; age: number; phone: string; address: string; allergy: string; bloodType: string; history: string; chronic: string; note: string }
interface WaitingAppointment { id: string; patient: Patient; time: string; reason: string; status: AppointmentStatus; appointmentCode: string }
interface Prescription { id: string; medicationName: string; dosage: string; quantity: number; unit: string; instructions: string }
interface MedicalOrder { id: string; orderType: OrderType; name: string; purpose: string; instructions: string }

const orderTypeLabels: Record<OrderType, string> = { LAB_TEST: 'Xét nghiệm', IMAGING: 'Chẩn đoán hình ảnh', PROCEDURE: 'Thủ thuật', OTHER: 'Khác' }

interface Draft { symptoms: string; diagnosis: string; icdCode: string; treatmentPlan: string; notes: string; pulse: string; systolic: string; diastolic: string; temperature: string; spo2: string; weight: string; height: string; prescriptions: Prescription[]; orders: MedicalOrder[] }
type MedicationDraft = { medicationName: string; dosage: string; quantity: string; unit: string; instructions: string }
type OrderDraft = { orderType: OrderType; name: string; purpose: string; instructions: string }
const EMPTY_DRAFT: Draft = { symptoms: '', diagnosis: '', icdCode: '', treatmentPlan: '', notes: '', pulse: '78', systolic: '120', diastolic: '80', temperature: '36.7', spo2: '98', weight: '', height: '', prescriptions: [], orders: [] }

function appointmentToVisit(appointment: Appointment): WaitingAppointment {
  return {
    id: appointment.id,
    patient: {
      id: appointment.patient.id,
      code: appointment.patient.code,
      fullName: appointment.patient.fullName,
      gender: appointment.patient.gender,
      dob: appointment.patient.dob,
      age: appointment.patient.age,
      phone: appointment.patient.phone,
      address: appointment.patient.address,
      allergy: 'Chưa cập nhật',
      bloodType: 'Chưa cập nhật',
      history: 'Chưa cập nhật',
      chronic: 'Chưa cập nhật',
      note: '—',
    },
    time: timeLabel(appointment.startTime),
    reason: appointment.reason,
    status: appointment.status as AppointmentStatus,
    appointmentCode: appointment.appointmentCode,
  }
}

export default function MedicalRecordsPage() {
  const user = useAuthStore((s) => s.user)
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<'today' | 'schedule' | 'history'>(searchParams.get('tab') === 'history' ? 'history' : searchParams.get('tab') === 'schedule' ? 'schedule' : 'today')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [slots, setSlots] = useState<SlotDefinition[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [expandedSlotId, setExpandedSlotId] = useState('')
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')
  const [startingId, setStartingId] = useState('')
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [activeVisit, setActiveVisit] = useState<WaitingAppointment | null>(null)
  const [draft, setDraft] = useState<Draft>({ ...EMPTY_DRAFT })
  const [savedAt, setSavedAt] = useState('Chưa lưu nháp')
  const [errors, setErrors] = useState<{ symptoms?: string; diagnosis?: string }>({})
  const [showComplete, setShowComplete] = useState(false)
  const [modal, setModal] = useState<'medication' | 'order' | null>(null)
  const [medication, setMedication] = useState<MedicationDraft>({ medicationName: '', dosage: '', quantity: '1', unit: 'viên', instructions: '' })
  const [order, setOrder] = useState<OrderDraft>({ orderType: 'LAB_TEST', name: '', purpose: '', instructions: '' })
  const [toast, setToast] = useState('')
  const [isPatientDrawerOpen, setIsPatientDrawerOpen] = useState(false)

  const currentDoctor = user?.fullName || 'Nguyễn Minh Đức'

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setPageError('')
      try {
        const date = todayValue()
        const [slotResponse, appointmentResponse, patientResponse] = await Promise.all([
          appointmentApi.slots(date, user.id),
          appointmentApi.appointments(date, user.id),
          appointmentApi.patients({ pageSize: 100 }),
        ])
        if (cancelled) return
        const mappedSlots = slotResponse.slots.map(mapSlot)
        const mappedPatients = patientResponse.patients.map(mapPatient)
        const mappedAppointments = appointmentResponse.appointments.map((item) =>
          mapAppointment(item, mappedPatients, mappedSlots),
        )
        setSlots(mappedSlots)
        setAppointments(mappedAppointments)
        setSelectedId((current) => mappedAppointments.some((item) => item.id === current)
          ? current
          : mappedAppointments.find((item) => item.status === 'IN_PROGRESS')?.id
            || mappedAppointments.find((item) => item.status === 'WAITING')?.id
            || mappedAppointments[0]?.id
            || '')
      } catch (error) {
        if (!cancelled) setPageError(error instanceof Error ? error.message : 'Không thể tải lịch khám hôm nay')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [user?.id, refreshVersion])

  const openVisit = async (appointment: Appointment) => {
    setStartingId(appointment.id)
    setPageError('')
    try {
      let current = appointment
      if (appointment.status === 'WAITING') {
        const response = await appointmentApi.start(Number(appointment.id))
        current = mapAppointment(response.appointment, appointments.map((item) => item.patient), slots)
        setAppointments((items) => items.map((item) => item.id === current.id ? current : item))
      }
      setActiveVisit(appointmentToVisit(current))
      setDraft({ ...EMPTY_DRAFT })
      setErrors({})
      setSavedAt('Chưa lưu nháp')
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Không thể bắt đầu lượt khám')
    } finally {
      setStartingId('')
    }
  }
  const backToDashboard = () => { setActiveVisit(null); setShowComplete(false) }
  const updateDraft = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }))
  const saveDraft = () => { setSavedAt(`Đã lưu lúc ${new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date())}`); setToast('Đã lưu bản nháp bệnh án') }
  const requestComplete = () => { const next: typeof errors = {}; if (!draft.symptoms.trim()) next.symptoms = 'Triệu chứng là bắt buộc'; if (!draft.diagnosis.trim()) next.diagnosis = 'Chẩn đoán là bắt buộc'; setErrors(next); if (Object.keys(next).length === 0) setShowComplete(true) }
  const completeVisit = () => { if (!activeVisit) return; setAppointments((items) => items.map((item) => item.id === activeVisit.id ? { ...item, status: 'COMPLETED' } : item)); setShowComplete(false); setActiveVisit(null); setToast('Đã hoàn thành ca khám'); setActiveTab('today') }
  const addMedication = (event: React.FormEvent) => { event.preventDefault(); if (!medication.medicationName.trim() || !medication.instructions.trim()) return; updateDraft('prescriptions', [...draft.prescriptions, { ...medication, id: `med-${Date.now()}`, quantity: Number(medication.quantity) || 1 }]); setMedication({ medicationName: '', dosage: '', quantity: '1', unit: 'viên', instructions: '' }); setModal(null) }
  const addOrder = (event: React.FormEvent) => { event.preventDefault(); if (!order.name.trim()) return; updateDraft('orders', [...draft.orders, { ...order, id: `order-${Date.now()}` }]); setOrder({ orderType: 'LAB_TEST', name: '', purpose: '', instructions: '' }); setModal(null) }
  const setTab = (tab: 'today' | 'schedule' | 'history') => { setActiveTab(tab); setSearchParams(tab === 'history' ? { tab: 'history' } : tab === 'schedule' ? { tab: 'schedule' } : {}) }

  if (activeVisit) return <>
    <ConsultationWorkspace visit={activeVisit} doctorName={currentDoctor} draft={draft} updateDraft={updateDraft} errors={errors} savedAt={savedAt} onBack={backToDashboard} onSave={saveDraft} onComplete={requestComplete} onRemoveMedication={(id) => updateDraft('prescriptions', draft.prescriptions.filter((item) => item.id !== id))} onRemoveOrder={(id) => updateDraft('orders', draft.orders.filter((item) => item.id !== id))} onAddMedication={() => setModal('medication')} onAddOrder={() => setModal('order')} onOpenPatientDrawer={() => setIsPatientDrawerOpen(true)} />
    {showComplete && <ConfirmModal onCancel={() => setShowComplete(false)} onConfirm={completeVisit} />}
    {modal === 'medication' && <MedicationModal value={medication} setValue={setMedication} onClose={() => setModal(null)} onSubmit={addMedication} />}
    {modal === 'order' && <OrderModal value={order} setValue={setOrder} onClose={() => setModal(null)} onSubmit={addOrder} />}
    {isPatientDrawerOpen && <PatientDetailDrawer patient={activeVisit.patient} onClose={() => setIsPatientDrawerOpen(false)} />}
  </>
  return <>
    <div className="page-header doctor-page-heading"><div><div className="page-title">Khám bệnh</div><div className="page-subtitle">Tiếp nhận và ghi nhận thông tin khám bệnh hôm nay.</div></div><div className="doctor-header-status"><span className="live-dot" /> Phòng khám đang hoạt động</div></div>
    <div className="doctor-tabs"><button className={activeTab === 'today' ? 'active' : ''} onClick={() => setTab('today')}><Stethoscope size={17} /> Khám hôm nay <span>{appointments.filter((item) => item.status === 'WAITING').length}</span></button><button className={activeTab === 'schedule' ? 'active' : ''} onClick={() => setTab('schedule')}><Clock3 size={17} /> Lịch hôm nay</button><button className={activeTab === 'history' ? 'active' : ''} onClick={() => setTab('history')}><History size={17} /> Lịch sử khám</button></div>
    {activeTab === 'history'
      ? <HistoryPanel visits={appointments.filter((item) => item.status === 'COMPLETED').map(appointmentToVisit)} />
      : activeTab === 'schedule'
        ? <DoctorSlotPanel doctorName={currentDoctor} slots={slots} appointments={appointments} expandedSlotId={expandedSlotId} selectedId={selectedId} onToggleSlot={setExpandedSlotId} onSelect={setSelectedId} onRefresh={() => setRefreshVersion((value) => value + 1)} loading={loading} />
        : <DoctorDashboard appointments={appointments} slots={slots} doctorName={currentDoctor} selectedId={selectedId} expandedSlotId={expandedSlotId} loading={loading} error={pageError} startingId={startingId} onSelect={setSelectedId} onToggleSlot={setExpandedSlotId} onStart={openVisit} onRefresh={() => setRefreshVersion((value) => value + 1)} />}
    {toast && <div className="doctor-toast"><CheckCircle2 size={16} /> {toast}</div>}
    {showComplete && <ConfirmModal onCancel={() => setShowComplete(false)} onConfirm={completeVisit} />}
    {modal === 'medication' && <MedicationModal value={medication} setValue={setMedication} onClose={() => setModal(null)} onSubmit={addMedication} />}
    {modal === 'order' && <OrderModal value={order} setValue={setOrder} onClose={() => setModal(null)} onSubmit={addOrder} />}
  </>
}

function DoctorDashboard({ appointments, slots, doctorName, selectedId, expandedSlotId, loading, error, startingId, onSelect, onToggleSlot, onStart, onRefresh }: { appointments: Appointment[]; slots: SlotDefinition[]; doctorName: string; selectedId: string; expandedSlotId: string; loading: boolean; error: string; startingId: string; onSelect: (id: string) => void; onToggleSlot: (id: string) => void; onStart: (appointment: Appointment) => void; onRefresh: () => void }) {
  const waiting = appointments.filter((item) => item.status === 'WAITING')
  const inProgress = appointments.filter((item) => item.status === 'IN_PROGRESS')
  return <div className="doctor-dashboard">
    <div className="doctor-summary-grid doctor-summary-three"><div className="doctor-stat-card"><span className="doctor-stat-icon blue"><ClipboardList size={19} /></span><strong>{waiting.length}</strong><span>Đang chờ khám</span></div><div className="doctor-stat-card"><span className="doctor-stat-icon green"><Stethoscope size={19} /></span><strong>{inProgress.length}</strong><span>Đang khám</span></div><div className="doctor-stat-card"><span className="doctor-stat-icon gray"><CheckCircle2 size={19} /></span><strong>{appointments.filter((item) => item.status === 'COMPLETED').length}</strong><span>Đã hoàn tất hôm nay</span></div></div>
    {error && <div className="form-error">{error}</div>}
    <div className="appointments-grid doctor-schedule-grid">
      <DoctorSlotPanel doctorName={doctorName} slots={slots} appointments={appointments} expandedSlotId={expandedSlotId} selectedId={selectedId} onToggleSlot={onToggleSlot} onSelect={onSelect} onRefresh={onRefresh} loading={loading} />
      <DoctorQueuePanel appointments={appointments} selectedId={selectedId} startingId={startingId} onSelect={onSelect} onStart={onStart} />
    </div>
  </div>
}

function DoctorSlotPanel({ doctorName, slots, appointments, expandedSlotId, selectedId, onToggleSlot, onSelect, onRefresh, loading }: { doctorName: string; slots: SlotDefinition[]; appointments: Appointment[]; expandedSlotId: string; selectedId: string; onToggleSlot: (id: string) => void; onSelect: (id: string) => void; onRefresh: () => void; loading: boolean }) {
  return <section className="slot-panel doctor-slot-panel"><div className="slot-panel-header"><div><h2>{doctorName}</h2><p>Lịch khám hôm nay · {new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date())}</p></div><div className="slot-refresh"><span><Clock3 size={15} /> Cập nhật theo dữ liệu hệ thống</span><button className="icon-button" onClick={onRefresh} aria-label="Làm mới lịch"><RefreshCw size={16} /></button></div></div><div className="slot-legend"><span><i className="legend-dot available" /> Còn chỗ</span><span><i className="legend-dot full" /> Đã đầy</span><span><i className="legend-dot ended" /> Đã qua</span><span><LockKeyhole size={13} /> Đã khóa</span></div><div className="slot-table-head"><span>Khung giờ</span><span>Số suất</span><span>Thao tác</span></div><div className="slot-list">{loading ? <div className="empty-context">Đang tải lịch khám...</div> : slots.length === 0 ? <div className="empty-context">Chưa có khung giờ khám trong hôm nay.</div> : slots.map((slot) => <SlotRow key={slot.id} slot={slot} appointments={appointments.filter((item) => item.slotId === slot.id)} expanded={expandedSlotId === slot.id} selectedId={selectedId} onToggle={() => onToggleSlot(expandedSlotId === slot.id ? '' : slot.id)} onSelectAppointment={onSelect} onCreate={() => undefined} receptionClosed showCreateAction={false} />)}</div></section>
}

function DoctorQueuePanel({ appointments, selectedId, startingId, onSelect, onStart }: { appointments: Appointment[]; selectedId: string; startingId: string; onSelect: (id: string) => void; onStart: (appointment: Appointment) => void }) {
  const [queueTab, setQueueTab] = useState<'IN_PROGRESS' | 'WAITING'>('IN_PROGRESS')
  const [query, setQuery] = useState('')
  const queue = useMemo(() => appointments.filter((item) => (item.status === 'IN_PROGRESS' || item.status === 'WAITING') && `${item.patient.fullName} ${item.patient.phone} ${item.patient.code} ${item.sequenceNumber}`.toLowerCase().includes(query.toLowerCase())), [appointments, query])
  const selected = appointments.find((item) => item.id === selectedId) || null
  const hasActiveVisit = appointments.some((item) => item.status === 'IN_PROGRESS')
  return <aside className="appointments-side doctor-appointments-side"><section className="queue-panel"><div className="side-panel-title"><h2>Danh sách chờ</h2><span className="queue-count">{queue.length} bệnh nhân</span></div><label className="queue-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên, SĐT, mã BN hoặc số khám..." /></label><div className="queue-tabs doctor-queue-tabs"><button className={queueTab === 'IN_PROGRESS' ? 'active' : ''} onClick={() => setQueueTab('IN_PROGRESS')}>Đang khám ({queue.filter((item) => item.status === 'IN_PROGRESS').length})</button><button className={queueTab === 'WAITING' ? 'active' : ''} onClick={() => setQueueTab('WAITING')}>Đang chờ ({queue.filter((item) => item.status === 'WAITING').length})</button></div><QueueGroup items={queue.filter((item) => item.status === queueTab)} selectedId={selectedId} onSelect={onSelect} /></section><section className="detail-panel doctor-visit-detail"><div className="side-panel-title"><h2>Thông tin lượt khám</h2></div>{!selected ? <div className="empty-context">Chọn bệnh nhân để xem thông tin.</div> : <><div className="detail-patient"><div className="detail-avatar"><UserRound size={21} /></div><div><strong>{selected.patient.fullName}</strong><span>{selected.patient.code} · Số khám {String(selected.sequenceNumber).padStart(2, '0')}</span><span>{timeLabel(selected.startTime)} - {timeLabel(selected.endTime)}</span></div></div><span className={`status-badge ${statusConfig[selected.status].className}`}>{statusConfig[selected.status].label}</span><dl className="detail-list"><div><dt>Lý do khám</dt><dd>{selected.reason || 'Chưa cập nhật'}</dd></div><div><dt>Phòng khám</dt><dd>{selected.room}</dd></div><div><dt>Mã lịch hẹn</dt><dd>{selected.appointmentCode}</dd></div></dl>{(selected.status === 'WAITING' || selected.status === 'IN_PROGRESS') && <div className="detail-actions"><button className="btn btn-primary btn-sm doctor-start-button" disabled={Boolean(startingId) || (selected.status === 'WAITING' && hasActiveVisit)} onClick={() => onStart(selected)}>{startingId === selected.id ? 'Đang xử lý...' : selected.status === 'IN_PROGRESS' ? 'Tiếp tục khám' : 'Bắt đầu khám'}</button></div>}</>}</section></aside>
}

function HistoryPanel({ visits }: { visits: WaitingAppointment[] }) { return <section className="doctor-queue-card history-panel"><div className="doctor-section-heading"><div><h3>Lịch sử khám</h3><p>Các ca khám đã hoàn tất trong hôm nay.</p></div><div className="history-search-box"><Search size={15} /><input placeholder="Tìm bệnh nhân" /></div></div>{visits.length === 0 ? <div className="doctor-empty"><FileClock size={38} /><strong>Chưa có ca khám hoàn tất</strong></div> : visits.map((visit) => <div className="history-row" key={visit.id}><span>{visit.time}</span><strong>{visit.patient.fullName}</strong><span>{visit.patient.code}</span><span>{visit.reason}</span><span className="status-pill completed">Đã hoàn tất</span></div>)}</section> }

function ConsultationWorkspace({ visit, doctorName, draft, updateDraft, errors, savedAt, onBack, onSave, onComplete, onRemoveMedication, onRemoveOrder, onAddMedication, onAddOrder, onOpenPatientDrawer }: { visit: WaitingAppointment; doctorName: string; draft: Draft; updateDraft: <K extends keyof Draft>(key: K, value: Draft[K]) => void; errors: { symptoms?: string; diagnosis?: string }; savedAt: string; onBack: () => void; onSave: () => void; onComplete: () => void; onRemoveMedication: (id: string) => void; onRemoveOrder: (id: string) => void; onAddMedication: () => void; onAddOrder: () => void; onOpenPatientDrawer: () => void }) { const patient = visit.patient; return <div className="consultation-page"><div className="consultation-topbar"><button className="back-link" onClick={onBack}><ArrowLeft size={17} /> Quay lại Khám bệnh</button><div className="consultation-top-actions"><button className="btn btn-secondary btn-sm" onClick={onOpenPatientDrawer}><UserRound size={15} /> Xem hồ sơ bệnh nhân</button><button className="icon-button"><MoreHorizontal size={17} /></button></div></div><section className="patient-header-card"><div className="patient-header-main"><div className="patient-large-avatar">NA</div><div><h1>{patient.fullName}</h1><p>{patient.gender} · {patient.age} tuổi</p><div className="patient-quick-info"><span>Mã BN: <b>{patient.code}</b></span><span>{patient.phone}</span><span>{patient.address}</span></div></div></div><div className="patient-appointment-meta"><div><span>Mã lịch hẹn</span><strong>{visit.appointmentCode}</strong></div><div><span>Thời gian hẹn</span><strong>18/07/2026 {visit.time}</strong></div><div><span>Trạng thái</span><b className="status-pill in-progress">ĐANG KHÁM</b></div><div><span>Bác sĩ</span><strong>BS. {doctorName}</strong></div></div></section><div className="clinical-warning"><AlertTriangle size={17} /><span><strong>Dị ứng:</strong> {patient.allergy}</span></div><div className="consultation-tabs"><button className="active">Thông tin khám</button><button>Tiền sử bệnh</button><button>Lịch sử khám</button><button>Ghi chú</button></div><div className="consultation-grid"><aside className="clinical-sidebar"><ClinicalSummary patient={patient} onOpenDrawer={onOpenPatientDrawer} /><div className="visit-reason-card"><h3>Lý do khám</h3><p>{visit.reason}</p></div></aside><main className="consultation-form"><section className="consultation-section"><SectionTitle icon={<Stethoscope size={17} />} title="Nội dung khám" /><label className="clinical-label">Triệu chứng *<textarea className={errors.symptoms ? 'has-error' : ''} rows={4} value={draft.symptoms} onChange={(e) => updateDraft('symptoms', e.target.value)} placeholder="Mô tả triệu chứng, diễn biến bệnh..." />{errors.symptoms && <small className="field-error">{errors.symptoms}</small>}</label><div className="vitals-block"><div className="subsection-title"><span>Dấu hiệu sinh tồn</span><small>Tùy chọn</small></div><div className="vitals-grid">{([['pulse', 'Mạch', 'lần/phút'], ['systolic', 'HA tâm thu', 'mmHg'], ['diastolic', 'HA tâm trương', 'mmHg'], ['temperature', 'Nhiệt độ', '°C'], ['spo2', 'SpO2', '%'], ['weight', 'Cân nặng', 'kg'], ['height', 'Chiều cao', 'cm']] as const).map(([key, label, unit]) => <label key={key}>{label}<div className="input-with-unit"><input type="number" value={draft[key]} onChange={(e) => updateDraft(key, e.target.value)} /><span>{unit}</span></div></label>)}</div></div><div className="diagnosis-grid"><label className="clinical-label">Chẩn đoán *<input className={errors.diagnosis ? 'has-error' : ''} value={draft.diagnosis} onChange={(e) => updateDraft('diagnosis', e.target.value)} placeholder="Nhập chẩn đoán" />{errors.diagnosis && <small className="field-error">{errors.diagnosis}</small>}</label><label className="clinical-label">Mã ICD<input value={draft.icdCode} onChange={(e) => updateDraft('icdCode', e.target.value)} placeholder="Ví dụ: F43.9" /></label></div><label className="clinical-label">Hướng điều trị / Kế hoạch<textarea rows={3} value={draft.treatmentPlan} onChange={(e) => updateDraft('treatmentPlan', e.target.value)} placeholder="Nhập kế hoạch điều trị..." /></label></section><PrescriptionSection items={draft.prescriptions} onAdd={onAddMedication} onRemove={onRemoveMedication} /><OrdersSection items={draft.orders} onAdd={onAddOrder} onRemove={onRemoveOrder} /><section className="consultation-section"><label className="clinical-label">Ghi chú thêm<textarea rows={3} value={draft.notes} onChange={(e) => updateDraft('notes', e.target.value)} placeholder="Ghi chú nội bộ cho ca khám" /></label></section></main></div><div className="consultation-actionbar"><div className="save-state"><button className="btn btn-secondary" onClick={onSave}><Save size={16} /> Lưu nháp</button><span><Check size={14} /> {savedAt}</span></div><button className="btn btn-primary btn-lg" onClick={onComplete}>Hoàn thành ca khám</button></div></div> }

function ClinicalSummary({ patient, onOpenDrawer }: { patient: Patient; onOpenDrawer: () => void }) { return <section className="clinical-summary-card"><div className="doctor-section-heading"><h3>Thông tin bệnh nhân</h3></div><dl className="clinical-summary-list"><div><dt>Dị ứng</dt><dd className={patient.allergy !== 'Không ghi nhận' ? 'warning-text' : ''}>{patient.allergy}</dd></div><div><dt>Nhóm máu</dt><dd>{patient.bloodType}</dd></div><div><dt>Tiền sử bệnh</dt><dd>{patient.history}</dd></div><div><dt>Bệnh nền khác</dt><dd>{patient.chronic}</dd></div><div><dt>Ghi chú</dt><dd>{patient.note}</dd></div></dl><button className="drawer-open-button" onClick={onOpenDrawer}>Xem chi tiết hồ sơ</button></section> }
function PatientDetailDrawer({ patient, onClose }: { patient: Patient; onClose: () => void }) { const [expanded, setExpanded] = useState<'overview' | 'history' | 'medications' | 'orders'>('overview'); return <div className="consultation-drawer-layer"><aside className="consultation-drawer"><div className="consultation-drawer-header"><div><span>Hồ sơ bệnh nhân</span><h2>{patient.fullName}</h2></div><button className="icon-button" onClick={onClose} aria-label="Đóng hồ sơ"><X size={18} /></button></div><div className="consultation-drawer-profile"><div className="patient-large-avatar">{patient.fullName.split(' ').slice(-1)[0][0]}</div><div><strong>{patient.gender} · {patient.age} tuổi</strong><span>{patient.dob}</span><span>{patient.code} · {patient.phone}</span><span>{patient.address}</span></div></div><div className="consultation-drawer-content"><DrawerSection title="Tổng quan" expanded={expanded === 'overview'} onToggle={() => setExpanded(expanded === 'overview' ? 'history' : 'overview')} action=""><div className="drawer-summary-grid"><div><span>Nhóm máu</span><strong>{patient.bloodType}</strong></div><div><span>Dị ứng</span><strong className={patient.allergy !== 'Không ghi nhận' ? 'warning-text' : ''}>{patient.allergy}</strong></div><div><span>Bệnh nền</span><strong>{patient.chronic}</strong></div><div><span>Ghi chú</span><strong>{patient.note}</strong></div></div><div className="drawer-overview-stats"><div><span>Tổng số lần khám</span><strong>12</strong></div><div><span>Lần khám gần nhất</span><strong>18/07/2026</strong></div><div><span>Bác sĩ khám nhiều nhất</span><strong>BS. Nguyễn Minh Đức</strong></div></div><div className="drawer-note-card"><span>Ghi chú</span><p>{patient.note}</p></div></DrawerSection><DrawerSection title="Lịch sử khám" expanded={expanded === 'history'} onToggle={() => setExpanded(expanded === 'history' ? 'overview' : 'history')} action="Xem 12 lần khám">{expanded === 'history' && <div className="drawer-history-list"><div><strong>18/07/2026</strong><span>BS. Nguyễn Minh Đức · Đau đầu, chóng mặt</span><b>Khám định kỳ</b></div><div><strong>02/06/2026</strong><span>BS. Trần Thị Mai · Tái khám</span><b>Viêm dạ dày</b></div></div>}</DrawerSection><DrawerSection title="Đơn thuốc gần nhất" expanded={expanded === 'medications'} onToggle={() => setExpanded(expanded === 'medications' ? 'overview' : 'medications')} action="Xem 8 đơn thuốc">{expanded === 'medications' && <div className="drawer-history-list"><div><strong>18/07/2026</strong><span>BS. Nguyễn Minh Đức</span><b>Chưa có đơn thuốc</b></div></div>}</DrawerSection><DrawerSection title="Chỉ định gần nhất" expanded={expanded === 'orders'} onToggle={() => setExpanded(expanded === 'overview' ? 'overview' : 'orders')} action="Xem 8 chỉ định">{expanded === 'orders' && <div className="drawer-history-list"><div><strong>18/07/2026</strong><span>Xét nghiệm</span><b>Chưa có chỉ định</b></div></div>}</DrawerSection></div><div className="consultation-drawer-footer"><button className="btn btn-secondary btn-block" onClick={onClose}>Đóng</button></div></aside></div> }
function DrawerSection({ title, action, expanded, onToggle, children }: { title: string; action: string; expanded: boolean; onToggle: () => void; children: React.ReactNode }) { return <section className={`drawer-accordion ${expanded ? 'expanded' : ''}`}><button className="drawer-accordion-trigger" onClick={onToggle}><strong>{title}</strong><span>{action}</span><b>{expanded ? '⌃' : '⌄'}</b></button>{expanded && <div className="drawer-accordion-body">{children}</div>}</section> }
function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) { return <div className="consultation-section-title">{icon}<h2>{title}</h2></div> }
function PrescriptionSection({ items, onAdd, onRemove }: { items: Prescription[]; onAdd: () => void; onRemove: (id: string) => void }) { return <section className="consultation-section compact-section"><SectionTitle icon={<FileText size={17} />} title="Đơn thuốc" /><button className="section-add-button" onClick={onAdd}><Plus size={15} /> Thêm thuốc</button>{items.length === 0 ? <div className="section-empty">Chưa có thuốc được kê. Đơn thuốc là tùy chọn.</div> : <div className="clinical-table"><div className="clinical-table-head"><span>Tên thuốc</span><span>Liều dùng</span><span>Số lượng</span><span>Cách dùng</span><span /></div>{items.map((item) => <div className="clinical-table-row" key={item.id}><strong>{item.medicationName}</strong><span>{item.dosage || '—'}</span><span>{item.quantity} {item.unit}</span><span>{item.instructions}</span><button onClick={() => onRemove(item.id)} aria-label="Xóa thuốc"><Trash2 size={15} /></button></div>)}</div>}</section> }
function OrdersSection({ items, onAdd, onRemove }: { items: MedicalOrder[]; onAdd: () => void; onRemove: (id: string) => void }) { return <section className="consultation-section compact-section"><SectionTitle icon={<FlaskConical size={17} />} title="Chỉ định" /><button className="section-add-button" onClick={onAdd}><Plus size={15} /> Thêm chỉ định</button>{items.length === 0 ? <div className="section-empty">Chưa có chỉ định. Chỉ định là tùy chọn.</div> : <div className="clinical-table"><div className="clinical-table-head"><span>Loại</span><span>Tên chỉ định</span><span>Mục đích</span><span>Hướng dẫn</span><span /></div>{items.map((item) => <div className="clinical-table-row" key={item.id}><strong>{orderTypeLabels[item.orderType]}</strong><span>{item.name}</span><span>{item.purpose || '—'}</span><span>{item.instructions || '—'}</span><button onClick={() => onRemove(item.id)} aria-label="Xóa chỉ định"><Trash2 size={15} /></button></div>)}</div>}</section> }

function ConfirmModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) { return <div className="modal-backdrop"><div className="doctor-confirm-modal"><div className="confirm-icon"><CheckCircle2 size={25} /></div><h2>Hoàn thành ca khám?</h2><p>Sau khi hoàn thành, hồ sơ khám sẽ được khóa và bệnh nhân được chuyển sang trạng thái hoàn tất.</p><div className="modal-footer"><button className="btn btn-secondary" onClick={onCancel}>Quay lại</button><button className="btn btn-primary" onClick={onConfirm}>Hoàn thành</button></div></div></div> }
function MedicationModal({ value, setValue, onClose, onSubmit }: { value: MedicationDraft; setValue: React.Dispatch<React.SetStateAction<MedicationDraft>>; onClose: () => void; onSubmit: (event: React.FormEvent) => void }) { return <div className="modal-backdrop"><form className="doctor-form-modal" onSubmit={onSubmit}><div className="modal-header"><div><h2>Thêm thuốc</h2><p>Nhập thông tin thuốc cho đơn khám.</p></div><button type="button" className="icon-button" onClick={onClose}><X size={18} /></button></div><div className="doctor-modal-fields"><label>Tên thuốc *<input autoFocus value={value.medicationName} onChange={(e) => setValue((v) => ({ ...v, medicationName: e.target.value }))} placeholder="Ví dụ: Paracetamol 500mg" /></label><label>Liều dùng<input value={value.dosage} onChange={(e) => setValue((v) => ({ ...v, dosage: e.target.value }))} placeholder="500mg" /></label><label>Số lượng *<input type="number" min="1" value={value.quantity} onChange={(e) => setValue((v) => ({ ...v, quantity: e.target.value }))} /></label><label>Đơn vị<input value={value.unit} onChange={(e) => setValue((v) => ({ ...v, unit: e.target.value }))} /></label><label className="span-two">Cách dùng *<textarea rows={2} value={value.instructions} onChange={(e) => setValue((v) => ({ ...v, instructions: e.target.value }))} placeholder="Uống 1 viên sau ăn" /></label></div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button><button className="btn btn-primary" type="submit">Thêm thuốc</button></div></form></div> }
function OrderModal({ value, setValue, onClose, onSubmit }: { value: OrderDraft; setValue: React.Dispatch<React.SetStateAction<OrderDraft>>; onClose: () => void; onSubmit: (event: React.FormEvent) => void }) { return <div className="modal-backdrop"><form className="doctor-form-modal" onSubmit={onSubmit}><div className="modal-header"><div><h2>Thêm chỉ định</h2><p>Ghi nhận xét nghiệm hoặc chỉ định cần thực hiện.</p></div><button type="button" className="icon-button" onClick={onClose}><X size={18} /></button></div><div className="doctor-modal-fields"><label>Loại chỉ định<select value={value.orderType} onChange={(e) => setValue((v) => ({ ...v, orderType: e.target.value as OrderType }))}>{Object.entries(orderTypeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="span-two">Tên chỉ định *<input autoFocus value={value.name} onChange={(e) => setValue((v) => ({ ...v, name: e.target.value }))} placeholder="Ví dụ: Công thức máu" /></label><label>Mục đích<input value={value.purpose} onChange={(e) => setValue((v) => ({ ...v, purpose: e.target.value }))} placeholder="Đánh giá thiếu máu" /></label><label>Hướng dẫn / Ghi chú<input value={value.instructions} onChange={(e) => setValue((v) => ({ ...v, instructions: e.target.value }))} placeholder="Nhịn ăn sáng" /></label></div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button><button className="btn btn-primary" type="submit">Thêm chỉ định</button></div></form></div> }
