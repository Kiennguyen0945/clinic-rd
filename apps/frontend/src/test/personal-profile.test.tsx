import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import App from '../app/App'
import { useAuthStore } from '../shared/auth/session-store'
import { server } from './server'

describe('personal profile management', () => {
  beforeEach(() => {
    useAuthStore.setState({
      token: 'token', refreshToken: null,
      user: { id: '1', username: 'manager', fullName: 'Clinic Manager', role: 'manager' },
      isLoading: false, error: null,
    })
    window.history.replaceState({}, '', '/organization')
    server.use(
      http.get('/api/departments/', () => HttpResponse.json([])),
      http.get('/api/rooms/', () => HttpResponse.json([])),
    )
  })

  it('opens from the user menu and updates editable personal fields', async () => {
    const user = userEvent.setup()
    server.use(
      http.get('/api/auth/me/', () => HttpResponse.json({ success: true, data: { id: '1', username: 'manager', fullName: 'Clinic Manager', email: 'manager@example.com', phone: '0901234567', gender: 'M', dateOfBirth: '1990-01-01', address: 'Quận 1', role: 'MANAGER', status: 'ACTIVE' } })),
      http.patch('/api/auth/me/', async ({ request }) => {
        const body = await request.json() as Record<string, string>
        return HttpResponse.json({ success: true, data: { id: '1', username: 'manager', role: 'MANAGER', status: 'ACTIVE', ...body } })
      }),
    )

    render(<App />)
    await user.click(screen.getByRole('button', { name: /Clinic Manager/ }))
    await user.click(screen.getByRole('button', { name: 'Quản lý thông tin cá nhân' }))
    expect(await screen.findByRole('dialog', { name: 'Quản lý thông tin cá nhân' })).toBeVisible()
    expect(screen.getByText('@manager')).toBeVisible()

    const name = screen.getByLabelText(/Họ và tên/)
    await user.clear(name)
    await user.type(name, 'Nguyễn Văn A')
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

    expect(await screen.findByText('Xin chào, Nguyễn Văn A')).toBeVisible()
    expect(screen.queryByRole('dialog', { name: 'Quản lý thông tin cá nhân' })).not.toBeInTheDocument()
  })
})
