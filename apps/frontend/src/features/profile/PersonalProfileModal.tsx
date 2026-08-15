import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

import { authenticatedFetch } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/session-store'
import './profile.css'

interface Profile {
  id: string
  username: string
  fullName: string
  email: string | null
  phone: string
  gender: '' | 'M' | 'F' | 'O'
  dateOfBirth: string | null
  address: string
  role: 'MANAGER' | 'DOCTOR' | 'RECEPTIONIST'
  status: 'ACTIVE' | 'INACTIVE' | 'LOCKED'
}

interface Envelope<T> {
  success: boolean
  data: T
  error?: { message?: string; details?: Record<string, string | string[]> }
}

const emptyProfile: Profile = { id: '', username: '', fullName: '', email: '', phone: '', gender: '', dateOfBirth: null, address: '', role: 'RECEPTIONIST', status: 'ACTIVE' }

function editableName(profile: Profile) {
  return profile.role === 'DOCTOR' ? profile.fullName.replace(/^BS\.\s*/i, '') : profile.fullName
}

function firstError(payload: Envelope<Profile> | null) {
  const details = payload?.error?.details
  if (details) {
    const value = Object.values(details)[0]
    if (Array.isArray(value)) return value[0]
    if (value) return value
  }
  return payload?.error?.message || 'Không thể cập nhật thông tin cá nhân.'
}

export default function PersonalProfileModal({ onClose }: { onClose: () => void }) {
  const updateUser = useAuthStore((state) => state.updateUser)
  const [profile, setProfile] = useState<Profile>(emptyProfile)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void authenticatedFetch('/api/auth/me/').then(async (response) => {
      const payload = await response.json() as Envelope<Profile>
      if (!response.ok || !payload.success) throw new Error(firstError(payload))
      if (active) setProfile(payload.data)
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Không thể tải thông tin cá nhân.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const response = await authenticatedFetch('/api/auth/me/', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: editableName(profile).trim(), email: profile.email?.trim(),
          phone: profile.phone.trim(), gender: profile.gender,
          dateOfBirth: profile.dateOfBirth || null, address: profile.address.trim(),
        }),
      })
      const payload = await response.json() as Envelope<Profile>
      if (!response.ok || !payload.success) throw new Error(firstError(payload))
      updateUser({ fullName: payload.data.fullName })
      onClose()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Không thể cập nhật thông tin cá nhân.')
    } finally {
      setSubmitting(false)
    }
  }

  const roleLabel = profile.role === 'DOCTOR' ? 'Bác sĩ' : profile.role === 'MANAGER' ? 'Quản lý' : 'Lễ tân'
  const statusLabel = profile.status === 'ACTIVE' ? 'Đang hoạt động' : profile.status === 'LOCKED' ? 'Đã khóa' : 'Ngừng hoạt động'

  return createPortal(<div className="modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && !submitting && onClose()}>
    <form className="modal-box personal-profile-modal" role="dialog" aria-modal="true" aria-labelledby="personal-profile-title" onSubmit={submit}>
      <div className="modal-header"><div><h3 id="personal-profile-title">Quản lý thông tin cá nhân</h3><p>Cập nhật thông tin liên hệ và hồ sơ cá nhân của bạn.</p></div><button className="modal-close" type="button" onClick={onClose} aria-label="Đóng"><X size={20} /></button></div>
      {loading ? <div className="profile-loading">Đang tải thông tin...</div> : <div className="profile-form-grid">
        <label>Họ và tên *<input required value={editableName(profile)} onChange={(event) => setProfile({ ...profile, fullName: event.target.value })} /></label>
        <label>Email *<input required type="email" value={profile.email || ''} onChange={(event) => setProfile({ ...profile, email: event.target.value })} /></label>
        <label>Số điện thoại<input inputMode="numeric" pattern="\d{9,11}" value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} /></label>
        <label>Giới tính<select value={profile.gender} onChange={(event) => setProfile({ ...profile, gender: event.target.value as Profile['gender'] })}><option value="">Chưa cập nhật</option><option value="M">Nam</option><option value="F">Nữ</option><option value="O">Khác</option></select></label>
        <label>Ngày sinh<input type="date" max={new Date().toISOString().slice(0, 10)} value={profile.dateOfBirth || ''} onChange={(event) => setProfile({ ...profile, dateOfBirth: event.target.value || null })} /></label>
        <label className="profile-span-two">Địa chỉ<textarea rows={3} value={profile.address} onChange={(event) => setProfile({ ...profile, address: event.target.value })} /></label>
        <div className="profile-readonly profile-span-two"><div><span>Tên đăng nhập</span><strong>@{profile.username}</strong></div><div><span>Vai trò</span><strong>{roleLabel}</strong></div><div><span>Trạng thái</span><strong>{statusLabel}</strong></div></div>
      </div>}
      {error && <div className="form-error profile-error" role="alert">{error}</div>}
      <div className="modal-footer"><button className="btn btn-secondary" type="button" disabled={submitting} onClick={onClose}>Hủy</button><button className="btn btn-primary" type="submit" disabled={loading || submitting}>{submitting ? 'Đang lưu...' : 'Lưu thay đổi'}</button></div>
    </form>
  </div>, document.body)
}
