import { useState } from "react";
import type { FormEvent } from "react";
import { X } from "lucide-react";

import { appointmentApi } from "../lib/appointmentsApi";
import type { ApiPatient } from "../lib/appointmentsApi";

interface NewPatientDraft {
  fullName: string;
  phone: string;
  gender: "Nam" | "Nữ";
  dob: string;
  email: string;
  cccd: string;
  address: string;
}

const emptyPatientDraft: NewPatientDraft = {
  fullName: "",
  phone: "",
  gender: "Nam",
  dob: "",
  email: "",
  cccd: "",
  address: "",
};

export default function CreatePatientModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (patient: ApiPatient) => void;
}) {
  const [value, setValue] = useState<NewPatientDraft>(emptyPatientDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const createPatient = async (event: FormEvent) => {
    event.preventDefault();
    if (!value.fullName.trim() || !value.phone.trim() || !value.dob) return;
    if (value.cccd.trim() && !/^\d{9,12}$/.test(value.cccd.trim())) {
      setError("Số CCCD/CMND phải có từ 9 đến 12 chữ số.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await appointmentApi.createPatient({
        full_name: value.fullName.trim(),
        phone: value.phone.replace(/\s/g, ""),
        dob: value.dob,
        gender: value.gender === "Nữ" ? "F" : "M",
        email: value.email.trim(),
        cccd: value.cccd.trim(),
        address: value.address.trim(),
      });
      onCreated(response.patient);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Không thể tạo hồ sơ bệnh nhân.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-backdrop patient-create-backdrop"
      onMouseDown={(event) =>
        event.target === event.currentTarget && !saving && onClose()
      }
    >
      <form className="patient-create-modal" onSubmit={createPatient}>
        <div className="modal-header">
          <div>
            <h2>Thêm bệnh nhân</h2>
            <p>Nhập thông tin hành chính để tạo hồ sơ bệnh nhân.</p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            disabled={saving}
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        <div className="patient-modal-fields">
          <label className="span-two">
            Họ và tên *
            <input
              autoFocus
              value={value.fullName}
              onChange={(event) =>
                setValue((current) => ({
                  ...current,
                  fullName: event.target.value,
                }))
              }
              placeholder="Nguyễn Văn A"
              required
            />
          </label>
          <label>
            Ngày sinh *
            <input
              type="date"
              value={value.dob}
              onChange={(event) =>
                setValue((current) => ({
                  ...current,
                  dob: event.target.value,
                }))
              }
              required
            />
          </label>
          <label>
            Giới tính *
            <select
              value={value.gender}
              onChange={(event) =>
                setValue((current) => ({
                  ...current,
                  gender: event.target.value as NewPatientDraft["gender"],
                }))
              }
              required
            >
              <option>Nam</option>
              <option>Nữ</option>
            </select>
          </label>
          <label>
            Số điện thoại *
            <input
              value={value.phone}
              onChange={(event) =>
                setValue((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
              placeholder="0901234567"
              required
            />
            <span className="field-hint">SĐT nên có 10-11 chữ số.</span>
          </label>
          <label>
            Email
            <input
              type="email"
              value={value.email}
              onChange={(event) =>
                setValue((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              placeholder="email@example.com"
            />
          </label>
          <label>
            Số CCCD/CMND
            <input
              inputMode="numeric"
              maxLength={12}
              value={value.cccd}
              onChange={(event) =>
                setValue((current) => ({
                  ...current,
                  cccd: event.target.value.replace(/\D/g, ""),
                }))
              }
              placeholder="Nhập 9–12 chữ số"
            />
          </label>
          <label className="span-two">
            Địa chỉ
            <textarea
              rows={3}
              value={value.address}
              onChange={(event) =>
                setValue((current) => ({
                  ...current,
                  address: event.target.value,
                }))
              }
              placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"
            />
          </label>
        </div>

        {error && <div className="form-error">{error}</div>}
        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Hủy
          </button>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? "Đang tạo..." : "Tạo hồ sơ"}
          </button>
        </div>
      </form>
    </div>
  );
}
