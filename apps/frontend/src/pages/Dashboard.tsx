import { useEffect, useState } from 'react'
import { useAuthStore } from '../store'
import { format, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'

interface TodayStats {
  total: number
  pending: number
  confirmed: number
  inProgress: number
  completed: number
  cancelled: number
}

interface UpcomingAppointment {
  id: string
  patientName: string
  patientCode: string
  doctorName: string
  appointmentTime: string
  status: string
}

interface DashboardData {
  todayStats: TodayStats
  upcomingAppointments: UpcomingAppointment[]
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="content-card" style={{ textAlign: 'center' }}>
      <p className="section-label">{label}</p>
      <strong style={{ fontSize: 28, color }}>{value}</strong>
    </div>
  )
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; color: string }> = {
    PENDING: { label: 'Đang chờ', color: '#e6a817' },
    CONFIRMED: { label: 'Đã xác nhận', color: '#2e7d32' },
    IN_PROGRESS: { label: 'Đang khám', color: '#1565c0' },
    COMPLETED: { label: 'Hoàn thành', color: '#4caf50' },
    CANCELLED: { label: 'Đã huỷ', color: '#b42318' },
  }
  const item = map[status] || { label: status, color: '#64748b' }
  return (
    <span style={{ background: item.color, color: 'white', padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
      {item.label}
    </span>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    if (!token) return

    fetch('/api/dashboard/today/', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          setData(json.data)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return <div className="content-card">Đang tải dữ liệu...</div>
  }

  if (!data) {
    return <div className="content-card">Không có dữ liệu hôm nay</div>
  }

  const { todayStats, upcomingAppointments } = data

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        <StatCard label="Tổng lịch hẹn" value={todayStats.total} color="#2364aa" />
        <StatCard label="Đang chờ" value={todayStats.pending} color="#e6a817" />
        <StatCard label="Đã xác nhận" value={todayStats.confirmed} color="#2e7d32" />
        <StatCard label="Đang khám" value={todayStats.inProgress} color="#1565c0" />
        <StatCard label="Hoàn thành" value={todayStats.completed} color="#4caf50" />
        <StatCard label="Đã huỷ" value={todayStats.cancelled} color="#b42318" />
      </div>

      {/* Upcoming Appointments */}
      <div className="content-card">
        <h4>Lịch hẹn sắp tới</h4>
        {upcomingAppointments.length === 0 ? (
          <p style={{ color: '#64748b' }}>Chưa có lịch hẹn nào trong hôm nay</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #eef4fb', textAlign: 'left' }}>
                <th style={{ padding: '8px 0' }}>Giờ</th>
                <th>Bệnh nhân</th>
                <th>Mã BN</th>
                <th>Bác sĩ</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {upcomingAppointments.map((apt) => (
                <tr key={apt.id} style={{ borderBottom: '1px solid #eef4fb' }}>
                  <td style={{ padding: '8px 0', fontWeight: 700 }}>
                    {format(parseISO(apt.appointmentTime), 'HH:mm')}
                  </td>
                  <td>{apt.patientName}</td>
                  <td>{apt.patientCode}</td>
                  <td>{apt.doctorName}</td>
                  <td>{statusBadge(apt.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}