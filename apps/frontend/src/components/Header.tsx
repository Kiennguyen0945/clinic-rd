import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../store';
import { LogOut, KeyRound, ChevronDown } from 'lucide-react';

export default function Header() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const roleLabel =
    user?.role === 'receptionist'
      ? 'Lễ tân'
      : user?.role === 'doctor'
        ? 'Bác sĩ'
        : 'Quản lý';

  const initials = user?.fullName
    ? user.fullName.split(' ').map((s: string) => s[0]).slice(-2).join('').toUpperCase()
    : user?.username?.slice(0, 2).toUpperCase() || '--';

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <header className="top-header">
      <div className="top-header-title">
        Xin chào, {user?.fullName || '...'}
      </div>

      <div className="user-menu" ref={dropdownRef}>
        <button
          className="user-menu-btn"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          aria-haspopup="true"
          aria-expanded={dropdownOpen}
        >
          <div className="user-avatar">{initials}</div>
          <div className="user-menu-info">
            <div className="user-name">{user?.fullName || user?.username || '—'}</div>
            <div className="user-role-text">{roleLabel}</div>
          </div>
          <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />
        </button>

        {dropdownOpen && (
          <div className="user-dropdown">
            <button className="user-dropdown-btn" onClick={() => { setDropdownOpen(false); }}>
              <KeyRound size={16} />
              Đổi mật khẩu
            </button>
            <hr className="user-dropdown-divider" />
            <button
              className="user-dropdown-btn danger"
              onClick={() => { logout(); setDropdownOpen(false); }}
            >
              <LogOut size={16} />
              Đăng xuất
            </button>
          </div>
        )}
      </div>
    </header>
  );
}