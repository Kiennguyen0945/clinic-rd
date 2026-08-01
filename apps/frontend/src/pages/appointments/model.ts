import type { ApiAppointment, ApiDoctor, ApiPatient, ApiSlot } from "../../lib/appointmentsApi";

export type AppointmentStatus =
  | "CONFIRMED"
  | "WAITING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";
export type AppointmentType = "SCHEDULED" | "WALK_IN";
export type SlotState = "available" | "ongoing" | "full" | "ended" | "closed";
export type BookingMode = "IMMEDIATE" | "SCHEDULED";

export interface PatientProfile {
  id: string;
  code: string;
  fullName: string;
  phone: string;
  email: string;
  cccd: string;
  gender: "Nam" | "Nữ";
  age: number;
  dob: string;
  address: string;
  lastVisit: { date: string; doctor: string; reason: string };
  insuranceNumber?: string;
}

export interface Appointment {
  id: string;
  slotId: string;
  patient: PatientProfile;
  doctor: { id: string; fullName: string; department: string };
  appointmentType: AppointmentType;
  startTime: string;
  endTime: string;
  reason: string;
  status: AppointmentStatus;
  sequenceNumber: number;
  appointmentCode: string;
  room: string;
  insuranceNumber?: string;
  cancellationReason: string;
  cancellationNote: string;
}

export interface SlotDefinition {
  id: string;
  start: string;
  end: string;
  state: SlotState;
  booked: number;
  capacity: number;
  bookable: boolean;
  room: string;
  date: string;
}

export interface AppointmentDraft {
  patientId: string;
  patientName: string;
  doctorId: string;
  department: string;
  room: string;
  date: string;
  slotId: string;
  service: "Dịch vụ" | "BHYT";
  insuranceNumber: string;
  reason: string;
  note: string;
}

export interface BookingSuggestion {
  mode: BookingMode;
  slot: SlotDefinition;
  deferWalkIn: boolean;
}

export const statusConfig: Record<
  AppointmentStatus,
  { label: string; className: string }
> = {
  CONFIRMED: { label: "Đã xác nhận", className: "status-confirmed" },
  WAITING: { label: "Đang chờ", className: "status-waiting" },
  IN_PROGRESS: { label: "Đang khám", className: "status-progress" },
  COMPLETED: { label: "Đã hoàn thành", className: "status-completed" },
  CANCELLED: { label: "Đã hủy", className: "status-cancelled" },
};

export const cancellationReasonLabels: Record<string, string> = {
  PATIENT_REQUEST: "Bệnh nhân báo bận / Xin dời lịch.",
  PATIENT_WRONG_INFO: "Đặt nhầm thông tin / Trùng lịch.",
  NO_SHOW: "Khách không đến / Không liên lạc được.",
  DOCTOR_UNAVAILABLE: "Bác sĩ nghỉ đột xuất / Có ca cấp cứu.",
  ROOM_ISSUE: "Phòng khám gặp sự cố kỹ thuật (Hỏng máy móc, mất điện...).",
  OTHER: "Nhập lý do khác",
};

export function cancellationReasonLabel(reason: string, note = "") {
  return reason === "OTHER" && note
    ? `${cancellationReasonLabels.OTHER}: ${note}`
    : cancellationReasonLabels[reason] || reason || "Chưa có lý do hủy";
}

export const todayValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

export const timeLabel = (value: string) =>
  value.includes("T") ? value.slice(11, 16) : value.slice(0, 5);
export const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
export const shortDateLabel = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
export const relativeSlotDateLabel = (value: string) => {
  const tomorrow = new Date(`${todayValue()}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowValue = tomorrow.toISOString().slice(0, 10);
  if (value === todayValue()) return `Hôm nay, ${shortDateLabel(value)}`;
  if (value === tomorrowValue) return `Ngày mai, ${shortDateLabel(value)}`;
  return `Ngày ${shortDateLabel(value)}`;
};
export const patientInitials = (name: string) =>
  name
    .split(" ")
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

export function ageFromDob(dob: string) {
  const birthDate = new Date(`${dob}T12:00:00`);
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  if (
    now < new Date(now.getFullYear(), birthDate.getMonth(), birthDate.getDate())
  )
    age -= 1;
  return Math.max(age, 0);
}

export function mapPatient(patient: ApiPatient): PatientProfile {
  return {
    id: String(patient.id),
    code: patient.patient_code,
    fullName: patient.full_name,
    phone: patient.phone,
    email: patient.email || "Chưa cập nhật",
    cccd: patient.cccd || "",
    gender: patient.gender === "F" ? "Nữ" : "Nam",
    age: ageFromDob(patient.dob),
    dob: patient.dob,
    address: patient.address || "Chưa cập nhật",
    lastVisit: { date: "", doctor: "Chưa cập nhật", reason: "Chưa có dữ liệu" },
    insuranceNumber: patient.insurance_number || undefined,
  };
}

export function mapDoctor(doctor: ApiDoctor) {
  return {
    id: doctor.id,
    fullName: doctor.fullName,
    department: doctor.departments[0]?.name || "Chưa phân khoa",
  };
}

export function mapSlot(slot: ApiSlot): SlotDefinition {
  const state: SlotState =
    slot.status === "CLOSED"
      ? "closed"
      : slot.isEnded
        ? "ended"
        : slot.isFull
          ? "full"
          : slot.isOngoing
            ? "ongoing"
            : "available";
  return {
    id: slot.slotKey || String(slot.id),
    start: timeLabel(slot.startTime),
    end: timeLabel(slot.endTime),
    state,
    booked: slot.bookedCount,
    capacity: slot.capacity,
    bookable: slot.isBookable,
    room: slot.room.roomNumber,
    date: slot.slotDate,
  };
}

export function mapAppointment(
  appointment: ApiAppointment,
  patients: PatientProfile[],
  slots: SlotDefinition[],
): Appointment {
  const patient = patients.find(
    (item) => item.id === String(appointment.patient.id),
  ) || {
    id: String(appointment.patient.id),
    code: appointment.patient.patientCode,
    fullName: appointment.patient.fullName,
    phone: appointment.patient.phone,
    email: "Chưa cập nhật",
    cccd: "",
    gender: "Nam",
    age: 0,
    dob: "",
    address: "Chưa cập nhật",
    lastVisit: { date: "", doctor: "Chưa cập nhật", reason: "Chưa có dữ liệu" },
  };
  const slot = slots.find((item) => item.id === String(appointment.slot_id));
  const date =
    appointment.slot?.slotDate || appointment.appointment_time.slice(0, 10);
  const start = appointment.slot?.startTime || appointment.appointment_time;
  const end = appointment.slot?.endTime || start;
  return {
    id: String(appointment.id),
    slotId: String(appointment.slot_id || ""),
    patient,
    doctor: {
      id: appointment.doctor.id,
      fullName: appointment.doctor.fullName,
      department: appointment.department?.name || "Chưa phân khoa",
    },
    appointmentType:
      appointment.booking_type === "WALK_IN" ? "WALK_IN" : "SCHEDULED",
    startTime: `${date}T${timeLabel(start)}:00`,
    endTime: `${date}T${timeLabel(end)}:00`,
    reason: appointment.reason,
    status: appointment.status === "PENDING" ? "CONFIRMED" : appointment.status,
    sequenceNumber: appointment.sequence_number || 0,
    appointmentCode: appointment.appointment_code,
    room: slot?.room || appointment.slot?.roomNumber || "Phòng khám",
    insuranceNumber: appointment.bhyt_number || patient.insuranceNumber,
    cancellationReason: appointment.cancellation_reason,
    cancellationNote: appointment.cancellation_note || "",
  };
}

export function isSlotAvailable(slot: SlotDefinition) {
  return (
    slot.state !== "ended" &&
    slot.state !== "full" &&
    slot.state !== "closed" &&
    slot.booked < slot.capacity
  );
}

export function emptyBookingSlot(): SlotDefinition {
  return {
    id: "",
    start: "Chưa chọn khung giờ",
    end: "",
    state: "available",
    booked: 0,
    capacity: 0,
    bookable: false,
    room: "",
    date: "",
  };
}


