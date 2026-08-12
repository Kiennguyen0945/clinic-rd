import { Eye, MoreHorizontal, Search } from 'lucide-react'
import { useState } from 'react'

import type { PatientListItem } from '../model/patient.types'

interface PatientTableProps {
  patients: PatientListItem[]
  loading: boolean
  canManagePatients: boolean
  page: number
  totalItems: number
  totalPages: number
  onPageChange: (page: number) => void
  onSelect: (patient: PatientListItem) => void
  onEdit: (patient: PatientListItem) => void
  onCreateAppointment: (patient: PatientListItem) => void
}

export default function PatientTable({
  patients,
  loading,
  canManagePatients,
  page,
  totalItems,
  totalPages,
  onPageChange,
  onSelect,
  onEdit,
  onCreateAppointment,
}: PatientTableProps) {
  const [showMenu, setShowMenu] = useState<string | null>(null)

  return <section className="patient-table-card">
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
          {loading ? <tr><td colSpan={5}>Đang tải dữ liệu bệnh nhân...</td></tr> : patients.map((patient) => <tr key={patient.id}>
            <td>
              <div className="patient-cell">
                <div className={`patient-avatar avatar-${patient.gender === 'Nam' ? 'blue' : 'pink'}`}>{patient.fullName.split(' ').slice(-1)[0][0]}</div>
                <div><strong>{patient.fullName}</strong><span>Mã BN: {patient.code}</span></div>
              </div>
            </td>
            <td><div className="contact-cell"><strong>{patient.phone}</strong><span>{patient.email}</span></div></td>
            <td><div className="info-cell"><strong>{patient.gender} · {patient.age || '—'} tuổi</strong><span>{patient.dob}</span></div></td>
            <td><div className="visit-cell"><strong>{patient.lastVisit}</strong><span>{patient.lastReason}</span></div></td>
            <td>
              <div className="patient-actions">
                <button className="btn btn-outline-blue btn-sm" onClick={() => onSelect(patient)}><Eye size={14} /> Xem hồ sơ</button>
                {canManagePatients && <button className="icon-button" onClick={() => setShowMenu(showMenu === patient.id ? null : patient.id)} aria-label="Thao tác khác"><MoreHorizontal size={17} /></button>}
                {canManagePatients && showMenu === patient.id && <div className="patient-row-menu">
                  <button onClick={() => onSelect(patient)}>Xem chi tiết</button>
                  <button onClick={() => { onEdit(patient); setShowMenu(null) }}>Cập nhật thông tin</button>
                  <button onClick={() => { onCreateAppointment(patient); setShowMenu(null) }}>Tạo lịch hẹn</button>
                </div>}
              </div>
            </td>
          </tr>)}
        </tbody>
      </table>

      {patients.length === 0 && <div className="patient-empty">
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
        <button className="icon-button" disabled={page <= 1 || loading} onClick={() => onPageChange(Math.max(1, page - 1))}>‹</button>
        {Array.from({ length: totalPages }, (_, index) => index + 1).filter((value) => value === 1 || value === totalPages || Math.abs(value - page) <= 1).map((value, index, values) => <span key={value} className="pagination-page-item">{index > 0 && value - values[index - 1] > 1 && <i>…</i>}<button className={`page-number ${value === page ? 'active' : ''}`} onClick={() => onPageChange(value)} disabled={loading}>{value}</button></span>)}
        <button className="icon-button" disabled={page >= totalPages || loading} onClick={() => onPageChange(Math.min(totalPages, page + 1))}>›</button>
      </div>
    </div>
  </section>
}
