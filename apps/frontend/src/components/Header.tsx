import { useAuthStore } from '../store';

export default function Header() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const roleLabel =
    user?.role === 'receptionist'
      ? 'Lễ tân'
      : user?.role === 'doctor'
        ? 'Bác sĩ'
        : 'Quản lý';

  return (
    <header className="main-header">
      <div>
        <p className="section-label">TRUNG TÂM HOẠT ĐỘNG</p>
        <h3>Xin chào, {user?.fullName || '...'}</h3>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <span className="header-pill">{roleLabel}</span>
        <button className="secondary-button" onClick={logout}>
          Đăng xuất
        </button>
      </div>
    </header>
  );
}