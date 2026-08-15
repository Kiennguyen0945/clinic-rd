import { zodResolver } from '@hookform/resolvers/zod'
import { X } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { Department, Room } from '../api/organization.api'
import { useOrganizationMutations } from '../model/organization.mutations'
import { roomSchema } from '../model/organization.schema'
import type { RoomFormValues } from '../model/organization.schema'

export default function RoomModal({ room, departments, selectedDepartmentId, onClose, onSaved }: { room?: Room; departments: Department[]; selectedDepartmentId: number; onClose: () => void; onSaved: () => void }) {
  const mutations = useOrganizationMutations()
  const mutation = room ? mutations.updateRoom : mutations.createRoom
  const [error, setError] = useState('')
  const { register, handleSubmit, formState: { errors } } = useForm<RoomFormValues>({ resolver: zodResolver(roomSchema), defaultValues: { room_number: room?.room_number || '', department_id: String(room?.department_id || selectedDepartmentId), description: room?.description || '' } })
  const submit = handleSubmit(async (values) => {
    setError('')
    const body = { room_number: values.room_number.trim(), department_id: Number(values.department_id), description: values.description.trim() }
    try {
      if (room) await mutations.updateRoom.mutateAsync({ id: room.id, body })
      else await mutations.createRoom.mutateAsync(body)
      onSaved()
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : 'Không thể lưu phòng.') }
  })
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><form className="organization-modal" onSubmit={submit}>
    <div className="modal-header"><div><h2>{room ? 'Cập nhật phòng' : 'Thêm phòng'}</h2><p>Phân phòng vào một khoa trong phòng khám.</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Đóng"><X size={18} /></button></div>
    <div className="organization-form"><label>Tên hoặc số phòng *<input autoFocus={!room} disabled={Boolean(room?.has_appointments)} {...register('room_number')} placeholder="Ví dụ: Phòng 101" />{errors.room_number && <small>{errors.room_number.message}</small>}</label><label>Khoa *<select disabled={Boolean(room?.has_appointments)} {...register('department_id')}>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select>{errors.department_id && <small>{errors.department_id.message}</small>}</label>{room?.has_appointments && <p className="organization-lock-note">Tên phòng và khoa không thể thay đổi vì phòng đã có lịch hẹn.</p>}<label>Mô tả<textarea rows={3} {...register('description')} placeholder="Mô tả chức năng của phòng" /></label></div>
    {error && <div className="form-error">{error}</div>}<div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button><button className="btn btn-primary" disabled={mutation.isPending}>{mutation.isPending ? 'Đang lưu...' : 'Lưu phòng'}</button></div>
  </form></div>
}
