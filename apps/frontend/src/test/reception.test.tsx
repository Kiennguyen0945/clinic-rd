import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AppointmentsPage from '../pages/Appointments'
import { useAuthStore } from '../store'
import {
  appointment,
  doctor,
  envelope,
  patient,
  receptionistUser,
  receptionContext,
  slot,
} from './fixtures'
import { renderWithRouter } from './render'
import { server } from './server'

type ReceptionSpies = {
  createPatient?: ReturnType<typeof vi.fn>
  createAppointment?: ReturnType<typeof vi.fn>
  updateAppointment?: ReturnType<typeof vi.fn>
  checkIn?: ReturnType<typeof vi.fn>
  cancel?: ReturnType<typeof vi.fn>
}

function useReceptionApi(spies: ReceptionSpies = {}) {
  server.use(
    http.get('/api/appointments/reception-context/', () =>
      HttpResponse.json(envelope(receptionContext)),
    ),
    http.get('/api/patients/', () =>
      HttpResponse.json(
        envelope({
          patients: [patient],
          pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
        }),
      ),
    ),
    http.get('/api/doctor-slots/', () =>
      HttpResponse.json(envelope({ slots: [slot] })),
    ),
    http.get('/api/appointments/', () =>
      HttpResponse.json(envelope({ appointments: [appointment] })),
    ),
    http.post('/api/patients/', async ({ request }) => {
      const body = await request.json()
      spies.createPatient?.(body)
      return HttpResponse.json(
        envelope({
          patient: {
            ...patient,
            id: 22,
            patient_code: 'BN000022',
            full_name: 'Nguyễn Văn Mới',
            phone: '0912345678',
            dob: '1995-06-15',
          },
        }),
        { status: 201 },
      )
    }),
    http.post('/api/appointments/', async ({ request }) => {
      const body = await request.json()
      spies.createAppointment?.(body)
      return HttpResponse.json(
        envelope({
          appointment: {
            ...appointment,
            id: 42,
            appointment_code: 'LH000042',
            booking_type:
              (body as { bookingType?: 'SCHEDULE' | 'WALK_IN' }).bookingType ||
              'SCHEDULE',
          },
        }),
        { status: 201 },
      )
    }),
    http.put('/api/appointments/:id/', async ({ request }) => {
      const body = await request.json()
      spies.updateAppointment?.(body)
      return HttpResponse.json(
        envelope({
          appointment: {
            ...appointment,
            reason: (body as { reason?: string }).reason || appointment.reason,
          },
        }),
      )
    }),
    http.post('/api/appointments/:id/check-in/', () => {
      spies.checkIn?.()
      return HttpResponse.json(
        envelope({ appointment: { ...appointment, status: 'WAITING' } }),
      )
    }),
    http.patch('/api/appointments/:id/cancel/', async ({ request }) => {
      const body = await request.json()
      spies.cancel?.(body)
      return HttpResponse.json(
        envelope({
          appointment: {
            ...appointment,
            status: 'CANCELLED',
            cancellation_reason: (body as { cancellationReason: string })
              .cancellationReason,
          },
        }),
      )
    }),
  )
}

function renderReception(route = `/appointments?doctorId=${doctor.id}`) {
  return renderWithRouter(<AppointmentsPage />, route)
}

describe('reception workflow behavior', () => {
  beforeEach(() => {
    useAuthStore.setState({
      token: 'reception-token',
      refreshToken: 'refresh-token',
      user: receptionistUser,
      isLoading: false,
      error: null,
    })
  })

  it('loads the reception overview and opens a doctor schedule', async () => {
    const user = userEvent.setup()
    useReceptionApi()
    renderReception('/appointments')

    expect((await screen.findAllByText(doctor.fullName)).length).toBeGreaterThan(0)
    expect(screen.getByText('1 / 4')).toBeVisible()
    expect(screen.getAllByText('3').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Xem lịch' }))

    expect(await screen.findByText(`Lịch khám chi tiết của ${doctor.fullName}.`)).toBeVisible()
    expect(screen.getAllByText('14:00 - 14:30').length).toBeGreaterThan(0)
    expect(screen.getAllByText(patient.full_name).length).toBeGreaterThan(0)
    expect(screen.getByText('LH000041')).toBeVisible()
  })

  it('creates a patient inside booking and submits a scheduled appointment', async () => {
    const user = userEvent.setup()
    const createPatient = vi.fn()
    const createAppointment = vi.fn()
    useReceptionApi({ createPatient, createAppointment })
    renderReception()
    await screen.findByText(`Lịch khám chi tiết của ${doctor.fullName}.`)

    await user.click(screen.getByRole('button', { name: /Tạo lịch hẹn/ }))
    const bookingForm = screen.getByRole('heading', { name: 'Tạo lịch hẹn' }).closest('form')!
    await user.click(within(bookingForm).getByRole('button', { name: 'Tạo bệnh nhân mới' }))

    const patientForm = screen.getByRole('heading', { name: 'Thêm bệnh nhân' }).closest('form')!
    await user.type(within(patientForm).getByLabelText(/Họ và tên/), 'Nguyễn Văn Mới')
    await user.type(within(patientForm).getByLabelText(/Ngày sinh/), '1995-06-15')
    await user.type(within(patientForm).getByLabelText(/Số điện thoại/), '0912345678')
    await user.click(within(patientForm).getByRole('button', { name: 'Tạo hồ sơ' }))

    await waitFor(() => expect(createPatient).toHaveBeenCalledWith({
      full_name: 'Nguyễn Văn Mới',
      phone: '0912345678',
      dob: '1995-06-15',
      gender: 'M',
      email: '',
      cccd: '',
      address: '',
    }))
    expect(within(bookingForm).getByDisplayValue('Nguyễn Văn Mới')).toBeVisible()

    await user.click(within(bookingForm).getByRole('button', { name: '14:00 - 14:30' }))
    await user.type(within(bookingForm).getByPlaceholderText('Nhập lý do khám'), 'Khám tổng quát')
    const createButtons = within(bookingForm).getAllByRole('button', { name: 'Tạo lịch' })
    await user.click(createButtons[createButtons.length - 1])

    await waitFor(() => expect(createAppointment).toHaveBeenCalledWith({
      patientId: 22,
      doctorId: 11,
      slotId: 31,
      departmentId: 3,
      bookingType: 'SCHEDULE',
      patientType: 'SERVICE',
      reason: 'Khám tổng quát',
    }))
    expect(await screen.findByText('LH000042')).toBeVisible()
  })

  it('submits an immediate walk-in appointment with the existing patient', async () => {
    const user = userEvent.setup()
    const createAppointment = vi.fn()
    useReceptionApi({ createAppointment })
    renderReception()
    await screen.findByText(`Lịch khám chi tiết của ${doctor.fullName}.`)

    await user.click(screen.getByRole('button', { name: /Tạo lịch hẹn/ }))
    const form = screen.getByRole('heading', { name: 'Tạo lịch hẹn' }).closest('form')!
    await user.type(within(form).getByPlaceholderText('Tìm tên hoặc mã bệnh nhân'), 'Trần Thu Hà')
    await user.click(within(form).getByRole('button', { name: /Trần Thu Hà/ }))
    await user.click(within(form).getAllByRole('button', { name: 'Khám ngay' })[0])
    await user.click(within(form).getByRole('button', { name: '14:00 - 14:30' }))
    await user.type(within(form).getByPlaceholderText('Nhập lý do khám'), 'Khám không hẹn')
    const immediateButtons = within(form).getAllByRole('button', { name: 'Khám ngay' })
    await user.click(immediateButtons[immediateButtons.length - 1])

    await waitFor(() => expect(createAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 21,
        doctorId: 11,
        slotId: 31,
        bookingType: 'WALK_IN',
        patientType: 'SERVICE',
        reason: 'Khám không hẹn',
      }),
    ))
  })

  it('checks in, reschedules, and cancels the selected appointment', async () => {
    const user = userEvent.setup()
    const checkIn = vi.fn()
    const updateAppointment = vi.fn()
    const cancel = vi.fn()
    useReceptionApi({ checkIn, updateAppointment, cancel })
    renderReception()

    expect(await screen.findByText('LH000041')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Tiếp nhận' }))
    await waitFor(() => expect(checkIn).toHaveBeenCalledOnce())

    await user.click(screen.getByRole('button', { name: /Cập nhật lịch khám/ }))
    const updateForm = screen.getByRole('heading', { name: 'Cập nhật lịch hẹn' }).closest('form')!
    const reasonInput = within(updateForm).getByLabelText(/Lý do khám/)
    await user.clear(reasonInput)
    await user.type(reasonInput, 'Tái khám sau điều trị')
    await user.click(within(updateForm).getByRole('button', { name: /Lưu thay đổi/ }))

    await waitFor(() => expect(updateAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'Tái khám sau điều trị', slotId: 31 }),
    ))

    await user.click(screen.getByRole('button', { name: 'Hủy' }))
    const cancelForm = screen.getByRole('heading', { name: 'Hủy lịch hẹn' }).closest('form')!
    await user.click(within(cancelForm).getByRole('button', { name: /Xác nhận hủy/ }))

    await waitFor(() => expect(cancel).toHaveBeenCalledWith({
      cancellationReason: 'PATIENT_REQUEST',
      cancellationNote: '',
    }))
  })
})
