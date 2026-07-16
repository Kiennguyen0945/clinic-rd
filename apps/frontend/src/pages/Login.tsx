import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const login = useAuthStore((s) => s.login)
  const error = useAuthStore((s) => s.error)
  const clearError = useAuthStore((s) => s.clearError)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    clearError()

    const success = await login(username, password)
    setIsSubmitting(false)

    if (success) {
      navigate('/dashboard', { replace: true })
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        {/* Brand */}
        <div className="brand">
          <div className="brand-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l8 4v5c0 5-3.4 8.4-8 9-4.6-.6-8-4-8-9V7l8-4z"/>
              <path d="M9 12h6M12 9v6"/>
            </svg>
          </div>
          <div>
            <div className="brand-name">Phòng Khám An Tâm</div>
            <div className="brand-sub">Hệ thống quản lý lễ tân</div>
          </div>
        </div>

        <h1>Đăng nhập</h1>
        <p className="auth-subtitle">Nhập tài khoản để bắt đầu ca làm việc hôm nay.</p>

        <form id="login-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="username">Tên đăng nhập</label>
            <input
              className="form-input"
              id="username"
              name="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="VD: letan"
              autoComplete="username"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">Mật khẩu</label>
            <div className="input-with-action">
              <input
                className="form-input"
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="input-action-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {showPassword ? (
                    <>
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>
                      <path d="M1 1l22 22"/>
                    </>
                  ) : (
                    <>
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </>
                  )}
                </svg>
              </button>
            </div>
            {error && <p className="field-error">{error}</p>}
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting}>
            {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>


        <div className="auth-divider">
          Chưa có tài khoản?{' '}
          <button type="button" className="link-btn" onClick={() => {}}>
            Đăng ký ngay
          </button>
        </div>
      </div>
    </div>
  )
}