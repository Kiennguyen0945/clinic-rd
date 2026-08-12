import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useAuthStore } from '../../store';
import { X, LogOut, KeyRound, ChevronDown } from 'lucide-react';
import { authFetch } from '../../lib/authFetch';

export default function Header() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
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
  const closeChangePassword = useCallback(() => {
    if (submitting) return;
    setChangePasswordOpen(false);
  }, [submitting]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (!changePasswordOpen) return;

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') closeChangePassword();
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [changePasswordOpen, closeChangePassword]);

  function openChangePassword() {
    setDropdownOpen(false);
    setFormError('');
    setForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
    setChangePasswordOpen(true);
  }

  async function handleChangePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError('');

    if (form.newPassword.length < 6) {
      setFormError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (form.newPassword !== form.confirmNewPassword) {
      setFormError('Xác nhận mật khẩu mới không khớp.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await authFetch('/api/auth/change-password/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await response.json();

      if (!response.ok || !json.success) {
        setFormError(json.error?.message || json.message || 'Không thể đổi mật khẩu.');
        return;
      }

      setChangePasswordOpen(false);
    } catch {
      setFormError('Không thể kết nối máy chủ. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  }

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
            <button className="user-dropdown-btn" onClick={openChangePassword}>
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

      {changePasswordOpen && createPortal(
        <div className="modal-overlay" role="presentation" onMouseDown={closeChangePassword}>
          <div
            className="modal-box change-password-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-password-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3 id="change-password-title">Đổi mật khẩu</h3>
                <p>Cập nhật mật khẩu để bảo vệ tài khoản của bạn.</p>
              </div>
              <button className="modal-close" type="button" onClick={closeChangePassword} aria-label="Đóng">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleChangePassword}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label" htmlFor="current-password">Mật khẩu hiện tại</label>
                  <input
                    id="current-password"
                    className="form-input"
                    type="password"
                    autoComplete="current-password"
                    value={form.currentPassword}
                    onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
                    required
                  />
                  <span className="form-hint">Dùng để xác thực chính chủ.</span>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="new-password">Mật khẩu mới</label>
                  <input
                    id="new-password"
                    className="form-input"
                    type="password"
                    autoComplete="new-password"
                    minLength={6}
                    value={form.newPassword}
                    onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                    required
                  />
                  <span className="form-hint">Tối thiểu 6 ký tự.</span>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="confirm-new-password">Xác nhận mật khẩu mới</label>
                  <input
                    id="confirm-new-password"
                    className="form-input"
                    type="password"
                    autoComplete="new-password"
                    value={form.confirmNewPassword}
                    onChange={(e) => setForm({ ...form, confirmNewPassword: e.target.value })}
                    required
                  />
                </div>
                {formError && <div className="form-error change-password-error" role="alert">{formError}</div>}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" type="button" onClick={closeChangePassword} disabled={submitting}>Hủy</button>
                <button className="btn btn-primary" type="submit" disabled={submitting}>
                  {submitting ? 'Đang cập nhật...' : 'Cập nhật'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </header>
  );
}
