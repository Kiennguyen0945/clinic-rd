import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Phone,
  Pencil,
  Plus,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { cancellationReasonLabel, statusConfig } from "../../entities/appointment";
import type { Appointment, AppointmentStatus } from "../../entities/appointment";
import type { SlotDefinition } from "../../entities/slot";
import { timeLabel } from "../../shared/lib/date";

export function SlotRow({
  slot,
  appointments,
  expanded,
  selectedId,
  onToggle,
  onSelectAppointment,
  onCreate,
  receptionClosed,
  showCreateAction = true,
}: {
  slot: SlotDefinition;
  appointments: Appointment[];
  expanded: boolean;
  selectedId: string;
  onToggle: () => void;
  onSelectAppointment: (id: string) => void;
  onCreate: (slot: SlotDefinition) => void;
  receptionClosed: boolean;
  showCreateAction?: boolean;
}) {
  const remaining = slot.capacity - slot.booked;
  const canCreate =
    slot.state !== "ended" && slot.state !== "full" && slot.state !== "closed";
  return (
    <div
      className={`slot-row-card slot-${slot.state} ${expanded ? "expanded" : ""}`}
    >
      <div className="slot-row">
        <div className="slot-time">
          <strong>
            {slot.start} - {slot.end}
          </strong>
          <small>
            {slot.state === "ended"
              ? "Đã kết thúc"
              : slot.state === "ongoing"
                ? "Đang diễn ra"
                : slot.state === "closed"
                  ? "Đã khóa"
                  : remaining
                    ? `Còn ${remaining} chỗ`
                    : "Đã đủ chỗ"}
          </small>
        </div>
        <div className="slot-capacity">
          <strong>
            {slot.state === "closed"
              ? "—"
              : `${slot.booked} / ${slot.capacity}`}
          </strong>
          <small>
            {slot.state === "closed"
              ? "Đã khóa"
              : remaining
                ? `Còn ${remaining} chỗ`
                : "Đã đủ chỗ"}
          </small>
        </div>
        <div className="slot-action">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={`slot-appointments-${slot.id}`}
          >
            Xem lịch{" "}
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showCreateAction && canCreate && (
            <button
              className="btn btn-outline-primary btn-sm"
              disabled={receptionClosed}
              onClick={() => onCreate(slot)}
            >
              <Plus size={15} /> Tạo lịch
            </button>
          )}
        </div>
      </div>
      {expanded && (
        <div className="slot-appointment-panel" id={`slot-appointments-${slot.id}`}>
          <div className="slot-appointment-head">
            <span>Số khám</span>
            <span>Bệnh nhân</span>
            <span>Trạng thái</span>
            <span />
          </div>
          {appointments.map((appointment) => (
            <button
              type="button"
              className={`slot-appointment-row ${selectedId === appointment.id ? "selected" : ""}`}
              key={appointment.id}
              onClick={() => onSelectAppointment(appointment.id)}
            >
              <strong>
                {String(appointment.sequenceNumber).padStart(2, "0")}
              </strong>
              <span>
                <b>{appointment.patient.fullName}</b>
                <small>{appointment.patient.code}</small>
              </span>
              <span
                className={`status-badge ${statusConfig[appointment.status].className}`}
              >
                {statusConfig[appointment.status].label}
              </span>
              <ChevronRight size={17} />
            </button>
          ))}
          {appointments.length === 0 && (
            <div className="slot-appointment-empty">
              Chưa có bệnh nhân trong khung giờ này.
            </div>
          )}
          <div className="slot-appointment-summary">
            <span>
              Tổng: <b>{appointments.length} bệnh nhân</b>
            </span>
            <span>
              Đang chờ:{" "}
              {appointments.filter((item) => item.status === "WAITING").length}
            </span>
            <span>
              Đã xác nhận:{" "}
              {
                appointments.filter((item) => item.status === "CONFIRMED")
                  .length
              }
            </span>
            <span>
              Đang khám:{" "}
              {
                appointments.filter((item) => item.status === "IN_PROGRESS")
                  .length
              }
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function QueueGroup({
  items,
  selectedId,
  onSelect,
}: {
  items: Appointment[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="queue-group">
      {items.map((item) => (
        <div
          className={`queue-item ${selectedId === item.id ? "selected" : ""}`}
          key={item.id}
        >
          <button
            className="queue-main-button"
            onClick={() => onSelect(item.id)}
          >
            <strong className="queue-number">
              {String(item.sequenceNumber).padStart(2, "0")}
            </strong>
            <span>
              <b>{item.patient.fullName}</b>
              <small>
                {timeLabel(item.startTime)} - {timeLabel(item.endTime)} ·{" "}
                {item.doctor.fullName}
              </small>
            </span>
          </button>
          <span
            className={`status-badge ${statusConfig[item.status].className}`}
          >
            {statusConfig[item.status].label}
          </span>
        </div>
      ))}
      {items.length === 0 && (
        <div className="empty-context">Không có lịch trong nhóm này.</div>
      )}
    </div>
  );
}

export function AppointmentDetail({
  appointment,
  onOpenProfile,
  onEditPatient,
  onEditAppointment,
  onStatusChange,
}: {
  appointment: Appointment | null;
  onOpenProfile: (id: string) => void;
  onEditPatient: () => void;
  onEditAppointment: () => void;
  onStatusChange: (status: AppointmentStatus) => void;
}) {
  if (!appointment)
    return (
      <section className="detail-panel">
        <div className="side-panel-title">
          <h2>Chi tiết lịch hẹn</h2>
        </div>
        <div className="empty-context">Chọn một lịch hẹn để xem chi tiết.</div>
      </section>
    );
  const status = statusConfig[appointment.status];
  return (
    <section className="detail-panel">
      <div className="side-panel-title">
        <h2>Chi tiết lịch hẹn</h2>
        <button className="icon-button" aria-label="Đóng chi tiết">
          <X size={16} />
        </button>
      </div>
      <div className="detail-patient-row">
        <div className="detail-patient">
          <div className="detail-avatar">
            <UserRound size={21} />
          </div>
          <div>
            <strong>{appointment.patient.fullName}</strong>
            <span>{appointment.patient.code}</span>
            <a href={`tel:${appointment.patient.phone}`}>
              <Phone size={13} /> {appointment.patient.phone}
            </a>
          </div>
        </div>
        <button
          className="btn btn-outline-primary btn-sm"
          onClick={onEditPatient}
        >
          <Pencil size={14} /> Cập nhật thông tin
        </button>
      </div>
      <span className={`status-badge ${status.className}`}>{status.label}</span>
      <dl className="detail-list">
        <DetailRow
          label="Số khám"
          value={String(appointment.sequenceNumber).padStart(2, "0")}
        />
        <DetailRow label="Mã lịch hẹn" value={appointment.appointmentCode} />
        <DetailRow
          label="Khung giờ"
          value={`${timeLabel(appointment.startTime)} - ${timeLabel(appointment.endTime)}`}
        />
        <DetailRow label="Bác sĩ" value={appointment.doctor.fullName} />
        <DetailRow label="Khoa" value={appointment.doctor.department} />
        <DetailRow
          label="Loại đặt lịch"
          value={
            appointment.appointmentType === "SCHEDULED"
              ? "Đặt trước"
              : "Đến trực tiếp"
          }
        />
        <DetailRow
          label="Hình thức khám"
          value={appointment.insuranceNumber ? "BHYT" : "Dịch vụ"}
        />
        <DetailRow label="Lý do khám" value={appointment.reason} />
        {appointment.status === "CANCELLED" && (
          <DetailRow
            label="Lý do hủy"
            value={cancellationReasonLabel(
              appointment.cancellationReason,
              appointment.cancellationNote,
            )}
          />
        )}
        <DetailRow label="Trạng thái" value={status.label} />
      </dl>
      <div className="detail-update-action">
        <button
          className="btn btn-outline-primary btn-sm"
          onClick={onEditAppointment}
          disabled={
            appointment.status === "COMPLETED" ||
            appointment.status === "CANCELLED"
          }
        >
          <CalendarDays size={14} /> Cập nhật lịch khám
        </button>
      </div>
      <div className="detail-actions">
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => onOpenProfile(appointment.id)}
        >
          <Search size={15} />{" "}
          {appointment.status === "CANCELLED"
            ? "Xem chi tiết lý do hủy"
            : "Xem hồ sơ"}
        </button>
        {appointment.status === "CONFIRMED" && (
          <>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => onStatusChange("WAITING")}
            >
              Tiếp nhận
            </button>
            <button
              className="btn btn-danger-outline btn-sm"
              onClick={() => onStatusChange("CANCELLED")}
            >
              <X size={15} /> Hủy
            </button>
          </>
        )}
        {appointment.status === "WAITING" && (
          <button
            className="btn btn-danger-outline btn-sm"
            onClick={() => onStatusChange("CANCELLED")}
          >
            <X size={15} /> Hủy
          </button>
        )}
        {appointment.status === "IN_PROGRESS" && (
          <span className="detail-state-note">Đang khám</span>
        )}
      </div>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
