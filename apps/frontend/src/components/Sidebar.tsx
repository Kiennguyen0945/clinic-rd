import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store';

const navConfig = {
  receptionist: [
    { path: '/dashboard', label: 'Tổng quan', icon: '📊' },
    { path: '/appointments', label: 'Lịch hẹn', icon: '🗓️' },
    { path: '/patients', label: 'Bệnh nhân', icon: '👤' },
  ],
  doctor: [
    { path: '/dashboard', label: 'Tổng quan', icon: '📊' },
    { path: '/appointments', label: 'Lịch hẹn', icon: '🗓️' },
    { path: '/patients', label: 'Bệnh nhân', icon: '👤' },
    { path: '/medical-records', label: 'Bệnh án', icon: '📝' },
  ],
  manager: [
    { path: '/dashboard', label: 'Tổng quan', icon: '📊' },
    { path: '/appointments', label: 'Lịch hẹn', icon: '🗓️' },
    { path: '/patients', label: 'Bệnh nhân', icon: '👤' },
    { path: '/staff', label: 'Nhân sự', icon: '👥' },
    { path: '/statistics', label: 'Thống kê', icon: '📈' },
  ],
};

export default function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const location = useLocation();

  const items = navConfig[user?.role ?? 'receptionist'];

  return (
    <aside className="sidebar">
      <div>
        <p className="brand-label">PHÒNG KHÁM</p>
        <h2>Clinic Board</h2>
      </div>

      <nav className="sidebar-nav">
        {items.map((item) => (
          <button
            key={item.path}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div />
    </aside>
  );
}