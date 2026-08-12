import { describe, expect, it } from 'vitest'

import { mapAppointment } from '../entities/appointment'
import { mapMedicalRecordHistory } from '../entities/medical-record'
import { mapPatient } from '../entities/patient'
import { mapSlot } from '../entities/slot'
import { mapDoctor } from '../features/appointments'
import {
  appointment,
  doctor,
  medicalHistory,
  patient,
  slot,
  testDate,
} from './fixtures'

describe('entity mapper contracts', () => {
  it('maps the patient transport shape to the existing patient profile', () => {
    const result = mapPatient(patient)

    expect(result).toMatchObject({
      id: String(patient.id),
      code: patient.patient_code,
      fullName: patient.full_name,
      gender: 'Nữ',
      dob: patient.dob,
      email: patient.email,
      cccd: patient.cccd,
      address: patient.address,
    })
    expect(result.lastVisit).toEqual({
      date: '',
      doctor: 'Chưa cập nhật',
      reason: 'Chưa có dữ liệu',
    })
  })

  it('maps slot availability and display values without changing semantics', () => {
    expect(mapSlot(slot)).toEqual({
      id: String(slot.id),
      start: '14:00',
      end: '14:30',
      state: 'available',
      booked: 1,
      capacity: 4,
      bookable: true,
      room: 'P.101',
      date: testDate,
    })
  })

  it('combines appointment, patient, and slot entities into the existing view model', () => {
    const mappedPatient = mapPatient(patient)
    const mappedSlot = mapSlot(slot)

    expect(mapAppointment(appointment, [mappedPatient], [mappedSlot])).toMatchObject({
      id: String(appointment.id),
      slotId: String(slot.id),
      patient: mappedPatient,
      doctor: {
        id: doctor.id,
        fullName: doctor.fullName,
        department: 'Nội tổng quát',
      },
      appointmentType: 'SCHEDULED',
      startTime: `${testDate}T14:00:00`,
      endTime: `${testDate}T14:30:00`,
      status: 'CONFIRMED',
      room: 'P.101',
    })
  })

  it('keeps reception and medical-record boundary mappings stable', () => {
    expect(mapDoctor(doctor)).toEqual({
      id: doctor.id,
      fullName: doctor.fullName,
      department: 'Nội tổng quát',
    })

    const mappedHistory = mapMedicalRecordHistory([medicalHistory])
    expect(mappedHistory).toEqual([medicalHistory])
    expect(mappedHistory[0]).not.toBe(medicalHistory)
  })
})
