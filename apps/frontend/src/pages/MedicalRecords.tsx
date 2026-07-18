import { useCallback, useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import {
  AlertTriangle, CalendarDays, CheckCircle2, ClipboardPlus, Clock3, FileClock,
  Loader2, Search, Stethoscope, UserRound, X,
} from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { authFetch } from '../lib/authFetch'
import { useAuthStore } from '../store'

interface Appointment {
  id: number
  patient: { id: string; patientCode: string; fullName: string; phone: string }
  doctor: { id: string; fullName: string }
  appointment_time: string
  reason: string
  status: string
}

interface MedicalRecord {
  id: number
  appointmentId: number
  visitDate: string
  doctorName: string
  symptoms: string
  diagnosis: string
  notes: string | null
}

interface RecordForm {
  symptoms: string
  diagnosis: string
  notes: string
}

const EMPTY_FORM: RecordForm = { symptoms: '', diagnosis: '', notes: '' }

function formatAppointmentTime(value: string) {
  try {
    return format(parseISO(value), 'HH:mm')
  } catch {
    return value
  }
}

function formatVisitDate(value: string) {
  try {
    return format(new Date(value.replace(' ', 'T')), 'HH:mm - dd/MM/yyyy')
  } catch {
    return value
  }
}

export default function MedicalRecordsPage() {
  const token = useAuthStore((state) => state.token)
  const [searchParams, setSearchParams] = useSearchParams()
  const patientId = searchParams.get('patientId')?.trim() || ''
  const [activeTab, setActiveTab] = useState<'today' | 'history'>(patientId ? 'history' : 'today')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [appointmentsLoading, setAppointmentsLoading] = useState(false)
  const [appointmentsError, setAppointmentsError] = useState<string | null>(null)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [form, setForm] = useState<RecordForm>({ ...EMPTY_FORM })
  const [formErrors, setFormErrors] = useState<Partial<RecordForm>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [lookupPatientId, setLookupPatientId] = useState(patientId)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const loadTodayAppointments = useCallback(async () => {
    if (!token) return
    setAppointmentsLoading(true)
    setAppointmentsError(null)
    try {
      const today = format(new Date(), 'yyyy-MM-dd')
      const response = await authFetch(`/api/appointments/?status=CONFIRMED&date=${today}`)
      const json = await response.json()
      if (!response.ok || !json.success) {
        setAppointments([])
        setAppointmentsError(json.error?.message || 'Không thể tải danh sách bệnh nhân chờ khám')
        return
      }
      setAppointments(Array.isArray(json.data?.appointments) ? json.data.appointments : [])
    } catch {
      setAppointments([])
      setAppointmentsError('Không thể kết nối đến máy chủ')
    } finally {
      setAppointmentsLoading(false)
    }
  }, [token])

  const loadMedicalHistory = useCallback(async (id: string) => {
    if (!token || !id) return
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      const response = await authFetch(`/api/patients/${encodeURIComponent(id)}/medical-records/`)
      const json = await response.json()
      if (!response.ok || !json.success) {
        setRecords([])
        setHistoryError(json.error?.message || 'Không thể tải lịch sử bệnh án')
        return
      }
      setRecords(Array.isArray(json.data?.medicalRecords) ? json.data.medicalRecords : [])
    } catch {
      setRecords([])
      setHistoryError('Không thể kết nối đến máy chủ')
    } finally {
      setHistoryLoading(false)
    }
  }, [token])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadTodayAppointments() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadTodayAppointments])

  useEffect(() => {
    if (!patientId) return
    const timer = window.setTimeout(() => {
      setActiveTab('history')
      setLookupPatientId(patientId)
      void loadMedicalHistory(patientId)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadMedicalHistory, patientId])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(timer)
  }, [toast])

  const openRecordForm = (appointment: Appointment) => {
    setSelectedAppointment(appointment)
    setForm({ ...EMPTY_FORM })
    setFormErrors({})
    setSubmitError(null)
  }

  const closeRecordForm = () => {
    if (submitting) return
    setSelectedAppointment(null)
    setForm({ ...EMPTY_FORM })
    setFormErrors({})
    setSubmitError(null)
  }

  const submitMedicalRecord = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedAppointment) return
    const errors: Partial<RecordForm> = {}
    if (!form.symptoms.trim()) errors.symptoms = 'Vui lòng nhập triệu chứng'
    if (!form.diagnosis.trim()) errors.diagnosis = 'Vui lòng nhập chẩn đoán'
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    setSubmitError(null)
    try {
      const response = await authFetch('/api/medical-records/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: selectedAppointment.id,
          symptoms: form.symptoms.trim(),
          diagnosis: form.diagnosis.trim(),
          notes: form.notes.trim(),
        }),
      })
      const json = await response.json()
      if (!response.ok || !json.success) {
        setSubmitError(json.error?.message || 'Không thể lưu bệnh án')
        return
      }
      setAppointments((current) => current.filter((item) => item.id !== selectedAppointment.id))
      setToast({ message: 'Đã lưu bệnh án và hoàn thành lượt khám', type: 'success' })
      setSelectedAppointment(null)
      setForm({ ...EMPTY_FORM })
    } catch {
      setSubmitError('Không thể kết nối đến máy chủ')
    } finally {
      setSubmitting(false)
    }
  }

  const selectTab = (tab: 'today' | 'history') => {
    setActiveTab(tab)
    if (tab === 'today' && patientId) setSearchParams({})
  }

  const searchHistory = (event: React.FormEvent) => {
    event.preventDefault()
    const id = lookupPatientId.trim()
    if (!id) {
      setHistoryError('Vui lòng nhập mã định danh bệnh nhân')
      setRecords([])
      return
    }
    setSearchParams({ patientId: id })
    if (id === patientId) void loadMedicalHistory(id)
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Quản lý bệnh án</div>
          <div className="page-subtitle">Tiếp nhận lượt khám hôm nay và tra cứu lịch sử điều trị.</div>
        </div>
      </div>

      <div className="medical-tabs" role="tablist" aria-label="Chế độ xem bệnh án">
        <button className={`medical-tab ${activeTab === 'today' ? 'active' : ''}`} onClick={() => selectTab('today')} role="tab" aria-selected={activeTab === 'today'}>
          <Stethoscope size={18} /> Bệnh án hôm nay
          <span className="medical-tab-count">{appointments.length}</span>
        </button>
        <button className={`medical-tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => selectTab('history')} role="tab" aria-selected={activeTab === 'history'}>
          <FileClock size={18} /> Tra cứu bệnh án
        </button>
      </div>

      {activeTab === 'today' ? (
        <section className="medical-section">
          <div className="medical-section-heading">
            <div><h3>Danh sách đang chờ khám</h3><p>Các lịch hẹn đã xác nhận của bác sĩ trong ngày hôm nay.</p></div>
            <button className="btn btn-secondary btn-sm" onClick={() => void loadTodayAppointments()} disabled={appointmentsLoading}>
              {appointmentsLoading ? <Loader2 size={16} className="spin" /> : <CalendarDays size={16} />} Tải lại
            </button>
          </div>

          {appointmentsError ? (
            <div className="api-error-box"><AlertTriangle size={17} /><span>{appointmentsError}</span></div>
          ) : appointmentsLoading ? (
            <div className="medical-empty"><Loader2 size={34} className="spin" /><strong>Đang tải danh sách chờ...</strong></div>
          ) : appointments.length === 0 ? (
            <div className="medical-empty"><CheckCircle2 size={42} /><strong>Không còn bệnh nhân chờ khám</strong><span>Các lịch hẹn đã xác nhận hôm nay sẽ xuất hiện tại đây.</span></div>
          ) : (
            <div className="appointment-card-grid">
              {appointments.map((appointment) => (
                <button className="appointment-medical-card" key={appointment.id} onClick={() => openRecordForm(appointment)}>
                  <div className="appointment-card-time"><Clock3 size={17} />{formatAppointmentTime(appointment.appointment_time)}</div>
                  <div className="appointment-card-patient">
                    <div className="appointment-card-avatar"><UserRound size={22} /></div>
                    <div><strong>{appointment.patient.fullName}</strong><span>{appointment.patient.patientCode} · {appointment.patient.phone}</span></div>
                  </div>
                  <div className="appointment-card-reason"><span>Lý do khám</span><p>{appointment.reason || 'Chưa ghi nhận'}</p></div>
                  <div className="appointment-card-action"><ClipboardPlus size={17} />Lập bệnh án</div>
                </button>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="medical-section">
          <div className="medical-section-heading history-heading">
            <div><h3>Lịch sử khám bệnh</h3><p>Các lần khám được sắp xếp từ mới nhất đến cũ nhất.</p></div>
            <form className="history-search" onSubmit={searchHistory}>
              <input className="form-input" inputMode="numeric" placeholder="Nhập ID bệnh nhân" value={lookupPatientId} onChange={(event) => setLookupPatientId(event.target.value)} />
              <button className="btn btn-primary" type="submit" disabled={historyLoading}>
                {historyLoading ? <Loader2 size={16} className="spin" /> : <Search size={16} />} Tra cứu
              </button>
            </form>
          </div>

          {historyError ? (
            <div className="api-error-box"><AlertTriangle size={17} /><span>{historyError}</span></div>
          ) : historyLoading ? (
            <div className="medical-empty"><Loader2 size={34} className="spin" /><strong>Đang tải lịch sử bệnh án...</strong></div>
          ) : !patientId ? (
            <div className="medical-empty"><Search size={42} /><strong>Chọn một bệnh nhân để tra cứu</strong><span>Có thể mở nhanh từ nút “Xem bệnh án” trong trang Bệnh nhân.</span></div>
          ) : records.length === 0 ? (
            <div className="medical-empty"><FileClock size={42} /><strong>Bệnh nhân chưa có lịch sử khám bệnh</strong><span>ID bệnh nhân: {patientId}</span></div>
          ) : (
            <div className="medical-timeline">
              {records.map((record) => (
                <article className="medical-timeline-item" key={record.id}>
                  <div className="medical-timeline-marker"><Stethoscope size={17} /></div>
                  <div className="medical-record-card">
                    <div className="medical-record-header">
                      <div><span className="medical-record-date">{formatVisitDate(record.visitDate)}</span><h4>{record.diagnosis}</h4></div>
                      <span className="badge badge-info">BS. {record.doctorName}</span>
                    </div>
                    <div className="medical-record-detail">
                      <div><span>Triệu chứng</span><p>{record.symptoms}</p></div>
                      <div><span>Ghi chú</span><p>{record.notes || 'Không có ghi chú'}</p></div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {selectedAppointment && (
        <div className="modal-overlay" onClick={closeRecordForm}>
          <div className="modal-box wide" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div><h3>Lập bệnh án khám</h3><p>{selectedAppointment.patient.fullName} · {selectedAppointment.patient.patientCode}</p></div>
              <button className="modal-close" onClick={closeRecordForm} disabled={submitting} aria-label="Đóng"><X size={20} /></button>
            </div>
            <form onSubmit={submitMedicalRecord}>
              <div className="modal-body">
                <div className="record-appointment-summary">
                  <div><Clock3 size={16} /><span>Giờ hẹn</span><strong>{formatAppointmentTime(selectedAppointment.appointment_time)}</strong></div>
                  <div><CalendarDays size={16} /><span>Lý do khám</span><strong>{selectedAppointment.reason || 'Chưa ghi nhận'}</strong></div>
                </div>
                {submitError && <div className="api-error-box"><AlertTriangle size={16} /><span>{submitError}</span></div>}
                <div className="form-group">
                  <label className="form-label required">Triệu chứng</label>
                  <textarea className={`form-textarea ${formErrors.symptoms ? 'error' : ''}`} rows={3} placeholder="Mô tả các triệu chứng bệnh nhân đang gặp phải..." value={form.symptoms} onChange={(event) => setForm({ ...form, symptoms: event.target.value })} disabled={submitting} />
                  {formErrors.symptoms && <div className="form-error">{formErrors.symptoms}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label required">Chẩn đoán</label>
                  <textarea className={`form-textarea ${formErrors.diagnosis ? 'error' : ''}`} rows={3} placeholder="Nhập kết luận chẩn đoán..." value={form.diagnosis} onChange={(event) => setForm({ ...form, diagnosis: event.target.value })} disabled={submitting} />
                  {formErrors.diagnosis && <div className="form-error">{formErrors.diagnosis}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Ghi chú</label>
                  <textarea className="form-textarea" rows={3} placeholder="Dặn dò hoặc thông tin bổ sung (không bắt buộc)..." value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} disabled={submitting} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" type="button" onClick={closeRecordForm} disabled={submitting}>Hủy</button>
                <button className="btn btn-primary" type="submit" disabled={submitting}>
                  {submitting ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />}{submitting ? 'Đang lưu...' : 'Lưu bệnh án'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}<span>{toast.message}</span>
          <button className="toast-close" onClick={() => setToast(null)}><X size={16} /></button>
        </div>
      )}
    </>
  )
}
