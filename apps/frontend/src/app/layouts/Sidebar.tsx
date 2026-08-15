import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Stethoscope,
  UserCog,
  BarChart3,
  Shield,
  Building2,
} from 'lucide-react';

const navConfig: Record<string, Array<{ path: string; label: string; icon: React.ReactNode }>> = {
  receptionist: [
    { path: '/dashboard', label: 'Tổng quan', icon: <LayoutDashboard size={20} /> },
    { path: '/appointments', label: 'Lịch hẹn', icon: <CalendarDays size={20} /> },
    { path: '/patients', label: 'Bệnh nhân', icon: <Users size={20} /> },
  ],
  doctor: [
    { path: '/dashboard', label: 'Tổng quan', icon: <LayoutDashboard size={20} /> },
    { path: '/patients', label: 'Bệnh nhân', icon: <Users size={20} /> },
    { path: '/medical-records', label: 'Khám bệnh', icon: <Stethoscope size={20} /> },
  ],
  manager: [
    { path: '/dashboard', label: 'Tổng quan', icon: <LayoutDashboard size={20} /> },
    { path: '/appointments', label: 'Lịch hẹn', icon: <CalendarDays size={20} /> },
    { path: '/patients', label: 'Bệnh nhân', icon: <Users size={20} /> },
    { path: '/staff', label: 'Nhân sự', icon: <UserCog size={20} /> },
    { path: '/organization', label: 'Khoa & Phòng', icon: <Building2 size={20} /> },
    { path: '/statistics', label: 'Thống kê', icon: <BarChart3 size={20} /> },
  ],
};

export default function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const location = useLocation();

  const items = navConfig[user?.role ?? 'receptionist'];

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Shield size={20} />
        </div>
        <div>
          <div className="sidebar-logo-brand">An Tâm</div>
          <div className="sidebar-logo-sub">{user?.role === 'receptionist' ? 'Lễ tân' : user?.role === 'doctor' ? 'Bác sĩ' : 'Quản lý'}</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {items.map((item) => (
          <button
            key={item.path}
            className={`nav-item ${location.pathname === item.path || (item.path === '/medical-records' && location.pathname === item.path && !location.search) ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span className="nav-item-icon">{item.icon}</span>
            <span className="nav-item-label">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        © 2026 Phòng Khám An Tâm
      </div>
    </aside>
  );
}
