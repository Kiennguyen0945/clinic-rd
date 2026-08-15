import { render, screen } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import App from '../app/App'
import { useAuthStore } from '../shared/auth/session-store'
import { receptionistUser } from './fixtures'
import { server } from './server'

const dashboardData = {
  todayStats: {
    total: 6,
    pending: 1,
    confirmed: 2,
    inProgress: 1,
    completed: 1,
    cancelled: 1,
  },
  upcomingAppointments: [],
}

describe('dashboard query behavior', () => {
  beforeEach(() => {
    useAuthStore.setState({
      token: 'dashboard-token',
      refreshToken: null,
      user: receptionistUser,
      isLoading: false,
      error: null,
    })
    localStorage.setItem('authToken', 'dashboard-token')
    localStorage.setItem('authUser', JSON.stringify(receptionistUser))
    window.history.replaceState({}, '', '/dashboard')
  })

  it('preserves the loading state and renders the mapped dashboard response', async () => {
    server.use(
      http.get('/api/dashboard/today/', async ({ request }) => {
        expect(request.headers.get('Authorization')).toBe('Bearer dashboard-token')
        await delay(50)
        return HttpResponse.json({ success: true, data: dashboardData })
      }),
    )

    render(<App />)

    expect(screen.getByText('Đang tải dữ liệu...')).toBeVisible()
    expect(await screen.findByText('Tổng lượt khám hôm nay')).toBeVisible()
    expect(screen.getByText('6')).toBeVisible()
  })

  it('preserves the empty-state message when the dashboard request fails', async () => {
    server.use(
      http.get('/api/dashboard/today/', () =>
        HttpResponse.json(
          { success: false, error: { message: 'Dashboard unavailable' } },
          { status: 503 },
        ),
      ),
    )

    render(<App />)

    expect(await screen.findByText('Không có dữ liệu hôm nay')).toBeVisible()
  })

  it('renders the reporting dashboard with real API data for managers', async () => {
    const managerUser = { id: '9', username: 'manager', fullName: 'Trần Hoàng Nam', role: 'manager' as const }
    useAuthStore.setState({ user: managerUser })
    localStorage.setItem('authUser', JSON.stringify(managerUser))

    server.use(
      http.get('/api/reports/dashboard/manager/', () => HttpResponse.json({ success: true, data: {
        period: { dateFrom: '2026-08-15', dateTo: '2026-08-15' },
        appointments: { total: 10, completed: 6, cancelled: 1 },
        employees: { total: 12, active: 11, locked: 1 },
        organization: { departments: 3, rooms: 5 },
        dailyAppointments: [{ date: '2026-08-15', total: 10, pending: 1, confirmed: 1, waiting: 1, inProgress: 1, completed: 6, cancelled: 1, synchronizedAt: '2026-08-15T09:00:00Z' }],
        lastSynchronizedAt: '2026-08-15T09:00:00Z',
      } })),
      http.get('/api/reports/doctors/', () => HttpResponse.json({ success: true, data: {
        period: { dateFrom: '2026-08-15', dateTo: '2026-08-15' },
        items: [{ date: '2026-08-15', doctorId: 11, total: 10, completed: 6, cancelled: 1, synchronizedAt: '2026-08-15T09:00:00Z' }],
      } })),
      http.get('/api/appointments/reception-context/', () => HttpResponse.json({ success: true, data: {
        doctors: [{ id: '11', fullName: 'BS. Nguyễn Minh Đức', departments: [{ id: 3, name: 'Nội khoa' }] }],
      } })),
    )

    render(<App />)

    expect(await screen.findByText('Tình hình theo bác sĩ')).toBeVisible()
    expect(screen.getAllByText(/Trần Hoàng Nam/).length).toBeGreaterThan(0)
    expect(screen.getByText('BS. Nguyễn Minh Đức')).toBeVisible()
    expect(screen.getByText('MĐ')).toBeVisible()
    expect(screen.getByText('Tổng quan tổ chức')).toBeVisible()
  })
})
