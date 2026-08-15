import { Eye, Pencil, Trash2, UserRound } from 'lucide-react'
import type { Employee } from '../api/employee.api'
import { employeeDisplayName, employeeInitials } from '../model/employee.initials'

const roleLabel = { DOCTOR: 'Bác sĩ', RECEPTIONIST: 'Lễ tân' }
const statusLabel = { ACTIVE: 'Đang hoạt động', INACTIVE: 'Ngừng hoạt động', LOCKED: 'Đã khóa' }

export default function EmployeeTable({ employees, loading, onView, onEdit, onDelete }: {
  employees: Employee[]; loading: boolean
  onView: (employee: Employee) => void
  onEdit: (employee: Employee) => void
  onDelete: (employee: Employee) => void
}) {
  return <div className="employee-table-card"><div className="employee-table-wrap"><table className="employee-table">
    <thead><tr><th>Nhân viên</th><th>Vai trò</th><th>Khoa / Lịch làm việc</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
    <tbody>{loading ? <tr><td colSpan={5}>Đang tải danh sách nhân viên...</td></tr> : employees.map((employee) => <tr key={employee.id} onClick={() => onView(employee)}>
      <td><div className="employee-person"><span className="employee-avatar">{employeeInitials(employee.fullName)}</span><div><strong>{employeeDisplayName(employee.fullName, employee.role)}</strong><span>{employee.email || employee.username}</span></div></div></td>
      <td><span className={`employee-role role-${employee.role.toLowerCase()}`}>{roleLabel[employee.role]}</span></td>
      <td><div className="employee-schedule"><strong>{employee.departments.map((item) => item.name).join(', ') || '—'}</strong>{employee.role === 'DOCTOR' && <span className={employee.canReceiveAppointments ? 'schedule-ready' : 'schedule-missing'}>{employee.canReceiveAppointments ? 'Đã có lịch nhận bệnh' : 'Chưa phân phòng'}</span>}</div></td>
      <td><span className={`employee-status status-${employee.status.toLowerCase()}`}>{statusLabel[employee.status]}</span></td>
      <td><div className="employee-actions" onClick={(event) => event.stopPropagation()}><button className="icon-button" onClick={() => onView(employee)} aria-label="Xem chi tiết"><Eye size={17} /></button>{employee.canEdit && <button className="icon-button" onClick={() => onEdit(employee)} aria-label="Chỉnh sửa"><Pencil size={16} /></button>}{employee.canDelete && <button className="icon-button danger" onClick={() => onDelete(employee)} aria-label="Xóa"><Trash2 size={16} /></button>}</div></td>
    </tr>)}</tbody>
  </table>{!loading && employees.length === 0 && <div className="employee-empty"><UserRound size={36} /><strong>Không tìm thấy nhân viên</strong><span>Thử thay đổi từ khóa hoặc bộ lọc.</span></div>}</div></div>
}
