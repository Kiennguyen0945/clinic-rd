import { Users, Search } from 'lucide-react'

export default function PatientsPage() {
  return (
    <>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="page-title">Danh sách bệnh nhân</div>
          <div className="page-subtitle">Tra cứu hồ sơ bệnh nhân đã từng khám tại phòng khám.</div>
        </div>
      </div>

      {/* Panel */}
      <div className="panel">
        <div className="panel-header">
          <h3>Hồ sơ bệnh nhân</h3>
          <div className="panel-actions">
            <div className="search-box">
              <Search size={18} />
              <input className="form-input" placeholder="Tìm theo tên hoặc SĐT..." style={{ height: 40 }} />
            </div>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Mã BN</th>
                <th>Họ và tên</th>
                <th>Ngày sinh</th>
                <th>Giới tính</th>
                <th>Số điện thoại</th>
                <th>Lần khám gần nhất</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={7}>
                  <div className="empty-state" style={{ padding: 48 }}>
                    <Users size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
                    <div className="empty-state-text">Chưa có bệnh nhân nào</div>
                    <div className="empty-state-hint">Bệnh nhân sẽ xuất hiện sau khi được đăng ký khám.</div>
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
