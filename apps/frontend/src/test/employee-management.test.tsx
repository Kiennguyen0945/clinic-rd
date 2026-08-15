import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import App from '../app/App'
import { useAuthStore } from '../shared/auth/session-store'
import { server } from './server'

const manager = { id: '1', username: 'manager', fullName: 'Clinic Manager', role: 'manager' as const }
const receptionist = {
  id: '2', username: 'reception', email: 'reception@example.com', fullName: 'Reception One', phone: '0900000000',
  gender: 'F', dateOfBirth: '1995-05-10', address: 'Quận 1, TP.HCM',
  status: 'ACTIVE', role: 'RECEPTIONIST', departments: [], canEdit: true, canDelete: true,
  scheduleStatus: 'NOT_APPLICABLE', canReceiveAppointments: false,
}

describe('manager employee workflow', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: 'manager-token', refreshToken: null, user: manager, isLoading: false, error: null })
    window.history.replaceState({}, '', '/staff')
    server.use(http.post('/api/reports/synchronize/', () => HttpResponse.json({ success: true, data: {} })))
  })

  it('lists employees and creates a receptionist', async () => {
    const user = userEvent.setup()
    const employees = [receptionist]
    server.use(
      http.get('/api/auth/staff/', () => HttpResponse.json({ success: true, data: employees })),
      http.get('/api/auth/staff/2/', () => HttpResponse.json({ success: true, data: { user: receptionist } })),
      http.get('/api/departments/', () => HttpResponse.json([{ id: 1, code: 'GENERAL', name: 'Nội khoa' }])),
      http.get('/api/rooms/', () => HttpResponse.json([{ id: 1, room_number: 'Phòng 1' }])),
      http.post('/api/auth/staff/', async ({ request }) => {
        const body = await request.json() as Record<string, string>
        const created = { ...receptionist, id: '3', username: body.username, fullName: body.fullName, email: body.email }
        employees.push(created)
        return HttpResponse.json({ success: true, data: { user: created, generatedPassword: 'Demo1234', allocation: null } }, { status: 201 })
      }),
    )

    render(<App />)
    expect(await screen.findByText('Reception One')).toBeVisible()
    expect(screen.getByText('O')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Xem chi tiết' }))
    expect(await screen.findByRole('dialog', { name: 'Thông tin nhân viên' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Đóng' }))
    await user.click(screen.getByRole('button', { name: /Thêm nhân viên/ }))
    await user.type(screen.getByLabelText(/Họ và tên/), 'Phó Sinh')
    expect(screen.getByLabelText(/Tên đăng nhập/)).toHaveValue('phosinh')
    await user.clear(screen.getByLabelText(/Tên đăng nhập/))
    await user.type(screen.getByLabelText(/Tên đăng nhập/), 'reception2')
    await user.type(screen.getByLabelText(/Email/), 'reception2@example.com')
    await user.click(screen.getByRole('button', { name: 'Lưu nhân viên' }))

    expect(await screen.findByText(/Mật khẩu ban đầu: Demo1234/)).toBeVisible()
    expect(await screen.findByText('Phó Sinh')).toBeVisible()
  })

  it('redirects a receptionist away from manager employee routes', async () => {
    useAuthStore.setState({ user: { id: '2', username: 'reception', fullName: 'Reception', role: 'receptionist' } })
    server.use(http.get('/api/dashboard/today/', () => HttpResponse.json({ success: true, data: { todayStats: { total: 0, pending: 0, confirmed: 0, inProgress: 0, completed: 0, cancelled: 0 }, upcomingAppointments: [] } })))

    render(<App />)
    expect(await screen.findByText('Tổng lượt khám hôm nay')).toBeVisible()
    expect(window.location.pathname).toBe('/dashboard')
  })

  it('locks and unlocks an employee independently from edit permissions', async () => {
    const user = userEvent.setup()
    let status: 'ACTIVE' | 'LOCKED' = 'ACTIVE'
    const lockedByHistory = { ...receptionist, canEdit: false, canDelete: false }
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    server.use(
      http.get('/api/auth/staff/', () => HttpResponse.json({ success: true, data: [{ ...lockedByHistory, status }] })),
      http.get('/api/auth/staff/2/', () => HttpResponse.json({ success: true, data: { user: { ...lockedByHistory, status } } })),
      http.get('/api/departments/', () => HttpResponse.json([])),
      http.get('/api/rooms/', () => HttpResponse.json([])),
      http.patch('/api/auth/staff/2/lock/', async ({ request }) => {
        const body = await request.json() as { action: 'lock' | 'unlock' }
        status = body.action === 'lock' ? 'LOCKED' : 'ACTIVE'
        return HttpResponse.json({ success: true, data: { user: { ...lockedByHistory, status } } })
      }),
    )

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Xem chi tiết' }))
    expect(screen.queryByRole('button', { name: /Chỉnh sửa/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Xóa nhân viên/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Khóa tài khoản' }))
    expect(await screen.findByText('Đã khóa tài khoản.')).toBeVisible()
    expect(await screen.findByRole('button', { name: 'Mở khóa' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Mở khóa' }))
    expect(await screen.findByText('Đã mở khóa tài khoản.')).toBeVisible()
    expect(await screen.findByRole('button', { name: 'Khóa tài khoản' })).toBeVisible()
  })
})
