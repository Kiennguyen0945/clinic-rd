import type {
  ApiAppointment,
  ApiPatient,
  ApiSlot,
  ReceptionContext,
} from '../lib/appointmentsApi'

export const testDate = new Date().toISOString().slice(0, 10)

export const receptionistUser = {
  id: '7',
  username: 'letan',
  fullName: 'Lễ Tân An',
  role: 'receptionist' as const,
}

export const doctor = {
  id: '11',
  fullName: 'BS. Nguyễn Minh Đức',
  departments: [{ id: 3, name: 'Nội tổng quát' }],
}

export const patient: ApiPatient = {
  id: 21,
  patient_code: 'BN000021',
  full_name: 'Trần Thu Hà',
  dob: '1992-04-12',
  gender: 'F',
  phone: '0901234567',
  email: 'ha@example.com',
  cccd: '012345678901',
  address: '12 Nguyễn Huệ',
  insurance_number: null,
}

export const slot: ApiSlot = {
  id: 31,
  doctorId: doctor.id,
  roomId: '5',
  doctor: { id: doctor.id, fullName: doctor.fullName },
  room: { id: '5', roomNumber: 'P.101' },
  slotDate: testDate,
  startTime: '14:00:00',
  endTime: '14:30:00',
  capacity: 4,
  bookedCount: 1,
  remainingCapacity: 3,
  isFull: false,
  isBookable: true,
  isOngoing: false,
  isEnded: false,
  status: 'OPEN',
}

export const appointment: ApiAppointment = {
  id: 41,
  patient: {
    id: String(patient.id),
    patientCode: patient.patient_code,
    fullName: patient.full_name,
    phone: patient.phone,
  },
  doctor: { id: doctor.id, fullName: doctor.fullName },
  slot: {
    id: slot.id!,
    slotDate: testDate,
    startTime: slot.startTime,
    endTime: slot.endTime,
    status: slot.status,
    roomNumber: slot.room.roomNumber,
  },
  slot_id: slot.id,
  appointment_code: 'LH000041',
  department_id: 3,
  department: { id: 3, name: 'Nội tổng quát' },
  sequence_number: 2,
  booking_type: 'SCHEDULE',
  patient_type: 'SERVICE',
  bhyt_number: null,
  appointment_time: `${testDate}T14:00:00`,
  reason: 'Đau đầu kéo dài',
  status: 'CONFIRMED',
  cancellation_reason: '',
  cancellation_note: null,
}

export const receptionContext: ReceptionContext = {
  doctors: [doctor],
  departments: doctor.departments,
  rooms: [{ id: '5', roomNumber: slot.room.roomNumber }],
  openSlotAssignments: [
    { doctorId: doctor.id, roomId: '5', roomNumber: slot.room.roomNumber },
  ],
  overview: [
    {
      doctor: { id: doctor.id, fullName: doctor.fullName },
      departments: doctor.departments,
      totalSlots: 1,
      capacity: slot.capacity,
      bookedCount: slot.bookedCount,
      remainingCapacity: slot.remainingCapacity,
      ongoingSlot: null,
      status: 'OPEN',
    },
  ],
  receptionSummary: {
    waiting: 1,
    confirmed: 1,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
  },
  waitingDoctors: [
    { doctorId: doctor.id, doctorName: doctor.fullName, waitingCount: 1 },
  ],
}

export function envelope<T>(data: T) {
  return { success: true, data }
}
