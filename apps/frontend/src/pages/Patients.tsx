import { useMemo, useState } from 'react'
import { Eye, Filter, MoreHorizontal, Plus, Search, X } from 'lucide-react'

interface Patient {
  id: string
  code: string
  fullName: string
  gender: 'Nam' | 'Nữ'
  dob: string
  age: number
  phone: string
  email: string
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
  address: string
}

const INITIAL_PATIENTS: Patient[] = [
  { id: 'p-1', code: 'BN-20260701-002', fullName: 'Nguyễn Văn A', gender: 'Nam', dob: '01/01/1992', age: 34, phone: '0901 222 333', email: 'nguyenvana@gmail.com', address: '123 Đường ABC, Quận 1, TP.HCM', lastVisit: '18/07/2026', lastReason: 'Đau đầu, chóng mặt', allergy: 'Penicillin', bloodType: 'O+', history: 'Tăng huyết áp (2 năm)' },
  { id: 'p-2', code: 'BN-20260712-001', fullName: 'Phạm Thị D', gender: 'Nữ', dob: '12/05/1990', age: 35, phone: '0901 456 789', email: 'phamthid@gmail.com', address: '45 Nguyễn Trãi, Quận 5, TP.HCM', lastVisit: '18/07/2026', lastReason: 'Đau bụng, đầy hơi', allergy: 'Không ghi nhận', bloodType: 'A+', history: 'Viêm dạ dày' },
  { id: 'p-3', code: 'BN-20260711-003', fullName: 'Lê Văn C', gender: 'Nam', dob: '20/03/1997', age: 28, phone: '0933 111 222', email: 'levanc@gmail.com', address: '18 Lê Lợi, Quận 3, TP.HCM', lastVisit: '18/07/2026', lastReason: 'Sốt nhẹ, ho khan', allergy: 'Chưa cập nhật', bloodType: 'B+', history: 'Không ghi nhận' },
  { id: 'p-4', code: 'BN-20260709-004', fullName: 'Trần Thị B', gender: 'Nữ', dob: '15/11/1982', age: 42, phone: '0988 444 555', email: 'tranthib@gmail.com', address: '88 Võ Văn Tần, Quận 3, TP.HCM', lastVisit: '15/07/2026', lastReason: 'Khó tiêu, đầy bụng', allergy: 'Không ghi nhận', bloodType: 'O+', history: 'Rối loạn mỡ máu' },
  { id: 'p-5', code: 'BN-20260705-001', fullName: 'Nguyễn Hoàng E', gender: 'Nam', dob: '02/02/1995', age: 30, phone: '0977 888 999', email: 'nguyenhoange@gmail.com', address: '12 Hoàng Diệu, Quận 4, TP.HCM', lastVisit: '12/07/2026', lastReason: 'Đau họng, viêm mũi', allergy: 'Không ghi nhận', bloodType: 'AB+', history: 'Không ghi nhận' },
]

const emptyPatientDraft: NewPatientDraft = {
  fullName: '',
  phone: '',
  gender: 'Nam',
  dob: '',
  email: '',
  address: '',
}

const formatDob = (value: string) => value ? new Intl.DateTimeFormat('vi-VN').format(new Date(`${value}T12:00:00`)) : 'Chưa cập nhật'
const calculateAge = (value: string) => {
  if (!value) return 0
  const birthDate = new Date(`${value}T12:00:00`)
  const today = new Date('2026-07-19T12:00:00')
  let age = today.getFullYear() - birthDate.getFullYear()
  const hasNotHadBirthday = today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())
  if (hasNotHadBirthday) age -= 1
  return age
}

export default function PatientsPage() {
  const [patients, setPatients] = useState(INITIAL_PATIENTS)
  const [keyword, setKeyword] = useState('')
  const [gender, setGender] = useState('all')
  const [age, setAge] = useState('all')
  const [lastVisit, setLastVisit] = useState('all')
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [showMenu, setShowMenu] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newPatient, setNewPatient] = useState<NewPatientDraft>(emptyPatientDraft)

  const filteredPatients = useMemo(() => patients.filter((patient) => {
    const query = keyword.trim().toLowerCase()
    const matchesQuery = !query || [patient.fullName, patient.code, patient.phone].some((value) => value.toLowerCase().includes(query))
    const matchesGender = gender === 'all' || patient.gender === gender
    const matchesAge = age === 'all' || (age === 'under30' ? patient.age < 30 : age === '30to40' ? patient.age >= 30 && patient.age <= 40 : patient.age > 40)
    const matchesVisit = lastVisit === 'all' || (lastVisit === 'today' ? patient.lastVisit === '18/07/2026' : patient.lastVisit !== '18/07/2026')
    return matchesQuery && matchesGender && matchesAge && matchesVisit
  }), [age, gender, keyword, lastVisit, patients])

  const createPatient = (event: React.FormEvent) => {
    event.preventDefault()
    if (!newPatient.fullName.trim() || !newPatient.phone.trim() || !newPatient.dob) return

    const item: Patient = {
      id: `p-${Date.now()}`,
      code: `BN-20260719-${String(patients.length + 1).padStart(3, '0')}`,
      fullName: newPatient.fullName.trim(),
      gender: newPatient.gender,
      dob: formatDob(newPatient.dob),
      age: calculateAge(newPatient.dob),
      phone: newPatient.phone.trim(),
      email: newPatient.email.trim() || 'Chưa cập nhật',
      address: newPatient.address.trim() || 'Chưa cập nhật',
      lastVisit: 'Chưa có',
      lastReason: 'Chưa có lịch sử khám',
      allergy: 'Chưa cập nhật',
      bloodType: 'Chưa cập nhật',
      history: 'Chưa cập nhật',
    }

    setPatients((current) => [item, ...current])
    setNewPatient(emptyPatientDraft)
    setShowCreate(false)
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
            {filteredPatients.map((patient) => <tr key={patient.id}>
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
        <span>Hiển thị 1 đến {filteredPatients.length} trong tổng số {patients.length} bệnh nhân</span>
        <div className="pagination">
          <span>Hiển thị:</span>
          <select defaultValue="10"><option>10</option><option>20</option></select>
          <button className="icon-button" disabled>‹</button>
          <button className="page-number active">1</button>
          <button className="page-number">2</button>
          <button className="page-number">3</button>
          <button className="icon-button">›</button>
        </div>
      </div>
    </section>

    {selectedPatient && <PatientDrawer patient={selectedPatient} onClose={() => setSelectedPatient(null)} />}
    {showCreate && <CreatePatientModal value={newPatient} setValue={setNewPatient} onClose={() => setShowCreate(false)} onSubmit={createPatient} />}
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

function CreatePatientModal({ value, setValue, onClose, onSubmit }: { value: NewPatientDraft; setValue: React.Dispatch<React.SetStateAction<NewPatientDraft>>; onClose: () => void; onSubmit: (event: React.FormEvent) => void }) {
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <form className="patient-create-modal" onSubmit={onSubmit}>
      <div className="modal-header">
        <div>
          <h2>Thêm bệnh nhân</h2>
          <p>Nhập thông tin hành chính để tạo hồ sơ bệnh nhân mock.</p>
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
        <label className="span-two">
          Địa chỉ
          <textarea rows={3} value={value.address} onChange={(e) => setValue((v) => ({ ...v, address: e.target.value }))} placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành" />
        </label>
      </div>

      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button>
        <button className="btn btn-primary" type="submit">Tạo hồ sơ</button>
      </div>
    </form>
  </div>
}
