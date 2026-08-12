import { useEffect, useRef, useState } from "react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import {
  CalendarDays,
  ChevronDown,
  Clock3,
  Plus,
  X,
} from "lucide-react";
import type { ApiDoctor, ReceptionContext } from "../../api/reception.api";
import type {
  AppointmentDraft,
  BookingMode,
  BookingSuggestion,
} from "../../../../entities/appointment";
import type { PatientProfile } from "../../../../entities/patient";
import type { SlotDefinition } from "../../../../entities/slot";
import { relativeSlotDateLabel, todayValue } from "../../../../shared/lib/date";

export function BookingSuggestionPanel({
  suggestion,
  sourceSlot,
  doctorName,
  variant,
}: {
  suggestion: BookingSuggestion | null;
  sourceSlot: SlotDefinition | null;
  doctorName: string;
  variant: "create" | "reschedule";
}) {
  if (!suggestion) return null;
  const slot = suggestion.slot;
  const isReschedule = variant === "reschedule";
  return (
    <div className={`booking-suggestion-panel ${isReschedule ? "reschedule-suggestion-panel" : ""}`}>
      <div className="suggestion-intro">
        <span className="suggestion-icon"><CalendarDays size={21} /></span>
        <span>
          <strong>{isReschedule ? "⚠ Khung bạn chọn không còn hợp lệ." : "Khung giờ được đề xuất"}</strong>
          <small>
            {isReschedule
              ? "Hệ thống đã đề xuất khung gần nhất còn chỗ. Không tự động lưu ngầm slot đề xuất."
              : suggestion.mode === "IMMEDIATE"
                ? "Khung hiện tại còn chỗ và có thể tiếp nhận bệnh nhân ngay."
                : "Khung bạn chọn không còn đủ thời gian đặt trước. Hệ thống đã đề xuất khung gần nhất còn chỗ và đủ thời gian (30 phút)."}
          </small>
        </span>
      </div>
      <div className="suggestion-slot-card">
        <span className="suggestion-badge">★ Đề xuất</span>
        <strong><CalendarDays size={13} /> {relativeSlotDateLabel(slot.date)}</strong>
        <b>{slot.start} – {slot.end}</b>
        <small>Còn {slot.capacity - slot.booked}/{slot.capacity} chỗ · {doctorName} · {slot.room}</small>
        <em>
          {isReschedule
            ? "Lễ tân phải chọn slot đề xuất hoặc tự chọn khung khác trước khi lưu thay đổi."
            : suggestion.mode === "IMMEDIATE"
              ? "Đây là khung đang diễn ra, bệnh nhân sẽ được đưa vào hàng đợi ngay."
              : `Khung ${sourceSlot?.start || "đã chọn"}–${sourceSlot?.end || ""} không còn đủ thời gian đặt trước.`}
        </em>
      </div>
    </div>
  );
}

export function CreateAppointmentModal({
  patients,
  doctors,
  departments,
  rooms,
  assignments,
  doctorLocked,
  patientLocked = false,
  showAllDoctors = false,
  draft,
  setDraft,
  slots,
  slot,
  mode,
  setMode,
  onDateChange,
  onDoctorChange,
  onDepartmentChange,
  onRoomChange,
  onSlotChange,
  suggestedSlot,
  onConfirmSuggestion,
  onAddPatient,
  onClose,
  onSubmit,
  error,
  saving,
}: {
  patients: PatientProfile[];
  doctors: ApiDoctor[];
  departments: ReceptionContext["departments"];
  rooms: ReceptionContext["rooms"];
  assignments: ReceptionContext["openSlotAssignments"];
  doctorLocked: boolean;
  patientLocked?: boolean;
  showAllDoctors?: boolean;
  draft: AppointmentDraft;
  setDraft: Dispatch<SetStateAction<AppointmentDraft>>;
  slots: SlotDefinition[];
  slot: SlotDefinition;
  mode: BookingMode;
  setMode: (mode: BookingMode) => void;
  onDateChange: (date: string) => void;
  onDoctorChange: (doctorId: string) => void;
  onDepartmentChange: (department: string) => void;
  onRoomChange: (room: string) => void;
  onSlotChange: (slotId: string) => void;
  suggestedSlot: BookingSuggestion | null;
  onConfirmSuggestion: () => void;
  onAddPatient: () => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  error: string;
  saving: boolean;
}) {
  const [submitted, setSubmitted] = useState(false);
  const suggestions = patients
    .filter((patient) =>
      `${patient.fullName} ${patient.code} ${patient.phone}`
        .toLowerCase()
        .includes(draft.patientName.toLowerCase()),
    )
    .slice(0, 5);
  const selectedPatient = patients.find(
    (patient) => patient.id === draft.patientId,
  );
  const updatePatient = (patient: PatientProfile) =>
    setDraft((current) => ({
      ...current,
      patientId: patient.id,
      patientName: patient.fullName,
      insuranceNumber: patient.insuranceNumber || "",
    }));
  const doctorsWithOpenSlots = new Set(
    assignments.map((item) => item.doctorId),
  );
  const doctorOptions = doctors
    .filter((doctor) =>
      doctorLocked
        ? doctor.id === draft.doctorId
        : (showAllDoctors || doctorsWithOpenSlots.has(doctor.id)) &&
          (Boolean(draft.doctorId) ||
            !draft.department ||
            doctor.departments.some((item) => item.name === draft.department)),
    )
    .map((doctor) => ({ value: doctor.id, label: doctor.fullName }));
  const selectedDoctor = doctors.find((doctor) => doctor.id === draft.doctorId);
  const availableDoctorIds = new Set(assignments.map((item) => item.doctorId));
  const departmentOptions = (
    selectedDoctor?.departments.length
      ? selectedDoctor.departments
      : showAllDoctors
        ? departments
        : departments.filter((department) =>
            doctors.some(
              (doctor) =>
                availableDoctorIds.has(doctor.id) &&
                doctor.departments.some((item) => item.id === department.id),
            ),
          )
  ).map((item) => ({ value: item.name, label: item.name }));
  const assignmentRooms = [
    ...new Set(
      assignments
        .filter((item) => !draft.doctorId || item.doctorId === draft.doctorId)
        .map((item) => item.roomNumber),
    ),
  ];
  const roomOptions = (
    draft.doctorId && assignmentRooms.length !== 1
      ? []
      : rooms.filter((room) => assignmentRooms.includes(room.roomNumber))
  ).map((room) => ({ value: room.roomNumber, label: room.roomNumber }));
  const handledDepartment = useRef("");
  const handledRoom = useRef("");
  useEffect(() => {
    if (!draft.department) handledDepartment.current = "";
    if (
      !draft.doctorId &&
      draft.department &&
      handledDepartment.current !== draft.department
    ) {
      handledDepartment.current = draft.department;
      void onDepartmentChange(draft.department);
    }
  }, [draft.department, draft.doctorId, onDepartmentChange]);
  useEffect(() => {
    if (!draft.room) handledRoom.current = "";
    if (!draft.doctorId && draft.room && handledRoom.current !== draft.room) {
      handledRoom.current = draft.room;
      void onRoomChange(draft.room);
    }
  }, [draft.doctorId, draft.room, onRoomChange]);
  const activeSlot = slots.find((item) => item.id === draft.slotId) || slot;
  const selectSlot = (slotId: string) => {
    onSlotChange(slotId);
  };
  const fieldErrors = submitted
    ? {
        patient: !draft.patientId ? "Vui lòng chọn bệnh nhân" : "",
        doctor: !draft.doctorId ? "Vui lòng chọn bác sĩ" : "",
        department: !draft.department ? "Vui lòng chọn khoa" : "",
        room: !draft.room ? "Vui lòng chọn số phòng" : "",
        date:
          !draft.date || draft.date < todayValue()
            ? "Vui lòng chọn ngày hôm nay hoặc ngày sau đó"
            : "",
        insurance:
          draft.service === "BHYT" && !draft.insuranceNumber.trim()
            ? "Vui lòng nhập số bảo hiểm y tế"
            : "",
        reason: !draft.reason.trim() ? "Vui lòng nhập lý do khám" : "",
      }
    : {
        patient: "",
        doctor: "",
        department: "",
        room: "",
        date: "",
        insurance: "",
        reason: "",
      };
  const submitForm = (event: FormEvent) => {
    setSubmitted(true);
    onSubmit(event);
  };
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <form
        className="appointment-modal appointment-booking-modal"
        onSubmit={submitForm}
      >
        <div className="modal-header">
          <div>
            <h2>{mode === "IMMEDIATE" ? "Khám ngay" : "Tạo lịch hẹn"}</h2>
            <p>
              {mode === "IMMEDIATE"
                ? "Đăng ký bệnh nhân vào hàng đợi khám ngay."
                : `Đặt lịch vào khung ${activeSlot.start} - ${activeSlot.end}.`}
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
        {error && <div className="form-error">{error}</div>}
        <div className="booking-mode-switch">
          <button
            type="button"
            className={mode === "IMMEDIATE" ? "active" : ""}
            onClick={() => setMode("IMMEDIATE")}
          >
            Khám ngay
          </button>
          <button
            type="button"
            className={mode === "SCHEDULED" ? "active" : ""}
            onClick={() => setMode("SCHEDULED")}
          >
            Tạo lịch
          </button>
        </div>
        <div className="booking-form-grid">
          <label className="booking-field patient-picker">
            Bệnh nhân *
            <div className="input-with-action">
              <input
                disabled={patientLocked}
                aria-invalid={Boolean(fieldErrors.patient)}
                value={draft.patientName}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    patientName: event.target.value,
                    patientId: "",
                  }))
                }
                placeholder="Tìm tên hoặc mã bệnh nhân"
              />
              <button
                type="button"
                onClick={onAddPatient}
                aria-label="Tạo bệnh nhân mới"
                disabled={patientLocked}
              >
                <Plus size={16} />
              </button>
            </div>
            {!patientLocked && draft.patientName && !selectedPatient && (
              <div className="suggestion-list">
                {suggestions.map((patient) => (
                  <button
                    type="button"
                    key={patient.id}
                    onClick={() => updatePatient(patient)}
                  >
                    <strong>{patient.fullName}</strong>
                    <small>
                      {patient.code} · {patient.phone}
                    </small>
                  </button>
                ))}
                {suggestions.length === 0 && (
                  <button type="button" onClick={onAddPatient}>
                    + Tạo bệnh nhân mới
                  </button>
                )}
              </div>
            )}
            {fieldErrors.patient && (
              <small className="field-error">{fieldErrors.patient}</small>
            )}
          </label>
          <label className="booking-field">
            Bác sĩ *
            <SearchableSelect
              value={draft.doctorId}
              options={doctorOptions}
              onChange={onDoctorChange}
            />
            {fieldErrors.doctor && (
              <small className="field-error">{fieldErrors.doctor}</small>
            )}
          </label>
          <label className="booking-field">
            Khoa *
            <SearchableSelect
              value={draft.department}
              options={departmentOptions}
              onChange={(value) =>
                setDraft((current) => ({ ...current, department: value }))
              }
            />
            {fieldErrors.department && (
              <small className="field-error">{fieldErrors.department}</small>
            )}
          </label>
          <label className="booking-field">
            Số phòng *
            <SearchableSelect
              value={draft.room}
              options={roomOptions}
              onChange={(value) =>
                setDraft((current) => ({ ...current, room: value }))
              }
            />
            {fieldErrors.room && (
              <small className="field-error">{fieldErrors.room}</small>
            )}
          </label>
          <label className="booking-field">
            Ngày *
            <input
              type="date"
              min={todayValue()}
              aria-invalid={Boolean(fieldErrors.date)}
              value={draft.date}
              onChange={(event) => onDateChange(event.target.value)}
            />
            {fieldErrors.date && (
              <small className="field-error">{fieldErrors.date}</small>
            )}
          </label>
          <label className="booking-field">
            Dịch vụ *
            <select
              value={draft.service}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  service: event.target.value as AppointmentDraft["service"],
                  insuranceNumber:
                    event.target.value === "BHYT"
                      ? current.insuranceNumber ||
                        selectedPatient?.insuranceNumber ||
                        ""
                      : "",
                }))
              }
            >
              <option>Dịch vụ</option>
              <option>BHYT</option>
            </select>
          </label>
          {draft.service === "BHYT" && (
            <label className="booking-field booking-span-two">
              Số BHYT *
              <input
                aria-invalid={Boolean(fieldErrors.insurance)}
                value={draft.insuranceNumber}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    insuranceNumber: event.target.value,
                  }))
                }
                placeholder="Tự điền nếu bệnh nhân đã có trong hồ sơ"
              />
              {fieldErrors.insurance && (
                <small className="field-error">{fieldErrors.insurance}</small>
              )}
            </label>
          )}
        </div>
        <div className="slot-picker">
          <strong>Chọn khung giờ</strong>
          <div className="slot-picker-group">
            <span>Ca sáng</span>
            <div>
              {slots.slice(0, 6).map((item) => (
                <SlotChoice
                  key={item.id}
                  item={item}
                  selectedId={draft.slotId}
                  onSelect={selectSlot}
                  mode={mode}
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
                  onSelect={selectSlot}
                  mode={mode}
                />
              ))}
            </div>
          </div>
        </div>
        <BookingSuggestionPanel
          suggestion={suggestedSlot}
          sourceSlot={slot}
          doctorName={selectedDoctor?.fullName || "Bác sĩ"}
          variant="create"
        />
        <div className="booking-form-grid">
          <label className="booking-field booking-span-two">
            Lý do khám *
            <input
              aria-invalid={Boolean(fieldErrors.reason)}
              value={draft.reason}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  reason: event.target.value,
                }))
              }
              placeholder="Nhập lý do khám"
            />
            {fieldErrors.reason && (
              <small className="field-error">{fieldErrors.reason}</small>
            )}
          </label>
          <label className="booking-field booking-span-two">
            Ghi chú
            <textarea
              rows={2}
              value={draft.note}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  note: event.target.value,
                }))
              }
              placeholder="Thông tin bổ sung (không bắt buộc)"
            />
          </label>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Hủy
          </button>
          <button
            type={suggestedSlot?.mode === "IMMEDIATE" ? "button" : "submit"}
            className={`btn btn-secondary ${suggestedSlot?.mode === "IMMEDIATE" ? "suggestion-action" : ""}`}
            disabled={saving}
            onClick={
              suggestedSlot?.mode === "IMMEDIATE"
                ? onConfirmSuggestion
                : undefined
            }
          >
            <Clock3 size={16} />{" "}
            {saving
              ? "Đang lưu..."
              : suggestedSlot?.mode === "IMMEDIATE"
                ? `Xác nhận khám ngay ${suggestedSlot.slot.start}–${suggestedSlot.slot.end}`
                : "Khám ngay"}
          </button>
          <button
            type={suggestedSlot?.mode === "SCHEDULED" ? "button" : "submit"}
            className="btn btn-primary"
            disabled={saving}
            onClick={
              suggestedSlot?.mode === "SCHEDULED"
                ? onConfirmSuggestion
                : undefined
            }
          >
            <CalendarDays size={16} />{" "}
            {saving
              ? "Đang lưu..."
              : suggestedSlot?.mode === "SCHEDULED"
                ? `Xác nhận tạo lịch ${suggestedSlot.slot.start}–${suggestedSlot.slot.end}`
                : "Tạo lịch"}
          </button>
        </div>
        {suggestedSlot && (
          <small className="booking-confirmation-note">
            {suggestedSlot.mode === "IMMEDIATE"
              ? "Bệnh nhân sẽ được tiếp nhận ngay sau khi bạn xác nhận."
              : "Lịch sẽ được tạo sau khi bạn xác nhận."}
          </small>
        )}
      </form>
    </div>
  );
}

export function SlotChoice({
  item,
  selectedId,
  onSelect,
  mode,
}: {
  item: SlotDefinition;
  selectedId: string;
  onSelect: (id: string) => void;
  mode: BookingMode;
}) {
  const disabled =
    item.state === "full" ||
    item.state === "closed" ||
    item.state === "ended" ||
    (mode === "SCHEDULED" && !item.bookable && item.state !== "ongoing");
  return (
    <button
      type="button"
      disabled={disabled}
      className={item.id === selectedId ? "selected" : ""}
      onClick={() => onSelect(item.id)}
    >
      {item.start} - {item.end}
      {item.state === "full" && " · Đầy"}
    </button>
  );
}

export function SearchableSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);
  const [query, setQuery] = useState(selected?.label || "");
  const [open, setOpen] = useState(false);
  const locked = Boolean(value) && options.length === 1 && !/^\d+$/.test(value);
  const displayValue = value ? selected?.label || query : query;
  const suggestions = options
    .filter((option) =>
      option.label.toLowerCase().includes(query.toLowerCase()),
    )
    .slice(0, 5);
  useEffect(() => {
    const closeWhenClickingOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeWhenClickingOutside);
    return () =>
      document.removeEventListener("mousedown", closeWhenClickingOutside);
  }, []);
  return (
    <div className="searchable-select" ref={containerRef}>
      <input
        disabled={locked}
        value={displayValue}
        placeholder="Chọn"
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          if (value) onChange("");
          setOpen(true);
        }}
      />
      <ChevronDown size={14} />
      {open && !locked && (
        <div className="suggestion-list searchable-suggestions">
          {suggestions.map((option) => (
            <button
              type="button"
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setQuery(option.label);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
          {suggestions.length === 0 && <span>Không có lựa chọn phù hợp</span>}
        </div>
      )}
    </div>
  );
}
