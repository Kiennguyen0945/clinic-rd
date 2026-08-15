import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { X } from 'lucide-react'
import type { Employee } from '../api/employee.api'
import { employeeSchema } from '../model/employee.schema'
import type { EmployeeFormValues } from '../model/employee.schema'
import { editableEmployeeName, usernameFromFullName } from '../model/employee.initials'
import { useEmployeeResourcesQuery } from '../model/employee.queries'
import { useEmployeeMutations } from '../model/employee.mutations'

export default function EmployeeFormModal({ employee, onClose, onSaved }: { employee?: Employee; onClose: () => void; onSaved: (password?: string) => void }) {
  const resources = useEmployeeResourcesQuery()
  const mutations = useEmployeeMutations()
  const mutation = employee ? mutations.update : mutations.create
  const [serverError, setServerError] = useState('')
  const [usernameEdited, setUsernameEdited] = useState(false)
  const { control, register, setValue, handleSubmit, formState: { errors } } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: employee ? { username: employee.username, fullName: editableEmployeeName(employee.fullName), email: employee.email || '', phone: employee.phone, gender: employee.gender || '', dateOfBirth: employee.dateOfBirth || '', address: employee.address || '', roleCode: employee.role, departmentId: String(employee.departments[0]?.id || ''), roomId: '', password: '' } : { username: '', fullName: '', email: '', phone: '', gender: '', dateOfBirth: '', address: '', roleCode: 'RECEPTIONIST', password: '', departmentId: '', roomId: '' },
  })
  const role = useWatch({ control, name: 'roleCode' })
  const displayError = serverError || (resources.error ? 'Không thể tải danh sách khoa và phòng.' : '')
  const fullNameField = register('fullName')
  const usernameField = register('username')

  const submit = handleSubmit(async (values) => {
    setServerError('')
    try {
      if (employee) {
        await mutations.update.mutateAsync({ id: employee.id, body: { fullName: values.fullName.trim(), email: values.email.trim(), phone: values.phone.trim(), gender: values.gender, dateOfBirth: values.dateOfBirth || null, address: values.address || '', status: employee.status, ...(employee.role === 'DOCTOR' ? { departmentId: Number(values.departmentId) } : {}) } })
        onSaved()
      } else {
        const result = await mutations.create.mutateAsync({ username: values.username.trim(), fullName: values.fullName.trim(), email: values.email.trim(), phone: values.phone.trim(), gender: values.gender, dateOfBirth: values.dateOfBirth || null, address: values.address || '', roleCode: values.roleCode, ...(values.password ? { password: values.password } : {}), ...(values.roleCode === 'DOCTOR' ? { departmentId: Number(values.departmentId), ...(values.roomId ? { roomId: Number(values.roomId) } : {}) } : {}) })
        onSaved(result.generatedPassword)
      }
    } catch (error) { setServerError(error instanceof Error ? error.message : 'Không thể lưu nhân viên.') }
  })

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !mutation.isPending && onClose()}><form className="employee-modal" onSubmit={submit} autoComplete="off">
    <div className="modal-header"><div><h2>{employee ? 'Cập nhật nhân viên' : 'Thêm nhân viên'}</h2><p>{employee ? 'Vai trò và tên đăng nhập không thể thay đổi.' : 'Tạo tài khoản bác sĩ hoặc lễ tân.'}</p></div><button type="button" className="icon-button" onClick={onClose}><X size={18} /></button></div>
    <div className="employee-form-grid">
      <label>Họ và tên *<input autoFocus autoComplete="name" {...fullNameField} onChange={(event) => { void fullNameField.onChange(event); if (!employee && !usernameEdited) setValue('username', usernameFromFullName(event.target.value), { shouldValidate: true }) }} />{errors.fullName && <small>{errors.fullName.message}</small>}</label>
      <label>Tên đăng nhập *<input disabled={Boolean(employee)} autoComplete="one-time-code" data-1p-ignore data-lpignore="true" {...usernameField} onChange={(event) => { setUsernameEdited(true); void usernameField.onChange(event) }} />{errors.username && <small>{errors.username.message}</small>}</label>
      <label>Email *<input type="email" {...register('email')} />{errors.email && <small>{errors.email.message}</small>}</label>
      <label>Số điện thoại<input inputMode="numeric" {...register('phone')} />{errors.phone && <small>{errors.phone.message}</small>}</label>
      <label>Giới tính<select {...register('gender')}><option value="">Chưa cập nhật</option><option value="M">Nam</option><option value="F">Nữ</option><option value="O">Khác</option></select></label>
      <label>Ngày sinh<input type="date" autoComplete="bday" {...register('dateOfBirth')} /></label>
      <label className="employee-span-two">Địa chỉ<textarea rows={2} autoComplete="street-address" {...register('address')} /></label>
      <label>Vai trò *<select disabled={Boolean(employee)} {...register('roleCode')}><option value="RECEPTIONIST">Lễ tân</option><option value="DOCTOR">Bác sĩ</option></select></label>
      {!employee && <label>Mật khẩu<input type="password" autoComplete="new-password" data-1p-ignore data-lpignore="true" placeholder="Để trống để tự sinh" {...register('password')} />{errors.password && <small>{errors.password.message}</small>}</label>}
      {role === 'DOCTOR' && <><label>Khoa *<select {...register('departmentId')}><option value="">Chọn khoa</option>{resources.data?.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{errors.departmentId && <small>{errors.departmentId.message}</small>}</label>{!employee && <label>Phòng ngày mai (không bắt buộc)<select {...register('roomId')}><option value="">Phân phòng sau</option>{resources.data?.rooms.map((item) => <option key={item.id} value={item.id}>{item.room_number}</option>)}</select><span className="field-hint">Nếu chọn, hệ thống tạo lịch cả ngày mai.</span></label>}</>}
    </div>
    {displayError && <div className="form-error" role="alert">{displayError}</div>}
    <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button><button className="btn btn-primary" disabled={mutation.isPending}>{mutation.isPending ? 'Đang lưu...' : 'Lưu nhân viên'}</button></div>
  </form></div>
}
