import { useCallback, useEffect, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'
import {
  Activity, Ban, Building2, CalendarDays, CheckCircle2, Clock3,
  Download, RefreshCw, Stethoscope, Users,
} from 'lucide-react'
import { useAuthStore } from '../../../shared/auth/session-store'
import { dashboardApi } from '../api/dashboard.api'
import { useManagerDashboardQuery } from '../model/dashboard.queries'

const COLORS = ['#f59e0b', '#64748b', '#10b981', '#2563eb', '#8b5cf6', '#ef4444']

function percent(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0
}

function doctorInitials(fullName: string) {
  const parts = fullName.replace(/^BS\.?\s*/i, '').trim().split(/\s+/)
  return parts.slice(-2).map((part) => part[0]?.toLocaleUpperCase('vi')).join('') || 'BS'
}

function downloadCsv(date: string, rows: Array<Array<string | number>>) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `bao-cao-phong-kham-${date}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

export default function ManagerDashboardPage() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [selectedDate, setSelectedDate] = useState(today)
  const [isSynchronizing, setIsSynchronizing] = useState(false)
  const synchronizationInFlight = useRef(false)
  const user = useAuthStore((state) => state.user)
  const { data, isPending, isError, refetch, isFetching } = useManagerDashboardQuery(selectedDate)

  const refreshDashboard = useCallback(async () => {
    if (synchronizationInFlight.current) return
    synchronizationInFlight.current = true
    setIsSynchronizing(true)
    try {
      await dashboardApi.synchronize(selectedDate, selectedDate)
      await refetch()
    } finally {
      synchronizationInFlight.current = false
      setIsSynchronizing(false)
    }
  }, [refetch, selectedDate])

  useEffect(() => {
    const synchronizeVisibleDashboard = () => {
      if (document.visibilityState === 'visible') {
        void refreshDashboard().catch(() => undefined)
      }
    }

    synchronizeVisibleDashboard()
    const interval = window.setInterval(synchronizeVisibleDashboard, 15_000)
    window.addEventListener('focus', synchronizeVisibleDashboard)
    document.addEventListener('visibilitychange', synchronizeVisibleDashboard)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', synchronizeVisibleDashboard)
      document.removeEventListener('visibilitychange', synchronizeVisibleDashboard)
    }
  }, [refreshDashboard])

  const daily = data?.dashboard.dailyAppointments[0]
  const stats = {
    total: daily?.total ?? 0,
    pending: daily?.pending ?? 0,
    confirmed: daily?.confirmed ?? 0,
    waiting: daily?.waiting ?? 0,
    inProgress: daily?.inProgress ?? 0,
    completed: daily?.completed ?? 0,
    cancelled: daily?.cancelled ?? 0,
  }
  const chartData = [
    { name: 'Chờ tiếp nhận', value: stats.pending },
    { name: 'Đã xác nhận', value: stats.confirmed },
    { name: 'Đang chờ', value: stats.waiting },
    { name: 'Đang khám', value: stats.inProgress },
    { name: 'Hoàn thành', value: stats.completed },
    { name: 'Đã hủy', value: stats.cancelled },
  ].filter((item) => item.value > 0)
  let chartOffset = 0
  const donutBackground = chartData.length
    ? `conic-gradient(${chartData.map((item, index) => {
        const start = chartOffset
        chartOffset += (item.value / stats.total) * 100
        return `${COLORS[index % COLORS.length]} ${start}% ${chartOffset}%`
      }).join(', ')})`
    : '#e2e8f0'

  if (isPending) return <div className="card manager-loading">Đang tải báo cáo quản lý...</div>
  if (isError || !data) return (
    <div className="card manager-loading">
      <p>Không thể tải dữ liệu báo cáo.</p>
      <button className="btn btn-secondary btn-sm" onClick={() => void refetch()}>Thử lại</button>
    </div>
  )

  const doctorRows = data.doctors
    .filter((statistic) => statistic.total > 0)
    .map((statistic) => ({
      statistic,
      profile: data.doctorDirectory.find(
        (profile) => Number(profile.id) === statistic.doctorId,
      ) || {
        id: String(statistic.doctorId),
        fullName: `Bác sĩ #${statistic.doctorId}`,
        departments: [],
      },
    }))

  const exportReport = () => downloadCsv(selectedDate, [
    ['BÁO CÁO TỔNG QUAN PHÒNG KHÁM', selectedDate],
    ['Chỉ số', 'Giá trị'],
    ['Tổng lượt khám', stats.total], ['Đang chờ', stats.waiting],
    ['Đang khám', stats.inProgress], ['Hoàn thành', stats.completed], ['Đã hủy', stats.cancelled],
    [], ['Mã bác sĩ', 'Tổng lượt', 'Hoàn thành', 'Đã hủy', 'Tỷ lệ hoàn thành'],
    ...doctorRows.map(({ profile, statistic }) => [profile.fullName, statistic.total, statistic.completed, statistic.cancelled, `${percent(statistic.completed, statistic.total)}%`]),
  ])

  const cards = [
    ['Tổng lượt khám', stats.total, Activity, 'blue'],
    ['Đang chờ', stats.waiting, Clock3, 'orange'],
    ['Đang khám', stats.inProgress, Stethoscope, 'green'],
    ['Đã hoàn thành', stats.completed, CheckCircle2, 'purple'],
    ['Đã hủy', stats.cancelled, Ban, 'red'],
    ['Tỷ lệ hoàn thành', `${percent(stats.completed, stats.total)}%`, CalendarDays, 'cyan'],
  ] as const

  return <div className="manager-dashboard">
    <div className="manager-dashboard-header">
      <div>
        <h1>Xin chào, {user?.fullName || 'Quản lý'} 👋</h1>
        <p>{format(parseISO(selectedDate), "EEEE, 'ngày' d 'tháng' M 'năm' yyyy", { locale: vi })}</p>
      </div>
      <div className="manager-toolbar">
        <input aria-label="Ngày báo cáo" type="date" value={selectedDate} max={today} onChange={(event) => setSelectedDate(event.target.value)} />
        <button className="btn btn-secondary btn-sm" title="Cập nhật dữ liệu" aria-label="Cập nhật dữ liệu" onClick={() => void refreshDashboard()} disabled={isFetching || isSynchronizing}><RefreshCw size={16} className={isFetching || isSynchronizing ? 'spin' : ''} /></button>
        <button className="btn btn-primary btn-sm" onClick={exportReport}><Download size={16} />Xuất báo cáo</button>
      </div>
    </div>

    <h2 className="manager-section-title">Tổng quan toàn phòng khám</h2>
    <div className="manager-stat-grid">
      {cards.map(([label, value, Icon, tone]) => <div className="manager-stat-card" key={label}>
        <span className={`manager-stat-icon ${tone}`}><Icon size={20} /></span>
        <div><small>{label}</small><strong>{value}</strong><span>{label === 'Tỷ lệ hoàn thành' ? 'Trên tổng lượt khám' : 'Lượt khám'}</span></div>
      </div>)}
    </div>

    <div className="manager-main-grid">
      <section className="manager-panel">
        <div className="manager-panel-title"><h3>Tình hình theo bác sĩ</h3></div>
        <div className="table-wrapper manager-doctor-scroll"><table className="manager-table"><thead><tr><th>Bác sĩ</th><th>Tổng lịch</th><th>Hoàn thành</th><th>Đã hủy</th><th>Tỷ lệ</th></tr></thead>
          <tbody>{doctorRows.length ? doctorRows.map(({ profile, statistic: doctor }) => {
            const rate = percent(doctor.completed, doctor.total)
            const doctorName = profile.fullName
            return <tr key={profile.id}><td><div className="manager-doctor"><span className="manager-doctor-avatar">{doctorInitials(doctorName)}</span><div><b>{doctorName}</b><small>{profile.departments.map((department) => department.name).join(', ') || 'Chưa cập nhật chuyên khoa'}</small></div></div></td><td>{doctor.total}</td><td>{doctor.completed}</td><td>{doctor.cancelled}</td><td><b>{rate}%</b><span className="manager-progress"><i style={{ width: `${rate}%` }} /></span></td></tr>
          }) : <tr><td colSpan={5}><div className="manager-empty-state"><div className="empty-illustration doctors"><Users size={34} /><Stethoscope size={24} /></div><b>Chưa có lịch khám theo bác sĩ trong ngày</b><span>Hiện chưa có dữ liệu lịch khám cho các bác sĩ.<br />Vui lòng chọn ngày khác hoặc quay lại sau.</span></div></td></tr>}</tbody></table></div>
      </section>

      <section className="manager-panel">
        <div className="manager-panel-title"><h3>Tổng quan tổ chức</h3></div>
        <div className="organization-grid">
          <div><Users /><strong>{data.dashboard.employees.total}</strong><span>Tổng nhân sự</span></div>
          <div><CheckCircle2 /><strong>{data.dashboard.employees.active}</strong><span>Đang hoạt động</span></div>
          <div><Building2 /><strong>{data.dashboard.organization.departments}</strong><span>Khoa chuyên môn</span></div>
          <div><Stethoscope /><strong>{data.dashboard.organization.rooms}</strong><span>Phòng khám</span></div>
        </div>
      </section>

      <section className="manager-panel manager-chart-panel">
        <div className="manager-panel-title"><h3>Tình hình khám trong ngày</h3><span>Tổng {stats.total} lượt khám</span></div>
        {chartData.length ? <div className="manager-chart-body">
          <div className="manager-donut"><div className="manager-donut-ring" role="img" aria-label={`Phân bố ${stats.total} lượt khám`} style={{ background: donutBackground }}><span /></div><div className="manager-donut-label"><strong>{stats.total}</strong><span>Tổng lượt khám</span></div></div>
          <div className="manager-legend">{chartData.map((item, index) => <div key={item.name}><i style={{ background: COLORS[index % COLORS.length] }} /><span>{item.name}</span><b>{item.value} ({percent(item.value, stats.total)}%)</b></div>)}</div>
        </div> : <div className="manager-empty-state chart"><div className="empty-illustration calendar"><CalendarDays size={43} /><Activity size={21} /></div><b>Chưa có lịch khám nào trong ngày này</b><span>Hiện tại không có lịch khám nào được ghi nhận.<br />Hãy chọn ngày khác để xem số liệu.</span></div>}
      </section>

      <section className="manager-panel manager-daily-panel">
        <div className="manager-panel-title"><h3>Thống kê lịch khám theo ngày</h3></div>
        <div className="daily-summary">
          <div><span>Chờ xác nhận</span><b>{stats.pending}</b></div><div><span>Đã xác nhận</span><b>{stats.confirmed}</b></div>
          <div><span>Đang chờ khám</span><b>{stats.waiting}</b></div><div><span>Đang khám</span><b>{stats.inProgress}</b></div>
          <div><span>Hoàn thành</span><b>{stats.completed}</b></div><div><span>Đã hủy</span><b>{stats.cancelled}</b></div>
        </div>
      </section>
    </div>
  </div>
}
