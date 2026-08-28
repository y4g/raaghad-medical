import { useEffect, useState, type FormEvent } from "react";
import type {
  Followup,
  Patient,
  ReportSummary,
  WaitlistEntry,
  WaitlistInput,
} from "shared";
import { operationsApi, patientApi } from "../api/client";
import { useAuth } from "../auth/AuthContext";
type Tab = "followups" | "waitlist" | "reports" | "activity" | "settings";
const fmt = (v: string) =>
  new Intl.DateTimeFormat("ar-JO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(v));
export default function Operations() {
  const { user } = useAuth();
  const available: Tab[] = [];
  if (user?.permissions.includes("followups.manage"))
    available.push("followups");
  if (user?.permissions.includes("waitlist.manage")) available.push("waitlist");
  if (user?.permissions.includes("reports.view")) available.push("reports");
  if (user?.permissions.includes("activity.view")) available.push("activity");
  if (user?.permissions.includes("settings.manage")) available.push("settings");
  if (!available.length) available.push("waitlist");
  const [tab, setTab] = useState<Tab>(available[0]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [waitModal, setWaitModal] = useState(false);
  const [patientQuery, setPatientQuery] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selected, setSelected] = useState<Patient | null>(null);
  const [waitForm, setWaitForm] = useState<Omit<WaitlistInput, "patientId">>({
    reason: "",
    priority: "NORMAL",
    notes: null,
  });
  async function load() {
    setLoading(true);
    setError("");
    try {
      if (tab === "followups")
        setFollowups((await operationsApi.followups()).items);
      if (tab === "waitlist")
        setWaitlist((await operationsApi.waitlist()).items);
      if (tab === "reports") {
        const to = new Date(),
          from = new Date(Date.now() - 30 * 86400000);
        setReport(
          (await operationsApi.reports(from.toISOString(), to.toISOString()))
            .summary,
        );
      }
      if (tab === "activity")
        setActivity((await operationsApi.activity()).items);
      if (tab === "settings")
        setSettings((await operationsApi.settings()).settings);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [tab]);
  useEffect(() => {
    if (!waitModal || patientQuery.length < 2) {
      setPatients([]);
      return;
    }
    const timer = setTimeout(
      () =>
        patientApi
          .list({ query: patientQuery, pageSize: 6 })
          .then((r) => setPatients(r.items)),
      200,
    );
    return () => clearTimeout(timer);
  }, [patientQuery, waitModal]);
  async function submitWait(e: FormEvent) {
    e.preventDefault();
    if (!selected) {
      setError("اختر المريض أولاً.");
      return;
    }
    try {
      const r = await operationsApi.addWaitlist({
        ...waitForm,
        patientId: selected.id,
      });
      setNotice(r.message);
      setWaitModal(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <div className="page-stack operations-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">تشغيل العيادة</span>
          <h1>الإدارة والمتابعة</h1>
          <p>المتابعات وقائمة الانتظار والتقارير والإعدادات في مكان واحد.</p>
        </div>
        {tab === "waitlist" && (
          <button className="button primary" onClick={() => setWaitModal(true)}>
            ＋ إضافة للانتظار
          </button>
        )}
      </div>
      {notice && (
        <div className="alert success">
          <span>✓</span>
          {notice}
          <button onClick={() => setNotice("")}>×</button>
        </div>
      )}
      {error && (
        <div className="alert error">
          <span>!</span>
          {error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}
      <nav className="record-tabs">
        {available.map((id) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {
              {
                followups: "المتابعات",
                waitlist: "قائمة الانتظار",
                reports: "التقارير",
                activity: "سجل النشاط",
                settings: "الإعدادات",
              }[id]
            }
          </button>
        ))}
      </nav>
      {loading ? (
        <div className="record-body-skeleton" />
      ) : tab === "followups" ? (
        <section className="clinical-card">
          <div className="card-heading">
            <h2>المتابعات القادمة والمستحقة</h2>
          </div>
          <div className="condition-list">
            {followups.length === 0 ? (
              <div className="compact-empty">لا توجد متابعات.</div>
            ) : (
              followups.map((x) => (
                <article key={x.id}>
                  <span className={`followup-state ${x.status.toLowerCase()}`}>
                    {x.status === "OVERDUE"
                      ? "متأخرة"
                      : x.status === "COMPLETED"
                        ? "مكتملة"
                        : "قادمة"}
                  </span>
                  <div>
                    <strong>
                      {x.patientName} · {x.reason}
                    </strong>
                    <small>
                      {x.patientMedicalNumber} · {fmt(x.dueAt)}
                    </small>
                    {x.notes && <p>{x.notes}</p>}
                  </div>
                  {!["COMPLETED", "CANCELLED"].includes(x.status) && (
                    <button
                      onClick={async () => {
                        const r = await operationsApi.followupStatus(
                          x.id,
                          "COMPLETED",
                        );
                        setNotice(r.message);
                        await load();
                      }}
                    >
                      إكمال
                    </button>
                  )}
                </article>
              ))
            )}
          </div>
        </section>
      ) : tab === "waitlist" ? (
        <section className="clinical-card">
          <div className="card-heading">
            <h2>قائمة انتظار اليوم</h2>
          </div>
          <div className="condition-list">
            {waitlist.length === 0 ? (
              <div className="compact-empty">قائمة الانتظار فارغة.</div>
            ) : (
              waitlist.map((x) => (
                <article key={x.id}>
                  <span
                    className={`priority priority-${x.priority.toLowerCase()}`}
                  >
                    {x.priority === "NORMAL"
                      ? "عادي"
                      : x.priority === "URGENT"
                        ? "مستعجل"
                        : "طارئ"}
                  </span>
                  <div>
                    <strong>{x.patientName}</strong>
                    <small>
                      {fmt(x.arrivedAt)} · {x.reason}
                    </small>
                  </div>
                  <select
                    value={x.status}
                    onChange={async (e) => {
                      const r = await operationsApi.waitlistStatus(
                        x.id,
                        e.target.value as WaitlistEntry["status"],
                      );
                      setNotice(r.message);
                      await load();
                    }}
                  >
                    <option value="WAITING">ينتظر</option>
                    <option value="CALLED">تم النداء</option>
                    <option value="CONVERTED">تم التحويل</option>
                    <option value="CANCELLED">ملغي</option>
                  </select>
                </article>
              ))
            )}
          </div>
        </section>
      ) : tab === "reports" && report ? (
        <>
          <div className="dashboard-stats report-stats">
            {[
              ["إجمالي المرضى", report.totalPatients],
              ["مرضى جدد", report.newPatients],
              ["المواعيد", report.totalAppointments],
              ["الزيارات", report.completedVisits],
              ["الإلغاءات", report.cancelled],
              ["عدم الحضور", report.noShow],
              ["المتابعات", report.followups],
            ].map(([l, v]) => (
              <article key={String(l)}>
                <span>◈</span>
                <div>
                  <strong>{v}</strong>
                  <small>{l}</small>
                </div>
              </article>
            ))}
          </div>
          <section className="clinical-card">
            <div className="card-heading">
              <h2>أكثر أسباب الزيارة خلال 30 يوماً</h2>
            </div>
            <div className="report-bars">
              {report.topReasons.map((x) => (
                <div key={x.name}>
                  <span>{x.name}</span>
                  <i
                    style={{
                      width: `${Math.max(8, (x.count / (report.topReasons[0]?.count || 1)) * 100)}%`,
                    }}
                  />
                  <b>{x.count}</b>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : tab === "activity" ? (
        <section className="clinical-card">
          <div className="card-heading">
            <h2>آخر النشاطات</h2>
          </div>
          <div className="activity-list">
            {activity.map((x) => (
              <article key={x.id}>
                <span>◷</span>
                <div>
                  <strong>{x.action}</strong>
                  <small>
                    {x.userName || "النظام"}
                    {x.patientName ? ` · ${x.patientName}` : ""}
                  </small>
                </div>
                <time>{fmt(x.createdAt)}</time>
              </article>
            ))}
          </div>
        </section>
      ) : tab === "settings" ? (
        <Settings settings={settings} onNotice={setNotice} />
      ) : null}
      {waitModal && (
        <div className="modal-backdrop">
          <section className="modal">
            <div className="modal-header">
              <h2>إضافة مريض لقائمة الانتظار</h2>
              <button
                className="icon-button"
                onClick={() => setWaitModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={submitWait}>
              <div className="form-grid">
                <label className="full">
                  المريض
                  {selected ? (
                    <button
                      type="button"
                      className="selected-option"
                      onClick={() => setSelected(null)}
                    >
                      {selected.fullName} · تغيير
                    </button>
                  ) : (
                    <>
                      <input
                        autoFocus
                        placeholder="ابحث بالاسم أو الهاتف"
                        value={patientQuery}
                        onChange={(e) => setPatientQuery(e.target.value)}
                      />
                      <div className="option-results">
                        {patients.map((p) => (
                          <button
                            type="button"
                            key={p.id}
                            onClick={() => setSelected(p)}
                          >
                            {p.fullName}
                            <small>{p.medicalNumber}</small>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </label>
                <label className="full">
                  سبب الزيارة
                  <input
                    required
                    value={waitForm.reason}
                    onChange={(e) =>
                      setWaitForm({ ...waitForm, reason: e.target.value })
                    }
                  />
                </label>
                <label>
                  الأولوية
                  <select
                    value={waitForm.priority}
                    onChange={(e) =>
                      setWaitForm({
                        ...waitForm,
                        priority: e.target.value as WaitlistInput["priority"],
                      })
                    }
                  >
                    <option value="NORMAL">عادي</option>
                    <option value="URGENT">مستعجل</option>
                    <option value="EMERGENCY">طارئ</option>
                  </select>
                </label>
                <label className="full">
                  ملاحظات
                  <textarea
                    value={waitForm.notes || ""}
                    onChange={(e) =>
                      setWaitForm({
                        ...waitForm,
                        notes: e.target.value || null,
                      })
                    }
                  />
                </label>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => setWaitModal(false)}
                >
                  إلغاء
                </button>
                <button className="button primary">إضافة</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
function Settings({
  settings,
  onNotice,
}: {
  settings: Record<string, any>;
  onNotice: (v: string) => void;
}) {
  const [profile, setProfile] = useState(settings.clinic_profile || {});
  const [appointments, setAppointments] = useState(
    settings.appointment_settings || {},
  );
  const [reminders, setReminders] = useState(settings.reminder_settings || {});
  const [appearance, setAppearance] = useState(
    settings.appearance_settings || {},
  );
  return (
    <section className="clinical-card">
      <div className="card-heading">
        <div>
          <h2>إعدادات العيادة والمواعيد</h2>
          <p>يتم حفظ التعديلات في قاعدة البيانات.</p>
        </div>
      </div>
      <form
        className="settings-form"
        onSubmit={async (e) => {
          e.preventDefault();
          await operationsApi.saveSetting("clinic_profile", profile);
          const r = await operationsApi.saveSetting(
            "appointment_settings",
            appointments,
          );
          await operationsApi.saveSetting("reminder_settings", reminders);
          await operationsApi.saveSetting("appearance_settings", appearance);
          document.documentElement.dataset.theme = appearance.theme || "light";
          document.documentElement.dataset.fontSize =
            appearance.fontSize || "medium";
          document.documentElement.dataset.motion =
            appearance.motionLevel || "full";
          onNotice(r.message);
        }}
      >
        <div className="form-grid">
          <label>
            اسم العيادة
            <input
              value={profile.name || ""}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            />
          </label>
          <label>
            اسم الطبيبة
            <input
              value={profile.doctorName || ""}
              onChange={(e) =>
                setProfile({ ...profile, doctorName: e.target.value })
              }
            />
          </label>
          <label>
            التخصص
            <input
              value={profile.specialty || ""}
              onChange={(e) =>
                setProfile({ ...profile, specialty: e.target.value })
              }
            />
          </label>
          <label>
            الهاتف
            <input
              value={profile.phone || ""}
              onChange={(e) =>
                setProfile({ ...profile, phone: e.target.value })
              }
            />
          </label>
          <label className="full">
            العنوان
            <input
              value={profile.address || ""}
              onChange={(e) =>
                setProfile({ ...profile, address: e.target.value })
              }
            />
          </label>
          <label>
            مدة الموعد بالدقائق
            <input
              type="number"
              min="5"
              max="240"
              value={appointments.defaultDurationMinutes || 30}
              onChange={(e) =>
                setAppointments({
                  ...appointments,
                  defaultDurationMinutes: Number(e.target.value),
                })
              }
            />
          </label>
          <label>
            ظهور المكتملة بالساعات
            <input
              type="number"
              value={appointments.completedVisibleHours || 12}
              onChange={(e) =>
                setAppointments({
                  ...appointments,
                  completedVisibleHours: Number(e.target.value),
                })
              }
            />
          </label>
          <label>
            الوضع
            <select
              value={appearance.theme || "light"}
              onChange={(e) =>
                setAppearance({ ...appearance, theme: e.target.value })
              }
            >
              <option value="light">فاتح</option>
              <option value="dark">داكن</option>
            </select>
          </label>
          <label>
            حجم الخط
            <select
              value={appearance.fontSize || "medium"}
              onChange={(e) =>
                setAppearance({ ...appearance, fontSize: e.target.value })
              }
            >
              <option value="small">صغير</option>
              <option value="medium">متوسط</option>
              <option value="large">كبير</option>
            </select>
          </label>
          <label>
            مستوى الحركة
            <select
              value={appearance.motionLevel || "full"}
              onChange={(e) =>
                setAppearance({ ...appearance, motionLevel: e.target.value })
              }
            >
              <option value="full">كامل</option>
              <option value="reduced">مخفف</option>
              <option value="none">بدون حركة</option>
            </select>
          </label>
          <label>
            التذكير قبل (ساعة)
            <input
              type="number"
              min="1"
              max="168"
              value={reminders.reminderHoursBefore || 24}
              onChange={(e) =>
                setReminders({
                  ...reminders,
                  reminderHoursBefore: Number(e.target.value),
                })
              }
            />
          </label>
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={Boolean(reminders.smsEnabled)}
              onChange={(e) =>
                setReminders({ ...reminders, smsEnabled: e.target.checked })
              }
            />{" "}
            تجهيز SMS <small>يتطلب API حقيقي قبل الإرسال</small>
          </label>
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={Boolean(reminders.whatsappEnabled)}
              onChange={(e) =>
                setReminders({
                  ...reminders,
                  whatsappEnabled: e.target.checked,
                })
              }
            />{" "}
            تجهيز WhatsApp <small>يتطلب API حقيقي قبل الإرسال</small>
          </label>
          <label className="full">
            قالب رسالة التذكير
            <textarea
              value={reminders.template || ""}
              onChange={(e) =>
                setReminders({ ...reminders, template: e.target.value })
              }
            />
          </label>
        </div>
        <button className="button primary">حفظ الإعدادات</button>
      </form>
    </section>
  );
}
