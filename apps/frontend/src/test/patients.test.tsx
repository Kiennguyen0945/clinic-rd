import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import PatientsPage from '../pages/Patients'
import { useAuthStore } from '../store'
import {
  appointment,
  doctor,
  doctorUser,
  envelope,
  medicalHistory,
  patient,
  receptionistUser,
  receptionContext,
  slot,
} from './fixtures'
import { renderWithRouter } from './render'
import { server } from './server'

function setSession(user: typeof receptionistUser | typeof doctorUser) {
  useAuthStore.setState({
    token: 'test-token',
    refreshToken: 'refresh-token',
    user,
    isLoading: false,
    error: null,
  })
}

describe('patient workflow behavior', () => {
  beforeEach(() => setSession(receptionistUser))

  it('searches, filters, and paginates through API query parameters', async () => {
    const user = userEvent.setup()
    const requests: URL[] = []
    server.use(
      http.get('/api/patients/', ({ request }) => {
        requests.push(new URL(request.url))
        return HttpResponse.json(envelope({
          patients: [patient],
          pagination: {
            page: Number(new URL(request.url).searchParams.get('page') || 1),
            pageSize: 10,
            totalItems: 12,
            totalPages: 2,
          },
        }))
      }),
    )

    renderWithRouter(<PatientsPage />, '/patients')
    expect(await screen.findByText(patient.full_name)).toBeVisible()

    await user.type(
      screen.getByPlaceholderText('Tìm theo tên, mã bệnh nhân hoặc số điện thoại...'),
      'Thu Hà',
    )
    await user.selectOptions(screen.getByDisplayValue('Giới tính: Tất cả'), 'Nữ')
    await user.selectOptions(screen.getByDisplayValue('Độ tuổi: Tất cả'), '30to40')

    await waitFor(() => {
      const latest = requests[requests.length - 1]
      expect(latest.searchParams.get('keyword')).toBe('Thu Hà')
      expect(latest.searchParams.get('gender')).toBe('F')
      expect(latest.searchParams.get('age')).toBe('30to40')
      expect(latest.searchParams.get('page')).toBe('1')
    })

    await user.click(screen.getByRole('button', { name: '2' }))
    await waitFor(() => expect(requests[requests.length - 1].searchParams.get('page')).toBe('2'))
    expect(screen.getByText('Hiển thị 11 đến 12 trong tổng số 12 bệnh nhân')).toBeVisible()
  })

  it('opens and edits a patient profile without requesting medical history for receptionists', async () => {
    const user = userEvent.setup()
    const updatePatient = vi.fn()
    const historyRequest = vi.fn()
    server.use(
      http.get('/api/patients/', () => HttpResponse.json(envelope({
        patients: [patient],
        pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
      }))),
      http.get('/api/patients/:id/medical-records/', () => {
        historyRequest()
        return HttpResponse.json(envelope({ medicalRecords: [medicalHistory] }))
      }),
      http.put('/api/patients/:id/', async ({ request }) => {
        const body = await request.json()
        updatePatient(body)
        return HttpResponse.json(envelope({
          patient: { ...patient, full_name: (body as { full_name: string }).full_name },
        }))
      }),
    )

    renderWithRouter(<PatientsPage />, '/patients')
    await screen.findByText(patient.full_name)
    await user.click(screen.getByRole('button', { name: 'Xem hồ sơ' }))

    const drawer = screen.getByLabelText('Hồ sơ bệnh nhân')
    expect(within(drawer).getAllByText(patient.patient_code).length).toBeGreaterThan(0)
    expect(within(drawer).queryByText('Lịch sử khám')).not.toBeInTheDocument()
    expect(historyRequest).not.toHaveBeenCalled()

    await user.click(within(drawer).getByRole('button', { name: /Cập nhật thông tin/ }))
    const form = screen.getByRole('heading', { name: 'Cập nhật thông tin bệnh nhân' }).closest('form')!
    const nameInput = within(form).getByLabelText(/Họ và tên/)
    await user.clear(nameInput)
    await user.type(nameInput, 'Trần Thu Hà Mới')
    await user.click(within(form).getByRole('button', { name: 'Lưu thay đổi' }))

    await waitFor(() => expect(updatePatient).toHaveBeenCalledWith({
      full_name: 'Trần Thu Hà Mới',
      phone: patient.phone,
      email: patient.email,
      cccd: patient.cccd,
      insurance_number: '',
      address: patient.address,
    }))
    expect((await screen.findAllByText('Trần Thu Hà Mới')).length).toBeGreaterThan(0)
  })

  it('creates an appointment from the selected patient', async () => {
    const user = userEvent.setup()
    const createAppointment = vi.fn()
    server.use(
      http.get('/api/patients/', () => HttpResponse.json(envelope({
        patients: [patient],
        pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
      }))),
      http.get('/api/appointments/reception-context/', () =>
        HttpResponse.json(envelope(receptionContext)),
      ),
      http.get('/api/doctor-slots/', () => HttpResponse.json(envelope({ slots: [slot] }))),
      http.post('/api/appointments/', async ({ request }) => {
        const body = await request.json()
        createAppointment(body)
        return HttpResponse.json(envelope({ appointment }), { status: 201 })
      }),
    )

    renderWithRouter(<PatientsPage />, '/patients')
    await screen.findByText(patient.full_name)
    await user.click(screen.getByRole('button', { name: 'Thao tác khác' }))
    await user.click(screen.getByRole('button', { name: 'Tạo lịch hẹn' }))

    const form = (await screen.findByRole('heading', { name: 'Tạo lịch hẹn' })).closest('form')!
    expect(within(form).getByDisplayValue(patient.full_name)).toBeDisabled()
    const doctorInput = within(form).getByLabelText(/Bác sĩ/)
    await user.click(doctorInput)
    await user.click(within(form).getByRole('button', { name: doctor.fullName }))
    await user.click(await within(form).findByRole('button', { name: '14:00 - 14:30' }))
    await user.type(within(form).getByPlaceholderText('Nhập lý do khám'), 'Khám từ hồ sơ bệnh nhân')
    const createButtons = within(form).getAllByRole('button', { name: 'Tạo lịch' })
    await user.click(createButtons[createButtons.length - 1])

    await waitFor(() => expect(createAppointment).toHaveBeenCalledWith({
      patientId: 21,
      doctorId: 11,
      slotId: 31,
      departmentId: 3,
      bookingType: 'SCHEDULE',
      patientType: 'SERVICE',
      reason: 'Khám từ hồ sơ bệnh nhân',
    }))
    expect(screen.queryByRole('heading', { name: 'Tạo lịch hẹn' })).not.toBeInTheDocument()
  })

  it('loads signed medical-record history when a doctor opens a patient profile', async () => {
    const user = userEvent.setup()
    setSession(doctorUser)
    server.use(
      http.get('/api/patients/', () => HttpResponse.json(envelope({
        patients: [patient],
        pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
      }))),
      http.get('/api/patients/:id/medical-records/', () =>
        HttpResponse.json(envelope({ medicalRecords: [medicalHistory] })),
      ),
    )

    renderWithRouter(<PatientsPage />, '/patients')
    await screen.findByText(patient.full_name)
    await user.click(screen.getByRole('button', { name: 'Xem hồ sơ' }))

    const drawer = screen.getByLabelText('Hồ sơ bệnh nhân')
    expect(await within(drawer).findByText('Chẩn đoán: Đau đầu căng thẳng')).toBeVisible()
    expect(within(drawer).getByText('Xem tất cả (1)')).toBeVisible()
    expect(within(drawer).queryByRole('button', { name: /Cập nhật thông tin/ })).not.toBeInTheDocument()
  })
})
