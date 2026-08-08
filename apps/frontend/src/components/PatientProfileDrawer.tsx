import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Cake, CalendarDays, ChevronDown, ChevronUp, MapPin, Phone, UserRound, X } from 'lucide-react'
import { medicalRecordsApi } from '../lib/medicalRecordsApi'
import type { ApiMedicalRecordHistoryItem } from '../lib/medicalRecordsApi'

export interface DrawerPatient {
  id: string
  code: string
  fullName: string
  gender: string
  dob?: string
  age: number
  phone: string
  email?: string
  cccd?: string
  insuranceNumber?: string
  address: string
}

interface PatientProfileDrawerProps {
  patient: DrawerPatient
  onClose: () => void
  showMedicalHistory?: boolean
  onOpenMedicalRecord?: (record: ApiMedicalRecordHistoryItem) => void
  actions?: ReactNode
}

function formatDate(value?: string) {
  if (!value) return 'Chưa cập nhật'
  const isoDate = /^\d{4}-\d{2}-\d{2}$/.test(value)
  const parsed = new Date(isoDate ? `${value}T12:00:00` : value)
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('vi-VN').format(parsed)
}

export default function PatientProfileDrawer({ patient, onClose, showMedicalHistory = true, onOpenMedicalRecord, actions }: PatientProfileDrawerProps) {
  const [overviewOpen, setOverviewOpen] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(true)
  const [history, setHistory] = useState<ApiMedicalRecordHistoryItem[]>([])
  const canLoadHistory = showMedicalHistory && Boolean(patient.id && !patient.id.startsWith('mock-'))
  const [loadedPatientId, setLoadedPatientId] = useState(canLoadHistory ? '' : patient.id)
  const [historyError, setHistoryError] = useState('')

  useEffect(() => {
    if (!canLoadHistory) return
    let cancelled = false
    medicalRecordsApi.historyByPatient(Number(patient.id))
      .then((records) => { if (!cancelled) { setHistory(records); setHistoryError(''); setLoadedPatientId(patient.id) } })
      .catch((error: unknown) => { if (!cancelled) { setHistoryError(error instanceof Error ? error.message : 'Không thể tải lịch sử khám'); setLoadedPatientId(patient.id) } })
    return () => { cancelled = true }
  }, [canLoadHistory, patient.id])

  const historyLoading = canLoadHistory && loadedPatientId !== patient.id
  const latestVisit = history[0]?.visitDate.slice(0, 10)
  return <div className="consultation-drawer-layer" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <aside className="consultation-drawer patient-profile-drawer" aria-label="Hồ sơ bệnh nhân">
      <header className="consultation-drawer-header"><div><span>Hồ sơ bệnh nhân</span><h2>{patient.fullName}</h2></div><button className="icon-button" onClick={onClose} aria-label="Đóng hồ sơ"><X size={18} /></button></header>
      <section className="patient-drawer-identity"><div className="patient-large-avatar">{patient.fullName.split(' ').slice(-1)[0]?.[0] || '?'}</div><div className="patient-drawer-identity-info"><div><span><UserRound size={13} /> {patient.gender}</span><span><Cake size={13} /> {patient.age || '—'} tuổi {patient.dob ? `(${formatDate(patient.dob)})` : ''}</span><b>{patient.code}</b></div><div><a href={`tel:${patient.phone}`}><Phone size={14} /> {patient.phone || 'Chưa cập nhật'}</a><span><MapPin size={14} /> {patient.address || 'Chưa cập nhật'}</span></div></div></section>
      <div className="consultation-drawer-content patient-drawer-content">
        <section className={`patient-drawer-section ${overviewOpen ? 'expanded' : ''}`}><button className="patient-drawer-section-trigger" onClick={() => setOverviewOpen((value) => !value)}><strong>Tổng quan</strong>{overviewOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>{overviewOpen && <div className="patient-drawer-section-body"><div className="patient-overview-card"><dl><div><dt>Mã bệnh nhân</dt><dd>{patient.code}</dd></div><div><dt>Ngày sinh</dt><dd>{formatDate(patient.dob)}</dd></div><div><dt>Email</dt><dd>{patient.email || 'Chưa cập nhật'}</dd></div><div><dt>Số BHYT</dt><dd>{patient.insuranceNumber || 'Chưa cập nhật'}</dd></div><div><dt>CCCD</dt><dd>{patient.cccd || 'Chưa cập nhật'}</dd></div><div><dt>Địa chỉ</dt><dd>{patient.address || 'Chưa cập nhật'}</dd></div></dl>{showMedicalHistory && <div className="patient-overview-stats"><div><span className="patient-stat-icon"><UserRound size={18} /></span><span>Tổng số lần khám<strong>{history.length}</strong></span></div><div><span className="patient-stat-icon"><CalendarDays size={18} /></span><span>Lần khám gần nhất<strong>{latestVisit ? formatDate(latestVisit) : 'Chưa có'}</strong></span></div></div>}</div></div>}</section>
        {showMedicalHistory && <section className={`patient-drawer-section ${historyOpen ? 'expanded' : ''}`}><button className="patient-drawer-section-trigger" onClick={() => setHistoryOpen((value) => !value)}><strong>Lịch sử khám</strong><span>Xem tất cả ({history.length})</span>{historyOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>{historyOpen && <div className="patient-drawer-section-body">{historyLoading ? <div className="drawer-history-empty">Đang tải lịch sử khám...</div> : historyError ? <div className="drawer-history-error">{historyError}</div> : history.length === 0 ? <div className="drawer-history-empty">Chưa có hồ sơ đã ký và hoàn thành.</div> : <div className="patient-medical-history-list">{history.map((record) => <article key={record.id}><div className="patient-history-time"><strong>{formatDate(record.visitDate.slice(0, 10))}</strong><span>{record.startTime} - {record.endTime}</span></div><div className="patient-history-content"><div><strong>BS. {record.doctorName}</strong><i /><span>{record.departmentName || 'Chưa phân khoa'}</span><b>Đã ký</b></div><p>Lý do: {record.reason || 'Chưa cập nhật'}</p><p>Chẩn đoán: {record.diagnosis || 'Chưa cập nhật'}</p></div>{onOpenMedicalRecord && <button className="btn btn-secondary btn-sm" onClick={() => onOpenMedicalRecord(record)}>Xem hồ sơ</button>}</article>)}</div>}</div>}</section>}
      </div>
      {actions && <div className="patient-drawer-management-actions">{actions}</div>}
      <footer className="consultation-drawer-footer"><button className="btn btn-secondary btn-block" onClick={onClose}>Đóng</button></footer>
    </aside>
  </div>
}
