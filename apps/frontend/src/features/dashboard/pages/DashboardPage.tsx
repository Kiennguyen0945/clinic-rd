<<<<<<< Updated upstream
import { useState } from 'react'
import { format, parseISO } from 'date-fns'
=======
>>>>>>> Stashed changes
import { Activity, Clock, CheckCircle, CalendarCheck, Search, Plus, Stethoscope, Ban } from 'lucide-react'
import { useTodayDashboardQuery } from '../model/dashboard.queries'
import { useAuthStore } from '../../../shared/auth/session-store'
import ManagerDashboardPage from './ManagerDashboardPage'
import DoctorDashboardPage from './DoctorDashboardPage'
import { appointmentApi } from '../../../entities/appointment'

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    PENDING:     { label: 'Đang chờ',     cls: 'badge-pending' },
    CONFIRMED:   { label: 'Đã xác nhận',   cls: 'badge-info' },
    IN_PROGRESS: { label: 'Đang khám',     cls: 'badge-pending' },
    COMPLETED:   { label: 'Hoàn thành',    cls: 'badge-completed' },
    CANCELLED:   { label: 'Đã huỷ',        cls: 'badge-cancelled' },
  }
  const item = map[status] || { label: status, cls: 'badge-neutral' }
  return <span className={`badge ${item.cls}`}>{item.label}</span>
}

function appointmentTimeLabel(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

function OperationalDashboardPage() {
  const { data, isPending: loading, refetch } = useTodayDashboardQuery()
  const [query, setQuery] = useState('')
  const [processingId, setProcessingId] = useState('')
  const [actionError, setActionError] = useState('')

  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 48 }}>
        <p style={{ color: 'var(--text-secondary)' }}>Đang tải dữ liệu...</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 48 }}>
        <p style={{ color: 'var(--text-secondary)' }}>Không có dữ liệu hôm nay</p>
      </div>
    )
  }

  const { todayStats, upcomingAppointments } = data
  const visibleAppointments = upcomingAppointments.filter((appointment) =>
    `${appointment.patientName} ${appointment.patientCode} ${appointment.patientPhone}`.toLowerCase().includes(query.trim().toLowerCase()),
  )
  const checkIn = async (id: string) => {
    setProcessingId(id); setActionError('')
    try { await appointmentApi.checkIn(Number(id)); await refetch() }
    catch (error) { setActionError(error instanceof Error ? error.message : 'Không thể tiếp nhận bệnh nhân') }
    finally { setProcessingId('') }
  }
  const cancel = async (id: string) => {
    if (!window.confirm('Bạn có chắc muốn hủy lượt khám này?')) return
    setProcessingId(id); setActionError('')
    try { await appointmentApi.cancel(Number(id), 'OTHER', 'Hủy từ dashboard lễ tân'); await refetch() }
    catch (error) { setActionError(error instanceof Error ? error.message : 'Không thể hủy lượt khám') }
    finally { setProcessingId('') }
  }

  // Format today's date
  const today = new Date()
  const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
  const dateStr = `${dayNames[today.getDay()]}, ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`

  return (
    <>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="page-title">Tổng quan</div>
          <div className="page-subtitle">{dateStr}</div>
        </div>
        <div className="panel-actions">
          <button className="btn btn-primary btn-sm">
            <Plus size={16} />
            Tiếp nhận bệnh nhân
          </button>
        </div>
      </div>

      {/* Stats Grid (like HTML) */}
      <div className="stats-grid dashboard-stats-grid">
        <div className="stat-card">
          <div className="stat-top">
            <div className="stat-icon tint-primary">
              <Activity size={20} />
            </div>
          </div>
          <div className="stat-value">{todayStats.total}</div>
          <div className="stat-label">Tổng lượt khám hôm nay</div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <div className="stat-icon tint-warning">
              <Clock size={20} />
            </div>
          </div>
          <div className="stat-value">{todayStats.pending}</div>
          <div className="stat-label">Chờ xác nhận</div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <div className="stat-icon tint-success">
              <CalendarCheck size={20} />
            </div>
          </div>
          <div className="stat-value">{todayStats.confirmed}</div>
          <div className="stat-label">Đã xác nhận</div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <div className="stat-icon tint-info">
              <Stethoscope size={20} />
            </div>
          </div>
          <div className="stat-value">{todayStats.inProgress}</div>
          <div className="stat-label">Đang khám</div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <div className="stat-icon tint-success">
              <CheckCircle size={20} />
            </div>
          </div>
          <div className="stat-value">{todayStats.completed}</div>
          <div className="stat-label">Đã khám xong</div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <div className="stat-icon tint-danger">
              <Ban size={20} />
            </div>
          </div>
          <div className="stat-value">{todayStats.cancelled}</div>
          <div className="stat-label">Đã hủy</div>
        </div>
      </div>

      {/* Queue Table Panel (like HTML) */}
      <div className="panel">
        <div className="panel-header">
          <h3>Danh sách lịch khám hôm nay</h3>
          <div className="panel-actions">
            <div className="search-box">
              <Search size={18} />
              <input className="form-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên hoặc SĐT..." style={{ height: 40 }} />
            </div>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Bệnh nhân</th>
                <th>Giờ hẹn</th>
                <th>Bác sĩ phụ trách</th>
                <th>Số điện thoại</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {visibleAppointments.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state" style={{ padding: 32 }}>
                      <Search size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                      <p style={{ color: 'var(--text-secondary)' }}>Chưa có lịch khám nào trong hôm nay</p>
                    </div>
                  </td>
                </tr>
              ) : (
                visibleAppointments.map((apt) => (
                  <tr key={apt.id}>
                    <td>
                      <div>{apt.patientName}</div>
                      <div className="cell-sub">{apt.patientCode}</div>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {appointmentTimeLabel(apt.appointmentTime)}
                    </td>
                    <td>{apt.doctorName}</td>
                    <td className="cell-sub">{apt.patientPhone || '—'}</td>
                    <td>{statusBadge(apt.status)}</td>
                    <td>
                      <div className="row-actions">
                        {apt.status === 'CONFIRMED' && <button className="btn btn-sm btn-primary" disabled={processingId === apt.id} onClick={() => void checkIn(apt.id)}>Tiếp nhận</button>}
                        {(apt.status === 'CONFIRMED' || apt.status === 'WAITING') && <button className="btn btn-sm btn-danger-outline" disabled={processingId === apt.id} onClick={() => void cancel(apt.id)}>Hủy</button>}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {actionError && <div className="form-error" role="alert">{actionError}</div>}
    </>
  )
}

export default function DashboardPage() {
  const role = useAuthStore((state) => state.user?.role)
  if (role === 'manager') return <ManagerDashboardPage />
  if (role === 'doctor') return <DoctorDashboardPage />
  return <OperationalDashboardPage />
}
