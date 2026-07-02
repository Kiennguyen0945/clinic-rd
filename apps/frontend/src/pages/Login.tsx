import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

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
    <div className="app-shell login-shell">
      <div className="login-card">
        <p className="brand-label">PHÒNG KHÁM</p>
        <h1>Hệ thống quản lý khám bệnh</h1>
        <p className="helper-text">Giao diện tối giản, rõ ràng và phù hợp cho bác sĩ và lễ tân.</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="username">Tên đăng nhập</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Nhập tên đăng nhập"
            required
          />

          <label className="field-label" htmlFor="password">Mật khẩu</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nhập mật khẩu"
            required
          />

          <button type="submit" className="primary-button" disabled={isSubmitting}>
            {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        {error ? <p className="error-text">{error}</p> : null}
      </div>
    </div>
  )
}