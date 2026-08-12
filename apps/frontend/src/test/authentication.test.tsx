import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import App from '../app/App'
import { authFetch } from '../lib/authFetch'
import { useAuthStore } from '../store'
import { receptionistUser } from './fixtures'
import { server } from './server'

const dashboardData = {
  todayStats: {
    total: 0,
    pending: 0,
    confirmed: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
  },
  upcomingAppointments: [],
}

function resetAuthStore() {
  useAuthStore.setState({
    token: null,
    refreshToken: null,
    user: null,
    isLoading: true,
    error: null,
  })
}

describe('authentication behavior', () => {
  beforeEach(() => {
    resetAuthStore()
    window.history.replaceState({}, '', '/login')
  })

  it('redirects an anonymous visitor from a protected route to login', async () => {
    window.history.replaceState({}, '', '/appointments')

    renderApp()

    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeVisible()
    expect(window.location.pathname).toBe('/login')
  })

  it('logs in a receptionist, persists the session, and exposes receptionist navigation', async () => {
    const user = userEvent.setup()
    let loginBody: unknown
    server.use(
      http.post('/api/auth/login/', async ({ request }) => {
        loginBody = await request.json()
        return HttpResponse.json({
          success: true,
          data: {
            token: 'access-token',
            refreshToken: 'refresh-token',
            user: {
              id: receptionistUser.id,
              username: receptionistUser.username,
              full_name: receptionistUser.fullName,
              role: receptionistUser.role,
            },
          },
        })
      }),
      http.get('/api/dashboard/today/', () =>
        HttpResponse.json({ success: true, data: dashboardData }),
      ),
    )

    renderApp()
    await user.type(screen.getByLabelText('Tên đăng nhập'), 'letan')
    await user.type(screen.getByLabelText('Mật khẩu'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))

    expect(await screen.findByText('Tổng lượt khám hôm nay')).toBeVisible()
    expect(loginBody).toEqual({ username: 'letan', password: 'secret123' })
    expect(localStorage.getItem('authToken')).toBe('access-token')
    expect(localStorage.getItem('refreshToken')).toBe('refresh-token')
    expect(screen.getByRole('button', { name: /Lịch hẹn/ })).toBeVisible()
    expect(screen.queryByRole('button', { name: /Khám bệnh/ })).not.toBeInTheDocument()
    expect(window.location.pathname).toBe('/dashboard')
  })

  it('restores a stored session and logs out through the header menu', async () => {
    const user = userEvent.setup()
    localStorage.setItem('authToken', 'stored-token')
    localStorage.setItem('refreshToken', 'stored-refresh-token')
    localStorage.setItem('authUser', JSON.stringify(receptionistUser))
    window.history.replaceState({}, '', '/dashboard')
    server.use(
      http.get('/api/dashboard/today/', () =>
        HttpResponse.json({ success: true, data: dashboardData }),
      ),
    )

    renderApp()

    expect(await screen.findByText(`Xin chào, ${receptionistUser.fullName}`)).toBeVisible()
    await user.click(screen.getByRole('button', { name: new RegExp(receptionistUser.fullName) }))
    await user.click(screen.getByRole('button', { name: /Đăng xuất/ }))

    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeVisible()
    expect(localStorage.getItem('authToken')).toBeNull()
    expect(localStorage.getItem('refreshToken')).toBeNull()
    expect(localStorage.getItem('authUser')).toBeNull()
  })

  it('refreshes an expired access token and retries a request once', async () => {
    useAuthStore.setState({
      token: 'expired-token',
      refreshToken: 'valid-refresh-token',
      user: receptionistUser,
      isLoading: false,
    })
    const protectedCalls = vi.fn()
    const refreshCalls = vi.fn()
    server.use(
      http.get('/api/protected/', ({ request }) => {
        protectedCalls(request.headers.get('Authorization'))
        if (request.headers.get('Authorization') === 'Bearer fresh-token') {
          return HttpResponse.json({ success: true })
        }
        return HttpResponse.json({ success: false }, { status: 401 })
      }),
      http.post('/api/auth/refresh/', async ({ request }) => {
        refreshCalls(await request.json())
        return HttpResponse.json({
          success: true,
          data: { token: 'fresh-token', refreshToken: 'rotated-refresh-token' },
        })
      }),
    )

    const response = await authFetch('/api/protected/')

    expect(response.status).toBe(200)
    expect(protectedCalls).toHaveBeenNthCalledWith(1, 'Bearer expired-token')
    expect(protectedCalls).toHaveBeenNthCalledWith(2, 'Bearer fresh-token')
    expect(refreshCalls).toHaveBeenCalledOnce()
    expect(refreshCalls).toHaveBeenCalledWith({ refreshToken: 'valid-refresh-token' })
    expect(useAuthStore.getState().token).toBe('fresh-token')
    expect(localStorage.getItem('refreshToken')).toBe('rotated-refresh-token')
  })
})

function renderApp() {
  // App owns the global providers, so these tests exercise the actual app boundary.
  return render(<App />)
}
