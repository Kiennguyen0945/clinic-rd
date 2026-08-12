import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { useAppointmentPageState } from '../features/appointments'
import { renderWithRouter } from './render'

function AppointmentPageStateHarness() {
  const state = useAppointmentPageState()
  return <>
    <output data-testid="appointment-page-state">
      {JSON.stringify({
        doctorId: state.doctorId,
        date: state.date,
        department: state.department,
        doctor: state.doctor,
        slotStatus: state.slotStatus,
        query: state.query,
      })}
    </output>
    <button onClick={() => state.setDoctorId('11')}>doctor</button>
    <button onClick={() => state.setDate('2026-08-20')}>date</button>
    <button onClick={() => state.setDepartment('3')}>department</button>
    <button onClick={() => state.setDoctor('11')}>doctor-filter</button>
    <button onClick={() => state.setSlotStatus('OPEN')}>slot</button>
    <button onClick={() => state.setQuery('Thu Hà')}>query</button>
  </>
}

describe('appointment URL-backed page state', () => {
  it('restores state from URL parameters', () => {
    renderWithRouter(
      <AppointmentPageStateHarness />,
      '/appointments?doctorId=11&date=2026-08-20&department=3&doctor=11&slotStatus=OPEN&query=Thu+Hà',
    )

    expect(screen.getByTestId('appointment-page-state')).toHaveTextContent(
      JSON.stringify({
        doctorId: '11',
        date: '2026-08-20',
        department: '3',
        doctor: '11',
        slotStatus: 'OPEN',
        query: 'Thu Hà',
      }),
    )
  })

  it('writes doctor, date, and filters to URL state', async () => {
    const user = userEvent.setup()
    renderWithRouter(<AppointmentPageStateHarness />, '/appointments')

    await user.click(screen.getByRole('button', { name: 'doctor' }))
    await user.click(screen.getByRole('button', { name: 'date' }))
    await user.click(screen.getByRole('button', { name: 'department' }))
    await user.click(screen.getByRole('button', { name: 'doctor-filter' }))
    await user.click(screen.getByRole('button', { name: 'slot' }))
    await user.click(screen.getByRole('button', { name: 'query' }))

    expect(screen.getByTestId('appointment-page-state')).toHaveTextContent(
      JSON.stringify({
        doctorId: '11',
        date: '2026-08-20',
        department: '3',
        doctor: '11',
        slotStatus: 'OPEN',
        query: 'Thu Hà',
      }),
    )
  })
})
