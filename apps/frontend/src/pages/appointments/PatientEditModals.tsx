import { useState } from "react";
import type { FormEvent } from "react";
import { X } from "lucide-react";
import type { Appointment } from "../../entities/appointment";
import { shortDateLabel, timeLabel } from "../../shared/lib/date";

export function PatientQuickEditModal({
  appointment,
  saving,
  onClose,
  onSave,
}: {
  appointment: Appointment;
  saving: boolean;
  onClose: () => void;
  onSave: (values: {
    fullName: string;
    phone: string;
    email: string;
    cccd: string;
    insuranceNumber: string;
    address: string;
  }) => Promise<void>;
}) {
  const [values, setValues] = useState({
    fullName: appointment.patient.fullName,
    phone: appointment.patient.phone,
    email:
      appointment.patient.email === "Chưa cập nhật"
        ? ""
        : appointment.patient.email,
    cccd: appointment.patient.cccd,
    insuranceNumber: appointment.patient.insuranceNumber || "",
    address:
      appointment.patient.address === "Chưa cập nhật"
        ? ""
        : appointment.patient.address,
  });
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!values.fullName.trim()) return setError("Vui lòng nhập họ và tên.");
    if (!/^\d{10,11}$/.test(values.phone.trim()))
      return setError("Số điện thoại phải có 10–11 chữ số.");
    if (values.cccd.trim() && !/^\d{9,12}$/.test(values.cccd.trim()))
      return setError("Số CCCD/CMND phải có từ 9 đến 12 chữ số.");
    setError("");
    try {
      await onSave(values);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Không thể cập nhật thông tin bệnh nhân.",
      );
    }
  };
  return (
    <div
      className="modal-backdrop patient-edit-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <form className="patient-edit-modal" onSubmit={submit}>
        <div className="modal-header">
          <div>
            <h2>Cập nhật thông tin bệnh nhân</h2>
            <p>{appointment.patient.code}</p>
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
        <div className="patient-edit-notice">
          ⓘ Thay đổi thông tin tại đây sẽ cập nhật vào hồ sơ bệnh nhân.
        </div>
        <div className="patient-edit-grid">
          <label>
            Họ và tên *
            <input
              value={values.fullName}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  fullName: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Số điện thoại *
            <input
              inputMode="numeric"
              value={values.phone}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  phone: event.target.value.replace(/\D/g, ""),
                }))
              }
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={values.email}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Số CCCD/CMND
            <input
              inputMode="numeric"
              maxLength={12}
              value={values.cccd}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  cccd: event.target.value.replace(/\D/g, ""),
                }))
              }
            />
          </label>
          <label>
            Số BHYT
            <input
              value={values.insuranceNumber}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  insuranceNumber: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Ngày sinh
            <input
              type="date"
              value={appointment.patient.dob}
              disabled
              title="Ngày sinh chỉ chỉnh sửa tại hồ sơ bệnh nhân đầy đủ"
            />
          </label>
          <label className="span-two">
            Địa chỉ
            <textarea
              rows={3}
              value={values.address}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  address: event.target.value,
                }))
              }
            />
          </label>
        </div>
        {error && <div className="form-error patient-edit-error">{error}</div>}
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Hủy bỏ
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function AppointmentQuickEditModal({
  appointment,
  saving,
  onClose,
  onSave,
}: {
  appointment: Appointment;
  saving: boolean;
  onClose: () => void;
  onSave: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState(appointment.reason);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!reason.trim()) return setError("Vui lòng nhập lý do khám.");
    setError("");
    try {
      await onSave(reason);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Không thể cập nhật lịch khám.",
      );
    }
  };
  return (
    <div
      className="modal-backdrop patient-edit-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <form
        className="patient-edit-modal appointment-quick-edit-modal"
        onSubmit={submit}
      >
        <div className="modal-header">
          <div>
            <h2>Cập nhật lịch khám</h2>
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
        <div className="patient-edit-grid">
          <label>
            Ngày khám
            <input
              value={shortDateLabel(appointment.startTime.slice(0, 10))}
              disabled
            />
          </label>
          <label>
            Khung giờ
            <input
              value={`${timeLabel(appointment.startTime)} - ${timeLabel(appointment.endTime)}`}
              disabled
            />
          </label>
          <label className="span-two">
            Lý do khám *
            <textarea
              rows={4}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
        </div>
        {error && <div className="form-error patient-edit-error">{error}</div>}
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Hủy bỏ
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      </form>
    </div>
  );
}

