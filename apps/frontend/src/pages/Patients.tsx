import { useState, useCallback, useEffect } from 'react'
import { Search, Plus, X, Loader2, AlertTriangle, Users, Edit3, Eye } from 'lucide-react'
import { useAuthStore } from '../store'
import { authFetch } from '../lib/authFetch'
import { useNavigate } from 'react-router-dom'

interface Patient {
  id: number
  patient_code: string
  full_name: string
  dob: string
  gender: string
  phone: string
  address: string
  created_at?: string
  updated_at?: string
}

interface FormData {
  full_name: string
  dob: string
  gender: string
  phone: string
  address: string
}

interface FormErrors {
  full_name?: string
  dob?: string
  gender?: string
  phone?: string
}

interface EditFormData {
  full_name: string
  phone: string
  address: string
}

interface EditFormErrors {
  full_name?: string
  phone?: string
}

const GENDER_MAP: Record<string, string> = {
  M: 'Nam',
  F: 'Nữ',
  O: 'Khác',
}

const INITIAL_FORM: FormData = {
  full_name: '',
  dob: '',
  gender: 'M',
  phone: '',
  address: '',
}

export default function PatientsPage() {
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const isReceptionist = user?.role === 'receptionist'
  const isDoctor = user?.role === 'doctor'

  // ── Search state ──
  const [keyword, setKeyword] = useState('')
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  // ── Create modal state ──
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<FormData>({ ...INITIAL_FORM })
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  // ── Confirm duplicate ──
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false)
  const [pendingData, setPendingData] = useState<FormData | null>(null)

  // ── Detail / Edit modal state ──
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [detailMode, setDetailMode] = useState<'view' | 'edit'>('view')
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditFormData>({ full_name: '', phone: '', address: '' })
  const [editFormErrors, setEditFormErrors] = useState<EditFormErrors>({})
  const [editSubmitting, setEditSubmitting] = useState(false)

  // ── Toast ──
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // ── Search API ──
  const searchPatients = useCallback(async (kw: string = '') => {
    if (!token) return
    const trimmedKeyword = kw.trim()

    setLoading(true)
    setSearched(true)
    try {
      const url = trimmedKeyword
        ? `/api/patients/?keyword=${encodeURIComponent(trimmedKeyword)}`
        : '/api/patients/'
      const res = await authFetch(url)
      const json = await res.json()
      if (json.success) {
        setPatients(json.data.patients)
      } else {
        setPatients([])
      }
    } catch {
      setPatients([])
      setToast({ message: 'Không thể kết nối đến máy chủ', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [token])

  // ── Search handlers ──
  const handleSearch = () => {
    searchPatients(keyword)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  useEffect(() => {
    if (!token) return
    const timer = window.setTimeout(() => { void searchPatients('') }, 0)
    return () => window.clearTimeout(timer)
  }, [searchPatients, token])

  // ── Open / close modal ──
  const openModal = () => {
    setForm({ ...INITIAL_FORM })
    setFormErrors({})
    setApiError(null)
    setShowDuplicateConfirm(false)
    setPendingData(null)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setForm({ ...INITIAL_FORM })
    setFormErrors({})
    setApiError(null)
    setShowDuplicateConfirm(false)
    setPendingData(null)
  }

  // ── Form validation ──
  const validateForm = (data: FormData): FormErrors => {
    const errors: FormErrors = {}
    if (!data.full_name.trim()) {
      errors.full_name = 'Họ tên không được để trống'
    }
    if (!data.dob) {
      errors.dob = 'Vui lòng chọn ngày sinh'
    } else {
      const birthDate = new Date(data.dob)
      const today = new Date()
      today.setHours(23, 59, 59, 999)
      if (birthDate > today) {
        errors.dob = 'Ngày sinh không được trong tương lai'
      }
    }
    if (!data.gender) {
      errors.gender = 'Vui lòng chọn giới tính'
    }
    if (!data.phone.trim()) {
      errors.phone = 'Số điện thoại không được để trống'
    } else if (!/^\d{10,11}$/.test(data.phone.trim())) {
      errors.phone = 'SĐT phải có 10-11 chữ số'
    }
    return errors
  }

  // ── Create API ──
  const createPatient = async (data: FormData) => {
    if (!token) return false
    setSubmitting(true)
    setApiError(null)
    try {
      const res = await authFetch('/api/patients/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: data.full_name.trim(),
          dob: data.dob,
          gender: data.gender,
          phone: data.phone.trim(),
          address: data.address.trim(),
        }),
      })
      const json = await res.json()
      if (json.success) {
        setToast({ message: 'Tạo hồ sơ bệnh nhân thành công', type: 'success' })
        closeModal()
        await searchPatients(keyword)
        return true
      }
      const code = json.error?.code
      if (code === 'DUPLICATE_PHONE') {
        setPendingData(data)
        setShowDuplicateConfirm(true)
        return false
      }
      setApiError(json.error?.message || 'Tạo bệnh nhân thất bại')
      return false
    } catch {
      setApiError('Không thể kết nối đến máy chủ')
      return false
    } finally {
      setSubmitting(false)
    }
  }

  // ── Submit form ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors = validateForm(form)
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return
    await createPatient(form)
  }

  // ── Confirm create despite duplicate phone ──
  const confirmDuplicate = async () => {
    if (!pendingData) return
    setShowDuplicateConfirm(false)
    setSubmitting(true)
    setApiError(null)
    try {
      const res = await authFetch('/api/patients/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: pendingData.full_name.trim(),
          dob: pendingData.dob,
          gender: pendingData.gender,
          phone: pendingData.phone.trim(),
          address: pendingData.address.trim(),
          force: true,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setToast({ message: 'Tạo hồ sơ bệnh nhân thành công', type: 'success' })
        closeModal()
        await searchPatients(keyword)
      } else {
        setApiError(json.error?.message || 'Tạo bệnh nhân thất bại')
      }
    } catch {
      setApiError('Không thể kết nối đến máy chủ')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Cancel duplicate confirm ──
  const cancelDuplicate = () => {
    setShowDuplicateConfirm(false)
    setPendingData(null)
  }

  // ── Fetch patient detail ──
  const fetchPatientDetail = useCallback(async (id: number) => {
    if (!token) return
    setDetailLoading(true)
    setDetailError(null)
    try {
      const res = await authFetch(`/api/patients/${id}/`)
      const json = await res.json()
      if (json.success) {
        setSelectedPatient(json.data.patient)
      } else {
        setDetailError(json.error?.message || 'Không thể tải thông tin')
      }
    } catch {
      setDetailError('Không thể kết nối đến máy chủ')
    } finally {
      setDetailLoading(false)
    }
  }, [token])

  // ── Open detail modal ──
  const openDetail = (patient: Patient) => {
    setSelectedPatient(patient)
    setDetailMode('view')
    setDetailError(null)
    setEditFormErrors({})
    setShowDetailModal(true)
    fetchPatientDetail(patient.id)
  }

  // ── Close detail modal ──
  const closeDetail = () => {
    setShowDetailModal(false)
    setSelectedPatient(null)
    setDetailMode('view')
    setDetailError(null)
    setEditFormErrors({})
    setEditSubmitting(false)
  }

  // ── Switch detail modal to edit mode ──
  const switchToEdit = () => {
    if (!selectedPatient) return
    setEditForm({
      full_name: selectedPatient.full_name,
      phone: selectedPatient.phone,
      address: selectedPatient.address,
    })
    setEditFormErrors({})
    setDetailMode('edit')
  }

  // ── Validate edit form ──
  const validateEditForm = (data: EditFormData): EditFormErrors => {
    const errors: EditFormErrors = {}
    if (!data.full_name.trim()) {
      errors.full_name = 'Họ tên không được để trống'
    }
    if (!data.phone.trim()) {
      errors.phone = 'Số điện thoại không được để trống'
    } else if (!/^\d{10,11}$/.test(data.phone.trim())) {
      errors.phone = 'SĐT phải có 10-11 chữ số'
    }
    return errors
  }

  // ── Update patient API ──
  const updatePatient = async () => {
    if (!token || !selectedPatient) return
    const errors = validateEditForm(editForm)
    setEditFormErrors(errors)
    if (Object.keys(errors).length > 0) return

    setEditSubmitting(true)
    setDetailError(null)
    try {
      const res = await authFetch(`/api/patients/${selectedPatient.id}/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: editForm.full_name.trim(),
          phone: editForm.phone.trim(),
          address: editForm.address.trim(),
        }),
      })
      const json = await res.json()
      if (json.success) {
        setToast({ message: 'Cập nhật thông tin thành công', type: 'success' })
        closeDetail()
        // Refresh list
        await searchPatients(keyword)
      } else {
        setDetailError(json.error?.message || 'Cập nhật thất bại')
      }
    } catch {
      setDetailError('Không thể kết nối đến máy chủ')
    } finally {
      setEditSubmitting(false)
    }
  }

  // ── Toast auto-dismiss ──
  const dismissToast = () => setToast(null)

  // ── Format helpers ──
  const formatGender = (g: string) => GENDER_MAP[g] || g
  const formatDob = (d: string) => {
    if (!d) return ''
    const [y, m, day] = d.split('-')
    return `${day}/${m}/${y}`
  }
  const formatDateTime = (dt: string) => {
    try {
      const d = new Date(dt)
      const day = String(d.getDate()).padStart(2, '0')
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const year = d.getFullYear()
      const hours = String(d.getHours()).padStart(2, '0')
      const mins = String(d.getMinutes()).padStart(2, '0')
      return `${day}/${month}/${year} ${hours}:${mins}`
    } catch {
      return dt
    }
  }

  return (
    <>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="page-title">Danh sách bệnh nhân</div>
          <div className="page-subtitle">Tra cứu hồ sơ bệnh nhân đã từng khám tại phòng khám.</div>
        </div>
        {isReceptionist && (
          <button className="btn btn-primary" onClick={openModal}>
            <Plus size={18} />
            Thêm bệnh nhân
          </button>
        )}
      </div>

      {/* Panel */}
      <div className="panel">
        <div className="panel-header">
          <h3>Hồ sơ bệnh nhân</h3>
          <div className="panel-actions">
            <div className="search-box">
              <Search size={18} />
              <input
                className="form-input"
                placeholder="Tìm theo tên, mã bệnh nhân hoặc số điện thoại..."
                style={{ height: 40 }}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            <button className="btn btn-primary btn-sm" onClick={handleSearch} disabled={loading}>
              {loading ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
              Tìm kiếm
            </button>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Mã bệnh nhân</th>
                <th>Họ và tên</th>
                <th>Ngày sinh</th>
                <th>Giới tính</th>
                <th>Số điện thoại</th>
                <th>Địa chỉ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state" style={{ padding: 48 }}>
                      <Loader2 size={36} className="spin" style={{ opacity: 0.3, marginBottom: 8 }} />
                      <div className="empty-state-text">Đang tải danh sách bệnh nhân...</div>
                    </div>
                  </td>
                </tr>
              ) : !searched ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state" style={{ padding: 48 }}>
                      <Search size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
                      <div className="empty-state-text">Chưa có dữ liệu bệnh nhân</div>
                      <div className="empty-state-hint">
                        Có thể tìm kiếm theo mã bệnh nhân, họ tên hoặc số điện thoại.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state" style={{ padding: 48 }}>
                      <Users size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
                      <div className="empty-state-text">Không tìm thấy bệnh nhân nào</div>
                      <div className="empty-state-hint">
                        {keyword.trim()
                          ? 'Thử thay đổi từ khóa tìm kiếm hoặc thêm bệnh nhân mới.'
                          : 'Hiện chưa có bệnh nhân nào trong hệ thống.'}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                patients.map((p) => (
                  <tr key={p.id} className="patient-row" onClick={() => openDetail(p)}>
                    <td>
                      <span className="badge badge-brand">{p.patient_code}</span>
                    </td>
                    <td className="patient-name">{p.full_name}</td>
                    <td>{formatDob(p.dob)}</td>
                    <td>{formatGender(p.gender)}</td>
                    <td>{p.phone}</td>
                    <td className="cell-address">{p.address || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Create Modal ─── */}
      {showModal && (
        <div className="modal-overlay" onClick={!submitting ? closeModal : undefined}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Thêm bệnh nhân mới</h3>
                <p>Nhập thông tin bệnh nhân để tạo hồ sơ.</p>
              </div>
              <button className="modal-close" onClick={closeModal} disabled={submitting}>
                <X size={20} />
              </button>
            </div>

            {showDuplicateConfirm && pendingData ? (
              <>
                <div className="modal-body">
                  <div className="confirm-duplicate">
                    <AlertTriangle size={36} style={{ color: 'var(--color-warning-600)' }} />
                    <h4>Số điện thoại có thể đã tồn tại</h4>
                    <p>
                      Số điện thoại <strong>{pendingData.phone}</strong> này có thể đã thuộc về một
                      bệnh nhân khác. Bạn vẫn muốn tạo hồ sơ mới?
                    </p>
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={cancelDuplicate}>
                    Hủy
                  </button>
                  <button className="btn btn-primary" onClick={confirmDuplicate} disabled={submitting}>
                    {submitting ? <Loader2 size={16} className="spin" /> : null}
                    Vẫn tạo
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  {apiError && (
                    <div className="api-error-box">
                      <AlertTriangle size={16} />
                      <span>{apiError}</span>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label required">Họ và tên</label>
                    <input
                      className={`form-input ${formErrors.full_name ? 'error' : ''}`}
                      placeholder="Nguyễn Văn A"
                      value={form.full_name}
                      onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                      disabled={submitting}
                    />
                    {formErrors.full_name && <div className="form-error">{formErrors.full_name}</div>}
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label className="form-label required">Ngày sinh</label>
                      <input
                        type="date"
                        className={`form-input ${formErrors.dob ? 'error' : ''}`}
                        value={form.dob}
                        onChange={(e) => setForm({ ...form, dob: e.target.value })}
                        disabled={submitting}
                      />
                      {formErrors.dob && <div className="form-error">{formErrors.dob}</div>}
                    </div>

                    <div className="form-group">
                      <label className="form-label required">Giới tính</label>
                      <select
                        className={`form-select ${formErrors.gender ? 'error' : ''}`}
                        value={form.gender}
                        onChange={(e) => setForm({ ...form, gender: e.target.value })}
                        disabled={submitting}
                      >
                        <option value="M">Nam</option>
                        <option value="F">Nữ</option>
                        <option value="O">Khác</option>
                      </select>
                      {formErrors.gender && <div className="form-error">{formErrors.gender}</div>}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label required">Số điện thoại</label>
                    <input
                      className={`form-input ${formErrors.phone ? 'error' : ''}`}
                      placeholder="0901234567"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      disabled={submitting}
                    />
                    {formErrors.phone && <div className="form-error">{formErrors.phone}</div>}
                    <div className="form-hint">Số điện thoại phải có 10-11 chữ số.</div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Địa chỉ</label>
                    <input
                      className="form-input"
                      placeholder="Số nhà, đường, quận/huyện (không bắt buộc)"
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      disabled={submitting}
                    />
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={closeModal} disabled={submitting}>
                    Hủy
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? <Loader2 size={16} className="spin" /> : null}
                    {submitting ? 'Đang lưu...' : 'Lưu hồ sơ'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ─── Detail / Edit Modal ─── */}
      {showDetailModal && selectedPatient && (
        <div className="modal-overlay" onClick={!editSubmitting ? closeDetail : undefined}>
          <div className="modal-box wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{detailMode === 'view' ? 'Chi tiết bệnh nhân' : 'Chỉnh sửa thông tin'}</h3>
                <p>
                  {detailMode === 'view'
                    ? `Mã bệnh nhân: ${selectedPatient.patient_code}`
                    : 'Chỉ được sửa họ tên, số điện thoại và địa chỉ.'}
                </p>
              </div>
              <button className="modal-close" onClick={closeDetail} disabled={editSubmitting}>
                <X size={20} />
              </button>
            </div>

            {detailLoading ? (
              <div className="modal-body">
                <div className="empty-state" style={{ padding: 32 }}>
                  <Loader2 size={32} className="spin" style={{ opacity: 0.3, marginBottom: 8 }} />
                  <div className="empty-state-text">Đang tải...</div>
                </div>
              </div>
            ) : detailError ? (
              <div className="modal-body">
                <div className="api-error-box">
                  <AlertTriangle size={16} />
                  <span>{detailError}</span>
                </div>
                <div className="modal-footer" style={{ padding: '16px 0 0' }}>
                  <button className="btn btn-secondary" onClick={closeDetail}>Đóng</button>
                </div>
              </div>
            ) : detailMode === 'view' ? (
              <>
                <div className="modal-body">
                  <table className="detail-table">
                    <tbody>
                      <tr><td className="detail-label">Mã bệnh nhân</td><td><span className="badge badge-brand">{selectedPatient.patient_code}</span></td></tr>
                      <tr><td className="detail-label">Họ và tên</td><td className="detail-value">{selectedPatient.full_name}</td></tr>
                      <tr><td className="detail-label">Ngày sinh</td><td>{formatDob(selectedPatient.dob)}</td></tr>
                      <tr><td className="detail-label">Giới tính</td><td>{formatGender(selectedPatient.gender)}</td></tr>
                      <tr><td className="detail-label">Số điện thoại</td><td>{selectedPatient.phone}</td></tr>
                      <tr><td className="detail-label">Địa chỉ</td><td>{selectedPatient.address || '—'}</td></tr>
                      <tr><td className="detail-label">Ngày tạo</td><td>{selectedPatient.created_at ? formatDateTime(selectedPatient.created_at) : '—'}</td></tr>
                      <tr><td className="detail-label">Cập nhật</td><td>{selectedPatient.updated_at ? formatDateTime(selectedPatient.updated_at) : '—'}</td></tr>
                    </tbody>
                  </table>
                </div>
                <div className="modal-footer">
                  {isDoctor && (
                    <button
                      className="btn btn-secondary"
                      onClick={() => navigate(`/medical-records?patientId=${selectedPatient.id}`)}
                    >
                      <Eye size={16} />
                      Xem bệnh án
                    </button>
                  )}
                  <button className="btn btn-secondary" onClick={closeDetail}>Đóng</button>
                  {isReceptionist && (
                    <button className="btn btn-primary" onClick={switchToEdit}>
                      <Edit3 size={16} />
                      Chỉnh sửa
                    </button>
                  )}
                </div>
              </>
            ) : (
              /* ── Edit mode ── */
              <>
                <div className="modal-body">
                  {detailError && (
                    <div className="api-error-box">
                      <AlertTriangle size={16} />
                      <span>{detailError}</span>
                    </div>
                  )}

                  {/* Read-only fields */}
                  <div className="form-group">
                    <label className="form-label">Mã bệnh nhân</label>
                    <input className="form-input" value={selectedPatient.patient_code} disabled style={{ opacity: 0.6 }} />
                  </div>
                  <div className="form-row-2">
                    <div className="form-group">
                      <label className="form-label">Ngày sinh</label>
                      <input className="form-input" value={formatDob(selectedPatient.dob)} disabled style={{ opacity: 0.6 }} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Giới tính</label>
                      <input className="form-input" value={formatGender(selectedPatient.gender)} disabled style={{ opacity: 0.6 }} />
                    </div>
                  </div>

                  {/* Editable fields */}
                  <div className="form-group">
                    <label className="form-label required">Họ và tên</label>
                    <input
                      className={`form-input ${editFormErrors.full_name ? 'error' : ''}`}
                      value={editForm.full_name}
                      onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                      disabled={editSubmitting}
                    />
                    {editFormErrors.full_name && <div className="form-error">{editFormErrors.full_name}</div>}
                  </div>

                  <div className="form-group">
                    <label className="form-label required">Số điện thoại</label>
                    <input
                      className={`form-input ${editFormErrors.phone ? 'error' : ''}`}
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      disabled={editSubmitting}
                    />
                    {editFormErrors.phone && <div className="form-error">{editFormErrors.phone}</div>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Địa chỉ</label>
                    <input
                      className="form-input"
                      value={editForm.address}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                      disabled={editSubmitting}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => { setDetailMode('view'); setDetailError(null); setEditFormErrors({}); }} disabled={editSubmitting}>
                    Hủy
                  </button>
                  <button className="btn btn-primary" onClick={updatePatient} disabled={editSubmitting}>
                    {editSubmitting ? <Loader2 size={16} className="spin" /> : null}
                    {editSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── Toast ─── */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          <span>{toast.message}</span>
          <button className="toast-close" onClick={dismissToast}>
            <X size={16} />
          </button>
        </div>
      )}
    </>
  )
}
