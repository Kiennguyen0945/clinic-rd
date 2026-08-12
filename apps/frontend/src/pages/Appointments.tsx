import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  LockKeyhole,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Stethoscope,
  X,
} from "lucide-react";
import { CreatePatientModal } from "../features/patients";
import { useAuthStore } from "../store";
import { appointmentApi, mapAppointment } from "../entities/appointment";
import type {
  Appointment,
  AppointmentDraft,
  AppointmentStatus,
  BookingMode,
  BookingSuggestion,
} from "../entities/appointment";
import { mapPatient, patientApi } from "../entities/patient";
import type { ApiPatient, PatientProfile } from "../entities/patient";
import { emptyBookingSlot, isSlotAvailable, mapSlot, slotApi } from "../entities/slot";
import type { ApiSlot, SlotDefinition } from "../entities/slot";
import { mapDoctor, receptionApi } from "../features/appointments";
import type { ReceptionContext } from "../features/appointments";
import { ApiError as AppointmentApiError } from "../shared/api";
import { todayValue } from "../shared/lib/date";
import {
  AppointmentOverview,
  QuickDatePicker,
} from "./appointments/AppointmentOverview";
import {
  AppointmentDetail,
  QueueGroup,
  SlotRow,
} from "./appointments/SchedulePanels";
import {
  AppointmentQuickEditModal,
  PatientQuickEditModal,
} from "./appointments/PatientEditModals";
import { CreateAppointmentModal } from "./appointments/AppointmentModals";
import {
  CancellationModal,
  RescheduleAppointmentModal,
} from "./appointments/RescheduleModals";
import {
  PrintTicket,
  ReceptionistPatientDrawer,
} from "./appointments/PatientArtifacts";
export default function AppointmentsPage() {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedDoctorId = searchParams.get("doctorId");
  const [selectedDate, setSelectedDate] = useState(todayValue);
  const [overviewDepartment, setOverviewDepartment] = useState("all");
  const [overviewDoctor, setOverviewDoctor] = useState("all");
  const [overviewSlotStatus, setOverviewSlotStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [context, setContext] = useState<ReceptionContext | null>(null);
  const [bookingContext, setBookingContext] = useState<ReceptionContext | null>(
    null,
  );
  const [patientDirectory, setPatientDirectory] = useState<PatientProfile[]>(
    [],
  );
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [slotDefinitions, setSlotDefinitions] = useState<SlotDefinition[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [expandedSlotId, setExpandedSlotId] = useState("");
  const [queueTab, setQueueTab] = useState<"WAITING" | "CONFIRMED">("WAITING");
  const [drawerAppointmentId, setDrawerAppointmentId] = useState<string | null>(
    null,
  );
  const [bookingSlot, setBookingSlot] = useState<SlotDefinition | null>(null);
  const [bookingMode, setBookingMode] = useState<BookingMode>("SCHEDULED");
  const [bookingSuggestion, setBookingSuggestion] =
    useState<BookingSuggestion | null>(null);
  const suggestionRequestRef = useRef(0);
  const [printAppointment, setPrintAppointment] = useState<Appointment | null>(
    null,
  );
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [patientEditTarget, setPatientEditTarget] =
    useState<Appointment | null>(null);
  const [appointmentEditTarget, setAppointmentEditTarget] =
    useState<Appointment | null>(null);
  const [rescheduleTarget, setRescheduleTarget] =
    useState<Appointment | null>(null);
  const [rescheduleSuggestion, setRescheduleSuggestion] =
    useState<BookingSuggestion | null>(null);
  const [toastMessage, setToastMessage] = useState("");
  const [showCreatePatient, setShowCreatePatient] = useState(false);
  const [draft, setDraft] = useState<AppointmentDraft>({
    patientId: "",
    patientName: "",
    doctorId: "",
    department: "",
    room: "",
    date: selectedDate,
    slotId: "",
    service: "Dịch vụ",
    insuranceNumber: "",
    reason: "",
    note: "",
  });
  const [formError, setFormError] = useState("");
  const [pageError, setPageError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const activeDoctorId = requestedDoctorId || "";
  const selectedDoctor = mapDoctor(
    context?.doctors.find((doctor) => doctor.id === activeDoctorId) || {
      id: "",
      fullName: "Chưa chọn bác sĩ",
      departments: [],
    },
  );
  const isReceptionClosed = false;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setPageError("");
      try {
        const [nextContext, nextPatients] = await Promise.all([
          receptionApi.context(selectedDate),
          patientApi.list(),
        ]);
        if (cancelled) return;
        setContext(nextContext);
        setPatientDirectory(nextPatients.patients.map(mapPatient));
        const nextDoctorId = requestedDoctorId || "";
        if (!nextDoctorId) return;
        const [nextSlots, nextAppointments] = await Promise.all([
          slotApi.list(selectedDate, nextDoctorId),
          appointmentApi.list(selectedDate, nextDoctorId),
        ]);
        if (cancelled) return;
        const mappedSlots = nextSlots.slots.map(mapSlot);
        const mappedPatients = nextPatients.patients.map(mapPatient);
        const mappedAppointments = nextAppointments.appointments.map((item) =>
          mapAppointment(item, mappedPatients, mappedSlots),
        );
        setSlotDefinitions(mappedSlots);
        setAppointments(mappedAppointments);
        setExpandedSlotId("");
        setSelectedId((current) =>
          mappedAppointments.some((item) => item.id === current)
            ? current
            : mappedAppointments[0]?.id || "",
        );
      } catch (error) {
        if (!cancelled)
          setPageError(
            error instanceof Error
              ? error.message
              : "Không thể tải dữ liệu lịch hẹn",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(
      () => setRefreshVersion((value) => value + 1),
      30000,
    );
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [selectedDate, requestedDoctorId, refreshVersion]);

  const visibleAppointments = useMemo(
    () => appointments.filter((item) => item.doctor.id === activeDoctorId),
    [activeDoctorId, appointments],
  );
  const queue = useMemo(
    () =>
      visibleAppointments.filter(
        (item) =>
          (item.status === "WAITING" || item.status === "CONFIRMED") &&
          `${item.patient.fullName} ${item.patient.phone} ${item.patient.code} ${item.sequenceNumber}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ).sort((first, second) => {
        const firstSequence =
          first.sequenceNumber > 0 ? first.sequenceNumber : Number.MAX_SAFE_INTEGER;
        const secondSequence =
          second.sequenceNumber > 0 ? second.sequenceNumber : Number.MAX_SAFE_INTEGER;
        return (
          firstSequence - secondSequence ||
          first.startTime.localeCompare(second.startTime) ||
          Number(first.id) - Number(second.id)
        );
      }),
    [visibleAppointments, query],
  );
  const selectedAppointment =
    appointments.find((item) => item.id === selectedId) || null;
  const drawerAppointment =
    appointments.find((item) => item.id === drawerAppointmentId) || null;

  const moveDate = (amount: number) => {
    const date = new Date(`${selectedDate}T12:00:00`);
    date.setDate(date.getDate() + amount);
    setSelectedDate(date.toISOString().slice(0, 10));
  };

  const findNextScheduleSlot = async (
    sourceSlot: SlotDefinition,
    doctorId: string,
  ) => {
    const sameDayCandidate = slotDefinitions.find(
      (candidate) =>
        candidate.date === sourceSlot.date &&
        candidate.start >= sourceSlot.end &&
        candidate.bookable &&
        candidate.booked < candidate.capacity &&
        candidate.state !== "closed" &&
        candidate.state !== "full" &&
        candidate.state !== "ended",
    );
    if (sameDayCandidate) return sameDayCandidate;

    const date = new Date(`${sourceSlot.date}T12:00:00`);
    for (let offset = 1; offset <= 60; offset += 1) {
      date.setDate(date.getDate() + 1);
      const nextDate = date.toISOString().slice(0, 10);
      const response = await slotApi.list(
        nextDate,
        doctorId,
        "SCHEDULE",
      );
      const candidate = response.slots
        .map(mapSlot)
        .find(
          (item) =>
            item.bookable &&
            item.booked < item.capacity &&
            item.state !== "closed" &&
            item.state !== "full" &&
            item.state !== "ended",
        );
      if (candidate) return candidate;
    }
    return undefined;
  };

  const updateSuggestionForSlot = async (
    selectedSlot: SlotDefinition,
    doctorId: string,
  ) => {
    const requestId = suggestionRequestRef.current + 1;
    suggestionRequestRef.current = requestId;
    setBookingSuggestion(null);
    if (selectedSlot.state !== "ongoing" || selectedSlot.bookable) return;
    try {
      const suggestedSlot = await findNextScheduleSlot(selectedSlot, doctorId);
      if (requestId !== suggestionRequestRef.current) return;
      if (suggestedSlot) {
        setBookingSuggestion({
          mode: "SCHEDULED",
          slot: suggestedSlot,
          deferWalkIn: false,
        });
      } else {
        setFormError("Không còn khung giờ phù hợp trong 60 ngày tới.");
      }
    } catch (error) {
      if (requestId !== suggestionRequestRef.current) return;
      setFormError(
        error instanceof Error
          ? error.message
          : "Không thể tìm khung giờ đề xuất.",
      );
    }
  };

  const openCreate = (slot: SlotDefinition) => {
    if (
      slot.state === "ended" ||
      slot.state === "full" ||
      slot.state === "closed"
    )
      return;
    if (!activeDoctorId) return;
    const assignedRooms = [
      ...new Set(
        (context?.openSlotAssignments || [])
          .filter((item) => item.doctorId === activeDoctorId)
          .map((item) => item.roomNumber),
      ),
    ];
    if (assignedRooms.length > 1) {
      const doctor = context?.doctors.find(
        (item) => item.id === activeDoctorId,
      );
      setBookingContext(context);
      setDraft({
        patientId: "",
        patientName: "",
        doctorId: activeDoctorId,
        department:
          doctor?.departments.length === 1 ? doctor.departments[0].name : "",
        room: "",
        date: selectedDate,
        slotId: "",
        service: "Dịch vụ",
        insuranceNumber: "",
        reason: "",
        note: "",
      });
      setFormError(
        "Ngoài phạm vi MVP: bác sĩ đổi phòng nhiều lần trong ngày. Vui lòng điều chỉnh DoctorSlot trước khi tạo lịch.",
      );
      setBookingSlot(emptyBookingSlot());
      return;
    }
    setBookingSlot(slot);
    setBookingMode("SCHEDULED");
    setBookingSuggestion(null);
    const doctor = context?.doctors.find((item) => item.id === activeDoctorId);
    setBookingContext(context);
    setDraft({
      patientId: "",
      patientName: "",
      doctorId: activeDoctorId,
      department:
        doctor?.departments.length === 1 ? doctor.departments[0].name : "",
      room: slot.room,
      date: selectedDate,
      slotId: slot.id,
      service: "Dịch vụ",
      insuranceNumber: "",
      reason: "",
      note: "",
    });
    setFormError("");
    void updateSuggestionForSlot(slot, activeDoctorId);
  };

  const changeSelectedBookingSlot = (slotId: string) => {
    const selectedSlot = slotDefinitions.find((item) => item.id === slotId);
    if (!selectedSlot) return;
    setDraft((current) => ({
      ...current,
      slotId,
      room: selectedSlot.room,
    }));
    setFormError("");
    void updateSuggestionForSlot(selectedSlot, draft.doctorId);
  };

  const openCreateWithoutSlot = () => {
    setBookingSlot(emptyBookingSlot());
    setBookingSuggestion(null);
    setBookingMode("SCHEDULED");
    const doctor = context?.doctors.find((item) => item.id === activeDoctorId);
    const doctorRooms = [
      ...new Set(
        (context?.openSlotAssignments || [])
          .filter((item) => item.doctorId === activeDoctorId)
          .map((item) => item.roomNumber),
      ),
    ];
    setBookingContext(context);
    setDraft({
      patientId: "",
      patientName: "",
      doctorId: activeDoctorId,
      department:
        doctor?.departments.length === 1 ? doctor.departments[0].name : "",
      room: doctorRooms.length === 1 ? doctorRooms[0] : "",
      date: selectedDate,
      slotId: "",
      service: "Dịch vụ",
      insuranceNumber: "",
      reason: "",
      note: "",
    });
    setFormError(
      doctorRooms.length > 1
        ? "Ngoài phạm vi MVP: bác sĩ đổi phòng nhiều lần trong ngày. Vui lòng điều chỉnh DoctorSlot trước khi tạo lịch."
        : "",
    );
  };

  const changeBookingMode = async (mode: BookingMode) => {
    setBookingMode(mode);
    setBookingSuggestion(null);
    setFormError("");
    if (!draft.doctorId) return;
    try {
      const response = await slotApi.list(
        draft.date,
        draft.doctorId,
        "SCHEDULE",
      );
      const nextSlots = response.slots.map(mapSlot);
      setSlotDefinitions(nextSlots);
      setDraft((current) => ({ ...current, slotId: "" }));
      setBookingSlot(emptyBookingSlot());
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Không thể tải khung giờ",
      );
    }
  };

  const changeBookingDate = async (date: string, preserveRescheduleModal = false) => {
    if (date < todayValue()) {
      setFormError("Không thể đặt lịch trong quá khứ.");
      return;
    }
    setDraft((current) => ({ ...current, date, slotId: "", room: "" }));
    try {
      const nextContext = await receptionApi.context(date);
      setBookingContext(nextContext);
      if (!draft.doctorId) {
        setSlotDefinitions([]);
        if (!preserveRescheduleModal) setBookingSlot(emptyBookingSlot());
        return;
      }
      const doctorRooms = [
        ...new Set(
          nextContext.openSlotAssignments
            .filter((item) => item.doctorId === draft.doctorId)
            .map((item) => item.roomNumber),
        ),
      ];
      if (doctorRooms.length > 1) {
        setFormError(
          "Ngoài phạm vi MVP: bác sĩ đổi phòng nhiều lần trong ngày. Vui lòng chọn lại theo bác sĩ sau khi điều chỉnh DoctorSlot.",
        );
        return;
      }
      const response = await slotApi.list(
        date,
        draft.doctorId,
        "SCHEDULE",
      );
      const nextSlots = response.slots.map(mapSlot);
      setSlotDefinitions(nextSlots);
      if (!preserveRescheduleModal) setBookingSlot(emptyBookingSlot());
      setDraft((current) => ({
        ...current,
        slotId: "",
        room: doctorRooms[0] || "",
      }));
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Không thể tải khung giờ của ngày đã chọn",
      );
    }
  };

  const changeBookingDoctor = async (
    nextDoctorId: string,
    preferredDepartment = draft.department,
    allowMultipleRooms = false,
    preserveRescheduleModal = false,
  ) => {
    const currentContext = bookingContext || context;
    const doctor = currentContext?.doctors.find(
      (item) => item.id === nextDoctorId,
    );
    const doctorRooms = [
      ...new Set(
        (currentContext?.openSlotAssignments || [])
          .filter((item) => item.doctorId === nextDoctorId)
          .map((item) => item.roomNumber),
      ),
    ];
    const department =
      doctor?.departments.length === 1
        ? doctor.departments[0].name
        : preferredDepartment &&
            doctor?.departments.some(
              (item) => item.name === preferredDepartment,
            )
          ? preferredDepartment
          : "";
    setDraft((current) => ({
      ...current,
      doctorId: nextDoctorId,
      department,
      room: doctorRooms.length === 1 ? doctorRooms[0] : "",
      slotId: "",
    }));
    setBookingSuggestion(null);
    if (!preserveRescheduleModal) setBookingSlot(emptyBookingSlot());
    setFormError("");
    if (!nextDoctorId) {
      setSlotDefinitions([]);
      return;
    }
    if (doctorRooms.length > 1 && !allowMultipleRooms) {
      setSlotDefinitions([]);
      setFormError(
        "Ngoài phạm vi MVP: bác sĩ đổi phòng nhiều lần trong ngày. Vui lòng chọn theo bác sĩ sau khi điều chỉnh DoctorSlot.",
      );
      return;
    }
    try {
      const response = await slotApi.list(
        draft.date,
        nextDoctorId,
        "SCHEDULE",
      );
      setSlotDefinitions(response.slots.map(mapSlot));
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Không thể tải khung giờ của bác sĩ",
      );
    }
  };

  const changeBookingDepartment = async (department: string) => {
    setDraft((current) => ({ ...current, department, slotId: "" }));
    if (draft.doctorId || !department) return;
    const currentContext = bookingContext || context;
    const doctorsWithOpenSlots = new Set(
      (currentContext?.openSlotAssignments || []).map((item) => item.doctorId),
    );
    const candidates = (currentContext?.doctors || []).filter(
      (doctor) =>
        doctorsWithOpenSlots.has(doctor.id) &&
        doctor.departments.some((item) => item.name === department),
    );
    if (candidates.length === 1)
      await changeBookingDoctor(candidates[0].id, department);
  };

  const changeBookingRoom = async (room: string) => {
    if (draft.doctorId || !room) return;
    const currentContext = bookingContext || context;
    const doctorIds = [
      ...new Set(
        (currentContext?.openSlotAssignments || [])
          .filter((item) => item.roomNumber === room)
          .map((item) => item.doctorId),
      ),
    ];
    if (doctorIds.length > 1) {
      setDraft((current) => ({
        ...current,
        doctorId: "",
        department: "",
        room: "",
        slotId: "",
      }));
      setFormError(
        "Ngoài phạm vi MVP: nhiều bác sĩ luân phiên dùng chung một phòng trong ngày. Vui lòng chọn theo bác sĩ.",
      );
      return;
    }
    if (doctorIds.length === 1) await changeBookingDoctor(doctorIds[0]);
  };

  const createAppointment = async (
    selectedSlot: SlotDefinition,
    actionMode: BookingMode,
  ) => {
    const doctor = context?.doctors.find((item) => item.id === draft.doctorId);
    const departmentOption = doctor?.departments.find(
      (item) => item.name === draft.department,
    );
    if (
      !draft.doctorId ||
      !draft.patientId ||
      !draft.department ||
      !draft.room ||
      !draft.date ||
      draft.date < todayValue() ||
      !draft.reason.trim() ||
      (draft.service === "BHYT" && !draft.insuranceNumber.trim())
    ) {
      setFormError("Vui lòng chọn bác sĩ và điền đầy đủ thông tin bắt buộc.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const response = await appointmentApi.create({
        patientId: Number(draft.patientId),
        doctorId: Number(draft.doctorId),
        ...( /^\d+$/.test(selectedSlot.id)
          ? { slotId: Number(selectedSlot.id) }
          : { slotKey: selectedSlot.id }),
        departmentId: departmentOption?.id,
        bookingType: actionMode === "IMMEDIATE" ? "WALK_IN" : "SCHEDULE",
        patientType: draft.service === "BHYT" ? "BHYT" : "SERVICE",
        bhytNumber:
          draft.service === "BHYT" ? draft.insuranceNumber.trim() : undefined,
        reason: draft.reason.trim(),
      });
      const created = mapAppointment(
        response.appointment,
        patientDirectory,
        slotDefinitions,
      );
      setBookingSuggestion(null);
      setBookingSlot(null);
      setSelectedId(created.id);
      setPrintAppointment(created);
      setRefreshVersion((value) => value + 1);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Không thể tạo lịch hẹn",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLElement | null;
    const actionMode: BookingMode =
      submitter?.textContent?.includes("Khám ngay") ||
      submitter?.textContent?.includes("Xếp vào khung")
        ? "IMMEDIATE"
        : "SCHEDULED";
    if (
      !draft.doctorId ||
      !draft.patientId ||
      !draft.department ||
      !draft.room ||
      !draft.date ||
      draft.date < todayValue() ||
      !draft.reason.trim() ||
      (draft.service === "BHYT" && !draft.insuranceNumber.trim())
    ) {
      setFormError("Vui lòng điền đầy đủ thông tin bắt buộc.");
      return;
    }
    const selectedSlot = draft.slotId
      ? slotDefinitions.find((slot) => slot.id === draft.slotId)
      : undefined;
    if (selectedSlot) {
      if (actionMode === "SCHEDULED" && !selectedSlot.bookable) {
        setFormError(
          `Khung ${selectedSlot.start} - ${selectedSlot.end} không còn hợp lệ. Vui lòng chọn khung khác.`,
        );
        return;
      }
      if (actionMode === "IMMEDIATE" && !isSlotAvailable(selectedSlot)) {
        setFormError(
          "Khung giờ đã chọn không còn chỗ. Vui lòng chọn khung khác.",
        );
        return;
      }
      await createAppointment(selectedSlot, actionMode);
      return;
    }

    setSaving(true);
    try {
      const response = await slotApi.list(
        draft.date,
        draft.doctorId,
        "SCHEDULE",
      );
      const nextSlots = response.slots.map(mapSlot);
      setSlotDefinitions(nextSlots);
      const currentSlot = nextSlots.find(
        (slot) => slot.state === "ongoing" && isSlotAvailable(slot),
      );
      const nextAvailableSlot = nextSlots.find(
        (slot) => slot.state === "available" && isSlotAvailable(slot),
      );
      const candidate =
        actionMode === "IMMEDIATE"
          ? currentSlot || nextAvailableSlot
          : nextSlots.find((slot) => slot.bookable && isSlotAvailable(slot));
      if (!candidate) {
        setFormError("Không còn slot tiếp nhận phù hợp.");
        return;
      }
      // Keep the suggestion separate from the user's selected slot. This lets
      // the other action re-run its own rules instead of silently booking the
      // suggested slot.
      setDraft((current) => ({
        ...current,
        slotId: "",
        room: candidate.room,
      }));
      setBookingSlot(candidate);
      setBookingSuggestion({
        mode: actionMode,
        slot: candidate,
        deferWalkIn:
          actionMode === "IMMEDIATE" && candidate.state !== "ongoing",
      });
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Không thể tìm khung giờ phù hợp",
      );
    } finally {
      setSaving(false);
    }
  };

  const confirmSuggestedBooking = () => {
    if (!bookingSuggestion) return;
    void createAppointment(bookingSuggestion.slot, bookingSuggestion.mode);
  };

  const addPatient = () => {
    setFormError("");
    setShowCreatePatient(true);
  };

  const selectCreatedPatient = (patient: ApiPatient) => {
    const createdPatient = mapPatient(patient);
    setPatientDirectory((current) => [
      createdPatient,
      ...current.filter((item) => item.id !== createdPatient.id),
    ]);
    setDraft((current) => ({
      ...current,
      patientId: createdPatient.id,
      patientName: createdPatient.fullName,
      insuranceNumber: createdPatient.insuranceNumber || "",
    }));
    setShowCreatePatient(false);
    setFormError("");
  };

  const updateStatus = async (next: AppointmentStatus) => {
    if (!selectedId) return;
    if (next === "CANCELLED") {
      setCancelTarget(selectedAppointment);
      return;
    }
    try {
      if (next === "WAITING") await appointmentApi.checkIn(Number(selectedId));
      setRefreshVersion((value) => value + 1);
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Không thể cập nhật trạng thái lịch hẹn",
      );
    }
  };

  const savePatient = async (values: {
    fullName: string;
    phone: string;
    email: string;
    cccd: string;
    insuranceNumber: string;
    address: string;
  }) => {
    if (!patientEditTarget) return;
    setSaving(true);
    try {
      const response = await patientApi.update(
        Number(patientEditTarget.patient.id),
        {
          full_name: values.fullName.trim(),
          phone: values.phone.trim(),
          email: values.email.trim(),
          cccd: values.cccd.trim(),
          insurance_number: values.insuranceNumber.trim(),
          address: values.address.trim(),
        },
      );
      const updated = mapPatient(response.patient);
      setPatientDirectory((current) =>
        current.map((patient) =>
          patient.id === updated.id ? { ...patient, ...updated } : patient,
        ),
      );
      setAppointments((current) =>
        current.map((appointment) =>
          appointment.patient.id === updated.id
            ? {
                ...appointment,
                patient: { ...appointment.patient, ...updated },
              }
            : appointment,
        ),
      );
      setPatientEditTarget(null);
    } finally {
      setSaving(false);
    }
  };

  const saveAppointmentReason = async (reason: string) => {
    if (!appointmentEditTarget) return;
    setSaving(true);
    try {
      await appointmentApi.update(Number(appointmentEditTarget.id), {
        reason: reason.trim(),
      });
      setAppointments((current) =>
        current.map((appointment) =>
          appointment.id === appointmentEditTarget.id
            ? { ...appointment, reason: reason.trim() }
            : appointment,
        ),
      );
      setAppointmentEditTarget(null);
    } finally {
      setSaving(false);
    }
  };

  const openReschedule = (appointment: Appointment) => {
    setBookingContext(context);
    setBookingMode("SCHEDULED");
    setBookingSuggestion(null);
    setDraft({
      patientId: appointment.patient.id,
      patientName: appointment.patient.fullName,
      doctorId: appointment.doctor.id,
      department: appointment.doctor.department,
      room: appointment.room,
      date: appointment.startTime.slice(0, 10),
      slotId: appointment.slotId,
      service: appointment.insuranceNumber ? "BHYT" : "Dịch vụ",
      insuranceNumber: appointment.insuranceNumber || "",
      reason: appointment.reason,
      note: "",
    });
    setFormError("");
    setRescheduleTarget(appointment);
    setRescheduleSuggestion(null);
    if (appointment.slotId && !slotDefinitions.some((item) => item.id === appointment.slotId)) {
      void slotApi.list(appointment.startTime.slice(0, 10), appointment.doctor.id, "SCHEDULE")
        .then((response) => setSlotDefinitions(response.slots.map(mapSlot)))
        .catch((error) => setFormError(error instanceof Error ? error.message : "Không thể tải khung giờ"));
    }
  };

  const saveReschedule = async (event: FormEvent) => {
    event.preventDefault();
    const targetSlotId = rescheduleSuggestion?.slot.id || draft.slotId;
    if (!rescheduleTarget || !draft.reason.trim() || !targetSlotId) {
      setFormError("Vui lòng chọn khung giờ và nhập lý do khám.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const body = {
        reason: draft.reason.trim(),
        doctorId: Number(draft.doctorId),
        departmentId: context?.doctors
          .find((doctor) => doctor.id === draft.doctorId)
          ?.departments.find((department) => department.name === draft.department)?.id,
        ...( /^\d+$/.test(targetSlotId)
          ? { slotId: Number(targetSlotId) }
          : { slotKey: targetSlotId }),
      };
      const response = await appointmentApi.update(Number(rescheduleTarget.id), body);
      const updated = mapAppointment(response.appointment, patientDirectory, slotDefinitions);
      setAppointments((current) => current.map((item) => item.id === updated.id ? updated : item));
      setSelectedId(updated.id);
      setRescheduleTarget(null);
      setRescheduleSuggestion(null);
      setRefreshVersion((value) => value + 1);
    } catch (error) {
      if (
        error instanceof AppointmentApiError &&
        (error.code === "INVALID_STATUS_FOR_UPDATE" ||
          error.code === "RESCHEDULE_NOT_ALLOWED")
      ) {
        setRescheduleTarget(null);
        setToastMessage("Lịch hẹn đã được cập nhật ở nơi khác, vui lòng tải lại");
        setRefreshVersion((value) => value + 1);
      } else if (
        error instanceof AppointmentApiError &&
        (error.code === "SLOT_NOT_AVAILABLE" ||
          error.code === "SLOT_RESCHEDULE_CONFLICT")
      ) {
        const suggested = error.details?.suggestedSlot as ApiSlot | undefined;
        if (suggested) {
          const mappedSuggestion = mapSlot(suggested);
          setRescheduleSuggestion({
            mode: "SCHEDULED",
            slot: mappedSuggestion,
            deferWalkIn: false,
          });
          setSlotDefinitions((current) => [
            ...current.filter((slot) => slot.id !== mappedSuggestion.id),
            mappedSuggestion,
          ].sort(
            (first, second) =>
              `${first.date}T${first.start}`.localeCompare(
                `${second.date}T${second.start}`,
              ),
          ));
        }
        setFormError(error.message);
      } else {
        setFormError(
          error instanceof Error
            ? error.message
            : "Không thể cập nhật lịch hẹn",
        );
      }
    } finally {
      setSaving(false);
    }
  };

  if (!requestedDoctorId) {
    return (
      <>
        <AppointmentOverview
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          onCreate={openCreateWithoutSlot}
          onViewDoctor={(id) => setSearchParams({ doctorId: id })}
          context={context}
          loading={loading}
          error={pageError}
          receptionClosed={isReceptionClosed}
          departmentFilter={overviewDepartment}
          onDepartmentFilterChange={setOverviewDepartment}
          doctorFilter={overviewDoctor}
          onDoctorFilterChange={setOverviewDoctor}
          slotStatusFilter={overviewSlotStatus}
          onSlotStatusFilterChange={setOverviewSlotStatus}
        />
        {bookingSlot && (
          <CreateAppointmentModal
            patients={patientDirectory}
            doctors={(bookingContext || context)?.doctors || []}
            departments={(bookingContext || context)?.departments || []}
            rooms={(bookingContext || context)?.rooms || []}
            assignments={(bookingContext || context)?.openSlotAssignments || []}
            doctorLocked={false}
            draft={draft}
            setDraft={setDraft}
            slots={slotDefinitions}
            slot={bookingSlot}
            mode={bookingMode}
            setMode={changeBookingMode}
            onDateChange={changeBookingDate}
            onDoctorChange={changeBookingDoctor}
            onDepartmentChange={changeBookingDepartment}
            onRoomChange={changeBookingRoom}
            onSlotChange={changeSelectedBookingSlot}
            suggestedSlot={bookingSuggestion}
            onConfirmSuggestion={confirmSuggestedBooking}
            onAddPatient={addPatient}
            onClose={() => setBookingSlot(null)}
            onSubmit={handleCreate}
            error={formError}
            saving={saving}
          />
        )}
        {showCreatePatient && (
          <CreatePatientModal
            onClose={() => setShowCreatePatient(false)}
            onCreated={selectCreatedPatient}
          />
        )}
        {cancelTarget && (
          <CancellationModal
            appointment={cancelTarget}
            saving={saving}
            onClose={() => setCancelTarget(null)}
            onConfirm={async (reason, note) => {
              setSaving(true);
              try {
                await appointmentApi.cancel(
                  Number(cancelTarget.id),
                  reason,
                  note,
                );
                setCancelTarget(null);
                setRefreshVersion((value) => value + 1);
              } catch (error) {
                setPageError(
                  error instanceof Error
                    ? error.message
                    : "Không thể hủy lịch hẹn",
                );
              } finally {
                setSaving(false);
              }
            }}
          />
        )}
        {printAppointment && (
          <PrintTicket
            appointment={printAppointment}
            onClose={() => setPrintAppointment(null)}
          />
        )}
      </>
    );
  }

  return (
    <div className="appointments-page appointments-redesign">
      <header className="appointments-heading">
        <div>
          <button
            className="appointment-back-button"
            onClick={() => navigate("/appointments")}
          >
            ← Tổng quan lịch hẹn
          </button>
          <h1 className="page-title">Lịch hẹn</h1>
          <p className="page-subtitle">
            Lịch khám chi tiết của {selectedDoctor.fullName}.
          </p>
        </div>
        <button
          className="btn btn-primary appointments-create-btn"
          onClick={openCreateWithoutSlot}
          disabled={isReceptionClosed}
        >
          <Plus size={18} /> Tạo lịch hẹn <ChevronDown size={15} />
        </button>
      </header>
      <nav className="appointment-tabs">
        <button onClick={() => navigate("/appointments")}>
          Tổng quan lịch hẹn
        </button>
        <button className="active">Lịch chi tiết</button>
        <button>Bảng tuần</button>
        <button>Bảng ngày</button>
      </nav>
      <div className="appointment-toolbar screenshot-toolbar">
        <div className="date-controls">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setSelectedDate(todayValue())}
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
          <QuickDatePicker selectedDate={selectedDate} onSelect={setSelectedDate} />
        </div>
        <div className="appointment-filters">
          <label className="locked-filter">
            <Stethoscope size={15} />
            <select
              value={activeDoctorId}
              disabled
              aria-label="Bác sĩ đang xem"
            >
              <option>{selectedDoctor.fullName}</option>
            </select>
          </label>
          <label className="locked-filter">
            <Filter size={15} />
            <select
              value={selectedDoctor.department}
              disabled
              aria-label="Khoa của bác sĩ đang xem"
            >
              <option>{selectedDoctor.department}</option>
            </select>
          </label>
          <button className="icon-button" aria-label="Cài đặt bộ lọc">
            <Settings2 size={17} />
          </button>
        </div>
      </div>
      {pageError && <div className="form-error">{pageError}</div>}
      <main className="appointments-grid">
        <section className="slot-panel reception-slot-panel">
          <div className="slot-panel-header">
            <div>
              <h2>{selectedDoctor.fullName}</h2>
              <p>{selectedDoctor.department} · Lịch dự kiến</p>
            </div>
            <div className="slot-refresh">
              <span>
                <Clock3 size={15} /> Cập nhật tự động mỗi 30 giây
              </span>
              <button
                className="icon-button"
                aria-label="Làm mới"
                onClick={() => setRefreshVersion((value) => value + 1)}
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>
          <div className="slot-legend">
            <span>
              <i className="legend-dot available" /> Còn chỗ
            </span>
            <span>
              <i className="legend-dot full" /> Full
            </span>
            <span>
              <i className="legend-dot ended" /> Đã qua
            </span>
            <span>
              <LockKeyhole size={13} /> Đã khóa
            </span>
          </div>
          <div className="slot-table-head">
            <span>Khung giờ</span>
            <span>Số suất</span>
            <span>Thao tác</span>
          </div>
          <div className="slot-list">
            {slotDefinitions.map((slot) => (
              <SlotRow
                key={slot.id}
                slot={slot}
                appointments={appointments.filter(
                  (item) => item.slotId === slot.id,
                )}
                expanded={expandedSlotId === slot.id}
                onToggle={() =>
                  setExpandedSlotId((current) =>
                    current === slot.id ? "" : slot.id,
                  )
                }
                onSelectAppointment={setSelectedId}
                selectedId={selectedId}
                onCreate={openCreate}
                receptionClosed={isReceptionClosed}
              />
            ))}
          </div>
          <div className="slot-footer-note">
            <Clock3 size={14} /> Ngừng tiếp nhận bệnh nhân mới từ 16:00 mỗi
            ngày.
          </div>
        </section>
        <aside className="appointments-side">
          <section className="queue-panel">
            <div className="side-panel-title">
              <h2>Danh sách chờ</h2>
            </div>
            <label className="queue-search">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm tên, SĐT, mã BN hoặc số khám..."
              />
            </label>
            <div className="queue-tabs">
              <button
                className={queueTab === "WAITING" ? "active" : ""}
                onClick={() => setQueueTab("WAITING")}
              >
                Đang chờ (
                {queue.filter((item) => item.status === "WAITING").length})
              </button>
              <button
                className={queueTab === "CONFIRMED" ? "active" : ""}
                onClick={() => setQueueTab("CONFIRMED")}
              >
                Đã xác nhận (
                {queue.filter((item) => item.status === "CONFIRMED").length})
              </button>
            </div>
            <QueueGroup
              items={queue.filter((item) => item.status === queueTab)}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </section>
          <AppointmentDetail
            appointment={selectedAppointment}
            onOpenProfile={(id) => {
              setSelectedId(id);
              setDrawerAppointmentId(id);
            }}
            onEditPatient={() =>
              selectedAppointment && setPatientEditTarget(selectedAppointment)
            }
            onEditAppointment={() =>
              selectedAppointment &&
              openReschedule(selectedAppointment)
            }
            onStatusChange={updateStatus}
          />
        </aside>
      </main>
      <div className="mock-api-hint">
        <span className="mock-dot" /> Dữ liệu đồng bộ từ hệ thống
      </div>
      <span className="sr-only">
        Đang đăng nhập: {user?.fullName || "Lễ tân"}
      </span>
      {bookingSlot && (
        <CreateAppointmentModal
          patients={patientDirectory}
          doctors={(bookingContext || context)?.doctors || []}
          departments={(bookingContext || context)?.departments || []}
          rooms={(bookingContext || context)?.rooms || []}
          assignments={(bookingContext || context)?.openSlotAssignments || []}
          doctorLocked={false}
          showAllDoctors
          draft={draft}
          setDraft={setDraft}
          slots={slotDefinitions}
          slot={bookingSlot}
          mode={bookingMode}
          setMode={changeBookingMode}
          onDateChange={changeBookingDate}
          onDoctorChange={changeBookingDoctor}
          onDepartmentChange={changeBookingDepartment}
          onRoomChange={changeBookingRoom}
          onSlotChange={changeSelectedBookingSlot}
          suggestedSlot={bookingSuggestion}
          onConfirmSuggestion={confirmSuggestedBooking}
          onAddPatient={addPatient}
          onClose={() => setBookingSlot(null)}
          onSubmit={handleCreate}
          error={formError}
          saving={saving}
        />
      )}
      {showCreatePatient && (
        <CreatePatientModal
          onClose={() => setShowCreatePatient(false)}
          onCreated={selectCreatedPatient}
        />
      )}
      {cancelTarget && (
        <CancellationModal
          appointment={cancelTarget}
          saving={saving}
          onClose={() => setCancelTarget(null)}
          onConfirm={async (reason, note) => {
            setSaving(true);
            try {
              await appointmentApi.cancel(
                Number(cancelTarget.id),
                reason,
                note,
              );
              setCancelTarget(null);
              setRefreshVersion((value) => value + 1);
            } catch (error) {
              setPageError(
                error instanceof Error
                  ? error.message
                  : "Không thể hủy lịch hẹn",
              );
            } finally {
              setSaving(false);
            }
          }}
        />
      )}
      {patientEditTarget && (
        <PatientQuickEditModal
          appointment={patientEditTarget}
          saving={saving}
          onClose={() => setPatientEditTarget(null)}
          onSave={savePatient}
        />
      )}
      {appointmentEditTarget && (
        <AppointmentQuickEditModal
          appointment={appointmentEditTarget}
          saving={saving}
          onClose={() => setAppointmentEditTarget(null)}
          onSave={saveAppointmentReason}
        />
      )}
      {rescheduleTarget && (
        <RescheduleAppointmentModal
          appointment={rescheduleTarget}
          draft={draft}
          setDraft={setDraft}
          doctors={(bookingContext || context)?.doctors || []}
          departments={(bookingContext || context)?.departments || []}
          rooms={(bookingContext || context)?.rooms || []}
          assignments={(bookingContext || context)?.openSlotAssignments || []}
          slots={slotDefinitions}
          suggestedSlot={rescheduleSuggestion}
          onDoctorChange={(doctorId) => {
            setRescheduleSuggestion(null);
            void changeBookingDoctor(doctorId, draft.department, true, true);
          }}
          onDepartmentChange={changeBookingDepartment}
          onDateChange={(date) => {
            setRescheduleSuggestion(null);
            void changeBookingDate(date, true);
          }}
          onSlotChange={(slotId) => {
            if (rescheduleSuggestion && slotId !== rescheduleSuggestion.slot.id) {
              setRescheduleSuggestion(null);
            }
            changeSelectedBookingSlot(slotId);
          }}
          onClose={() => setRescheduleTarget(null)}
          onSubmit={saveReschedule}
          error={formError}
          saving={saving}
        />
      )}
      {toastMessage && (
        <div className="doctor-toast" role="status">
          {toastMessage}
          <button type="button" className="icon-button" onClick={() => setToastMessage("")} aria-label="Đóng thông báo">
            <X size={14} />
          </button>
        </div>
      )}
      {drawerAppointment && (
        <ReceptionistPatientDrawer
          appointment={drawerAppointment}
          onClose={() => setDrawerAppointmentId(null)}
        />
      )}
      {printAppointment && (
        <PrintTicket
          appointment={printAppointment}
          onClose={() => setPrintAppointment(null)}
        />
      )}
    </div>
  );
}
