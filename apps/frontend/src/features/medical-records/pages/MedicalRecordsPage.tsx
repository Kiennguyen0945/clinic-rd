import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Activity, ArrowLeft, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronUp,
  ClipboardList, Clock3, FileClock, FileText, History, LockKeyhole,
  MoreHorizontal, PenLine, Pill, Plus, RefreshCw, Save, Search, Stethoscope,
  Trash2, UserRound, X,
} from 'lucide-react'
import { appointmentApi, mapAppointment, statusConfig } from '../../../entities/appointment'
import type { Appointment } from '../../../entities/appointment'
import { patientInitials } from '../../../entities/patient'
import type { SlotDefinition } from '../../../entities/slot'
import { medicalRecordApi } from '../../../entities/medical-record'
import type { ApiMedicalRecordHistoryItem } from '../../../entities/medical-record'
import PatientProfileDrawer from '../../../entities/patient/ui/PatientProfileDrawer'
import { useAuthStore } from '../../../shared/auth/session-store'
import { shortDateLabel, timeLabel } from '../../../shared/lib/date'
import { QueueGroup, SlotRow } from '../../appointments/components/schedule/SchedulePanels'
import {
  EMPTY_CONSULTATION_DRAFT, EMPTY_MEDICATION, draftFromMedicalRecord,
  parseVitalSigns, validateConsultation,
} from '../model/consultation.schema'
import type {
  AppointmentStatus, ConsultationDraft as Draft, MedicationDraft, OrderDraft,
  OrderType, Patient, Prescription, WaitingAppointment,
} from '../model/consultation.schema'
import { useDoctorQueueQuery } from '../model/medical-record.queries'

const orderTypeLabels: Record<OrderType, string> = { LAB_TEST: 'Xét nghiệm', IMAGING: 'Chẩn đoán hình ảnh', PROCEDURE: 'Thủ thuật', OTHER: 'Khác' }
function formatSavedAt(value: string) {
  return `Đã lưu lúc ${new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))}`
}

function doctorLabel(name: string) {
  return name.trim().startsWith('BS.') ? name : `BS. ${name}`
}

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
      email: appointment.patient.email,
      cccd: appointment.patient.cccd,
      insuranceNumber: appointment.patient.insuranceNumber,
      address: appointment.patient.address,
      allergy: 'Chưa cập nhật',
      bloodType: 'Chưa cập nhật',
      history: 'Chưa cập nhật',
      chronic: 'Chưa cập nhật',
      note: '—',
    },
    date: appointment.startTime.slice(0, 10),
    time: timeLabel(appointment.startTime),
    endTime: timeLabel(appointment.endTime),
    reason: appointment.reason,
    status: appointment.status as AppointmentStatus,
    appointmentCode: appointment.appointmentCode,
    sequenceNumber: appointment.sequenceNumber,
    appointmentType: appointment.appointmentType,
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
  const [pageError, setPageError] = useState('')
  const [startingId, setStartingId] = useState('')
  const [activeVisit, setActiveVisit] = useState<WaitingAppointment | null>(null)
  const [draft, setDraft] = useState<Draft>({ ...EMPTY_CONSULTATION_DRAFT })
  const [medicalRecordId, setMedicalRecordId] = useState<number | null>(null)
  const [medicalRecordStatus, setMedicalRecordStatus] = useState<'DRAFT' | 'SIGNED'>('DRAFT')
  const [medicalRecordError, setMedicalRecordError] = useState('')
  const [savingRecord, setSavingRecord] = useState(false)
  const [savedAt, setSavedAt] = useState('Chưa lưu nháp')
  const [errors, setErrors] = useState<{ diagnosis?: string }>({})
  const [showComplete, setShowComplete] = useState(false)
  const [modal, setModal] = useState<'medication' | 'order' | null>(null)
  const [medication, setMedication] = useState<MedicationDraft>({ ...EMPTY_MEDICATION })
  const [editingMedicationId, setEditingMedicationId] = useState<string | null>(null)
  const [order, setOrder] = useState<OrderDraft>({ orderType: 'LAB_TEST', name: '', purpose: '', instructions: '' })
  const [toast, setToast] = useState('')
  const [profilePatient, setProfilePatient] = useState<Patient | null>(null)
  const locallyCancelledIds = useRef(new Set<string>())
  const locallyCompletedIds = useRef(new Set<string>())
  const completedDrafts = useRef(new Map<string, Draft>())

  const currentDoctor = user?.fullName || 'Nguyễn Minh Đức'
  const queueQuery = useDoctorQueueQuery(user?.id || '')
  const loading = queueQuery.isLoading
  const queueError = queueQuery.error instanceof Error
    ? queueQuery.error.message
    : queueQuery.error ? 'Không thể tải lịch khám hôm nay.' : ''

  useEffect(() => {
    if (!toast) return
    const timeoutId = window.setTimeout(() => setToast(''), 3500)
    return () => window.clearTimeout(timeoutId)
  }, [toast])

  /* eslint-disable react-hooks/set-state-in-effect */
  useLayoutEffect(() => {
    if (!queueQuery.data) return
    setSlots(queueQuery.data.slots)
    const nextAppointments = queueQuery.data.appointments.map((appointment) => {
      if (locallyCancelledIds.current.has(appointment.id)) return { ...appointment, status: 'CANCELLED' as const }
      if (locallyCompletedIds.current.has(appointment.id)) return { ...appointment, status: 'COMPLETED' as const }
      return appointment
    })
    setAppointments(nextAppointments)
    setPageError('')
    setSelectedId((current) => nextAppointments.some((item) => item.id === current)
      ? current
      : nextAppointments.find((item) => item.status === 'IN_PROGRESS')?.id
        || nextAppointments.find((item) => item.status === 'WAITING')?.id
        || nextAppointments[0]?.id
        || '')
  }, [queueQuery.data])
  /* eslint-enable react-hooks/set-state-in-effect */

  const openVisit = async (appointment: Appointment) => {
    setStartingId(appointment.id)
    setPageError('')
    setMedicalRecordError('')
    try {
      let current = appointment
      if (appointment.status === 'WAITING') {
        const response = await appointmentApi.start(Number(appointment.id))
        current = mapAppointment(response.appointment, appointments.map((item) => item.patient), slots)
        setAppointments((items) => items.map((item) => item.id === current.id ? current : item))
      }
      const record = await medicalRecordApi.getByAppointment(Number(current.id))
      setMedicalRecordId(record.id)
      setMedicalRecordStatus(record.status)
      setDraft(draftFromMedicalRecord(record))
      setSavedAt(formatSavedAt(record.updatedAt))
      setActiveVisit(appointmentToVisit(current))
      setErrors({})
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Không thể bắt đầu lượt khám')
    } finally {
      setStartingId('')
    }
  }
  const backToDashboard = () => { setActiveVisit(null); setShowComplete(false); setMedicalRecordError('') }
  const updateDraft = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }))
  const persistDraft = async (showSuccess: boolean) => {
    if (!activeVisit) return null
    if (!medicalRecordId) {
      setMedicalRecordError('Chưa xác định được hồ sơ bệnh án cần lưu.')
      return null
    }
    if (medicalRecordStatus === 'SIGNED') {
      setMedicalRecordError('Hồ sơ đã ký, không thể chỉnh sửa.')
      return null
    }
    setSavingRecord(true)
    setMedicalRecordError('')
    try {
      await medicalRecordApi.update(medicalRecordId, {
        illnessHistory: draft.illnessHistory,
        vitalSigns: JSON.stringify({ pulse: draft.pulse, systolic: draft.systolic, diastolic: draft.diastolic, temperature: draft.temperature, spo2: draft.spo2, weight: draft.weight, height: draft.height }),
        examinationNote: draft.symptoms,
        diagnosis: draft.diagnosis,
      })
      const record = await medicalRecordApi.replacePrescription(medicalRecordId, draft.prescriptions.map((item) => ({ medicationName: item.medicationName, dosage: item.dosage, durationDays: item.durationDays, quantity: item.quantity, instructions: item.instructions })))
      setDraft(draftFromMedicalRecord(record))
      setMedicalRecordStatus(record.status)
      setSavedAt(formatSavedAt(record.updatedAt))
      if (showSuccess) setToast('Đã lưu bản nháp bệnh án')
      return record
    } catch (error) {
      setMedicalRecordError(error instanceof Error ? error.message : 'Không thể lưu hồ sơ bệnh án')
      return null
    } finally {
      setSavingRecord(false)
    }
  }
  const saveDraft = () => { void persistDraft(true) }
  const requestComplete = () => { const next = validateConsultation(draft); setErrors(next); if (Object.keys(next).length === 0) setShowComplete(true) }
  const completeVisit = async () => {
    if (!activeVisit) return
    setShowComplete(false)
    const savedRecord = await persistDraft(false)
    if (!savedRecord) return
    try {
      setSavingRecord(true)
      setMedicalRecordError('')
      const signedRecord = await medicalRecordApi.sign(savedRecord.id)
      setMedicalRecordStatus(signedRecord.status)
    } catch (error) {
      setMedicalRecordError(error instanceof Error ? error.message : 'Không thể ký hồ sơ bệnh án')
      return
    } finally {
      setSavingRecord(false)
    }
    completedDrafts.current.set(activeVisit.id, { ...draft, prescriptions: draft.prescriptions.map((item) => ({ ...item })), orders: draft.orders.map((item) => ({ ...item })) })
    locallyCompletedIds.current.add(activeVisit.id)
    setAppointments((items) => items.map((item) => item.id === activeVisit.id ? { ...item, status: 'COMPLETED' } : item))
    setActiveVisit(null)
    setToast('Đã ký và hoàn thành ca khám')
    setActiveTab('today')
  }
  const openCompletedMedicalRecord = async (appointment: Appointment) => {
    setStartingId(appointment.id)
    setPageError('')
    setMedicalRecordError('')
    try {
      const cachedDraft = completedDrafts.current.get(appointment.id)
      if (cachedDraft) {
        setMedicalRecordId(null)
        setDraft({ ...cachedDraft, prescriptions: cachedDraft.prescriptions.map((item) => ({ ...item })), orders: cachedDraft.orders.map((item) => ({ ...item })) })
      } else {
        const history = await medicalRecordApi.historyByPatient(Number(appointment.patient.id))
        const record = history.find((item) => item.appointmentId === Number(appointment.id))
        if (!record) throw new Error('Không tìm thấy hồ sơ bệnh án của lượt khám này')
        setMedicalRecordId(record.id)
        setDraft({ ...EMPTY_CONSULTATION_DRAFT, illnessHistory: record.symptoms || '', symptoms: record.notes || '', diagnosis: record.diagnosis || '' })
      }
      setMedicalRecordStatus('SIGNED')
      setSavedAt('Hồ sơ đã hoàn thành')
      setErrors({})
      setActiveVisit(appointmentToVisit(appointment))
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Không thể tải hồ sơ bệnh án')
    } finally {
      setStartingId('')
    }
  }
  const openHistoryMedicalRecord = (patient: Patient, record: ApiMedicalRecordHistoryItem) => {
    setMedicalRecordId(record.id)
    setMedicalRecordStatus('SIGNED')
    setMedicalRecordError('')
    setSavedAt('Hồ sơ đã hoàn thành')
    setDraft({
      ...EMPTY_CONSULTATION_DRAFT,
      ...parseVitalSigns(record.vitalSigns || ''),
      illnessHistory: record.symptoms || '',
      symptoms: record.notes || '',
      diagnosis: record.diagnosis || '',
      prescriptions: record.prescription?.items.map((item) => ({ ...item, id: String(item.id), unit: 'viên' })) || [],
    })
    setErrors({})
    setProfilePatient(null)
    setActiveVisit({ id: String(record.appointmentId), patient, date: record.visitDate.slice(0, 10), time: record.startTime, endTime: record.endTime, reason: record.reason || '', status: 'COMPLETED', appointmentCode: record.appointmentCode || `#${record.appointmentId}`, sequenceNumber: record.sequenceNumber || 0, appointmentType: record.bookingType === 'WALK_IN' ? 'WALK_IN' : 'SCHEDULED' })
  }
  const cancelVisit = (appointment: Appointment) => { locallyCancelledIds.current.add(appointment.id); setAppointments((items) => items.map((item) => item.id === appointment.id ? { ...item, status: 'CANCELLED' } : item)); setSelectedId((current) => current === appointment.id ? '' : current); setToast('Đã hủy lượt khám trên giao diện thử nghiệm') }
  const openAddMedication = () => { setEditingMedicationId(null); setMedication({ ...EMPTY_MEDICATION }); setModal('medication') }
  const openEditMedication = (item: Prescription) => { setEditingMedicationId(item.id); setMedication({ medicationName: item.medicationName, dosage: item.dosage, durationDays: String(item.durationDays), quantity: String(item.quantity), unit: item.unit, instructions: item.instructions }); setModal('medication') }
  const closeMedicationModal = () => { setEditingMedicationId(null); setModal(null) }
  const addMedication = (event: React.FormEvent) => {
    event.preventDefault()
    if (!medication.medicationName.trim() || !medication.instructions.trim()) return
    const normalized: Prescription = { ...medication, id: editingMedicationId || `med-${Date.now()}`, durationDays: Number(medication.durationDays) || 0, quantity: Number(medication.quantity) || 1 }
    updateDraft('prescriptions', editingMedicationId ? draft.prescriptions.map((item) => item.id === editingMedicationId ? normalized : item) : [...draft.prescriptions, normalized])
    setToast(editingMedicationId ? 'Đã cập nhật thuốc' : 'Đã thêm thuốc vào đơn')
    setMedication({ ...EMPTY_MEDICATION })
    setEditingMedicationId(null)
    setModal(null)
  }
  const addOrder = (event: React.FormEvent) => { event.preventDefault(); if (!order.name.trim()) return; updateDraft('orders', [...draft.orders, { ...order, id: `order-${Date.now()}` }]); setOrder({ orderType: 'LAB_TEST', name: '', purpose: '', instructions: '' }); setModal(null) }
  const setTab = (tab: 'today' | 'schedule' | 'history') => { setActiveTab(tab); setSearchParams(tab === 'history' ? { tab: 'history' } : tab === 'schedule' ? { tab: 'schedule' } : {}) }
  const displayedAppointments = appointments.length
    ? appointments
    : queueQuery.data?.appointments ?? []
  const displayedSlots = slots.length ? slots : queueQuery.data?.slots ?? []
  const displayedSelectedId = selectedId
    || displayedAppointments.find((item) => item.status === 'IN_PROGRESS')?.id
    || displayedAppointments.find((item) => item.status === 'WAITING')?.id
    || displayedAppointments[0]?.id
    || ''

  if (activeVisit) return <>
    <ConsultationWorkspace visit={activeVisit} doctorName={currentDoctor} draft={draft} updateDraft={updateDraft} errors={errors} savedAt={savedAt} recordError={medicalRecordError} recordStatus={medicalRecordStatus} saving={savingRecord} onBack={backToDashboard} onSave={saveDraft} onComplete={requestComplete} onRemoveMedication={(id) => updateDraft('prescriptions', draft.prescriptions.filter((item) => item.id !== id))} onClearMedications={() => updateDraft('prescriptions', [])} onAddMedication={openAddMedication} onEditMedication={openEditMedication} onOpenPatientDrawer={() => setProfilePatient(activeVisit.patient)} onOpenHistoryMedicalRecord={(record) => openHistoryMedicalRecord(activeVisit.patient, record)} />
    {showComplete && <ConfirmModal onCancel={() => setShowComplete(false)} onConfirm={completeVisit} />}
    {modal === 'medication' && <MedicationModal editing={Boolean(editingMedicationId)} value={medication} setValue={setMedication} onClose={closeMedicationModal} onSubmit={addMedication} />}
    {modal === 'order' && <OrderModal value={order} setValue={setOrder} onClose={() => setModal(null)} onSubmit={addOrder} />}
    {profilePatient && <PatientProfileDrawer patient={profilePatient} onClose={() => setProfilePatient(null)} onOpenMedicalRecord={(record) => openHistoryMedicalRecord(profilePatient, record)} />}
    {toast && <div className="doctor-toast"><CheckCircle2 size={16} /> {toast}</div>}
  </>
  return <>
    <div className="page-header doctor-page-heading"><div><div className="page-title">Khám bệnh</div><div className="page-subtitle">{loading ? 'Đang tải lịch khám hôm nay...' : 'Tiếp nhận và ghi nhận thông tin khám bệnh hôm nay.'}</div></div><div className="doctor-header-status"><span className="live-dot" /> Phòng khám đang hoạt động</div></div>
    <div className="doctor-tabs"><button className={activeTab === 'today' ? 'active' : ''} onClick={() => setTab('today')}><Stethoscope size={17} /> Khám hôm nay <span>{displayedAppointments.filter((item) => item.status === 'WAITING').length}</span></button><button className={activeTab === 'schedule' ? 'active' : ''} onClick={() => setTab('schedule')}><Clock3 size={17} /> Lịch hôm nay</button><button className={activeTab === 'history' ? 'active' : ''} onClick={() => setTab('history')}><History size={17} /> Lịch sử khám</button></div>
    {activeTab === 'history'
      ? <HistoryPanel visits={displayedAppointments.filter((item) => item.status === 'COMPLETED').map(appointmentToVisit)} />
      : activeTab === 'schedule'
        ? <DoctorSlotPanel doctorName={currentDoctor} slots={displayedSlots} appointments={displayedAppointments} expandedSlotId={expandedSlotId} selectedId={displayedSelectedId} onToggleSlot={setExpandedSlotId} onSelect={setSelectedId} onRefresh={() => void queueQuery.refetch()} loading={loading} />
        : <DoctorDashboard appointments={displayedAppointments} slots={displayedSlots} doctorName={currentDoctor} selectedId={displayedSelectedId} expandedSlotId={expandedSlotId} loading={loading} error={pageError || queueError} startingId={startingId} onSelect={setSelectedId} onToggleSlot={setExpandedSlotId} onStart={openVisit} onCancel={cancelVisit} onViewPatient={(appointment) => setProfilePatient(appointmentToVisit(appointment).patient)} onViewMedicalRecord={openCompletedMedicalRecord} onRefresh={() => void queueQuery.refetch()} />}
    {toast && <div className="doctor-toast"><CheckCircle2 size={16} /> {toast}</div>}
    {showComplete && <ConfirmModal onCancel={() => setShowComplete(false)} onConfirm={completeVisit} />}
    {modal === 'medication' && <MedicationModal editing={Boolean(editingMedicationId)} value={medication} setValue={setMedication} onClose={closeMedicationModal} onSubmit={addMedication} />}
    {modal === 'order' && <OrderModal value={order} setValue={setOrder} onClose={() => setModal(null)} onSubmit={addOrder} />}
    {profilePatient && <PatientProfileDrawer patient={profilePatient} onClose={() => setProfilePatient(null)} onOpenMedicalRecord={(record) => openHistoryMedicalRecord(profilePatient, record)} />}
  </>
}

function DoctorDashboard({ appointments, slots, doctorName, selectedId, expandedSlotId, loading, error, startingId, onSelect, onToggleSlot, onStart, onCancel, onViewPatient, onViewMedicalRecord, onRefresh }: { appointments: Appointment[]; slots: SlotDefinition[]; doctorName: string; selectedId: string; expandedSlotId: string; loading: boolean; error: string; startingId: string; onSelect: (id: string) => void; onToggleSlot: (id: string) => void; onStart: (appointment: Appointment) => void; onCancel: (appointment: Appointment) => void; onViewPatient: (appointment: Appointment) => void; onViewMedicalRecord: (appointment: Appointment) => void; onRefresh: () => void }) {
  const waiting = appointments.filter((item) => item.status === 'WAITING')
  const inProgress = appointments.filter((item) => item.status === 'IN_PROGRESS')
  return <div className="doctor-dashboard">
    <div className="doctor-summary-grid doctor-summary-three"><div className="doctor-stat-card"><span className="doctor-stat-icon blue"><ClipboardList size={19} /></span><strong>{waiting.length}</strong><span>Đang chờ khám</span></div><div className="doctor-stat-card"><span className="doctor-stat-icon green"><Stethoscope size={19} /></span><strong>{inProgress.length}</strong><span>Đang khám</span></div><div className="doctor-stat-card"><span className="doctor-stat-icon gray"><CheckCircle2 size={19} /></span><strong>{appointments.filter((item) => item.status === 'COMPLETED').length}</strong><span>Đã hoàn tất hôm nay</span></div></div>
    {error && <div className="form-error">{error}</div>}
    <div className="appointments-grid doctor-schedule-grid">
      <DoctorSlotPanel doctorName={doctorName} slots={slots} appointments={appointments} expandedSlotId={expandedSlotId} selectedId={selectedId} onToggleSlot={onToggleSlot} onSelect={onSelect} onRefresh={onRefresh} loading={loading} />
      <DoctorQueuePanel appointments={appointments} selectedId={selectedId} startingId={startingId} onSelect={onSelect} onStart={onStart} onCancel={onCancel} onViewPatient={onViewPatient} onViewMedicalRecord={onViewMedicalRecord} />
    </div>
  </div>
}

function DoctorSlotPanel({ doctorName, slots, appointments, expandedSlotId, selectedId, onToggleSlot, onSelect, onRefresh, loading }: { doctorName: string; slots: SlotDefinition[]; appointments: Appointment[]; expandedSlotId: string; selectedId: string; onToggleSlot: (id: string) => void; onSelect: (id: string) => void; onRefresh: () => void; loading: boolean }) {
  return <section className="slot-panel doctor-slot-panel"><div className="slot-panel-header"><div><h2>{doctorName}</h2><p>Lịch khám hôm nay · {new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date())}</p></div><div className="slot-refresh"><span><Clock3 size={15} /> Tự động cập nhật mỗi 3 giây</span><button className="icon-button" onClick={onRefresh} aria-label="Làm mới lịch"><RefreshCw size={16} /></button></div></div><div className="slot-legend"><span><i className="legend-dot available" /> Còn chỗ</span><span><i className="legend-dot full" /> Đã đầy</span><span><i className="legend-dot ended" /> Đã qua</span><span><LockKeyhole size={13} /> Đã khóa</span></div><div className="slot-table-head"><span>Khung giờ</span><span>Số suất</span><span>Thao tác</span></div><div className="slot-list">{loading ? <div className="empty-context">Đang tải lịch khám...</div> : slots.length === 0 ? <div className="empty-context">Chưa có khung giờ khám trong hôm nay.</div> : slots.map((slot) => <SlotRow key={slot.id} slot={slot} appointments={appointments.filter((item) => item.slotId === slot.id)} expanded={expandedSlotId === slot.id} selectedId={selectedId} onToggle={() => onToggleSlot(expandedSlotId === slot.id ? '' : slot.id)} onSelectAppointment={onSelect} onCreate={() => undefined} receptionClosed showCreateAction={false} />)}</div></section>
}

function DoctorQueuePanel({ appointments, selectedId, startingId, onSelect, onStart, onCancel, onViewPatient, onViewMedicalRecord }: { appointments: Appointment[]; selectedId: string; startingId: string; onSelect: (id: string) => void; onStart: (appointment: Appointment) => void; onCancel: (appointment: Appointment) => void; onViewPatient: (appointment: Appointment) => void; onViewMedicalRecord: (appointment: Appointment) => void }) {
  const [queueTab, setQueueTab] = useState<'IN_PROGRESS' | 'WAITING' | 'COMPLETED'>('IN_PROGRESS')
  const [query, setQuery] = useState('')
  const queue = useMemo(() => appointments.filter((item) => (item.status === 'IN_PROGRESS' || item.status === 'WAITING' || item.status === 'COMPLETED') && `${item.patient.fullName} ${item.patient.phone} ${item.patient.code} ${item.sequenceNumber}`.toLowerCase().includes(query.toLowerCase())), [appointments, query])
  const selected = appointments.find((item) => item.id === selectedId) || null
  return <aside className="appointments-side doctor-appointments-side">
    <section className="queue-panel"><div className="side-panel-title"><h2>Danh sách chờ</h2><span className="queue-count">{queue.length} bệnh nhân</span></div><label className="queue-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên, SĐT, mã BN hoặc số khám..." /></label><div className="queue-tabs doctor-queue-tabs"><button className={queueTab === 'IN_PROGRESS' ? 'active' : ''} onClick={() => setQueueTab('IN_PROGRESS')}>Đang khám ({queue.filter((item) => item.status === 'IN_PROGRESS').length})</button><button className={queueTab === 'WAITING' ? 'active' : ''} onClick={() => setQueueTab('WAITING')}>Đang chờ ({queue.filter((item) => item.status === 'WAITING').length})</button><button className={queueTab === 'COMPLETED' ? 'active' : ''} onClick={() => setQueueTab('COMPLETED')}>Đã hoàn thành ({queue.filter((item) => item.status === 'COMPLETED').length})</button></div><QueueGroup items={queue.filter((item) => item.status === queueTab)} selectedId={selectedId} onSelect={onSelect} /></section>
    <section className="detail-panel doctor-visit-detail">
      <div className="side-panel-title"><h2>Thông tin lượt khám</h2></div>
      {!selected ? <div className="empty-context">Chọn bệnh nhân để xem thông tin.</div> : <>
        <div className="detail-patient">
          <div className="detail-avatar doctor-detail-avatar">{patientInitials(selected.patient.fullName)}</div>
          <div>
            <strong>{selected.patient.fullName}</strong>
            <span>{selected.patient.gender} · {selected.patient.age} tuổi · {selected.patient.code}</span>
            <a href={`tel:${selected.patient.phone}`}>{selected.patient.phone}</a>
          </div>
        </div>
        <span className={`status-badge ${statusConfig[selected.status].className}`}>{statusConfig[selected.status].label}</span>
        <dl className="detail-list doctor-appointment-detail-list">
          <div><dt>Số khám</dt><dd>{String(selected.sequenceNumber).padStart(3, '0')}</dd></div>
          <div><dt>Ngày khám</dt><dd>{shortDateLabel(selected.startTime.slice(0, 10))}</dd></div>
          <div><dt>Khung giờ</dt><dd>{timeLabel(selected.startTime)} - {timeLabel(selected.endTime)}</dd></div>
          <div><dt>Bác sĩ</dt><dd>{selected.doctor.fullName}</dd></div>
          <div><dt>Khoa</dt><dd>{selected.doctor.department}</dd></div>
          <div><dt>Loại lịch</dt><dd>{selected.appointmentType === 'WALK_IN' ? 'Khám ngay' : 'Đặt lịch trước'}</dd></div>
          <div><dt>Hình thức</dt><dd>{selected.insuranceNumber ? 'BHYT' : 'Dịch vụ'}</dd></div>
          {selected.insuranceNumber && <div><dt>Mã thẻ BHYT</dt><dd>{selected.insuranceNumber}</dd></div>}
          <div><dt>Phòng khám</dt><dd>{selected.room}</dd></div>
          <div className="detail-reason-row"><dt>Lý do khám</dt><dd>{selected.reason || 'Chưa cập nhật'}</dd></div>
          <div><dt>Mã lịch hẹn</dt><dd>{selected.appointmentCode}</dd></div>
        </dl>
        {selected.status === 'WAITING' && <div className="detail-actions doctor-visit-actions"><button className="btn btn-secondary btn-sm" onClick={() => onViewPatient(selected)}><UserRound size={14} /> Xem hồ sơ</button><button className="btn btn-primary btn-sm doctor-start-button" disabled={Boolean(startingId)} onClick={() => onStart(selected)}>{startingId === selected.id ? 'Đang xử lý...' : 'Bắt đầu khám'}</button></div>}
        {selected.status === 'IN_PROGRESS' && <div className="detail-actions doctor-visit-actions"><button className="btn btn-secondary btn-sm" onClick={() => onViewPatient(selected)}><UserRound size={14} /> Xem hồ sơ</button><button className="btn btn-danger-outline btn-sm" onClick={() => onCancel(selected)}>Hủy</button><button className="btn btn-primary btn-sm doctor-start-button" disabled={Boolean(startingId)} onClick={() => onStart(selected)}>{startingId === selected.id ? 'Đang xử lý...' : 'Tiếp tục khám'}</button></div>}
        {selected.status === 'COMPLETED' && <div className="detail-actions doctor-visit-actions completed-visit-actions"><button className="btn btn-secondary btn-sm" onClick={() => onViewPatient(selected)}><UserRound size={14} /> Xem hồ sơ</button><button className="btn btn-primary btn-sm" disabled={Boolean(startingId)} onClick={() => onViewMedicalRecord(selected)}>{startingId === selected.id ? 'Đang tải...' : 'Xem hồ sơ bệnh án'}</button></div>}
      </>}
    </section>
  </aside>
}

function HistoryPanel({ visits }: { visits: WaitingAppointment[] }) { return <section className="doctor-queue-card history-panel"><div className="doctor-section-heading"><div><h3>Lịch sử khám</h3><p>Các ca khám đã hoàn tất trong hôm nay.</p></div><div className="history-search-box"><Search size={15} /><input placeholder="Tìm bệnh nhân" /></div></div>{visits.length === 0 ? <div className="doctor-empty"><FileClock size={38} /><strong>Chưa có ca khám hoàn tất</strong></div> : visits.map((visit) => <div className="history-row" key={visit.id}><span>{visit.time}</span><strong>{visit.patient.fullName}</strong><span>{visit.patient.code}</span><span>{visit.reason}</span><span className="status-pill completed">Đã hoàn tất</span></div>)}</section> }

function ConsultationWorkspace({ visit, doctorName, draft, updateDraft, errors, savedAt, recordError, recordStatus, saving, onBack, onSave, onComplete, onRemoveMedication, onClearMedications, onAddMedication, onEditMedication, onOpenPatientDrawer, onOpenHistoryMedicalRecord }: { visit: WaitingAppointment; doctorName: string; draft: Draft; updateDraft: <K extends keyof Draft>(key: K, value: Draft[K]) => void; errors: { diagnosis?: string }; savedAt: string; recordError: string; recordStatus: 'DRAFT' | 'SIGNED'; saving: boolean; onBack: () => void; onSave: () => void; onComplete: () => void; onRemoveMedication: (id: string) => void; onClearMedications: () => void; onAddMedication: () => void; onEditMedication: (item: Prescription) => void; onOpenPatientDrawer: () => void; onOpenHistoryMedicalRecord: (record: ApiMedicalRecordHistoryItem) => void }) {
  const patient = visit.patient
  const readOnly = recordStatus === 'SIGNED'
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ history: true, examination: true, vitals: true, diagnosis: true, prescription: true })
  const [recentHistory, setRecentHistory] = useState<ApiMedicalRecordHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(() => Boolean(patient.id))
  const [historyError, setHistoryError] = useState('')
  const toggleSection = (key: string) => setOpenSections((current) => ({ ...current, [key]: !current[key] }))
  useEffect(() => {
    if (!patient.id) return
    let cancelled = false
    const loadRecentHistory = async () => {
      try {
        const records = await medicalRecordApi.historyByPatient(Number(patient.id))
        if (!cancelled) setRecentHistory(records.slice(0, 3))
      } catch (error) {
        if (!cancelled) setHistoryError(error instanceof Error ? error.message : 'Không thể tải lịch sử khám')
      } finally {
        if (!cancelled) setHistoryLoading(false)
      }
    }
    void loadRecentHistory()
    return () => { cancelled = true }
  }, [patient.id])
  return <div className="consultation-page consultation-redesign">
    <div className="consultation-topbar">
      <button className="back-link" onClick={onBack}><ArrowLeft size={17} /> Quay lại Khám bệnh</button>
      <div className="consultation-top-actions"><button className="btn btn-secondary btn-sm" onClick={onOpenPatientDrawer}><UserRound size={15} /> Xem hồ sơ bệnh nhân</button><button className="icon-button" aria-label="Thao tác khác"><MoreHorizontal size={17} /></button></div>
    </div>
    <section className="patient-header-card consultation-patient-header">
      <div className="patient-header-main"><div className="patient-large-avatar">{patientInitials(patient.fullName)}</div><div><h1>{patient.fullName}</h1><p>{patient.gender} · {patient.age} tuổi · {patient.phone}</p><div className="patient-quick-info"><span>Mã BN: <b>{patient.code}</b></span><span>{patient.address}</span></div></div></div>
      <div className="patient-appointment-meta">
        <div><span><CalendarDays size={14} /> Mã lịch hẹn</span><strong>{visit.appointmentCode}</strong></div>
        <div><span><UserRound size={14} /> Bác sĩ</span><strong>{doctorLabel(doctorName)}</strong></div>
        <div><span><Clock3 size={14} /> Thời gian</span><strong>{visit.time} - {visit.endTime}, {shortDateLabel(visit.date)}</strong></div>
        <div><span><Clock3 size={14} /> Trạng thái</span><b className={`status-pill ${readOnly ? 'completed' : 'in-progress'}`}>{readOnly ? 'ĐÃ HOÀN THÀNH' : 'ĐANG KHÁM'}</b></div>
      </div>
    </section>
    <div className="consultation-workspace-grid">
      <aside className="visit-overview-card">
        <section><h2><CalendarDays size={17} /> Thông tin cuộc hẹn</h2><dl><div><dt>Lý do khám</dt><dd>{visit.reason}</dd></div><div><dt>Khung giờ</dt><dd>{visit.time} - {visit.endTime}</dd></div><div><dt>Số khám</dt><dd>{String(visit.sequenceNumber).padStart(2, '0')}</dd></div><div><dt>Loại khám</dt><dd>{visit.appointmentType === 'WALK_IN' ? 'Khám ngay' : 'Khám thường'}</dd></div></dl></section>
        <section className="visit-history-summary"><div className="visit-history-title"><h2><History size={17} /> Lịch sử khám</h2><button type="button" onClick={onOpenPatientDrawer}>Xem tất cả</button></div>{historyLoading ? <div className="visit-history-message">Đang tải lịch sử...</div> : historyError ? <div className="visit-history-message error">{historyError}</div> : recentHistory.length === 0 ? <div className="visit-history-message">Chưa có lần khám đã hoàn thành.</div> : <div className="visit-history-list">{recentHistory.map((record) => <button type="button" className="visit-history-item" key={record.id} onClick={() => onOpenHistoryMedicalRecord(record)}><strong>{shortDateLabel(record.visitDate.slice(0, 10))}</strong><span>{record.reason || record.diagnosis || 'Chưa cập nhật'}</span><b>Đã ký</b></button>)}</div>}</section>
      </aside>
      <main className="consultation-sheet">
        <div className="consultation-sheet-tabs"><button className="active">Phiếu khám hiện tại</button></div>
        {recordError && <div className="consultation-record-error">{recordError}</div>}
        {readOnly && <div className="consultation-signed-notice">Hồ sơ đã được ký và khóa chỉnh sửa.</div>}
        <ClinicalAccordionSection sectionKey="history" number="1" title="Tiền sử bệnh" icon={<ClipboardList size={17} />} open={openSections.history} onToggle={toggleSection}>
          <textarea disabled={readOnly} rows={3} value={draft.illnessHistory} onChange={(event) => updateDraft('illnessHistory', event.target.value)} placeholder="Nhập tiền sử bệnh, dị ứng và bệnh nền của bệnh nhân..." />
        </ClinicalAccordionSection>
        <ClinicalAccordionSection sectionKey="examination" number="2" title="Diễn biến khám" icon={<FileText size={17} />} open={openSections.examination} onToggle={toggleSection}>
          <textarea disabled={readOnly} rows={3} value={draft.symptoms} onChange={(event) => updateDraft('symptoms', event.target.value)} placeholder="Mô tả triệu chứng, diễn biến bệnh và ghi nhận khi khám (không bắt buộc)..." />
        </ClinicalAccordionSection>
        <ClinicalAccordionSection sectionKey="vitals" number="3" title="Dấu hiệu sinh tồn" icon={<Activity size={17} />} open={openSections.vitals} onToggle={toggleSection}>
          <div className="consultation-vitals-grid">{([['pulse', 'Mạch (lần/phút)'], ['systolic', 'Huyết áp tâm thu (mmHg)'], ['diastolic', 'Huyết áp tâm trương (mmHg)'], ['temperature', 'Nhiệt độ (°C)'], ['spo2', 'SpO₂ (%)'], ['weight', 'Cân nặng (kg)']] as const).map(([key, label]) => <label key={key}><span>{label}</span><input disabled={readOnly} type="number" value={draft[key]} placeholder="Không đo" onChange={(event) => updateDraft(key, event.target.value)} /></label>)}</div>
        </ClinicalAccordionSection>
        <ClinicalAccordionSection sectionKey="diagnosis" number="4" title="Chẩn đoán" icon={<Stethoscope size={17} />} open={openSections.diagnosis} onToggle={toggleSection}>
          <textarea disabled={readOnly} className={errors.diagnosis ? 'has-error' : ''} rows={2} value={draft.diagnosis} onChange={(event) => updateDraft('diagnosis', event.target.value)} placeholder="Nhập chẩn đoán..." />
          {errors.diagnosis && <small className="field-error">{errors.diagnosis}</small>}
        </ClinicalAccordionSection>
        <ClinicalAccordionSection sectionKey="prescription" number="5" title="Đơn thuốc" icon={<Pill size={17} />} open={openSections.prescription} onToggle={toggleSection} action={<div className="prescription-header-actions"><button type="button" disabled={readOnly || draft.prescriptions.length === 0} className="clinical-clear-medicine" onClick={(event) => { event.stopPropagation(); onClearMedications() }}><Trash2 size={14} /> Xóa hết</button><button type="button" disabled={readOnly} className="clinical-add-medicine" onClick={(event) => { event.stopPropagation(); onAddMedication() }}><Plus size={15} /> Thêm thuốc</button></div>}>
          <PrescriptionSection items={draft.prescriptions} onAdd={onAddMedication} onEdit={onEditMedication} onRemove={onRemoveMedication} embedded readOnly={readOnly} />
        </ClinicalAccordionSection>
        <div className="consultation-sheet-actions"><div><button className="btn btn-outline-primary" disabled={saving || readOnly} onClick={onSave}><Save size={16} /> {saving ? 'Đang lưu...' : 'Lưu nháp'}</button><span><Check size={14} /> {savedAt}</span></div><button className="btn btn-primary" disabled={saving || readOnly} onClick={onComplete}><PenLine size={16} /> {saving ? 'Đang xử lý...' : readOnly ? 'Hồ sơ đã ký' : 'Ký và hoàn thành khám'}</button></div>
      </main>
    </div>
  </div>
}

function ClinicalAccordionSection({ sectionKey, number, title, icon, open, onToggle, action, children }: { sectionKey: string; number: string; title: string; icon: React.ReactNode; open: boolean; onToggle: (key: string) => void; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className={`clinical-accordion ${open ? 'open' : ''}`}><div className="clinical-accordion-header" role="button" tabIndex={0} onClick={() => onToggle(sectionKey)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onToggle(sectionKey) }}><span className="clinical-accordion-icon">{icon}</span><strong>{number}. {title}</strong><div className="clinical-accordion-actions">{action}{open ? <ChevronUp size={17} /> : <ChevronDown size={17} />}</div></div>{open && <div className="clinical-accordion-body">{children}</div>}</section>
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) { return <div className="consultation-section-title">{icon}<h2>{title}</h2></div> }
function PrescriptionSection({ items, onAdd, onEdit, onRemove, embedded = false, readOnly = false }: { items: Prescription[]; onAdd: () => void; onEdit?: (item: Prescription) => void; onRemove: (id: string) => void; embedded?: boolean; readOnly?: boolean }) {
  const content = items.length === 0 ? <div className="section-empty">Chưa có thuốc được kê. Đơn thuốc là tùy chọn.</div> : <div className="clinical-table prescription-table"><div className="clinical-table-head"><span>Tên thuốc</span><span>Liều dùng</span><span>Số ngày</span><span>Số lượng</span><span>Cách dùng</span><span>Thao tác</span></div>{items.map((item) => <div className="clinical-table-row" key={item.id}><strong>{item.medicationName}</strong><span>{item.dosage || '—'}</span><span>{item.durationDays || '—'}</span><span>{item.quantity} {item.unit}</span><span>{item.instructions}</span><span className="prescription-row-actions"><button type="button" disabled={readOnly || !onEdit} onClick={() => onEdit?.(item)} aria-label={`Sửa thuốc ${item.medicationName}`}><PenLine size={14} /></button><button type="button" disabled={readOnly} onClick={() => onRemove(item.id)} aria-label={`Xóa thuốc ${item.medicationName}`}><Trash2 size={14} /></button></span></div>)}</div>
  if (embedded) return content
  return <section className="consultation-section compact-section"><SectionTitle icon={<FileText size={17} />} title="Đơn thuốc" /><button className="section-add-button" onClick={onAdd}><Plus size={15} /> Thêm thuốc</button>{content}</section>
}

function ConfirmModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) { return <div className="modal-backdrop"><div className="doctor-confirm-modal"><div className="confirm-icon"><CheckCircle2 size={25} /></div><h2>Ký và hoàn thành khám?</h2><p>Sau khi ký, phiếu khám sẽ được khóa và bệnh nhân được chuyển sang trạng thái hoàn tất.</p><div className="modal-footer"><button className="btn btn-secondary" onClick={onCancel}>Quay lại</button><button className="btn btn-primary" onClick={onConfirm}>Ký và hoàn thành</button></div></div></div> }
function MedicationModal({ editing, value, setValue, onClose, onSubmit }: { editing: boolean; value: MedicationDraft; setValue: React.Dispatch<React.SetStateAction<MedicationDraft>>; onClose: () => void; onSubmit: (event: React.FormEvent) => void }) { return <div className="modal-backdrop"><form className="doctor-form-modal" onSubmit={onSubmit}><div className="modal-header"><div><h2>{editing ? 'Sửa thuốc' : 'Thêm thuốc'}</h2><p>{editing ? 'Cập nhật thông tin thuốc trong đơn khám.' : 'Nhập thông tin thuốc cho đơn khám.'}</p></div><button type="button" className="icon-button" onClick={onClose}><X size={18} /></button></div><div className="doctor-modal-fields"><label>Tên thuốc *<input autoFocus value={value.medicationName} onChange={(e) => setValue((v) => ({ ...v, medicationName: e.target.value }))} placeholder="Ví dụ: Paracetamol 500mg" /></label><label>Liều dùng<input value={value.dosage} onChange={(e) => setValue((v) => ({ ...v, dosage: e.target.value }))} placeholder="1 viên/lần" /></label><label>Số ngày<input type="number" min="0" value={value.durationDays} onChange={(e) => setValue((v) => ({ ...v, durationDays: e.target.value }))} /></label><label>Số lượng *<input type="number" min="1" value={value.quantity} onChange={(e) => setValue((v) => ({ ...v, quantity: e.target.value }))} /></label><label>Đơn vị<input value={value.unit} onChange={(e) => setValue((v) => ({ ...v, unit: e.target.value }))} /></label><label className="span-two">Cách dùng *<textarea rows={2} value={value.instructions} onChange={(e) => setValue((v) => ({ ...v, instructions: e.target.value }))} placeholder="Uống 1 viên sau ăn" /></label></div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button><button className="btn btn-primary" type="submit">{editing ? 'Lưu thay đổi' : 'Thêm thuốc'}</button></div></form></div> }
function OrderModal({ value, setValue, onClose, onSubmit }: { value: OrderDraft; setValue: React.Dispatch<React.SetStateAction<OrderDraft>>; onClose: () => void; onSubmit: (event: React.FormEvent) => void }) { return <div className="modal-backdrop"><form className="doctor-form-modal" onSubmit={onSubmit}><div className="modal-header"><div><h2>Thêm chỉ định</h2><p>Ghi nhận xét nghiệm hoặc chỉ định cần thực hiện.</p></div><button type="button" className="icon-button" onClick={onClose}><X size={18} /></button></div><div className="doctor-modal-fields"><label>Loại chỉ định<select value={value.orderType} onChange={(e) => setValue((v) => ({ ...v, orderType: e.target.value as OrderType }))}>{Object.entries(orderTypeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="span-two">Tên chỉ định *<input autoFocus value={value.name} onChange={(e) => setValue((v) => ({ ...v, name: e.target.value }))} placeholder="Ví dụ: Công thức máu" /></label><label>Mục đích<input value={value.purpose} onChange={(e) => setValue((v) => ({ ...v, purpose: e.target.value }))} placeholder="Đánh giá thiếu máu" /></label><label>Hướng dẫn / Ghi chú<input value={value.instructions} onChange={(e) => setValue((v) => ({ ...v, instructions: e.target.value }))} placeholder="Nhịn ăn sáng" /></label></div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button><button className="btn btn-primary" type="submit">Thêm chỉ định</button></div></form></div> }
