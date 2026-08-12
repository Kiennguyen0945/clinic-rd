import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
  Settings2,
  Stethoscope,
} from "lucide-react";
import type { ReceptionContext } from "../../api/reception.api";
import { dateLabel, timeLabel, todayValue } from "../../../../shared/lib/date";

export function AppointmentOverview({
  selectedDate,
  onDateChange,
  onCreate,
  onViewDoctor,
  context,
  loading,
  error,
  receptionClosed,
  departmentFilter,
  onDepartmentFilterChange,
  doctorFilter,
  onDoctorFilterChange,
  slotStatusFilter,
  onSlotStatusFilterChange,
}: {
  selectedDate: string;
  onDateChange: (date: string) => void;
  onCreate: () => void;
  onViewDoctor: (doctorId: string) => void;
  context: ReceptionContext | null;
  loading: boolean;
  error: string;
  receptionClosed: boolean;
  departmentFilter: string;
  onDepartmentFilterChange: (value: string) => void;
  doctorFilter: string;
  onDoctorFilterChange: (value: string) => void;
  slotStatusFilter: string;
  onSlotStatusFilterChange: (value: string) => void;
}) {
  const moveDate = (amount: number) => {
    const date = new Date(`${selectedDate}T12:00:00`);
    date.setDate(date.getDate() + amount);
    onDateChange(date.toISOString().slice(0, 10));
  };
  const overview = useMemo(
    () =>
      (context?.overview || []).filter(
        (item) =>
          (departmentFilter === "all" ||
            item.departments.some(
              (department) => String(department.id) === departmentFilter,
            )) &&
          (doctorFilter === "all" || item.doctor.id === doctorFilter) &&
          (slotStatusFilter === "all" || item.status === slotStatusFilter),
      ),
    [context, departmentFilter, doctorFilter, slotStatusFilter],
  );
  return (
    <div className="appointments-page appointments-redesign appointment-overview-page">
      <header className="appointments-heading">
        <div>
          <h1 className="page-title">Lịch hẹn</h1>
          <p className="page-subtitle">
            Quản lý lịch khám và điều phối bệnh nhân trong ngày.
          </p>
        </div>
        <button
          className="btn btn-primary appointments-create-btn"
          onClick={onCreate}
          disabled={receptionClosed}
        >
          <Plus size={18} /> Tạo lịch hẹn <ChevronDown size={15} />
        </button>
      </header>
      <nav className="appointment-tabs">
        <button className="active">Tổng quan lịch hẹn</button>
        <button>Bảng tuần</button>
        <button>Bảng ngày</button>
      </nav>
      <div className="appointment-toolbar screenshot-toolbar">
        <div className="date-controls">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onDateChange(todayValue())}
          >
            Hôm nay
          </button>
          <button
            className="icon-button"
            onClick={() => moveDate(-1)}
            aria-label="Ngày trước"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="icon-button"
            onClick={() => moveDate(1)}
            aria-label="Ngày sau"
          >
            <ChevronRight size={18} />
          </button>
          <QuickDatePicker selectedDate={selectedDate} onSelect={onDateChange} />
        </div>
        <div className="appointment-filters">
          <label>
            <Filter size={15} />
            <select
              value={departmentFilter}
              onChange={(event) => onDepartmentFilterChange(event.target.value)}
            >
              <option value="all">Khoa: Tất cả</option>
              {(context?.departments || []).map((department) => (
                <option key={department.id} value={String(department.id)}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <Stethoscope size={15} />
            <select
              value={doctorFilter}
              onChange={(event) => onDoctorFilterChange(event.target.value)}
            >
              <option value="all">Bác sĩ: Tất cả</option>
              {(context?.doctors || []).map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.fullName}
                </option>
              ))}
            </select>
          </label>
          <label>
            <select
              value={slotStatusFilter}
              onChange={(event) => onSlotStatusFilterChange(event.target.value)}
            >
              <option value="all">Tình trạng slot: Tất cả</option>
              <option value="OPEN">Đang nhận</option>
              <option value="NEAR_FULL">Gần đầy</option>
              <option value="FULL">Đã đầy</option>
            </select>
          </label>
          <button className="icon-button" aria-label="Cài đặt bộ lọc">
            <Settings2 size={17} />
          </button>
        </div>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="overview-info-banner">
        ⓘ Chọn bác sĩ để xem lịch chi tiết theo khung giờ.
      </div>
      <div className="overview-layout">
        <section className="overview-table-card">
          <div className="overview-card-title">
            <h2>Tổng quan lịch khám theo bác sĩ</h2>
          </div>
          <div className="overview-table-wrap">
            <table className="overview-table">
              <thead>
                <tr>
                  <th>Bác sĩ</th>
                  <th>Khoa</th>
                  <th>Tổng slot</th>
                  <th>Đã đặt</th>
                  <th>Còn chỗ</th>
                  <th>Slot đang diễn ra</th>
                  <th>Tình trạng</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading && !context ? (
                  <tr>
                    <td colSpan={8}>Đang tải dữ liệu...</td>
                  </tr>
                ) : (
                  overview.map((item) => {
                    const doctorName = item.doctor.fullName;
                    const departmentName =
                      item.departments[0]?.name || "Chưa phân khoa";
                    const full = item.status === "FULL";
                    const near = item.status === "NEAR_FULL";
                    return (
                      <tr key={item.doctor.id}>
                        <td>
                          <div className="overview-doctor-cell">
                            <span className="doctor-initial-avatar">
                              {doctorName.replace(/^BS\.\s*/, "").slice(0, 1)}
                            </span>
                            <span>
                              <strong>{doctorName}</strong>
                              <small>{departmentName}</small>
                            </span>
                          </div>
                        </td>
                        <td>{departmentName}</td>
                        <td>{item.totalSlots}</td>
                        <td
                          className={full ? "metric-danger" : "metric-success"}
                        >
                          {item.bookedCount} / {item.capacity}
                        </td>
                        <td
                          className={
                            item.remainingCapacity === 0
                              ? "metric-danger"
                              : "metric-success"
                          }
                        >
                          {item.remainingCapacity}
                        </td>
                        <td>
                          {item.ongoingSlot ? (
                            <span>
                              {timeLabel(item.ongoingSlot.startTime)} -{" "}
                              {timeLabel(item.ongoingSlot.endTime)} ·{" "}
                              {item.ongoingSlot.bookedCount}/
                              {item.ongoingSlot.capacity}
                            </span>
                          ) : (
                            <span className="slot-full-text">—</span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`overview-status ${full ? "is-full" : near ? "is-near" : "is-open"}`}
                          >
                            {full ? "Đã đầy" : near ? "Gần đầy" : "Đang nhận"}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-outline-primary btn-sm"
                            onClick={() => onViewDoctor(item.doctor.id)}
                          >
                            Xem lịch
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="overview-legend">
            <span>
              <i className="legend-dot available" /> Đang nhận
            </span>
            <span>
              <i className="legend-dot near" /> Gần đầy
            </span>
            <span>
              <i className="legend-dot full" /> Đã đầy
            </span>
            <span>
              <i className="legend-dot ended" /> Đã khóa
            </span>
          </div>
        </section>
        <aside className="overview-side">
          <MiniCalendar
            key={selectedDate}
            selectedDate={selectedDate}
            onSelect={onDateChange}
          />
          <section className="overview-side-card">
            <h3>Tổng quan tiếp nhận hôm nay</h3>
            <p>
              Đang chờ{" "}
              <strong className="metric-success">
                {context?.receptionSummary.waiting || 0}
              </strong>
            </p>
            <p>
              Đã xác nhận{" "}
              <strong className="metric-blue">
                {context?.receptionSummary.confirmed || 0}
              </strong>
            </p>
            <p>
              Đang khám{" "}
              <strong className="metric-orange">
                {context?.receptionSummary.inProgress || 0}
              </strong>
            </p>
            <p>
              Hoàn tất{" "}
              <strong>{context?.receptionSummary.completed || 0}</strong>
            </p>
          </section>
          <section className="overview-side-card">
            <h3>Bác sĩ có bệnh nhân chờ</h3>
            {(context?.waitingDoctors || []).slice(0, 3).map((doctor) => (
              <p key={doctor.doctorId}>
                {doctor.doctorName} <b>{doctor.waitingCount}</b>
              </p>
            ))}
            {!context?.waitingDoctors.length && (
              <p>Chưa có bệnh nhân đang chờ</p>
            )}
            <button className="view-all-link">
              Xem tất cả <ChevronRight size={15} />
            </button>
          </section>
        </aside>
      </div>
      <div className="overview-empty-state">
        <CalendarDays size={40} />
        <strong>Chọn bác sĩ trong bảng để xem các khung giờ.</strong>
        <span>
          Danh sách slot và bệnh nhân sẽ được tải theo bác sĩ đã chọn.
        </span>
      </div>
      <div className="mock-api-hint">
        <span className="mock-dot" /> Dữ liệu đồng bộ từ hệ thống
      </div>
    </div>
  );
}

export function QuickDatePicker({
  selectedDate,
  onSelect,
}: {
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [monthDate, setMonthDate] = useState(
    () => new Date(`${selectedDate}T12:00:00`),
  );
  const pickerRef = useRef<HTMLDivElement>(null);
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;

  useEffect(() => {
    if (!open) return undefined;
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open]);

  const moveMonth = (amount: number) => {
    setMonthDate(new Date(year, month + amount, 1, 12));
  };
  const chooseDate = (day: number) => {
    const value = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    onSelect(value);
    setOpen(false);
  };

  return (
    <div className="quick-date-picker" ref={pickerRef}>
      <button
        type="button"
        className="toolbar-date"
        aria-label="Chọn ngày"
        aria-expanded={open}
        onClick={() => {
          if (!open) setMonthDate(new Date(`${selectedDate}T12:00:00`));
          setOpen((current) => !current);
        }}
      >
        <CalendarDays size={17} /> {dateLabel(selectedDate)}
      </button>
      {open && (
        <div className="quick-date-popover" role="dialog" aria-label="Chọn ngày">
          <div className="quick-date-header">
            <strong>
              {new Intl.DateTimeFormat("vi-VN", {
                month: "long",
                year: "numeric",
              }).format(new Date(year, month, 1))}
            </strong>
            <div>
              <button type="button" onClick={() => moveMonth(-1)} aria-label="Tháng trước">
                <ChevronLeft size={16} />
              </button>
              <button type="button" onClick={() => moveMonth(1)} aria-label="Tháng sau">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div className="quick-date-weekdays">
            {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="quick-date-grid">
            {Array.from({ length: firstDay }).map((_, index) => (
              <span key={`empty-${index}`} />
            ))}
            {Array.from({ length: days }).map((_, index) => {
              const day = index + 1;
              const value = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              return (
                <button
                  type="button"
                  key={value}
                  className={`${value === selectedDate ? "selected" : ""} ${value === todayValue() ? "today" : ""}`}
                  onClick={() => chooseDate(day)}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="quick-date-today"
            onClick={() => onSelect(todayValue())}
          >
            Về hôm nay
          </button>
        </div>
      )}
    </div>
  );
}

function MiniCalendar({
  selectedDate,
  onSelect,
}: {
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  const [monthDate, setMonthDate] = useState(
    () => new Date(`${selectedDate}T12:00:00`),
  );
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;

  const moveMonth = (amount: number) => {
    setMonthDate(new Date(year, month + amount, 1, 12));
  };

  return (
    <section className="mini-calendar">
      <div className="mini-calendar-header">
        <strong>
          {new Intl.DateTimeFormat("vi-VN", {
            month: "long",
            year: "numeric",
          }).format(new Date(year, month, 1))}
        </strong>
        <div className="mini-calendar-navigation">
          <button type="button" onClick={() => moveMonth(-1)} aria-label="Tháng trước">
            <ChevronLeft size={14} />
          </button>
          <button type="button" onClick={() => moveMonth(1)} aria-label="Tháng sau">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      <div className="mini-calendar-week">
        {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="mini-calendar-grid">
        {Array.from({ length: firstDay }).map((_, index) => (
          <span key={`empty-${index}`} />
        ))}
        {Array.from({ length: days }).map((_, index) => {
          const day = index + 1;
          const value = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          return (
            <button
              key={value}
              className={value === selectedDate ? "selected" : ""}
              onClick={() => onSelect(value)}
            >
              {day}
            </button>
          );
        })}
      </div>
    </section>
  );
}
