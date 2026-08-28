import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import type {
  Appointment,
  AppointmentInput,
  AppointmentStatus,
  DoctorOption,
  Patient,
  VisitReasonOption,
} from "shared";
import { appointmentApi, patientApi } from "../api/client";
import { useNavigate } from "react-router-dom";

const columns: { status: AppointmentStatus; label: string; icon: string }[] = [
  { status: "BOOKED", label: "محجوز", icon: "◷" },
  { status: "ARRIVED", label: "وصل", icon: "✓" },
  { status: "WAITING", label: "بانتظار الدخول", icon: "…" },
  { status: "WITH_DOCTOR", label: "عند الدكتورة", icon: "✚" },
  { status: "COMPLETED", label: "انتهت الزيارة", icon: "✓" },
];
const nextStatus: Partial<Record<AppointmentStatus, AppointmentStatus>> = {
  BOOKED: "ARRIVED",
  ARRIVED: "WAITING",
  WAITING: "WITH_DOCTOR",
  WITH_DOCTOR: "COMPLETED",
};
const nextLabel: Partial<Record<AppointmentStatus, string>> = {
  BOOKED: "تسجيل الوصول",
  ARRIVED: "إلى الانتظار",
  WAITING: "إدخال للدكتورة",
  WITH_DOCTOR: "إنهاء الزيارة",
};
const dayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return [start.toISOString(), end.toISOString()] as const;
};
const padNumber = (value: number) => String(value).padStart(2, "0");
const defaultSlot = () => {
  const date = new Date();
  const minutesUntilNextSlot = 30 - (date.getMinutes() % 30);
  date.setMinutes(date.getMinutes() + minutesUntilNextSlot, 0, 0);
  return {
    date: `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`,
    time: `${padNumber(date.getHours())}:${padNumber(date.getMinutes())}`,
  };
};

export default function Home() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [totalPatients, setTotalPatients] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{
    message: string;
    appointmentId?: string;
  } | null>(null);
  const [clock, setClock] = useState(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientQuery, setPatientQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [reasons, setReasons] = useState<VisitReasonOption[]>([]);
  const [reasonQuery, setReasonQuery] = useState("");
  const [selectedReason, setSelectedReason] =
    useState<VisitReasonOption | null>(null);
  const [saving, setSaving] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [form, setForm] = useState<Omit<AppointmentInput, "patientId">>({
    startAt: "",
    durationMinutes: 30,
    priority: "NORMAL",
    receptionNotes: "",
    additionalNotes: "",
  });
  const [initialSlot] = useState(defaultSlot);
  const [date, setDate] = useState(initialSlot.date);
  const [time, setTime] = useState(initialSlot.time);

  async function load() {
    setLoading(true);
    try {
      const [from, to] = dayRange();
      const [appointmentResult, patientResult, options] = await Promise.all([
        appointmentApi.list(from, to),
        patientApi.list({ pageSize: 10 }),
        appointmentApi.options(),
      ]);
      setAppointments(appointmentResult.items);
      setTotalPatients(patientResult.total);
      setDoctors(options.doctors);
      setReasons(options.reasons);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => setClock(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!modalOpen || patientQuery.length < 2) {
      setPatients([]);
      return;
    }
    const timer = window.setTimeout(
      () =>
        patientApi
          .list({ query: patientQuery, pageSize: 8 })
          .then((result) => setPatients(result.items)),
      220,
    );
    return () => window.clearTimeout(timer);
  }, [patientQuery, modalOpen]);
  const filteredReasons = useMemo(
    () =>
      reasons
        .filter(
          (reason) =>
            !reasonQuery ||
            `${reason.nameAr} ${reason.category}`.includes(reasonQuery),
        )
        .slice(0, 12),
    [reasons, reasonQuery],
  );
  const stats = {
    total: appointments.length,
    arrived: appointments.filter((a) => a.status === "ARRIVED").length,
    waiting: appointments.filter((a) => a.status === "WAITING").length,
    withDoctor: appointments.filter((a) => a.status === "WITH_DOCTOR").length,
    completed: appointments.filter((a) => a.status === "COMPLETED").length,
    late: appointments.filter(
      (a) => a.status === "BOOKED" && new Date(a.startAt) < clock,
    ).length,
    noShow: appointments.filter((a) => a.status === "NO_SHOW").length,
  };

  function replaceAppointment(updated: Appointment) {
    const apply = () =>
      setAppointments((items) =>
        items.map((item) => (item.id === updated.id ? updated : item)),
      );
    const documentWithTransition = document as Document & {
      startViewTransition?: (callback: () => void) => void;
    };
    if (documentWithTransition.startViewTransition)
      documentWithTransition.startViewTransition(apply);
    else apply();
  }
  async function changeStatus(
    appointment: Appointment,
    status: AppointmentStatus,
  ) {
    try {
      const result = await appointmentApi.status(appointment.id, status);
      replaceAppointment(result.appointment);
      setToast({ message: result.message, appointmentId: appointment.id });
    } catch (requestError) {
      setError((requestError as Error).message);
    }
  }
  async function undo() {
    if (!toast?.appointmentId) return;
    try {
      const result = await appointmentApi.undoStatus(toast.appointmentId);
      replaceAppointment(result.appointment);
      setToast({ message: result.message });
    } catch (requestError) {
      setError((requestError as Error).message);
    }
  }
  function openNew() {
    const nextSlot = defaultSlot();
    setSelectedPatient(null);
    setPatientQuery("");
    setSelectedReason(null);
    setReasonQuery("");
    setForm({
      startAt: "",
      durationMinutes: 30,
      priority: "NORMAL",
      receptionNotes: "",
      additionalNotes: "",
    });
    setDate(nextSlot.date);
    setTime(nextSlot.time);
    setBookingError("");
    setModalOpen(true);
  }
  async function createAppointment(event: FormEvent) {
    event.preventDefault();
    setBookingError("");
    if (!selectedPatient || !selectedReason) {
      setBookingError("اختر المريض وسبب الزيارة.");
      return;
    }
    if (doctors.length > 1 && !form.doctorId) {
      setBookingError("اختر الطبيب المسؤول عن الموعد.");
      return;
    }
    if (!date || !time) {
      setBookingError("اختر تاريخ الموعد ووقته.");
      return;
    }
    const appointmentDate = new Date(`${date}T${time}:00`);
    if (Number.isNaN(appointmentDate.getTime())) {
      setBookingError("التاريخ أو الوقت غير صحيح، يرجى اختيارهما مجدداً.");
      return;
    }
    if (appointmentDate.getTime() < Date.now() - 60_000) {
      setBookingError("لا يمكن حجز موعد في وقت مضى، يرجى اختيار وقت لاحق.");
      return;
    }
    setSaving(true);
    try {
      const startAt = appointmentDate.toISOString();
      const result = await appointmentApi.create({
        ...form,
        patientId: selectedPatient.id,
        visitReasonId: selectedReason.id,
        startAt,
        doctorId: doctors.length > 1 ? form.doctorId : undefined,
      });
      setAppointments((items) =>
        [...items, result.appointment].sort((a, b) =>
          a.startAt.localeCompare(b.startAt),
        ),
      );
      setToast({ message: result.message });
      setModalOpen(false);
    } catch (requestError) {
      setBookingError((requestError as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack dashboard-page">
      <div className="dashboard-heading">
        <div>
          <span className="eyebrow">لوحة الاستقبال</span>
          <h1>صباح الخير، د. رغد</h1>
          <p>
            {new Intl.DateTimeFormat("ar-JO", { dateStyle: "full" }).format(
              clock,
            )}{" "}
            ·{" "}
            {new Intl.DateTimeFormat("ar-JO", { timeStyle: "short" }).format(
              clock,
            )}
          </p>
        </div>
        <button className="button primary" onClick={openNew}>
          ＋ موعد جديد
        </button>
      </div>
      {error && (
        <div className="alert error" role="alert">
          <span>!</span>
          {error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}
      <div className="dashboard-stats">
        {[
          ["مواعيد اليوم", stats.total, "◷"],
          ["وصلوا", stats.arrived, "✓"],
          ["المنتظرون", stats.waiting, "…"],
          ["عند الدكتورة", stats.withDoctor, "✚"],
          ["مكتملة", stats.completed, "✓"],
          ["متأخرون", stats.late, "!"],
          ["لم يحضروا", stats.noShow, "×"],
        ].map(([label, value, icon]) => (
          <article key={String(label)}>
            <span>{icon}</span>
            <div>
              <strong>{value}</strong>
              <small>{label}</small>
            </div>
          </article>
        ))}
      </div>
      <section className="dashboard-quick-actions" aria-label="إجراءات سريعة">
        <button onClick={openNew}>
          <span>＋</span>
          <b>موعد جديد</b>
        </button>
        <button onClick={() => navigate("/patients?new=1")}>
          <span>♙</span>
          <b>مريض جديد</b>
        </button>
        <button onClick={() => navigate("/patients")}>
          <span>⌕</span>
          <b>البحث عن مريض</b>
        </button>
        <button onClick={() => navigate("/calendar")}>
          <span>▦</span>
          <b>التقويم</b>
        </button>
        <button onClick={() => navigate("/operations")}>
          <span>☷</span>
          <b>الانتظار والمتابعات</b>
        </button>
        <button onClick={() => navigate("/operations")}>
          <span>◈</span>
          <b>التقارير</b>
        </button>
      </section>
      <section className="today-board">
        <div className="board-heading">
          <div>
            <h2>مسار مواعيد اليوم</h2>
            <p>غيّري الحالة وسيتم حفظها ونقل البطاقة تلقائيًا.</p>
          </div>
          <span>{totalPatients} مريضًا في النظام</span>
        </div>
        {loading ? (
          <div className="board-loading">
            {columns.map((column) => (
              <div key={column.status} className="board-skeleton" />
            ))}
          </div>
        ) : (
          <div className="appointment-board">
            {columns.map((column) => {
              const items = appointments.filter(
                (appointment) => appointment.status === column.status,
              );
              return (
                <section
                  className={`status-column status-${column.status.toLowerCase()}`}
                  key={column.status}
                >
                  <header>
                    <span>{column.icon}</span>
                    <h3>{column.label}</h3>
                    <b>{items.length}</b>
                  </header>
                  <div className="status-list">
                    {items.length === 0 ? (
                      <div className="column-empty">لا توجد مواعيد</div>
                    ) : (
                      items.map((appointment) => (
                        <article
                          className="appointment-card"
                          key={appointment.id}
                          style={
                            {
                              viewTransitionName: `appointment-${appointment.id}`,
                            } as CSSProperties
                          }
                        >
                          <div className="appointment-time">
                            <strong>
                              {new Date(appointment.startAt).toLocaleTimeString(
                                "ar-JO",
                                { hour: "2-digit", minute: "2-digit" },
                              )}
                            </strong>
                            <span>{appointment.durationMinutes} دقيقة</span>
                          </div>
                          <button
                            className="patient-link"
                            onClick={() =>
                              navigate(`/patients/${appointment.patientId}`)
                            }
                          >
                            {appointment.patientName}
                          </button>
                          <p>{appointment.reason}</p>
                          <div className="appointment-meta">
                            <span
                              className={`priority priority-${appointment.priority.toLowerCase()}`}
                            >
                              {appointment.priority === "NORMAL"
                                ? "عادي"
                                : appointment.priority === "URGENT"
                                  ? "مستعجل"
                                  : "طارئ"}
                            </span>
                            {appointment.hasAllergies && (
                              <span className="flag allergy">! حساسية</span>
                            )}
                            {appointment.hasChronicConditions && (
                              <span className="flag chronic">● مزمن</span>
                            )}
                          </div>
                          {nextStatus[appointment.status] && (
                            <button
                              className="card-action"
                              onClick={() =>
                                void changeStatus(
                                  appointment,
                                  nextStatus[appointment.status]!,
                                )
                              }
                            >
                              {nextLabel[appointment.status]} ←
                            </button>
                          )}
                          {appointment.status === "BOOKED" && (
                            <button
                              className="no-show-action"
                              onClick={() =>
                                void changeStatus(appointment, "NO_SHOW")
                              }
                            >
                              لم يحضر
                            </button>
                          )}
                        </article>
                      ))
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </section>
      {toast && (
        <div className="toast" role="status">
          <span>✓</span>
          <p>{toast.message}</p>
          {toast.appointmentId && (
            <button onClick={() => void undo()}>تراجع</button>
          )}
          <button className="toast-close" onClick={() => setToast(null)}>
            ×
          </button>
        </div>
      )}
      {modalOpen && (
        <div className="modal-backdrop">
          <section
            className="modal appointment-modal"
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-header">
              <div>
                <span className="eyebrow">حجز سريع</span>
                <h2>موعد جديد</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setModalOpen(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={createAppointment} noValidate>
              <div className="booking-step">
                <h3>
                  <span>1</span> المريض
                </h3>
                {selectedPatient ? (
                  <div className="selected-option">
                    <div>
                      <strong>{selectedPatient.fullName}</strong>
                      <small>
                        {selectedPatient.medicalNumber} ·{" "}
                        {selectedPatient.phone}
                      </small>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPatient(null)}
                    >
                      تغيير
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      className="standalone-input"
                      value={patientQuery}
                      onChange={(event) => setPatientQuery(event.target.value)}
                      placeholder="ابحث بالاسم أو الهاتف أو رقم الملف"
                      autoFocus
                    />
                    <div className="option-results">
                      {patients.map((patient) => (
                        <button
                          type="button"
                          key={patient.id}
                          onClick={() => setSelectedPatient(patient)}
                        >
                          <strong>{patient.fullName}</strong>
                          <small>
                            {patient.medicalNumber} · {patient.phone}
                          </small>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="booking-step">
                <h3>
                  <span>2</span> الموعد
                </h3>
                <div className="form-grid">
                  <label>
                    التاريخ
                    <input
                      type="date"
                      value={date}
                      onChange={(event) => {
                        setDate(event.target.value);
                        setBookingError("");
                      }}
                    />
                  </label>
                  <label>
                    الوقت
                    <input
                      type="time"
                      step="1800"
                      value={time}
                      onChange={(event) => {
                        setTime(event.target.value);
                        setBookingError("");
                      }}
                    />
                  </label>
                  <label>
                    المدة
                    <select
                      value={form.durationMinutes}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          durationMinutes: Number(event.target.value),
                        })
                      }
                    >
                      {[15, 20, 30, 45, 60].map((duration) => (
                        <option key={duration} value={duration}>
                          {duration} دقيقة
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    الأولوية
                    <select
                      value={form.priority}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          priority: event.target
                            .value as AppointmentInput["priority"],
                        })
                      }
                    >
                      <option value="NORMAL">عادي</option>
                      <option value="URGENT">مستعجل</option>
                      <option value="EMERGENCY">طارئ</option>
                    </select>
                  </label>
                  {doctors.length > 1 && (
                    <label className="full">
                      الطبيب
                      <select
                        value={form.doctorId || ""}
                        onChange={(event) =>
                          setForm({ ...form, doctorId: event.target.value })
                        }
                      >
                        <option value="">اختر الطبيب</option>
                        {doctors.map((doctor) => (
                          <option key={doctor.id} value={doctor.id}>
                            {doctor.fullName}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              </div>
              <div className="booking-step">
                <h3>
                  <span>3</span> سبب الزيارة
                </h3>
                {selectedReason ? (
                  <div className="selected-option">
                    <div>
                      <strong>{selectedReason.nameAr}</strong>
                      <small>{selectedReason.category}</small>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedReason(null)}
                    >
                      تغيير
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      className="standalone-input"
                      value={reasonQuery}
                      onChange={(event) => setReasonQuery(event.target.value)}
                      placeholder="ابحث في أسباب الزيارة"
                    />
                    <div className="reason-results">
                      {filteredReasons.map((reason) => (
                        <button
                          type="button"
                          key={reason.id}
                          onClick={() => setSelectedReason(reason)}
                        >
                          {reason.nameAr}
                          <small>{reason.category}</small>
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <label className="notes-label">
                  ملاحظات الاستقبال
                  <textarea
                    value={form.receptionNotes || ""}
                    onChange={(event) =>
                      setForm({ ...form, receptionNotes: event.target.value })
                    }
                  />
                </label>
              </div>
              {bookingError && (
                <div
                  className="inline-form-error appointment-error"
                  role="alert"
                >
                  <span aria-hidden="true">!</span>
                  {bookingError}
                </div>
              )}
              <div className="modal-actions">
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => setModalOpen(false)}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="button primary"
                  disabled={saving}
                >
                  {saving ? "جارٍ الحجز..." : "تأكيد الموعد"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
