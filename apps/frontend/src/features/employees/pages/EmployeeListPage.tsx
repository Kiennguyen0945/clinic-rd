import { Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import '../employees.css'
import type { Employee } from '../api/employee.api'
import EmployeeDetailDrawer from '../components/EmployeeDetailDrawer'
import EmployeeFormModal from '../components/EmployeeFormModal'
import EmployeeTable from '../components/EmployeeTable'
import { useEmployeeMutations } from '../model/employee.mutations'
import { useEmployeesQuery } from '../model/employee.queries'

export default function EmployeeListPage() {
  const query = useEmployeesQuery()
  const mutations = useEmployeeMutations()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('ALL')
  const [editing, setEditing] = useState<Employee | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const employees = useMemo(() => (query.data || []).filter((item) => {
    const keyword = search.trim().toLowerCase()
    return (role === 'ALL' || item.role === role) && (!keyword || `${item.fullName} ${item.username} ${item.email}`.toLowerCase().includes(keyword))
  }), [query.data, role, search])

  const remove = async (employee: Employee) => {
    if (!window.confirm(`Xóa nhân viên “${employee.fullName}”? Hành động này không thể hoàn tác.`)) return
    try { await mutations.remove.mutateAsync(employee.id); setNotice('Đã xóa nhân viên.') } catch (error) { setNotice(error instanceof Error ? error.message : 'Không thể xóa nhân viên.') }
  }

  return <div className="employee-page"><div className="page-header"><div><div className="page-title">Quản lý nhân viên</div><div className="page-subtitle">Quản lý tài khoản, khoa chuyên môn và lịch nhận bệnh.</div></div><button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={17} /> Thêm nhân viên</button></div>
    <div className="employee-toolbar"><label className="employee-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo tên, tài khoản hoặc email" /></label><select value={role} onChange={(event) => setRole(event.target.value)}><option value="ALL">Tất cả vai trò</option><option value="DOCTOR">Bác sĩ</option><option value="RECEPTIONIST">Lễ tân</option></select></div>
    {notice && <div className="employee-notice">{notice}</div>}
    {query.error && <div className="form-error">{query.error instanceof Error ? query.error.message : 'Không thể tải danh sách nhân viên.'}</div>}
    <EmployeeTable employees={employees} loading={query.isFetching} onView={(item) => setSelectedId(item.id)} onEdit={setEditing} onDelete={(item) => void remove(item)} />
    {showCreate && <EmployeeFormModal onClose={() => setShowCreate(false)} onSaved={(password) => { setShowCreate(false); setNotice(password ? `Đã tạo nhân viên. Mật khẩu ban đầu: ${password}` : 'Đã tạo nhân viên.') }} />}
    {editing && <EmployeeFormModal employee={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setNotice('Đã cập nhật nhân viên.') }} />}
    {selectedId && <EmployeeDetailDrawer employeeId={selectedId} onClose={() => setSelectedId(null)} onDeleted={() => { setSelectedId(null); setNotice('Đã xóa nhân viên.') }} />}
  </div>
}
