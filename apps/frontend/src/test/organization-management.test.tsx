import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import App from '../app/App'
import type { Room } from '../features/organization/api/organization.api'
import { useAuthStore } from '../shared/auth/session-store'
import { server } from './server'

describe('manager organization workflow', () => {
  beforeEach(() => {
    useAuthStore.setState({
      token: 'manager-token', refreshToken: null,
      user: { id: '1', username: 'manager', fullName: 'Clinic Manager', role: 'manager' },
      isLoading: false, error: null,
    })
    window.history.replaceState({}, '', '/organization')
  })

  it('shows departments and creates a room in the selected department', async () => {
    const user = userEvent.setup()
    const rooms: Room[] = [{ id: 10, room_number: 'Phòng 101', description: 'Phòng khám nội', department_id: 1, department: { id: 1, code: 'NOI', name: 'Nội khoa', description: null }, doctor_id: 3, doctor: { id: 3, username: 'doctor', full_name: 'BS. Trần Thị Mai' } }]
    server.use(
      http.get('/api/departments/', () => HttpResponse.json([{ id: 1, code: 'NOI', name: 'Nội khoa', description: 'Khám nội tổng quát' }])),
      http.get('/api/rooms/', () => HttpResponse.json(rooms)),
      http.post('/api/rooms/', async ({ request }) => {
        const body = await request.json() as { room_number: string; department_id: number; description: string }
        rooms.push({ id: 11, ...body, department: { id: 1, code: 'NOI', name: 'Nội khoa', description: null } })
        return HttpResponse.json(rooms[1], { status: 201 })
      }),
    )

    render(<App />)
    expect(await screen.findByText('Phòng 101')).toBeVisible()
    expect(screen.getAllByText('Nội khoa')).not.toHaveLength(0)
    expect(screen.getByText('BS. Trần Thị Mai')).toBeVisible()
    expect(screen.queryByText('BS. BS. Trần Thị Mai')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Mở khoa Nội khoa' }))
    expect(screen.getAllByText('Phòng 101')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: /Thêm phòng/ }))
    await user.type(screen.getByLabelText(/Tên hoặc số phòng/), 'Phòng 102')
    await user.type(screen.getByLabelText('Mô tả'), 'Phòng khám mới')
    await user.click(screen.getByRole('button', { name: 'Lưu phòng' }))

    expect(await screen.findAllByText('Phòng 102')).toHaveLength(2)
    expect(screen.getByText('Đã lưu thông tin phòng.')).toBeVisible()
  })
})
