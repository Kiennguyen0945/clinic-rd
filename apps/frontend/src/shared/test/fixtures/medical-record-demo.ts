import type { Appointment } from '../../../entities/appointment'
import type { SlotDefinition } from '../../../entities/slot'
import type { ConsultationDraft } from '../../../features/medical-records/model/consultation.schema'
import { EMPTY_CONSULTATION_DRAFT } from '../../../features/medical-records/model/consultation.schema'

export const DEMO_CONSULTATION_DRAFT: ConsultationDraft = {
  ...EMPTY_CONSULTATION_DRAFT,
  illnessHistory: 'Tăng huyết áp 5 năm, đang điều trị thuốc đều. Không dị ứng thuốc.',
  symptoms: 'Bệnh nhân đau đầu vùng trán, âm ỉ, tăng khi làm việc căng thẳng.\nKhông buồn nôn, không sốt. Khám thần kinh không ghi nhận bất thường.',
  diagnosis: 'Đau đầu căng thẳng (Tension headache)',
  prescriptions: [
    { id: 'demo-med-1', medicationName: 'Paracetamol 500mg', dosage: '1 viên/lần', durationDays: 3, quantity: 6, unit: 'viên', instructions: 'Uống khi đau, tối đa 3 lần/ngày' },
    { id: 'demo-med-2', medicationName: 'Betahistin 16mg', dosage: '1 viên/lần', durationDays: 5, quantity: 10, unit: 'viên', instructions: 'Sau ăn sáng và tối' },
    { id: 'demo-med-3', medicationName: 'Vitamin B1 100mg', dosage: '1 viên/lần', durationDays: 7, quantity: 14, unit: 'viên', instructions: 'Sau ăn sáng' },
  ],
}

const DEMO_PATIENTS = [
  { fullName: 'Nguyễn Minh Anh', code: 'BN-MOCK-001', gender: 'Nữ' as const, dob: '1992-04-18', age: 34, phone: '0901 234 501', address: 'Đống Đa, Hà Nội', reason: 'Đau đầu, chóng mặt kéo dài', status: 'IN_PROGRESS' as const },
  { fullName: 'Trần Quốc Bảo', code: 'BN-MOCK-002', gender: 'Nam' as const, dob: '1987-09-02', age: 38, phone: '0901 234 502', address: 'Cầu Giấy, Hà Nội', reason: 'Ho và đau họng từ hôm qua', status: 'WAITING' as const },
  { fullName: 'Lê Thu Hà', code: 'BN-MOCK-003', gender: 'Nữ' as const, dob: '2000-01-25', age: 26, phone: '0901 234 503', address: 'Thanh Xuân, Hà Nội', reason: 'Tái khám và kiểm tra huyết áp', status: 'WAITING' as const },
  { fullName: 'Phạm Văn Nam', code: 'BN-MOCK-004', gender: 'Nam' as const, dob: '1978-11-11', age: 47, phone: '0901 234 504', address: 'Hai Bà Trưng, Hà Nội', reason: 'Đau lưng, mỏi vai gáy', status: 'WAITING' as const },
]

export function createDemoSlots(date: string): SlotDefinition[] {
  return ['08:00-09:00', '09:00-10:00', '10:00-11:00', '11:00-12:00'].map((range, index) => {
    const [start, end] = range.split('-')
    return { id: `mock-slot-${index + 1}`, start, end, state: index === 1 ? 'ongoing' : 'available', booked: 1, capacity: 4, bookable: true, room: 'P.101', date }
  })
}

export function createDemoAppointments(
  slots: SlotDefinition[], doctorId: string, doctorName: string, date: string,
): Appointment[] {
  return DEMO_PATIENTS.map((item, index) => {
    const slot = slots[index % slots.length]
    return {
      id: `mock-appointment-${index + 1}`, slotId: slot.id,
      patient: { id: `mock-patient-${index + 1}`, code: item.code, fullName: item.fullName,
        phone: item.phone, email: 'mock@example.com', cccd: '', gender: item.gender,
        age: item.age, dob: item.dob, address: item.address,
        lastVisit: { date: '', doctor: 'Chưa cập nhật', reason: 'Chưa có dữ liệu' } },
      doctor: { id: doctorId, fullName: doctorName, department: 'Nội tổng quát' },
      appointmentType: 'SCHEDULED', startTime: `${date}T${slot.start}:00`, endTime: `${date}T${slot.end}:00`,
      reason: item.reason, status: item.status, sequenceNumber: index + 1,
      appointmentCode: `MOCK-${String(index + 1).padStart(3, '0')}`, room: slot.room,
      cancellationReason: '', cancellationNote: '',
    }
  })
}
