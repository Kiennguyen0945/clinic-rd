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
})
