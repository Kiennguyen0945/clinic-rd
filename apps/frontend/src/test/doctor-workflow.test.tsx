import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import App from '../App'
import MedicalRecordsPage from '../pages/MedicalRecords'
import { useAuthStore } from '../store'
import {
  appointment,
  doctorUser,
  envelope,
  medicalHistory,
  medicalRecord,
  patient,
  receptionistUser,
  slot,
} from './fixtures'
import { renderWithRouter } from './render'
import { server } from './server'

const waitingAppointment = { ...appointment, status: 'WAITING' as const }
const inProgressAppointment = { ...appointment, status: 'IN_PROGRESS' as const }

function setDoctorSession() {
  useAuthStore.setState({
    token: 'doctor-token',
    refreshToken: 'refresh-token',
    user: doctorUser,
    isLoading: false,
    error: null,
  })
}

function useDoctorScheduleApi(scheduleRequest?: ReturnType<typeof vi.fn>) {
  server.use(
    http.get('/api/doctor-slots/', () => HttpResponse.json(envelope({ slots: [slot] }))),
    http.get('/api/appointments/', () => {
      scheduleRequest?.()
      return HttpResponse.json(envelope({ appointments: [waitingAppointment] }))
    }),
    http.get('/api/patients/', () => HttpResponse.json(envelope({
      patients: [patient],
      pagination: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
    }))),
  )
}

describe('doctor workflow behavior', () => {
  beforeEach(() => setDoctorSession())

  it('redirects a non-doctor away from the medical-record route', async () => {
    useAuthStore.setState({
      token: null,
      refreshToken: null,
      user: null,
      isLoading: true,
      error: null,
    })
    localStorage.setItem('authToken', 'reception-token')
    localStorage.setItem('refreshToken', 'refresh-token')
    localStorage.setItem('authUser', JSON.stringify(receptionistUser))
    window.history.replaceState({}, '', '/medical-records')
    server.use(
      http.get('/api/dashboard/today/', () => HttpResponse.json({
        success: true,
        data: {
          todayStats: { total: 0, pending: 0, confirmed: 0, inProgress: 0, completed: 0, cancelled: 0 },
          upcomingAppointments: [],
        },
      })),
    )

    render(<App />)

    expect(await screen.findByText('Tổng lượt khám hôm nay')).toBeVisible()
    expect(window.location.pathname).toBe('/dashboard')
    expect(screen.queryByText('Tiếp nhận và ghi nhận thông tin khám bệnh hôm nay.')).not.toBeInTheDocument()
  })

  it('loads the doctor queue and polls it every three seconds', async () => {
    const scheduleRequest = vi.fn()
    useDoctorScheduleApi(scheduleRequest)

    renderWithRouter(<MedicalRecordsPage />, '/medical-records')

    expect(await screen.findByText('Tiếp nhận và ghi nhận thông tin khám bệnh hôm nay.')).toBeVisible()
    expect(screen.getAllByText(patient.full_name).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Bắt đầu khám' })).toBeVisible()
    expect(scheduleRequest).toHaveBeenCalledOnce()

    await waitFor(() => expect(scheduleRequest.mock.calls.length).toBeGreaterThanOrEqual(2), {
      timeout: 4_500,
    })
  }, 7_000)

  it('starts a consultation, manages prescriptions, saves a draft, and signs the record', async () => {
    const user = userEvent.setup()
    const startVisit = vi.fn()
    const updateRecord = vi.fn()
    const replacePrescription = vi.fn()
    const signRecord = vi.fn()
    useDoctorScheduleApi()
    server.use(
      http.post('/api/appointments/:id/start/', () => {
        startVisit()
        return HttpResponse.json(envelope({ appointment: inProgressAppointment }))
      }),
      http.get('/api/appointments/:id/medical-record/', () =>
        HttpResponse.json(envelope({ medicalRecord })),
      ),
      http.get('/api/patients/:id/medical-records/', () =>
        HttpResponse.json(envelope({ medicalRecords: [medicalHistory] })),
      ),
      http.patch('/api/medical-records/:id/', async ({ request }) => {
        const body = await request.json()
        updateRecord(body)
        return HttpResponse.json(envelope({
          medicalRecord: {
            ...medicalRecord,
            illnessHistory: (body as { illnessHistory: string }).illnessHistory,
            examinationNote: (body as { examinationNote: string }).examinationNote,
            diagnosis: (body as { diagnosis: string }).diagnosis,
          },
        }))
      }),
      http.put('/api/medical-records/:id/prescription/', async ({ request }) => {
        const body = await request.json() as {
          items: Array<{
            medicationName: string
            dosage: string
            durationDays: number
            quantity: number
            instructions: string
          }>
        }
        replacePrescription(body)
        return HttpResponse.json(envelope({
          medicalRecord: {
            ...medicalRecord,
            diagnosis: 'Đau đầu căng thẳng',
            prescription: {
              id: 61,
              medicalRecordId: medicalRecord.id,
              prescribedBy: Number(doctorUser.id),
              createdAt: medicalRecord.updatedAt,
              items: body.items.map((item, index) => ({ ...item, id: 70 + index })),
            },
          },
        }))
      }),
      http.post('/api/medical-records/:id/sign/', () => {
        signRecord()
        return HttpResponse.json(envelope({
          medicalRecord: {
            ...medicalRecord,
            status: 'SIGNED',
            signedBy: Number(doctorUser.id),
            signedAt: medicalRecord.updatedAt,
          },
        }))
      }),
    )

    renderWithRouter(<MedicalRecordsPage />, '/medical-records')
    await user.click(await screen.findByRole('button', { name: 'Bắt đầu khám' }))

    expect(await screen.findByText('Phiếu khám hiện tại')).toBeVisible()
    expect(startVisit).toHaveBeenCalledOnce()
    expect((await screen.findAllByText('Tái khám')).length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Thêm thuốc' }))
    let medicineForm = screen.getByRole('heading', { name: 'Thêm thuốc' }).closest('form')!
    await user.type(within(medicineForm).getByLabelText(/Tên thuốc/), 'Paracetamol 500mg')
    await user.type(within(medicineForm).getByLabelText(/Liều dùng/), '1 viên/lần')
    await user.type(within(medicineForm).getByLabelText(/Cách dùng/), 'Uống sau ăn')
    await user.click(within(medicineForm).getByRole('button', { name: 'Thêm thuốc' }))

    expect(screen.getByText('Paracetamol 500mg')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Sửa thuốc Paracetamol 500mg' }))
    medicineForm = screen.getByRole('heading', { name: 'Sửa thuốc' }).closest('form')!
    const dosage = within(medicineForm).getByLabelText('Liều dùng')
    await user.clear(dosage)
    await user.type(dosage, '2 viên/ngày')
    await user.click(within(medicineForm).getByRole('button', { name: 'Lưu thay đổi' }))
    expect(screen.getByText('2 viên/ngày')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Xóa thuốc Paracetamol 500mg' }))
    expect(screen.queryByText('Paracetamol 500mg')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Thêm thuốc' }))
    medicineForm = screen.getByRole('heading', { name: 'Thêm thuốc' }).closest('form')!
    await user.type(within(medicineForm).getByLabelText(/Tên thuốc/), 'Ibuprofen 200mg')
    await user.type(within(medicineForm).getByLabelText(/Cách dùng/), 'Uống khi đau')
    await user.click(within(medicineForm).getByRole('button', { name: 'Thêm thuốc' }))

    const diagnosis = screen.getByPlaceholderText('Nhập chẩn đoán...')
    await user.clear(diagnosis)
    await user.type(diagnosis, 'Đau đầu căng thẳng')
    await user.click(screen.getByRole('button', { name: 'Lưu nháp' }))

    await waitFor(() => expect(updateRecord).toHaveBeenCalledWith(expect.objectContaining({
      diagnosis: 'Đau đầu căng thẳng',
      examinationNote: 'Đau đầu hai ngày',
    })))
    expect(replacePrescription).toHaveBeenCalledWith({
      items: [{
        medicationName: 'Ibuprofen 200mg',
        dosage: '',
        durationDays: 3,
        quantity: 1,
        instructions: 'Uống khi đau',
      }],
    })
    expect(await screen.findByText('Đã lưu bản nháp bệnh án')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Ký và hoàn thành khám' }))
    await user.click(screen.getByRole('button', { name: 'Ký và hoàn thành' }))

    await waitFor(() => expect(signRecord).toHaveBeenCalledOnce())
    expect(await screen.findByText('Đã ký và hoàn thành ca khám')).toBeVisible()
  })
})
