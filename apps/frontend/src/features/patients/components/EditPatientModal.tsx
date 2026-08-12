import { useState } from 'react'
import type { FormEvent } from 'react'
import { X } from 'lucide-react'

import type { ApiPatient } from '../../../entities/patient'
import { useUpdatePatientMutation } from '../model/patient.mutations'
import type { PatientListItem } from '../model/patient.types'

export default function EditPatientModal({ patient, onClose, onSaved }: { patient: PatientListItem; onClose: () => void; onSaved: (patient: ApiPatient) => void }) {
  const [values, setValues] = useState({ fullName: patient.fullName, phone: patient.phone, email: patient.email === 'Chưa cập nhật' ? '' : patient.email, cccd: patient.cccd === 'Chưa cập nhật' ? '' : patient.cccd, insuranceNumber: patient.insuranceNumber, address: patient.address === 'Chưa cập nhật' ? '' : patient.address })
  const [formError, setFormError] = useState('')
  const updateMutation = useUpdatePatientMutation()
  const saving = updateMutation.isPending

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!values.fullName.trim()) return setFormError('Vui lòng nhập họ và tên.')
    if (!/^\d{10,11}$/.test(values.phone.trim())) return setFormError('Số điện thoại phải có 10–11 chữ số.')
    if (values.cccd.trim() && !/^\d{9,12}$/.test(values.cccd.trim())) return setFormError('Số CCCD/CMND phải có từ 9 đến 12 chữ số.')
    setFormError('')
    try {
      const response = await updateMutation.mutateAsync({
        id: Number(patient.id),
        body: {
          full_name: values.fullName.trim(), phone: values.phone.trim(), email: values.email.trim(), cccd: values.cccd.trim(),
          insurance_number: values.insuranceNumber.trim(), address: values.address.trim(),
        },
      })
      onSaved(response.patient)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Không thể cập nhật thông tin bệnh nhân.')
    }
  }

  return <div className="modal-backdrop patient-edit-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <form className="patient-edit-modal" onSubmit={submit}>
      <div className="modal-header"><div><h2>Cập nhật thông tin bệnh nhân</h2><p>{patient.code}</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Đóng"><X size={18} /></button></div>
      <div className="patient-edit-notice">ⓘ Thay đổi sẽ được cập nhật vào hồ sơ bệnh nhân.</div>
      <div className="patient-edit-grid">
        <label>Họ và tên *<input value={values.fullName} onChange={(event) => setValues((current) => ({ ...current, fullName: event.target.value }))} /></label>
        <label>Số điện thoại *<input inputMode="numeric" value={values.phone} onChange={(event) => setValues((current) => ({ ...current, phone: event.target.value.replace(/\D/g, '') }))} /></label>
        <label>Email<input type="email" value={values.email} onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))} /></label>
        <label>Số CCCD/CMND<input inputMode="numeric" maxLength={12} value={values.cccd} onChange={(event) => setValues((current) => ({ ...current, cccd: event.target.value.replace(/\D/g, '') }))} /></label>
        <label>Số BHYT<input value={values.insuranceNumber} onChange={(event) => setValues((current) => ({ ...current, insuranceNumber: event.target.value }))} /></label>
        <label>Ngày sinh<input type="date" value={patient.rawDob} disabled /></label>
        <label className="span-two">Địa chỉ<textarea rows={3} value={values.address} onChange={(event) => setValues((current) => ({ ...current, address: event.target.value }))} /></label>
      </div>
      {formError && <div className="form-error patient-edit-error">{formError}</div>}
      <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Hủy bỏ</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</button></div>
    </form>
  </div>
}
