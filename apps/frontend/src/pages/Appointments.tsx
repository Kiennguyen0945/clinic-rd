import { useCallback, useEffect, useMemo, useState } from 'react'
import { addMinutes, format, parseISO } from 'date-fns'
import {
  AlertTriangle,
  Ban,
  CalendarPlus,
  ChevronDown,
  Clock3,
  Edit3,
  Loader2,
  Plus,
  X,
  UserRoundSearch,
} from 'lucide-react'
import { authFetch } from '../lib/authFetch'
import { useAuthStore } from '../store'

type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'

interface AppointmentPatient {
  id: string | number
  patientCode: string
  fullName: string
  phone: string
}

interface AppointmentDoctor {
  id: string | number
  fullName: string
}

interface AppointmentRow {
  id: string | number
  patient: AppointmentPatient
  doctor: AppointmentDoctor
  appointment_time: string
  reason: string
  status: AppointmentStatus
  created_at: string
  updated_at: string
}

interface DoctorOption {
  id: string
  full_name: string
  username: string
  role: string
}

interface PatientOption {
  id: string | number
  patient_code: string
  full_name: string
  phone: string
}

interface SelectedPatient {
  id: string | number
  patientCode: string
  fullName: string
  phone: string
}

interface AppointmentFormState {
  patientId: string
  doctorId: string
  appointmentTime: string
  reason: string
}

interface AppointmentFormErrors {
  patientId?: string
  doctorId?: string
  appointmentTime?: string
}

const STATUS_OPTIONS: Array<{ value: 'all' | AppointmentStatus; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'PENDING', label: 'PENDING' },
  { value: 'CONFIRMED', label: 'CONFIRMED' },
  { value: 'COMPLETED', label: 'COMPLETED' },
  { value: 'CANCELLED', label: 'CANCELLED' },
]

const STATUS_CLASS_MAP: Record<AppointmentStatus, string> = {
  PENDING: 'badge-pending',
  CONFIRMED: 'badge-info',
  COMPLETED: 'badge-completed',
  CANCELLED: 'badge-cancelled',
}

const EMPTY_FORM: AppointmentFormState = {
  patientId: '',
  doctorId: '',
  appointmentTime: '',
  reason: '',
}

function getTodayValue() {
  return format(new Date(), 'yyyy-MM-dd')
}

function getDefaultFutureTime() {
  return format(addMinutes(new Date(), 60), "yyyy-MM-dd'T'HH:mm")
}

function formatForInput(value: string) {
  try {
    return format(parseISO(value), "yyyy-MM-dd'T'HH:mm")
  } catch {
    return getDefaultFutureTime()
  }
}

function formatDate(value: string) {
  try {
    return format(parseISO(value), 'dd/MM/yyyy')
  } catch {
    return value
  }
}

function formatTime(value: string) {
  try {
    return format(parseISO(value), 'HH:mm')
  } catch {
    return value
  }
}

function isFutureTime(value: string) {
  const time = new Date(value).getTime()
  return !Number.isNaN(time) && time > Date.now()
}

function formatPhone(value: string | number | null | undefined) {
  return String(value ?? '')
}

function toSelectedPatient(patient: AppointmentPatient | PatientOption): SelectedPatient {
  if ('patientCode' in patient) {
    return {
      id: patient.id,
      patientCode: patient.patientCode,
      fullName: patient.fullName,
      phone: patient.phone,
    }
  }

  return {
    id: patient.id,
    patientCode: patient.patient_code,
    fullName: patient.full_name,
    phone: patient.phone,
  }
}

function patientLabel(patient: SelectedPatient) {
  return `${patient.patientCode} · ${patient.fullName}`
}

export default function AppointmentsPage() {
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)
  const isReceptionist = user?.role === 'receptionist'
  const isDoctor = user?.role === 'doctor'

  const [dateFilter, setDateFilter] = useState(getTodayValue)
  const [doctorFilter, setDoctorFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | AppointmentStatus>('all')
  const [appointments, setAppointments] = useState<AppointmentRow[]>([])
  const [appointmentsLoading, setAppointmentsLoading] = useState(false)
  const [appointmentsError, setAppointmentsError] = useState<string | null>(null)

  const [doctors, setDoctors] = useState<DoctorOption[]>([])
  const [doctorsLoading, setDoctorsLoading] = useState(false)

  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [editingAppointment, setEditingAppointment] = useState<AppointmentRow | null>(null)
  const [form, setForm] = useState<AppointmentFormState>({ ...EMPTY_FORM })
  const [formErrors, setFormErrors] = useState<AppointmentFormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const [patientQuery, setPatientQuery] = useState('')
  const [patientResults, setPatientResults] = useState<PatientOption[]>([])
  const [patientLoading, setPatientLoading] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<SelectedPatient | null>(null)

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const loadDoctors = useCallback(async () => {
    if (!token) return
    setDoctorsLoading(true)
    try {
      const response = await authFetch('/api/auth/users/')
      const json = await response.json()
      const rawUsers = Array.isArray(json.data) ? json.data : json.data?.users ?? []
      const doctorList: DoctorOption[] = rawUsers
        .filter((item: DoctorOption) => String(item.role || '').toUpperCase() === 'DOCTOR')
        .map((item: DoctorOption) => ({
          id: String(item.id),
          full_name: item.full_name,
          username: item.username,
          role: item.role,
        }))
      setDoctors(doctorList)
    } catch {
      setDoctors([])
    } finally {
      setDoctorsLoading(false)
    }
  }, [token])

  const fetchAppointments = useCallback(async (dateOverride?: string) => {
    if (!token) return

    setAppointmentsLoading(true)
    setAppointmentsError(null)

    try {
      const params = new URLSearchParams()
      params.set('date', dateOverride || dateFilter)

      if (!isDoctor && doctorFilter !== 'all') {
        params.set('doctorId', doctorFilter)
      }

      if (statusFilter !== 'all') {
        params.set('status', statusFilter)
      }

      const response = await authFetch(`/api/appointments/?${params.toString()}`)
      const json = await response.json()

      if (json.success) {
        const items = Array.isArray(json.data?.appointments) ? json.data.appointments : []
        setAppointments(
          [...items].sort((left: AppointmentRow, right: AppointmentRow) => {
            return new Date(left.appointment_time).getTime() - new Date(right.appointment_time).getTime()
          }),
        )
      } else {
        setAppointments([])
        setAppointmentsError(json.error?.message || 'Không thể tải danh sách lịch hẹn')
      }
    } catch {
      setAppointments([])
      setAppointmentsError('Không thể kết nối đến máy chủ')
    } finally {
      setAppointmentsLoading(false)
    }
  }, [dateFilter, doctorFilter, isDoctor, statusFilter, token])

  useEffect(() => {
    loadDoctors()
  }, [loadDoctors])

  useEffect(() => {
    fetchAppointments()
  }, [fetchAppointments])

  useEffect(() => {
    if (!showModal || modalMode !== 'create') return

    const trimmedQuery = patientQuery.trim()
    if (!trimmedQuery || trimmedQuery.length < 2) {
      setPatientResults([])
      setPatientLoading(false)
      return
    }

    if (selectedPatient && trimmedQuery === patientLabel(selectedPatient)) {
      setPatientResults([])
      setPatientLoading(false)
      return
    }

    const timer = window.setTimeout(async () => {
      if (!token) return

      setPatientLoading(true)
      try {
        const response = await authFetch(`/api/patients/?keyword=${encodeURIComponent(trimmedQuery)}`)
        const json = await response.json()
        const items = Array.isArray(json.data?.patients) ? json.data.patients : []
        setPatientResults(items)
      } catch {
        setPatientResults([])
      } finally {
        setPatientLoading(false)
      }
    }, 300)

    return () => window.clearTimeout(timer)
  }, [modalMode, patientQuery, selectedPatient, showModal, token])

  const refreshList = useCallback(async () => {
    await fetchAppointments()
  }, [fetchAppointments])

  const openCreateModal = () => {
    setModalMode('create')
    setEditingAppointment(null)
    setForm({
      ...EMPTY_FORM,
      doctorId: isDoctor && user?.id ? String(user.id) : '',
      appointmentTime: getDefaultFutureTime(),
    })
    setFormErrors({})
    setApiError(null)
    setPatientQuery('')
    setPatientResults([])
    setSelectedPatient(null)
    setShowModal(true)
  }

  const openEditModal = (appointment: AppointmentRow) => {
    setModalMode('edit')
    setEditingAppointment(appointment)
    setForm({
      patientId: String(appointment.patient.id),
      doctorId: String(appointment.doctor.id),
      appointmentTime: formatForInput(appointment.appointment_time),
      reason: appointment.reason || '',
    })
    setFormErrors({})
    setApiError(null)
    setPatientQuery(patientLabel(appointment.patient))
    setPatientResults([])
    setSelectedPatient(toSelectedPatient(appointment.patient))
    setShowModal(true)
  }

  const closeModal = () => {
    if (submitting) return
    setShowModal(false)
    setModalMode('create')
    setEditingAppointment(null)
    setForm({ ...EMPTY_FORM })
    setFormErrors({})
    setApiError(null)
    setPatientQuery('')
    setPatientResults([])
    setSelectedPatient(null)
  }

  const validateForm = () => {
    const errors: AppointmentFormErrors = {}

    if (modalMode === 'create' && !form.patientId) {
      errors.patientId = 'Vui lòng chọn bệnh nhân'
    }

    if (!form.doctorId) {
      errors.doctorId = 'Vui lòng chọn bác sĩ'
    }

    if (!form.appointmentTime) {
      errors.appointmentTime = 'Vui lòng chọn thời gian hẹn'
    } else if (modalMode === 'create' && !isFutureTime(form.appointmentTime)) {
      errors.appointmentTime = 'Thời gian hẹn phải trong tương lai'
    }

    return errors
  }

  const submitCreateAppointment = async () => {
    if (!token) return

    const payload = {
      patientId: Number(form.patientId),
      doctorId: Number(form.doctorId),
      appointmentTime: new Date(form.appointmentTime).toISOString(),
      reason: form.reason.trim(),
    }

    const response = await authFetch('/api/appointments/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await response.json()

    if (json.success) {
      setToast({ message: 'Tạo lịch hẹn thành công', type: 'success' })
      const appointmentTime = json.data?.appointment?.appointment_time
      const createdDate = appointmentTime ? format(parseISO(appointmentTime), 'yyyy-MM-dd') : dateFilter
      closeModal()
      await fetchAppointments(createdDate)
      return
    }

    const code = json.error?.code
    if (code === 'PAST_TIME') {
      setFormErrors((current) => ({
        ...current,
        appointmentTime: json.error?.message || 'Thời gian hẹn phải trong tương lai',
      }))
    }
    setApiError(json.error?.message || 'Tạo lịch hẹn thất bại')
  }

  const submitUpdateAppointment = async () => {
    if (!token || !editingAppointment) return

    const payload = {
      doctorId: Number(form.doctorId),
      appointmentTime: new Date(form.appointmentTime).toISOString(),
      reason: form.reason.trim(),
    }

    const response = await authFetch(`/api/appointments/${editingAppointment.id}/`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await response.json()

    if (json.success) {
      setToast({ message: 'Cập nhật lịch hẹn thành công', type: 'success' })
      closeModal()
      await refreshList()
      return
    }

    setApiError(json.error?.message || 'Cập nhật lịch hẹn thất bại')
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextErrors = validateForm()
    setFormErrors(nextErrors)
    setApiError(null)

    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    try {
      if (modalMode === 'create') {
        await submitCreateAppointment()
      } else {
        await submitUpdateAppointment()
      }
    } catch {
      setApiError('Không thể kết nối đến máy chủ')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancelAppointment = async (appointment: AppointmentRow) => {
    if (!token) return

    const confirmed = window.confirm('Huỷ lịch hẹn này?')
    if (!confirmed) return

    try {
      const response = await authFetch(`/api/appointments/${appointment.id}/cancel/`, {
        method: 'PATCH',
      })
      const json = await response.json()

      if (json.success) {
        setToast({ message: 'Huỷ lịch hẹn thành công', type: 'success' })
        await refreshList()
      } else {
        setToast({ message: json.error?.message || 'Huỷ lịch hẹn thất bại', type: 'error' })
      }
    } catch {
      setToast({ message: 'Không thể kết nối đến máy chủ', type: 'error' })
    }
  }

  const statusBadgeClass = (status: AppointmentStatus) => STATUS_CLASS_MAP[status] || 'badge-neutral'

  const filteredDoctors = useMemo(() => doctors, [doctors])
  const canManageActions = isReceptionist
  const filterColumns = isDoctor ? 'repeat(2, minmax(180px, 1fr))' : 'repeat(3, minmax(180px, 1fr))'

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Lịch hẹn</div>
          <div className="page-subtitle">Quản lý các lịch hẹn khám và tạo lịch hẹn mới.</div>
        </div>
        {isReceptionist && (
          <button className="btn btn-primary" onClick={openCreateModal}>
            <Plus size={18} />
            Tạo lịch hẹn
          </button>
        )}
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h3>Danh sách lịch hẹn</h3>
            <div className="cell-sub">Lọc theo ngày, bác sĩ và trạng thái.</div>
          </div>
          <div className="panel-actions" style={{ marginLeft: 'auto', justifyContent: 'flex-end' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: filterColumns,
                gap: 12,
                width: 'min(100%, 700px)',
              }}
            >
              <div className="search-box" style={{ width: '100%' }}>
                <Clock3 size={18} />
                <input
                  className="form-input"
                  type="date"
                  value={dateFilter}
                  onChange={(event) => setDateFilter(event.target.value)}
                  style={{ height: 40, width: '100%' }}
                />
              </div>

              {!isDoctor && (
                <div style={{ position: 'relative' }}>
                  <select
                    className="form-select"
                    value={doctorFilter}
                    onChange={(event) => setDoctorFilter(event.target.value)}
                    disabled={doctorsLoading}
                    style={{ height: 40 }}
                  >
                    <option value="all">Tất cả bác sĩ</option>
                    {filteredDoctors.map((doctor) => (
                      <option key={doctor.id} value={doctor.id}>
                        {doctor.full_name}
                      </option>
                    ))}
                  </select>
                  {doctorsLoading && (
                    <div
                      style={{
                        position: 'absolute',
                        right: 34,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <Loader2 size={14} className="spin" />
                    </div>
                  )}
                </div>
              )}

              <select
                className="form-select"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'all' | AppointmentStatus)}
                style={{ height: 40 }}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {appointmentsError && (
          <div style={{ padding: '0 24px 16px' }}>
            <div className="api-error-box" style={{ marginBottom: 0 }}>
              <AlertTriangle size={16} />
              <span>{appointmentsError}</span>
            </div>
          </div>
        )}

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Giờ</th>
                <th>Mã BN</th>
                <th>Bệnh nhân</th>
                <th>Bác sĩ</th>
                <th>Lý do</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {appointmentsLoading ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state" style={{ padding: 48 }}>
                      <Loader2 size={36} className="spin" style={{ opacity: 0.3, marginBottom: 8 }} />
                      <div className="empty-state-text">Đang tải lịch hẹn...</div>
                    </div>
                  </td>
                </tr>
              ) : appointments.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state" style={{ padding: 48 }}>
                      <CalendarPlus size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
                      <div className="empty-state-text">Chưa có lịch hẹn nào</div>
                      <div className="empty-state-hint">
                        {isReceptionist
                          ? 'Thay đổi bộ lọc hoặc tạo một lịch hẹn mới.'
                          : 'Thay đổi bộ lọc để xem dữ liệu phù hợp.'}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                appointments.map((appointment) => (
                  <tr key={String(appointment.id)}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{formatTime(appointment.appointment_time)}</div>
                      <div className="cell-sub">{formatDate(appointment.appointment_time)}</div>
                    </td>
                    <td>
                      <span className="badge badge-brand">{appointment.patient.patientCode}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{appointment.patient.fullName}</div>
                      <div className="cell-sub">{formatPhone(appointment.patient.phone)}</div>
                    </td>
                    <td>{appointment.doctor.fullName}</td>
                    <td style={{ maxWidth: 260 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {appointment.reason || '—'}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${statusBadgeClass(appointment.status)}`}>
                        <span className="badge-dot" />
                        {appointment.status}
                      </span>
                    </td>
                    <td>
                      {canManageActions && appointment.status !== 'COMPLETED' ? (
                        <div className="row-actions">
                          <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(appointment)}>
                            <Edit3 size={16} />
                            Sửa
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleCancelAppointment(appointment)}>
                            <Ban size={16} />
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <span className="cell-sub">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={!submitting ? closeModal : undefined}>
          <div className="modal-box wide" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{modalMode === 'create' ? 'Tạo lịch hẹn mới' : 'Cập nhật lịch hẹn'}</h3>
                <p>
                  {modalMode === 'create'
                    ? 'Chọn bệnh nhân, bác sĩ và thời gian khám.'
                    : 'Chỉnh sửa bác sĩ, thời gian hoặc lý do khám.'}
                </p>
              </div>
              <button className="modal-close" onClick={closeModal} disabled={submitting}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {apiError && (
                  <div className="api-error-box">
                    <AlertTriangle size={16} />
                    <span>{apiError}</span>
                  </div>
                )}

                {modalMode === 'create' ? (
                  <div className="form-group" style={{ position: 'relative' }}>
                    <label className="form-label required">Bệnh nhân</label>
                    <div style={{ position: 'relative' }}>
                      <div className="search-box" style={{ width: '100%' }}>
                        <UserRoundSearch size={18} />
                        <input
                          className={`form-input ${formErrors.patientId ? 'error' : ''}`}
                          placeholder="Tìm theo mã BN, tên hoặc SĐT"
                          value={patientQuery}
                          onChange={(event) => {
                            setPatientQuery(event.target.value)
                            setSelectedPatient(null)
                            setForm((current) => ({ ...current, patientId: '' }))
                          }}
                          disabled={submitting}
                          style={{ height: 44 }}
                        />
                      </div>

                      {(patientLoading || patientResults.length > 0) && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 6px)',
                            left: 0,
                            right: 0,
                            background: 'var(--surface-card)',
                            border: '1px solid var(--border-default)',
                            borderRadius: 'var(--radius-md)',
                            boxShadow: '0 10px 25px rgba(15,23,42,.12)',
                            zIndex: 20,
                            maxHeight: 260,
                            overflowY: 'auto',
                          }}
                        >
                          {patientLoading ? (
                            <div style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                              Đang tìm kiếm...
                            </div>
                          ) : patientResults.length > 0 ? (
                            patientResults.map((patient) => (
                              <button
                                key={String(patient.id)}
                                type="button"
                                onClick={() => {
                                  const selected = toSelectedPatient(patient)
                                  setSelectedPatient(selected)
                                  setPatientQuery(patientLabel(selected))
                                  setForm((current) => ({ ...current, patientId: String(patient.id) }))
                                  setPatientResults([])
                                  setFormErrors((current) => ({ ...current, patientId: undefined }))
                                }}
                                style={{
                                  display: 'flex',
                                  width: '100%',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 12,
                                  padding: '12px 16px',
                                  border: 'none',
                                  borderBottom: '1px solid var(--border-default)',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  font: 'inherit',
                                }}
                              >
                                <div>
                                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{patient.full_name}</div>
                                  <div className="cell-sub">{patient.patient_code} · {formatPhone(patient.phone)}</div>
                                </div>
                                <ChevronDown size={16} style={{ color: 'var(--text-muted)', transform: 'rotate(-90deg)' }} />
                              </button>
                            ))
                          ) : (
                            <div style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                              Không tìm thấy bệnh nhân phù hợp.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {selectedPatient && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          marginTop: 10,
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-brand-200)',
                          background: 'var(--color-brand-50)',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{selectedPatient.fullName}</div>
                          <div className="cell-sub">
                            {selectedPatient.patientCode} · {formatPhone(selectedPatient.phone)}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setSelectedPatient(null)
                            setForm((current) => ({ ...current, patientId: '' }))
                            setPatientQuery('')
                          }}
                        >
                          Đổi
                        </button>
                      </div>
                    )}
                    {formErrors.patientId && <div className="form-error">{formErrors.patientId}</div>}
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label">Bệnh nhân</label>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-default)',
                        background: 'var(--surface-muted)',
                      }}
                    >
                        <div>
                          <div style={{ fontWeight: 700 }}>{selectedPatient?.fullName}</div>
                        <div className="cell-sub">
                            {selectedPatient?.patientCode} · {formatPhone(selectedPatient?.phone)}
                        </div>
                      </div>
                      <span className="badge badge-brand">Đang sửa</span>
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label required">Bác sĩ</label>
                  <div style={{ position: 'relative' }}>
                    <select
                      className={`form-select ${formErrors.doctorId ? 'error' : ''}`}
                      value={form.doctorId}
                      onChange={(event) => setForm((current) => ({ ...current, doctorId: event.target.value }))}
                      disabled={submitting}
                    >
                      <option value="">Chọn bác sĩ</option>
                      {doctors.map((doctor) => (
                        <option key={doctor.id} value={doctor.id}>
                          {doctor.full_name}
                        </option>
                      ))}
                    </select>
                    {doctorsLoading && (
                      <div
                        style={{
                          position: 'absolute',
                          right: 34,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        <Loader2 size={14} className="spin" />
                      </div>
                    )}
                  </div>
                  {formErrors.doctorId && <div className="form-error">{formErrors.doctorId}</div>}
                </div>

                <div className="form-group">
                  <label className="form-label required">Ngày giờ hẹn</label>
                  <input
                    className={`form-input ${formErrors.appointmentTime ? 'error' : ''}`}
                    type="datetime-local"
                    value={form.appointmentTime}
                    onChange={(event) => setForm((current) => ({ ...current, appointmentTime: event.target.value }))}
                    min={modalMode === 'create' ? getDefaultFutureTime() : undefined}
                    disabled={submitting}
                  />
                  {formErrors.appointmentTime && <div className="form-error">{formErrors.appointmentTime}</div>}
                  <div className="form-hint">
                    {modalMode === 'create'
                      ? 'Chỉ cho phép thời gian trong tương lai.'
                      : 'Có thể thay đổi lịch hẹn nếu chưa hoàn thành.'}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Lý do khám</label>
                  <textarea
                    className="form-textarea"
                    rows={4}
                    value={form.reason}
                    onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
                    disabled={submitting}
                    placeholder="Mô tả ngắn lý do khám"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal} disabled={submitting}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? <Loader2 size={16} className="spin" /> : null}
                  {submitting ? 'Đang lưu...' : modalMode === 'create' ? 'Tạo lịch hẹn' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast toast-${toast.type}`}>
          <span>{toast.message}</span>
          <button className="toast-close" onClick={() => setToast(null)}>
            <X size={16} />
          </button>
        </div>
      )}
    </>
  )
}
