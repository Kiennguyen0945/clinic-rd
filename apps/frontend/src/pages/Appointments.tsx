import { CalendarPlus, Plus, Search } from 'lucide-react'

export default function AppointmentsPage() {
  return (
    <>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="page-title">Lịch hẹn</div>
          <div className="page-subtitle">Quản lý các lịch hẹn khám sắp tới.</div>
        </div>
        <div className="panel-actions">
          <button className="btn btn-primary btn-sm">
            <Plus size={16} />
            Đặt lịch hẹn mới
          </button>
        </div>
      </div>

      {/* Panel */}
      <div className="panel">
        <div className="panel-header">
          <h3>Danh sách lịch hẹn</h3>
          <div className="panel-actions">
            <div className="search-box">
              <Search size={18} />
              <input className="form-input" placeholder="Tìm kiếm..." style={{ height: 40 }} />
            </div>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Ngày khám</th>
                <th>Giờ</th>
                <th>Bệnh nhân</th>
                <th>Số điện thoại</th>
                <th>Bác sĩ</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={7}>
                  <div className="empty-state" style={{ padding: 48 }}>
                    <CalendarPlus size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
                    <div className="empty-state-text">Chưa có lịch hẹn nào</div>
                    <div className="empty-state-hint">Nhấn "Đặt lịch hẹn mới" để tạo lịch hẹn đầu tiên.</div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
