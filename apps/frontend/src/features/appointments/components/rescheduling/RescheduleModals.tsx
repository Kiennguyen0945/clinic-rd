import { useState } from "react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import { CalendarDays, X } from "lucide-react";
import type { ApiDoctor, ReceptionContext } from "../../api/reception.api";
import type {
  Appointment,
  AppointmentDraft,
  BookingSuggestion,
} from "../../../../entities/appointment";
import { cancellationReasonLabels } from "../../../../entities/appointment";
import type { SlotDefinition } from "../../../../entities/slot";
import { todayValue } from "../../../../shared/lib/date";
import {
  BookingSuggestionPanel,
  SearchableSelect,
  SlotChoice,
} from "../booking/AppointmentModals";

export function RescheduleAppointmentModal({
  appointment,
  draft,
  setDraft,
  doctors,
  departments,
  rooms,
  assignments,
  slots,
  suggestedSlot,
  onDoctorChange,
  onDepartmentChange,
  onDateChange,
  onSlotChange,
  onClose,
  onSubmit,
  error,
  saving,
}: {
  appointment: Appointment;
  draft: AppointmentDraft;
  setDraft: Dispatch<SetStateAction<AppointmentDraft>>;
  doctors: ApiDoctor[];
  departments: ReceptionContext["departments"];
  rooms: ReceptionContext["rooms"];
  assignments: ReceptionContext["openSlotAssignments"];
  slots: SlotDefinition[];
  suggestedSlot: BookingSuggestion | null;
  onDoctorChange: (doctorId: string) => void;
  onDepartmentChange: (department: string) => void;
  onDateChange: (date: string) => void;
  onSlotChange: (slotId: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  error: string;
  saving: boolean;
}) {
  const doctor = doctors.find((item) => item.id === draft.doctorId);
  const doctorAssignments = assignments.filter((item) => item.doctorId === draft.doctorId);
  const doctorOptions = doctors.map((item) => ({ value: item.id, label: item.fullName }));
  const departmentOptions = (doctor?.departments.length ? doctor.departments : departments)
    .map((item) => ({ value: item.name, label: item.name }));
  const roomOptions = rooms
    .filter((item) => doctorAssignments.some((assignment) => assignment.roomNumber === item.roomNumber))
    .map((item) => ({ value: item.roomNumber, label: item.roomNumber }));

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <form className="appointment-modal appointment-booking-modal reschedule-modal" onSubmit={onSubmit}>
        <div className="modal-header">
          <div>
            <h2>Cập nhật lịch hẹn</h2>
            <p>{appointment.patient.fullName} · {appointment.appointmentCode}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="booking-form-grid">
          <label className="booking-field">
            Bác sĩ
            <SearchableSelect
              value={draft.doctorId}
              options={doctorOptions}
              onChange={onDoctorChange}
            />
          </label>
          <label className="booking-field">
            Khoa
            <SearchableSelect
              value={draft.department}
              options={departmentOptions}
              onChange={onDepartmentChange}
            />
          </label>
          <label className="booking-field">
            Số phòng
            <SearchableSelect
              value={draft.room}
              options={roomOptions}
              onChange={(value) => setDraft((current) => ({ ...current, room: value, slotId: "" }))}
            />
            {doctorAssignments.length > 1 && <small className="field-error">Phòng được xác định theo khung giờ.</small>}
          </label>
          <label className="booking-field">
            Ngày khám *
            <input type="date" min={todayValue()} value={draft.date} onChange={(event) => onDateChange(event.target.value)} />
          </label>
        </div>
        <div className="slot-picker">
          <strong>Chọn khung giờ *</strong>
          <div className="slot-picker-group">
            <span>Ca sáng</span>
            <div>
              {slots.slice(0, 6).map((item) => (
                <SlotChoice
                  key={item.id}
                  item={item}
                  selectedId={draft.slotId}
                  onSelect={onSlotChange}
                  mode="SCHEDULED"
                />
              ))}
            </div>
          </div>
          <div className="slot-picker-group">
            <span>Ca chiều</span>
            <div>
              {slots.slice(6).map((item) => (
                <SlotChoice
                  key={item.id}
                  item={item}
                  selectedId={draft.slotId}
                  onSelect={onSlotChange}
                  mode="SCHEDULED"
                />
              ))}
            </div>
          </div>
        </div>
        <div className="booking-form-grid">
          <label className="booking-field booking-span-two">
            Lý do khám *
            <input value={draft.reason} onChange={(event) => setDraft((current) => ({ ...current, reason: event.target.value }))} />
          </label>
          <label className="booking-field booking-span-two">
            Ghi chú
            <textarea
              rows={2}
              value={draft.note}
              onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
              placeholder="Thông tin bổ sung (không bắt buộc)"
            />
          </label>
        </div>
        <BookingSuggestionPanel
          suggestion={suggestedSlot}
          sourceSlot={null}
          doctorName={doctor?.fullName || appointment.doctor.fullName}
          variant="reschedule"
        />
        {appointment.status === "WAITING" && draft.date !== appointment.startTime.slice(0, 10) && (
          <div className="reschedule-warning">⚠ Đổi sang ngày khác sẽ đưa bệnh nhân ra khỏi hàng chờ hôm nay. Bệnh nhân cần check-in lại vào ngày mới.</div>
        )}
        {appointment.status === "WAITING" &&
          draft.date === appointment.startTime.slice(0, 10) &&
          draft.room && draft.room !== appointment.room && (
            <div className="reschedule-warning">⚠ Bệnh nhân đang chờ tại {appointment.room} (số {String(appointment.sequenceNumber).padStart(2, "0")}). Lưu thay đổi sẽ chuyển sang hàng chờ {draft.room} với số thứ tự mới.</div>
          )}
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <CalendarDays size={16} /> {saving
              ? "Đang lưu..."
              : suggestedSlot
                ? `Xác nhận cập nhật thành ${suggestedSlot.slot.start}-${suggestedSlot.slot.end}`
                : "Lưu thay đổi"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function CancellationModal({
  appointment,
  saving,
  onClose,
  onConfirm,
}: {
  appointment: Appointment;
  saving: boolean;
  onClose: () => void;
  onConfirm: (reason: string, note: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("PATIENT_REQUEST");
  const [note, setNote] = useState("");
  const isOther = reason === "OTHER";
  const canConfirm = !saving && (!isOther || Boolean(note.trim()));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (canConfirm) void onConfirm(reason, isOther ? note.trim() : "");
  };
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <form className="appointment-modal cancellation-modal" onSubmit={submit}>
        <div className="modal-header">
          <div>
            <h2>Hủy lịch hẹn</h2>
            <p>
              {appointment.patient.fullName} · {appointment.appointmentCode}
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>
        <div className="cancellation-form">
          <label className="booking-field">
            Chi tiết lý do hủy{isOther ? " *" : ""}
            <textarea
              rows={4}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Nhập thông tin chi tiết (không bắt buộc, trừ khi chọn lý do khác)"
            />
            {isOther && (
              <small className="field-error">
                {note.trim() ? "" : "Vui lòng nhập chi tiết lý do hủy"}
              </small>
            )}
          </label>
          <label className="booking-field">
            Lý do hủy *
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            >
              {Object.entries(cancellationReasonLabels).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Đóng
          </button>
          <button
            type="submit"
            className="btn btn-danger-outline"
            disabled={!canConfirm}
          >
            <X size={16} /> {saving ? "Đang lưu..." : "Xác nhận hủy"}
          </button>
        </div>
      </form>
    </div>
  );
}
