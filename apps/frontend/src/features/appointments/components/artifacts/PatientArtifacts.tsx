import type { ReactNode } from "react";
import { X } from "lucide-react";
import { statusConfig } from "../../../../entities/appointment";
import type { Appointment } from "../../../../entities/appointment";
import { patientInitials } from "../../../../entities/patient";
import { shortDateLabel, timeLabel } from "../../../../shared/lib/date";

export function PrintTicket({
  appointment,
  onClose,
}: {
  appointment: Appointment;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop print-ticket-backdrop">
      <section className="print-ticket-modal">
        <div className="print-ticket">
          <small>{appointment.room}</small>
          <h2>PHIẾU KHÁM BỆNH</h2>
          <p>Ngày: {shortDateLabel(appointment.startTime.slice(0, 10))}</p>
          <div className="ticket-info">
            <span>Họ tên:</span>
            <strong>{appointment.patient.fullName}</strong>
            <span>Giới tính:</span>
            <b>{appointment.patient.gender}</b>
            <span>Năm sinh:</span>
            <b>{appointment.patient.dob.slice(0, 4)}</b>
            <span>Khoa:</span>
            <b>{appointment.doctor.department}</b>
            <span>Dịch vụ:</span>
            <b>{appointment.insuranceNumber ? "BHYT" : "Dịch vụ"}</b>
            <span>Bác sĩ:</span>
            <b>{appointment.doctor.fullName}</b>
            <span>Khung giờ:</span>
            <b>
              {timeLabel(appointment.startTime)} -{" "}
              {timeLabel(appointment.endTime)}
            </b>
            <span>Mã bệnh nhân:</span>
            <b>{appointment.patient.code}</b>
            <span>Mã lịch hẹn:</span>
            <b>{appointment.appointmentCode}</b>
          </div>
          <div className="ticket-number">
            <span>Phòng số:</span>
            <strong>{appointment.room.replace("Phòng ", "")}</strong>
            <span>Số thứ tự:</span>
            <strong>
              {String(appointment.sequenceNumber).padStart(3, "0")}
            </strong>
          </div>
          <small className="ticket-note">
            Lưu ý: Quý khách vui lòng khám đúng khung giờ đăng ký.
          </small>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Đóng
          </button>
          <button className="btn btn-primary" onClick={() => window.print()}>
            In phiếu khám
          </button>
        </div>
      </section>
    </div>
  );
}

export function ReceptionistPatientDrawer({
  appointment,
  onClose,
}: {
  appointment: Appointment;
  onClose: () => void;
}) {
  const patient = appointment.patient;
  const status = statusConfig[appointment.status];
  return (
    <div className="receptionist-patient-drawer-layer">
      <aside
        className="receptionist-patient-drawer"
        aria-label="Hồ sơ bệnh nhân"
      >
        <header className="receptionist-drawer-header">
          <div>
            <span>Hồ sơ bệnh nhân</span>
            <h2>Chi tiết bệnh nhân</h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Đóng hồ sơ"
          >
            <X size={18} />
          </button>
        </header>
        <section className="receptionist-patient-profile">
          <div className="receptionist-profile-avatar">
            {patientInitials(patient.fullName)}
          </div>
          <div>
            <h3>{patient.fullName}</h3>
            <div className="receptionist-profile-meta">
              <span className="gender-badge">{patient.gender}</span>
              <span>{patient.age} tuổi</span>
              <span>{patient.dob && shortDateLabel(patient.dob)}</span>
            </div>
            <strong>{patient.code}</strong>
            <a href={`tel:${patient.phone}`}>{patient.phone}</a>
            <p>{patient.address}</p>
          </div>
        </section>
        <div className="receptionist-drawer-body">
          <DrawerCard title="Thông tin liên hệ">
            <InfoRow label="Email" value={patient.email} />
            <InfoRow label="Số điện thoại" value={patient.phone} />
            <InfoRow label="Địa chỉ" value={patient.address} />
          </DrawerCard>
          <DrawerCard
            title="Lịch hẹn hiện tại"
            action={
              <span className={`status-badge ${status.className}`}>
                {status.label}
              </span>
            }
          >
            <InfoRow
              label="Thời gian"
              value={`${timeLabel(appointment.startTime)} - ${timeLabel(appointment.endTime)}`}
            />
            <InfoRow label="Bác sĩ" value={appointment.doctor.fullName} />
            <InfoRow label="Khoa" value={appointment.doctor.department} />
            <InfoRow label="Lý do khám" value={appointment.reason} />
          </DrawerCard>
        </div>
        <footer className="receptionist-drawer-footer">
          <button className="btn btn-primary" onClick={onClose}>
            Đóng
          </button>
        </footer>
      </aside>
    </div>
  );
}

function DrawerCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="receptionist-info-card">
      <div className="receptionist-card-title">
        <h3>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="receptionist-info-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
