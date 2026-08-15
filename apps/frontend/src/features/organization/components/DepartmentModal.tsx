import { zodResolver } from '@hookform/resolvers/zod'
import { X } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { Department } from '../api/organization.api'
import { useOrganizationMutations } from '../model/organization.mutations'
import { departmentSchema } from '../model/organization.schema'
import type { DepartmentFormValues } from '../model/organization.schema'

export default function DepartmentModal({ department, onClose, onSaved }: { department?: Department; onClose: () => void; onSaved: () => void }) {
  const mutations = useOrganizationMutations()
  const mutation = department ? mutations.updateDepartment : mutations.createDepartment
  const [error, setError] = useState('')
  const { register, handleSubmit, formState: { errors } } = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentSchema),
    defaultValues: { code: department?.code || '', name: department?.name || '', description: department?.description || '' },
  })
  const submit = handleSubmit(async (values) => {
    setError('')
    const body = { code: values.code.trim().toUpperCase(), name: values.name.trim(), description: values.description.trim() || null }
    try {
      if (department) await mutations.updateDepartment.mutateAsync({ id: department.id, body })
      else await mutations.createDepartment.mutateAsync(body)
      onSaved()
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : 'Không thể lưu khoa.') }
  })
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><form className="organization-modal" onSubmit={submit}>
    <div className="modal-header"><div><h2>{department ? 'Cập nhật khoa' : 'Thêm khoa'}</h2><p>Thông tin chuyên môn của khoa trong phòng khám.</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Đóng"><X size={18} /></button></div>
    <div className="organization-form"><label>Mã khoa *<input autoFocus={!department} disabled={Boolean(department?.has_appointments)} {...register('code')} placeholder="Ví dụ: NOI" />{errors.code && <small>{errors.code.message}</small>}</label><label>Tên khoa *<input disabled={Boolean(department?.has_appointments)} {...register('name')} placeholder="Ví dụ: Nội tổng quát" />{errors.name && <small>{errors.name.message}</small>}</label>{department?.has_appointments && <p className="organization-lock-note">Mã khoa và tên khoa không thể thay đổi vì khoa đã có lịch hẹn.</p>}<label>Mô tả<textarea rows={3} {...register('description')} placeholder="Mô tả chức năng của khoa" /></label></div>
    {error && <div className="form-error">{error}</div>}<div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button><button className="btn btn-primary" disabled={mutation.isPending}>{mutation.isPending ? 'Đang lưu...' : 'Lưu khoa'}</button></div>
  </form></div>
}
