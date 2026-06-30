import { useState } from 'react'
import './App.css'

type ViewKey = 'today' | 'appointments' | 'patients' | 'records'

const navItems: Array<{ key: ViewKey; label: string; icon: string }> = [
  { key: 'today', label: 'Lịch hôm nay', icon: '📅' },
  { key: 'appointments', label: 'Lịch hẹn', icon: '🗓️' },
  { key: 'patients', label: 'Bệnh nhân', icon: '👤' },
  { key: 'records', label: 'Bệnh án', icon: '📝' },
]

function App() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('authToken')
    }
    return null
  })
  const [activeView, setActiveView] = useState<ViewKey>('today')

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const data = await response.json()

      if (response.ok) {
        window.localStorage.setItem('authToken', data.token)
        setToken(data.token)
        setUsername('')
        setPassword('')
      } else {
        setError(data.errors || data.error || 'Đăng nhập thất bại')
      }
    } catch {
      setError('Không thể kết nối máy chủ. Vui lòng kiểm tra backend.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = () => {
    window.localStorage.removeItem('authToken')
    setToken(null)
  }

  if (!token) {
    return (
      <div className="app-shell login-shell">
        <div className="login-card">
          <p className="brand-label">PHÒNG KHÁM</p>
          <h1>Hệ thống quản lý khám bệnh</h1>
          <p className="helper-text">Giao diện tối giản, rõ ràng và phù hợp cho bác sĩ và lễ tân.</p>

          <form className="login-form" onSubmit={handleLogin}>
            <label className="field-label" htmlFor="username">Tên đăng nhập</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Nhập tên đăng nhập"
              required
            />

            <label className="field-label" htmlFor="password">Mật khẩu</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Nhập mật khẩu"
              required
            />

            <button type="submit" className="primary-button" disabled={isLoading}>
              {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>

          {error ? <p className="error-text">{error}</p> : null}
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell workspace-shell">
      <aside className="sidebar">
        <div>
          <p className="brand-label">PHÒNG KHÁM</p>
          <h2>Clinic Board</h2>
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`nav-item ${activeView === item.key ? 'active' : ''}`}
              onClick={() => setActiveView(item.key)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <button className="secondary-button logout-button" onClick={handleLogout}>
          Đăng xuất
        </button>
      </aside>

      <main className="main-panel">
        <header className="main-header">
          <div>
            <p className="section-label">TRUNG TÂM HOẠT ĐỘNG</p>
            <h3>
              {activeView === 'today' && 'Lịch hẹn hôm nay'}
              {activeView === 'appointments' && 'Quản lý lịch hẹn'}
              {activeView === 'patients' && 'Hồ sơ bệnh nhân'}
              {activeView === 'records' && 'Bệnh án'}
            </h3>
          </div>
          <div className="header-pill">Đang làm việc</div>
        </header>

        <section className="workspace-grid">
          <div className="content-card large-card">
            <h4>Thông tin làm việc</h4>
            <p>
              {activeView === 'today' && 'Danh sách lịch hẹn sẽ được hiển thị ở đây, sắp xếp theo thời gian để bác sĩ làm việc nhanh.'}
              {activeView === 'appointments' && 'Màn hình đặt lịch sẽ được mở ở đây với các trường tối giản và thao tác rõ ràng.'}
              {activeView === 'patients' && 'Tra cứu bệnh nhân và hồ sơ sẽ được tổ chức thành một khu vực riêng, dễ dùng.'}
              {activeView === 'records' && 'Ghi chép bệnh án sẽ nằm trong một form ngắn gọn, chỉ giữ những trường cần thiết.'}
            </p>
            <div className="info-box">
              <strong>Giai đoạn đầu</strong>
              <p>Đây là khung làm việc tổng thể cho frontend, sẵn sàng để nối tiếp các thành phần sau này.</p>
            </div>
          </div>

          <div className="content-card">
            <h4>Tóm tắt nhanh</h4>
            <div className="stat-row"><span>Hẹn hôm nay</span><strong>12</strong></div>
            <div className="stat-row"><span>Đang chờ</span><strong>4</strong></div>
            <div className="stat-row"><span>Bệnh nhân mới</span><strong>3</strong></div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App

