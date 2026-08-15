import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarClock, Pencil, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { todayValue, tomorrowValue } from '@/shared/lib/date'
import EmployeeFormModal from './EmployeeFormModal'
import { employeeDisplayName, employeeInitials } from '../model/employee.initials'
import { useEmployeeMutations } from '../model/employee.mutations'
import { useEmployeeQuery, useEmployeeResourcesQuery } from '../model/employee.queries'
import { allocationSchema } from '../model/employee.schema'
import type { AllocationFormValues } from '../model/employee.schema'

export default function EmployeeDetailDrawer({ employeeId, onClose, onDeleted }: { employeeId: string; onClose: () => void; onDeleted: () => void }) {
  const query = useEmployeeQuery(employeeId)
  const resources = useEmployeeResourcesQuery()
  const mutations = useEmployeeMutations()
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState('')
  const [tomorrow] = useState(tomorrowValue)
  const { register, handleSubmit, formState: { errors } } = useForm<AllocationFormValues>({ resolver: zodResolver(allocationSchema), defaultValues: { roomId: '', date: tomorrow, startTime: '06:00', endTime: '17:00' } })
  const employee = query.data

  const remove = async () => {
    if (!employee || !window.confirm(`Xóa nhân viên “${employee.fullName}”?`)) return
    try { await mutations.remove.mutateAsync(employee.id); onDeleted() } catch (error) { setMessage(error instanceof Error ? error.message : 'Không thể xóa nhân viên.') }
  }
  const allocate = handleSubmit(async (values) => {
    if (!employee) return
    setMessage('')
    try {
      await mutations.allocate.mutateAsync({ id: employee.id, body: { roomId: Number(values.roomId), date: values.date, startTime: values.startTime, endTime: values.endTime } })
      setMessage('Đã phân phòng và tạo các ca khám.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Không thể phân phòng.') }
  })

  return <div className="employee-drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <aside className="employee-drawer" role="dialog" aria-modal="true" aria-label="Thông tin nhân viên">
      <header className="employee-drawer-header"><div><h2>Thông tin nhân viên</h2><p>Thông tin tài khoản và lịch làm việc.</p></div><button className="icon-button" onClick={onClose} aria-label="Đóng"><X size={19} /></button></header>
      {query.isLoading ? <div className="employee-drawer-loading">Đang tải thông tin...</div> : !employee ? <div className="form-error">Không tìm thấy nhân viên.</div> : <div className="employee-drawer-body">
        <section className="employee-drawer-profile"><div className="employee-detail-avatar">{employeeInitials(employee.fullName)}</div><div><h3>{employeeDisplayName(employee.fullName, employee.role)}</h3><p>{employee.role === 'DOCTOR' ? 'Bác sĩ' : 'Lễ tân'}</p><span className={`employee-status status-${employee.status.toLowerCase()}`}>{employee.status === 'ACTIVE' ? 'Đang hoạt động' : employee.status === 'LOCKED' ? 'Đã khóa' : 'Ngừng hoạt động'}</span></div></section>
        {!employee.canEdit && <div className="employee-lock-note">Nhân viên đã có lịch hẹn hoặc dữ liệu khám bệnh liên quan nên không thể chỉnh sửa hoặc xóa.</div>}
        {message && <div className="employee-notice">{message}</div>}
        <section className="employee-drawer-section"><h3>Thông tin chung</h3><dl><div><dt>Tên đăng nhập</dt><dd>@{employee.username}</dd></div><div><dt>Email</dt><dd>{employee.email || '—'}</dd></div><div><dt>Số điện thoại</dt><dd>{employee.phone || '—'}</dd></div><div><dt>Giới tính</dt><dd>{employee.gender === 'M' ? 'Nam' : employee.gender === 'F' ? 'Nữ' : employee.gender === 'O' ? 'Khác' : '—'}</dd></div><div><dt>Ngày sinh</dt><dd>{employee.dateOfBirth ? new Intl.DateTimeFormat('vi-VN').format(new Date(`${employee.dateOfBirth}T12:00:00`)) : '—'}</dd></div><div><dt>Địa chỉ</dt><dd>{employee.address || '—'}</dd></div><div><dt>Vai trò</dt><dd>{employee.role === 'DOCTOR' ? 'Bác sĩ' : 'Lễ tân'}</dd></div><div><dt>Khoa</dt><dd>{employee.departments.map((item) => item.name).join(', ') || '—'}</dd></div><div><dt>Lịch nhận bệnh</dt><dd>{employee.role === 'DOCTOR' ? employee.canReceiveAppointments ? 'Đã phân lịch' : 'Chưa phân phòng' : 'Không áp dụng'}</dd></div></dl></section>
        {employee.role === 'DOCTOR' && <section className="employee-drawer-section"><div className="allocation-heading"><CalendarClock size={19} /><div><h3>Phân phòng làm việc</h3><p>Chọn phòng và khoảng giờ để tạo ca khám.</p></div></div><form onSubmit={allocate} className="allocation-form drawer-allocation-form"><label>Phòng<select {...register('roomId')}><option value="">Chọn phòng</option>{resources.data?.rooms.map((room) => <option key={room.id} value={room.id}>{room.room_number}</option>)}</select>{errors.roomId && <small>{errors.roomId.message}</small>}</label><label>Ngày<input type="date" min={todayValue()} {...register('date')} />{errors.date && <small>{errors.date.message}</small>}</label><label>Bắt đầu<input type="time" step="3600" {...register('startTime')} /></label><label>Kết thúc<input type="time" step="3600" {...register('endTime')} />{errors.endTime && <small>{errors.endTime.message}</small>}</label><button className="btn btn-primary" disabled={mutations.allocate.isPending}>{mutations.allocate.isPending ? 'Đang phân phòng...' : 'Phân phòng và tạo ca'}</button></form></section>}
      </div>}
      {employee && <footer className="employee-drawer-footer">{employee.canEdit && <button className="btn btn-secondary" onClick={() => setEditing(true)}><Pencil size={16} /> Chỉnh sửa</button>}{employee.canDelete && <button className="btn btn-danger" onClick={() => void remove()}><Trash2 size={16} /> Xóa nhân viên</button>}</footer>}
    </aside>
    {editing && employee && <EmployeeFormModal employee={employee} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); setMessage('Đã cập nhật nhân viên.') }} />}
  </div>
}
