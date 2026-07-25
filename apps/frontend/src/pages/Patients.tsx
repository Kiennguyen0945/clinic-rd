import { useEffect, useMemo, useState } from 'react'
import { Eye, Filter, MoreHorizontal, Plus, Search, X } from 'lucide-react'
import { appointmentApi } from '../lib/appointmentsApi'
import type { ApiPatient } from '../lib/appointmentsApi'

interface Patient {
  id: string
  code: string
  fullName: string
  gender: 'Nam' | 'Nữ'
  dob: string
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
}

interface NewPatientDraft {
  fullName: string
  phone: string
  gender: Patient['gender']
  dob: string
  email: string
  cccd: string
  address: string
}

const emptyPatientDraft: NewPatientDraft = {
  fullName: '',
  phone: '',
  gender: 'Nam',
  dob: '',
  email: '',
  cccd: '',
  address: '',
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
})

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [keyword, setKeyword] = useState('')
  const [gender, setGender] = useState('all')
  const [age, setAge] = useState('all')
  const [lastVisit, setLastVisit] = useState('all')
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [showMenu, setShowMenu] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newPatient, setNewPatient] = useState<NewPatientDraft>(emptyPatientDraft)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [refreshVersion, setRefreshVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const response = await appointmentApi.patients({
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

  useEffect(() => {
    setPage(1)
  }, [age, gender, keyword])

  const filteredPatients = useMemo(() => patients.filter((patient) => {
    const matchesVisit = lastVisit === 'all' || (lastVisit === 'today' ? patient.lastVisit === '18/07/2026' : patient.lastVisit !== '18/07/2026')
    return matchesVisit
  }), [lastVisit, patients])

  const createPatient = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!newPatient.fullName.trim() || !newPatient.phone.trim() || !newPatient.dob) return
    if (newPatient.cccd.trim() && !/^\d{9,12}$/.test(newPatient.cccd.trim())) {
      setError('Số CCCD/CMND phải có từ 9 đến 12 chữ số.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const response = await appointmentApi.createPatient({
        full_name: newPatient.fullName.trim(),
        phone: newPatient.phone.replace(/\s/g, ''),
        dob: newPatient.dob,
        gender: newPatient.gender === 'Nữ' ? 'F' : 'M',
        email: newPatient.email.trim(),
        cccd: newPatient.cccd.trim(),
        address: newPatient.address.trim(),
      })
      if (page === 1) setPatients((current) => [mapApiPatient(response.patient), ...current].slice(0, 10))
      setTotalItems((current) => current + 1)
      setNewPatient(emptyPatientDraft)
      setShowCreate(false)
      setPage(1)
      setRefreshVersion((current) => current + 1)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Không thể tạo hồ sơ bệnh nhân.')
    } finally {
      setSaving(false)
    }
  }

  return <div className="patients-mock-page">
    <div className="page-header patient-page-heading">
      <div>
        <div className="page-title">Bệnh nhân</div>
        <div className="page-subtitle">Tra cứu và quản lý thông tin bệnh nhân từng khám tại phòng khám.</div>
      </div>
      <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
        <Plus size={17} /> Thêm bệnh nhân
      </button>
    </div>

    <section className="patient-toolbar">
      <div className="patient-search">
        <Search size={17} />
        <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Tìm theo tên, mã bệnh nhân hoặc số điện thoại..." />
      </div>
      <select value={gender} onChange={(e) => setGender(e.target.value)}>
        <option value="all">Giới tính: Tất cả</option>
        <option>Nam</option>
        <option>Nữ</option>
      </select>
      <select value={age} onChange={(e) => setAge(e.target.value)}>
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
                  <button className="icon-button" onClick={() => setShowMenu(showMenu === patient.id ? null : patient.id)} aria-label="Thao tác khác"><MoreHorizontal size={17} /></button>
                  {showMenu === patient.id && <div className="patient-row-menu">
                    <button onClick={() => setSelectedPatient(patient)}>Xem chi tiết</button>
                    <button>Chỉnh sửa thông tin</button>
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

    {selectedPatient && <PatientDrawer patient={selectedPatient} onClose={() => setSelectedPatient(null)} />}
    {showCreate && <CreatePatientModal value={newPatient} setValue={setNewPatient} saving={saving} error={error} onClose={() => setShowCreate(false)} onSubmit={createPatient} />}
  </div>
}

function PatientDrawer({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  return <div className="drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <aside className="patient-drawer">
      <div className="drawer-header">
        <div>
          <span>Hồ sơ bệnh nhân</span>
          <h2>{patient.fullName}</h2>
        </div>
        <button className="icon-button" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="drawer-profile">
        <div className={`patient-avatar avatar-${patient.gender === 'Nam' ? 'blue' : 'pink'}`}>{patient.fullName.split(' ').slice(-1)[0][0]}</div>
        <div>
          <strong>{patient.code}</strong>
          <span>{patient.gender} · {patient.age || '—'} tuổi</span>
        </div>
      </div>
      <div className="drawer-alert"><strong>Dị ứng:</strong> {patient.allergy}</div>
      <dl className="drawer-details">
        <div><dt>Số điện thoại</dt><dd>{patient.phone}</dd></div>
        <div><dt>Email</dt><dd>{patient.email}</dd></div>
        <div><dt>Số CCCD/CMND</dt><dd>{patient.cccd}</dd></div>
        <div><dt>Ngày sinh</dt><dd>{patient.dob}</dd></div>
        <div><dt>Địa chỉ</dt><dd>{patient.address}</dd></div>
        <div><dt>Nhóm máu</dt><dd>{patient.bloodType}</dd></div>
        <div><dt>Tiền sử bệnh</dt><dd>{patient.history}</dd></div>
      </dl>
      <div className="drawer-section">
        <h3>Lần khám gần nhất</h3>
        <div className="drawer-visit">
          <strong>{patient.lastVisit}</strong>
          <span>{patient.lastReason}</span>
        </div>
      </div>
      <div className="drawer-footer">
        <button className="btn btn-secondary">Chỉnh sửa</button>
        <button className="btn btn-primary" onClick={onClose}>Đóng</button>
      </div>
    </aside>
  </div>
}

function CreatePatientModal({ value, setValue, saving, error, onClose, onSubmit }: { value: NewPatientDraft; setValue: React.Dispatch<React.SetStateAction<NewPatientDraft>>; saving: boolean; error: string; onClose: () => void; onSubmit: (event: React.FormEvent) => void }) {
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <form className="patient-create-modal" onSubmit={onSubmit}>
      <div className="modal-header">
        <div>
          <h2>Thêm bệnh nhân</h2>
          <p>Nhập thông tin hành chính để tạo hồ sơ bệnh nhân.</p>
        </div>
        <button type="button" className="icon-button" onClick={onClose}><X size={18} /></button>
      </div>

      <div className="patient-modal-fields">
        <label className="span-two">
          Họ và tên *
          <input autoFocus value={value.fullName} onChange={(e) => setValue((v) => ({ ...v, fullName: e.target.value }))} placeholder="Nguyễn Văn A" required />
        </label>
        <label>
          Ngày sinh *
          <input type="date" value={value.dob} onChange={(e) => setValue((v) => ({ ...v, dob: e.target.value }))} required />
        </label>
        <label>
          Giới tính *
          <select value={value.gender} onChange={(e) => setValue((v) => ({ ...v, gender: e.target.value as Patient['gender'] }))} required>
            <option>Nam</option>
            <option>Nữ</option>
          </select>
        </label>
        <label>
          Số điện thoại *
          <input value={value.phone} onChange={(e) => setValue((v) => ({ ...v, phone: e.target.value }))} placeholder="0901234567" required />
          <span className="field-hint">SĐT nên có 10-11 chữ số.</span>
        </label>
        <label>
          Email
          <input type="email" value={value.email} onChange={(e) => setValue((v) => ({ ...v, email: e.target.value }))} placeholder="email@example.com" />
        </label>
        <label>
          Số CCCD/CMND
          <input inputMode="numeric" maxLength={12} value={value.cccd} onChange={(e) => setValue((v) => ({ ...v, cccd: e.target.value.replace(/\D/g, '') }))} placeholder="Nhập 9–12 chữ số" />
        </label>
        <label className="span-two">
          Địa chỉ
          <textarea rows={3} value={value.address} onChange={(e) => setValue((v) => ({ ...v, address: e.target.value }))} placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành" />
        </label>
      </div>

      {error && <div className="form-error">{error}</div>}
      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Đang tạo...' : 'Tạo hồ sơ'}</button>
      </div>
    </form>
  </div>
}
