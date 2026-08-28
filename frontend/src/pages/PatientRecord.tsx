import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Link, useParams } from "react-router-dom";
import type {
  AllergyInput,
  ChronicConditionInput,
  FollowupInput,
  ImagingOrderInput,
  LabOrderInput,
  MedicalVisitInput,
  PatientRecord as PatientRecordType,
  PrescriptionInput,
  VitalSignsInput,
} from "shared";
import { medicalRecordApi } from "../api/client";
import { useAuth } from "../auth/AuthContext";

type Tab =
  | "overview"
  | "visits"
  | "vitals"
  | "diagnoses"
  | "appointments"
  | "prescriptions"
  | "labs"
  | "imaging"
  | "followups"
  | "attachments"
  | "chronic"
  | "allergies";
type Dialog =
  | "allergy"
  | "condition"
  | "vitals"
  | "visit"
  | "prescription"
  | "lab"
  | "imaging"
  | "followup"
  | null;

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "نظرة عامة" },
  { id: "visits", label: "الزيارات" },
  { id: "vitals", label: "القياسات الحيوية" },
  { id: "diagnoses", label: "التشخيصات" },
  { id: "appointments", label: "المواعيد" },
  { id: "prescriptions", label: "الوصفات" },
  { id: "labs", label: "التحاليل" },
  { id: "imaging", label: "الأشعة" },
  { id: "followups", label: "المتابعات" },
  { id: "attachments", label: "المرفقات" },
  { id: "chronic", label: "الأمراض المزمنة" },
  { id: "allergies", label: "الحساسية" },
];
const emptyAllergy: AllergyInput = {
  substance: "",
  allergyType: "DRUG",
  severity: "MODERATE",
  symptoms: null,
  notes: null,
  isActive: true,
};
const emptyCondition: ChronicConditionInput = {
  name: "",
  diagnosedAt: null,
  status: "ACTIVE",
  notes: null,
  followupPlan: null,
  isActive: true,
};
const emptyVitals: VitalSignsInput = {
  visitId: null,
  heightCm: null,
  weightKg: null,
  systolic: null,
  diastolic: null,
  pulse: null,
  temperatureC: null,
  spo2: null,
  notes: null,
};
const emptyVisit: MedicalVisitInput = {
  appointmentId: null,
  visitReason: "",
  symptoms: null,
  clinicalNotes: null,
  treatmentPlan: null,
  educationInstructions: null,
  followupPlan: null,
  completedAt: null,
  diagnoses: [],
};
const emptyPrescription: PrescriptionInput = {
  visitId: null,
  notes: null,
  items: [
    {
      medicationName: "",
      dosage: "",
      dosageForm: null,
      frequency: "",
      duration: "",
      instructions: null,
      notes: null,
    },
  ],
};
const emptyLab: LabOrderInput = {
  visitId: null,
  testName: "",
  orderNotes: null,
};
const emptyImaging: ImagingOrderInput = {
  visitId: null,
  imagingType: "",
  reason: "",
  report: null,
};
const emptyFollowup: FollowupInput = {
  visitId: null,
  reason: "",
  dueAt: "",
  notes: null,
};

const formatDate = (value?: string | null, withTime = false) =>
  value
    ? new Intl.DateTimeFormat("ar-JO", {
        dateStyle: "medium",
        ...(withTime ? { timeStyle: "short" as const } : {}),
      }).format(new Date(value))
    : "—";
const allergyTypes = {
  DRUG: "دواء",
  FOOD: "طعام",
  MATERIAL: "مادة",
  OTHER: "أخرى",
} as const;
const severities = {
  MILD: "خفيفة",
  MODERATE: "متوسطة",
  SEVERE: "شديدة",
} as const;
const conditionStatuses = {
  ACTIVE: "نشط",
  CONTROLLED: "مسيطر عليه",
  IN_REMISSION: "في هدوء",
} as const;

export default function PatientRecordPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const [record, setRecord] = useState<PatientRecordType | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [allergy, setAllergy] = useState(emptyAllergy);
  const [condition, setCondition] = useState(emptyCondition);
  const [vitals, setVitals] = useState(emptyVitals);
  const [visit, setVisit] = useState(emptyVisit);
  const [diagnosis, setDiagnosis] = useState("");
  const [prescription, setPrescription] = useState(emptyPrescription);
  const [lab, setLab] = useState(emptyLab);
  const [imaging, setImaging] = useState(emptyImaging);
  const [followup, setFollowup] = useState(emptyFollowup);
  const [labResultDrafts, setLabResultDrafts] = useState<
    Record<string, string>
  >({});

  const canManageClinical = Boolean(
    user?.permissions.includes("visits.manage"),
  );
  const canManageVitals = Boolean(user?.permissions.includes("vitals.manage"));

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRecord((await medicalRecordApi.get(id)).record);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  const activeAllergies = useMemo(
    () => record?.allergies.filter((item) => item.isActive) ?? [],
    [record],
  );
  const activeConditions = useMemo(
    () => record?.chronicConditions.filter((item) => item.isActive) ?? [],
    [record],
  );
  const latestVitals = record?.vitals[0];
  const upcomingAppointment = record?.appointments
    .filter(
      (item) =>
        new Date(item.startAt) > new Date() &&
        !["CANCELLED", "NO_SHOW"].includes(item.status),
    )
    .sort((a, b) => a.startAt.localeCompare(b.startAt))[0];

  function openDialog(kind: Exclude<Dialog, null>) {
    setError("");
    setDialog(kind);
    if (kind === "allergy") setAllergy(emptyAllergy);
    if (kind === "condition") setCondition(emptyCondition);
    if (kind === "vitals")
      setVitals({
        ...emptyVitals,
        heightCm: record?.patient.heightCm ?? null,
        weightKg: record?.patient.weightKg ?? null,
      });
    if (kind === "visit") {
      setVisit(emptyVisit);
      setDiagnosis("");
    }
    if (kind === "prescription") setPrescription(emptyPrescription);
    if (kind === "lab") setLab(emptyLab);
    if (kind === "imaging") setImaging(emptyImaging);
    if (kind === "followup")
      setFollowup({
        ...emptyFollowup,
        dueAt: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
      });
  }

  async function submitDialog(event: FormEvent) {
    event.preventDefault();
    if (!record || !dialog) return;
    setSaving(true);
    setError("");
    try {
      const result =
        dialog === "allergy"
          ? await medicalRecordApi.addAllergy(id, allergy)
          : dialog === "condition"
            ? await medicalRecordApi.addCondition(id, condition)
            : dialog === "vitals"
              ? await medicalRecordApi.addVitals(id, vitals)
              : dialog === "prescription"
                ? await medicalRecordApi.addPrescription(id, prescription)
                : dialog === "lab"
                  ? await medicalRecordApi.addLab(id, lab)
                  : dialog === "imaging"
                    ? await medicalRecordApi.addImaging(id, imaging)
                    : dialog === "followup"
                      ? await medicalRecordApi.addFollowup(id, {
                          ...followup,
                          dueAt: new Date(followup.dueAt).toISOString(),
                        })
                      : await medicalRecordApi.addVisit(id, {
                          ...visit,
                          completedAt: new Date().toISOString(),
                          diagnoses: diagnosis.trim()
                            ? [
                                {
                                  name: diagnosis.trim(),
                                  code: null,
                                  diagnosisType: "PRIMARY",
                                  notes: null,
                                },
                              ]
                            : [],
                        });
      setRecord(result.record);
      setNotice(result.message);
      setDialog(null);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleAllergy(itemId: string) {
    const item = record?.allergies.find((entry) => entry.id === itemId);
    if (!item) return;
    try {
      const result = await medicalRecordApi.updateAllergy(id, itemId, {
        substance: item.substance,
        allergyType: item.allergyType,
        severity: item.severity,
        symptoms: item.symptoms,
        notes: item.notes,
        isActive: !item.isActive,
      });
      setRecord(result.record);
      setNotice(result.message);
    } catch (requestError) {
      setError((requestError as Error).message);
    }
  }
  async function toggleCondition(itemId: string) {
    const item = record?.chronicConditions.find((entry) => entry.id === itemId);
    if (!item) return;
    try {
      const result = await medicalRecordApi.updateCondition(id, itemId, {
        name: item.name,
        diagnosedAt: item.diagnosedAt,
        status: item.status,
        notes: item.notes,
        followupPlan: item.followupPlan,
        isActive: !item.isActive,
      });
      setRecord(result.record);
      setNotice(result.message);
    } catch (requestError) {
      setError((requestError as Error).message);
    }
  }

  if (loading)
    return (
      <div className="record-loading">
        <div className="record-header-skeleton" />
        <div className="record-body-skeleton" />
      </div>
    );
  if (!record)
    return (
      <div className="empty-state">
        <h2>{error || "سجل المريض غير موجود"}</h2>
        <Link className="button primary" to="/patients">
          العودة إلى المرضى
        </Link>
      </div>
    );
  const patient = record.patient;

  return (
    <div className="page-stack medical-record-page">
      <div className="record-breadcrumb">
        <Link to="/patients">المرضى</Link>
        <span>‹</span>
        <span>{patient.fullName}</span>
      </div>
      <section className="record-profile">
        <div className="record-avatar">{patient.fullName.charAt(0)}</div>
        <div className="record-identity">
          <span className="medical-number">{patient.medicalNumber}</span>
          <h1>{patient.fullName}</h1>
          <p>
            {patient.age} سنة · {patient.gender} ·{" "}
            <span dir="ltr">{patient.phone}</span> · فصيلة الدم{" "}
            {patient.bloodType || "غير محددة"}
          </p>
        </div>
        <div className="record-header-actions">
          {canManageVitals && (
            <button
              className="button secondary"
              onClick={() => openDialog("vitals")}
            >
              ＋ قياسات
            </button>
          )}
          {canManageClinical && (
            <button
              className="button primary"
              onClick={() => openDialog("visit")}
            >
              ＋ زيارة جديدة
            </button>
          )}
        </div>
      </section>
      {(activeAllergies.length > 0 || activeConditions.length > 0) && (
        <div className="medical-warnings" role="alert">
          {activeAllergies.length > 0 && (
            <div className="warning allergy">
              <strong>⚠ تنبيه حساسية</strong>
              <span>
                {activeAllergies
                  .map(
                    (item) =>
                      `${item.substance} (${severities[item.severity]})`,
                  )
                  .join("، ")}
              </span>
            </div>
          )}
          {activeConditions.length > 0 && (
            <div className="warning chronic">
              <strong>◆ أمراض مزمنة</strong>
              <span>
                {activeConditions.map((item) => item.name).join("، ")}
              </span>
            </div>
          )}
        </div>
      )}
      {notice && (
        <div className="alert success" role="status">
          <span>✓</span>
          {notice}
          <button onClick={() => setNotice("")}>×</button>
        </div>
      )}
      {error && (
        <div className="alert error" role="alert">
          <span>!</span>
          {error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}
      <nav className="record-tabs" aria-label="أقسام الملف الطبي">
        {tabs.map((item) => (
          <button
            key={item.id}
            className={tab === item.id ? "active" : ""}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="record-overview">
          <section className="clinical-card vital-summary">
            <div className="card-heading">
              <div>
                <span className="eyebrow">آخر تسجيل</span>
                <h2>القياسات الحيوية</h2>
              </div>
              {canManageVitals && (
                <button onClick={() => openDialog("vitals")}>
                  إضافة قياسات
                </button>
              )}
            </div>
            <div className="vital-grid">
              {[
                ["الطول", latestVitals?.heightCm, "سم"],
                ["الوزن", latestVitals?.weightKg, "كغ"],
                ["BMI", latestVitals?.bmi, ""],
                [
                  "ضغط الدم",
                  latestVitals?.systolic && latestVitals?.diastolic
                    ? `${latestVitals.systolic}/${latestVitals.diastolic}`
                    : null,
                  "",
                ],
                ["النبض", latestVitals?.pulse, "/د"],
                ["الحرارة", latestVitals?.temperatureC, "°C"],
                ["الأكسجين", latestVitals?.spo2, "%"],
              ].map(([label, value, unit]) => (
                <div key={String(label)}>
                  <small>{label}</small>
                  <strong>
                    {value ?? "—"} <i>{unit}</i>
                  </strong>
                </div>
              ))}
            </div>
            <p className="measurement-date">
              {latestVitals
                ? `قاسها ${latestVitals.measuredByName} · ${formatDate(latestVitals.measuredAt, true)}`
                : "لم تُسجّل قياسات بعد."}
            </p>
          </section>
          <section className="clinical-card record-snapshot">
            <div className="card-heading">
              <h2>ملخص المتابعة</h2>
            </div>
            <dl>
              <div>
                <dt>آخر زيارة</dt>
                <dd>
                  {record.visits[0]
                    ? formatDate(record.visits[0].startedAt)
                    : "لا توجد زيارة"}
                </dd>
              </div>
              <div>
                <dt>الموعد القادم</dt>
                <dd>
                  {upcomingAppointment
                    ? `${formatDate(upcomingAppointment.startAt, true)} · ${upcomingAppointment.reason}`
                    : "لا يوجد موعد قادم"}
                </dd>
              </div>
              <div>
                <dt>الحساسيات النشطة</dt>
                <dd>{activeAllergies.length || "لا يوجد"}</dd>
              </div>
              <div>
                <dt>الأمراض المزمنة</dt>
                <dd>{activeConditions.length || "لا يوجد"}</dd>
              </div>
            </dl>
          </section>
          <section className="clinical-card recent-visit">
            <div className="card-heading">
              <h2>آخر زيارة طبية</h2>
              {record.visits.length > 0 && (
                <button onClick={() => setTab("visits")}>عرض السجل</button>
              )}
            </div>
            {record.visits[0] ? (
              <div>
                <strong>{record.visits[0].visitReason}</strong>
                <p>
                  {record.visits[0].clinicalNotes ||
                    record.visits[0].symptoms ||
                    "لا توجد ملاحظات."}
                </p>
                <span>
                  {record.visits[0].doctorName} ·{" "}
                  {formatDate(record.visits[0].startedAt, true)}
                </span>
              </div>
            ) : (
              <div className="compact-empty">لا توجد زيارات طبية مسجلة.</div>
            )}
          </section>
        </div>
      )}

      {tab === "visits" && (
        <section className="clinical-card">
          <div className="card-heading">
            <div>
              <h2>الخط الزمني للزيارات</h2>
              <p>{record.visits.length} زيارة مسجلة</p>
            </div>
            {canManageClinical && (
              <button onClick={() => openDialog("visit")}>
                ＋ زيارة جديدة
              </button>
            )}
          </div>
          <div className="medical-timeline">
            {record.visits.length === 0 ? (
              <div className="compact-empty">لا توجد زيارات طبية حتى الآن.</div>
            ) : (
              record.visits.map((item) => (
                <article key={item.id}>
                  <div className="timeline-dot" />
                  <div className="timeline-content">
                    <header>
                      <div>
                        <strong>{item.visitReason}</strong>
                        <span>{item.doctorName}</span>
                      </div>
                      <time>{formatDate(item.startedAt, true)}</time>
                    </header>
                    {item.diagnoses.length > 0 && (
                      <div className="diagnosis-chips">
                        {item.diagnoses.map((diagnosis) => (
                          <span key={diagnosis.id}>
                            {diagnosis.diagnosisType === "PRIMARY"
                              ? "أساسي: "
                              : "ثانوي: "}
                            {diagnosis.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {item.symptoms && (
                      <p>
                        <b>الأعراض:</b> {item.symptoms}
                      </p>
                    )}
                    {item.clinicalNotes && (
                      <p>
                        <b>الملاحظات:</b> {item.clinicalNotes}
                      </p>
                    )}
                    {item.treatmentPlan && (
                      <p>
                        <b>الخطة العلاجية:</b> {item.treatmentPlan}
                      </p>
                    )}
                    {item.educationInstructions && (
                      <p>
                        <b>التعليمات:</b> {item.educationInstructions}
                      </p>
                    )}
                    {item.followupPlan && (
                      <p>
                        <b>المتابعة:</b> {item.followupPlan}
                      </p>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      )}

      {tab === "vitals" && (
        <section className="clinical-card">
          <div className="card-heading">
            <div>
              <h2>سجل القياسات الحيوية</h2>
              <p>مرتب من الأحدث إلى الأقدم</p>
            </div>
            {canManageVitals && (
              <button onClick={() => openDialog("vitals")}>
                ＋ إضافة قياسات
              </button>
            )}
          </div>
          {record.vitals.length === 0 ? (
            <div className="compact-empty">لم تُسجل قياسات بعد.</div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>التاريخ</th>
                    <th>الطول/الوزن</th>
                    <th>BMI</th>
                    <th>الضغط</th>
                    <th>النبض</th>
                    <th>الحرارة</th>
                    <th>SpO2</th>
                    <th>المستخدم</th>
                  </tr>
                </thead>
                <tbody>
                  {record.vitals.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDate(item.measuredAt, true)}</td>
                      <td>
                        {item.heightCm ?? "—"} سم / {item.weightKg ?? "—"} كغ
                      </td>
                      <td>{item.bmi ?? "—"}</td>
                      <td>
                        {item.systolic && item.diastolic
                          ? `${item.systolic}/${item.diastolic}`
                          : "—"}
                      </td>
                      <td>{item.pulse ?? "—"}</td>
                      <td>{item.temperatureC ?? "—"}</td>
                      <td>{item.spo2 ? `${item.spo2}%` : "—"}</td>
                      <td>{item.measuredByName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === "diagnoses" && (
        <section className="clinical-card">
          <div className="card-heading">
            <h2>التشخيصات</h2>
          </div>
          <div className="diagnosis-list">
            {record.visits.flatMap((item) =>
              item.diagnoses.map((diagnosis) => ({
                ...diagnosis,
                visit: item,
              })),
            ).length === 0 ? (
              <div className="compact-empty">لا توجد تشخيصات محفوظة.</div>
            ) : (
              record.visits.flatMap((item) =>
                item.diagnoses.map((diagnosis) => (
                  <article key={diagnosis.id}>
                    <div>
                      <strong>{diagnosis.name}</strong>
                      <span>
                        {diagnosis.diagnosisType === "PRIMARY"
                          ? "تشخيص أساسي"
                          : "تشخيص ثانوي"}{" "}
                        {diagnosis.code ? `· ${diagnosis.code}` : ""}
                      </span>
                    </div>
                    <time>{formatDate(item.startedAt)}</time>
                  </article>
                )),
              )
            )}
          </div>
        </section>
      )}

      {tab === "appointments" && (
        <section className="clinical-card">
          <div className="card-heading">
            <h2>مواعيد المريض</h2>
          </div>
          {record.appointments.length === 0 ? (
            <div className="compact-empty">لا توجد مواعيد لهذا المريض.</div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>التاريخ والوقت</th>
                    <th>السبب</th>
                    <th>الطبيب</th>
                    <th>الحالة</th>
                    <th>الأولوية</th>
                  </tr>
                </thead>
                <tbody>
                  {record.appointments.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDate(item.startAt, true)}</td>
                      <td>{item.reason}</td>
                      <td>{item.doctorName}</td>
                      <td>
                        <span
                          className={`status-badge status-${item.status.toLowerCase()}`}
                        >
                          {item.statusLabel}
                        </span>
                      </td>
                      <td>
                        {item.priority === "NORMAL"
                          ? "عادي"
                          : item.priority === "URGENT"
                            ? "مستعجل"
                            : "طارئ"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === "prescriptions" && (
        <section className="clinical-card">
          <div className="card-heading">
            <div>
              <h2>الوصفات الطبية</h2>
              <p>الوصفات السابقة والأدوية المصروفة</p>
            </div>
            {user?.permissions.includes("prescriptions.manage") && (
              <button onClick={() => openDialog("prescription")}>
                ＋ وصفة جديدة
              </button>
            )}
          </div>
          <div className="condition-list">
            {record.prescriptions.length === 0 ? (
              <div className="compact-empty">لا توجد وصفات محفوظة.</div>
            ) : (
              record.prescriptions.map((item) => (
                <article key={item.id}>
                  <span className="condition-state">
                    {formatDate(item.issuedAt)}
                  </span>
                  <div>
                    <strong>
                      {item.items.map((m) => m.medicationName).join("، ")}
                    </strong>
                    <small>{item.doctorName}</small>
                    {item.items.map((m) => (
                      <p key={m.id}>
                        {m.medicationName}: {m.dosage} · {m.frequency} ·{" "}
                        {m.duration}
                        {m.instructions ? ` · ${m.instructions}` : ""}
                      </p>
                    ))}
                  </div>
                  <button onClick={() => window.print()}>طباعة</button>
                </article>
              ))
            )}
          </div>
        </section>
      )}

      {tab === "labs" && (
        <section className="clinical-card">
          <div className="card-heading">
            <div>
              <h2>التحاليل والنتائج</h2>
              <p>طلبات التحاليل المرتبطة بالسجل الطبي</p>
            </div>
            {canManageClinical && (
              <button onClick={() => openDialog("lab")}>＋ طلب تحليل</button>
            )}
          </div>
          <div className="condition-list">
            {record.labOrders.length === 0 ? (
              <div className="compact-empty">لا توجد تحاليل مطلوبة.</div>
            ) : (
              record.labOrders.map((item) => (
                <article key={item.id}>
                  <span className="condition-state">
                    {item.status === "COMPLETED" ? "مكتمل" : "مطلوب"}
                  </span>
                  <div>
                    <strong>{item.testName}</strong>
                    <small>{formatDate(item.orderedAt, true)}</small>
                    {item.orderNotes && <p>{item.orderNotes}</p>}
                    {item.results.map((result) => (
                      <p key={result.id}>
                        <b>النتيجة:</b> {result.resultValue} {result.unit || ""}{" "}
                        {result.referenceRange
                          ? `· المرجع ${result.referenceRange}`
                          : ""}
                      </p>
                    ))}
                  </div>
                  {canManageClinical && item.results.length === 0 && (
                    <div className="inline-result-form">
                      <input
                        aria-label={`نتيجة ${item.testName}`}
                        placeholder="اكتب النتيجة"
                        value={labResultDrafts[item.id] || ""}
                        onChange={(event) =>
                          setLabResultDrafts({
                            ...labResultDrafts,
                            [item.id]: event.target.value,
                          })
                        }
                      />
                      <button
                        onClick={async () => {
                          const value = labResultDrafts[item.id]?.trim();
                          if (!value) return;
                          try {
                            const result = await medicalRecordApi.addLabResult(
                              id,
                              item.id,
                              {
                                resultValue: value,
                                resultAt: new Date().toISOString(),
                              },
                            );
                            setRecord(result.record);
                            setNotice(result.message);
                            setLabResultDrafts({
                              ...labResultDrafts,
                              [item.id]: "",
                            });
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        إضافة نتيجة
                      </button>
                    </div>
                  )}
                </article>
              ))
            )}
          </div>
        </section>
      )}

      {tab === "imaging" && (
        <section className="clinical-card">
          <div className="card-heading">
            <div>
              <h2>الأشعة</h2>
              <p>طلبات الأشعة والتقارير</p>
            </div>
            {canManageClinical && (
              <button onClick={() => openDialog("imaging")}>＋ طلب أشعة</button>
            )}
          </div>
          <div className="condition-list">
            {record.imagingOrders.length === 0 ? (
              <div className="compact-empty">لا توجد طلبات أشعة.</div>
            ) : (
              record.imagingOrders.map((item) => (
                <article key={item.id}>
                  <span className="condition-state">
                    {item.report ? "تم التقرير" : "مطلوب"}
                  </span>
                  <div>
                    <strong>{item.imagingType}</strong>
                    <small>
                      {formatDate(item.orderedAt, true)} · {item.reason}
                    </small>
                    {item.report && <p>{item.report}</p>}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      )}

      {tab === "followups" && (
        <section className="clinical-card">
          <div className="card-heading">
            <div>
              <h2>المتابعات</h2>
              <p>المواعيد السريرية المستحقة والقادمة</p>
            </div>
            {user?.permissions.includes("followups.manage") && (
              <button onClick={() => openDialog("followup")}>＋ متابعة</button>
            )}
          </div>
          <div className="condition-list">
            {record.followups.length === 0 ? (
              <div className="compact-empty">لا توجد متابعات.</div>
            ) : (
              record.followups.map((item) => (
                <article key={item.id}>
                  <span className="condition-state">
                    {new Date(item.dueAt) < new Date() ? "متأخرة" : "قادمة"}
                  </span>
                  <div>
                    <strong>{item.reason}</strong>
                    <small>{formatDate(item.dueAt, true)}</small>
                    {item.notes && <p>{item.notes}</p>}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      )}

      {tab === "attachments" && (
        <section className="clinical-card">
          <div className="card-heading">
            <div>
              <h2>المرفقات الطبية</h2>
              <p>ملفات PDF وصور JPG وPNG خاصة وغير مكشوفة للعامة</p>
            </div>
            {user?.permissions.includes("attachments.manage") && (
              <label className="attachment-upload">
                {uploading ? "جارٍ الرفع..." : "＋ رفع ملف"}
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  disabled={uploading}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    setError("");
                    try {
                      const result = await medicalRecordApi.uploadAttachment(
                        id,
                        file,
                      );
                      setRecord(result.record);
                      setNotice(result.message);
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setUploading(false);
                      event.target.value = "";
                    }
                  }}
                />
              </label>
            )}
          </div>
          <div className="condition-list">
            {record.attachments.length === 0 ? (
              <div className="compact-empty">لا توجد مرفقات طبية.</div>
            ) : (
              record.attachments.map((item) => (
                <article
                  key={item.id}
                  className={item.isArchived ? "inactive" : ""}
                >
                  <span className="condition-state">
                    {item.mimeType === "application/pdf" ? "PDF" : "صورة"}
                  </span>
                  <div>
                    <strong>{item.originalName}</strong>
                    <small>
                      {(item.sizeBytes / 1024).toFixed(1)} ك.ب ·{" "}
                      {item.uploadedByName} ·{" "}
                      {formatDate(item.uploadedAt, true)}
                    </small>
                  </div>
                  {!item.isArchived && (
                    <a
                      className="button secondary compact"
                      href={`/api/medical/patients/${id}/attachments/${item.id}/download`}
                    >
                      تنزيل
                    </a>
                  )}
                  {user?.permissions.includes("attachments.manage") && (
                    <button
                      onClick={async () => {
                        const result = await medicalRecordApi.archiveAttachment(
                          id,
                          item.id,
                          !item.isArchived,
                        );
                        setRecord(result.record);
                        setNotice(result.message);
                      }}
                    >
                      {item.isArchived ? "استعادة" : "أرشفة"}
                    </button>
                  )}
                </article>
              ))
            )}
          </div>
        </section>
      )}

      {tab === "allergies" && (
        <section className="clinical-card">
          <div className="card-heading">
            <div>
              <h2>الحساسيات</h2>
              <p>حساسية الأدوية والأطعمة والمواد الأخرى</p>
            </div>
            {canManageClinical && (
              <button onClick={() => openDialog("allergy")}>
                ＋ إضافة حساسية
              </button>
            )}
          </div>
          <div className="condition-list">
            {record.allergies.length === 0 ? (
              <div className="compact-empty">لا توجد حساسية مسجلة.</div>
            ) : (
              record.allergies.map((item) => (
                <article
                  key={item.id}
                  className={!item.isActive ? "inactive" : ""}
                >
                  <span
                    className={`severity severity-${item.severity.toLowerCase()}`}
                  >
                    ⚠ {severities[item.severity]}
                  </span>
                  <div>
                    <strong>{item.substance}</strong>
                    <small>
                      {allergyTypes[item.allergyType]}
                      {item.symptoms ? ` · الأعراض: ${item.symptoms}` : ""}
                    </small>
                    {item.notes && <p>{item.notes}</p>}
                  </div>
                  {canManageClinical && (
                    <button onClick={() => void toggleAllergy(item.id)}>
                      {item.isActive ? "تعطيل" : "تفعيل"}
                    </button>
                  )}
                </article>
              ))
            )}
          </div>
        </section>
      )}

      {tab === "chronic" && (
        <section className="clinical-card">
          <div className="card-heading">
            <div>
              <h2>الأمراض المزمنة</h2>
              <p>الحالة وخطة المتابعة لكل مرض</p>
            </div>
            {canManageClinical && (
              <button onClick={() => openDialog("condition")}>
                ＋ إضافة مرض
              </button>
            )}
          </div>
          <div className="condition-list">
            {record.chronicConditions.length === 0 ? (
              <div className="compact-empty">لا توجد أمراض مزمنة مسجلة.</div>
            ) : (
              record.chronicConditions.map((item) => (
                <article
                  key={item.id}
                  className={!item.isActive ? "inactive" : ""}
                >
                  <span className="condition-state">
                    {conditionStatuses[item.status]}
                  </span>
                  <div>
                    <strong>{item.name}</strong>
                    <small>
                      {item.diagnosedAt
                        ? `شُخّص في ${formatDate(item.diagnosedAt)}`
                        : "تاريخ التشخيص غير محدد"}
                    </small>
                    {item.followupPlan && (
                      <p>خطة المتابعة: {item.followupPlan}</p>
                    )}
                    {item.notes && <p>{item.notes}</p>}
                  </div>
                  {canManageClinical && (
                    <button onClick={() => void toggleCondition(item.id)}>
                      {item.isActive ? "تعطيل" : "تفعيل"}
                    </button>
                  )}
                </article>
              ))
            )}
          </div>
        </section>
      )}

      {dialog && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) =>
            event.target === event.currentTarget && !saving && setDialog(null)
          }
        >
          <section
            className="modal record-modal"
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-header">
              <h2>
                {dialog === "allergy"
                  ? "إضافة حساسية"
                  : dialog === "condition"
                    ? "إضافة مرض مزمن"
                    : dialog === "vitals"
                      ? "تسجيل قياسات حيوية"
                      : dialog === "prescription"
                        ? "وصفة طبية جديدة"
                        : dialog === "lab"
                          ? "طلب تحليل جديد"
                          : dialog === "imaging"
                            ? "طلب أشعة جديد"
                            : dialog === "followup"
                              ? "حجز متابعة"
                              : "تسجيل زيارة طبية"}
              </h2>
              <button className="icon-button" onClick={() => setDialog(null)}>
                ×
              </button>
            </div>
            <form onSubmit={submitDialog}>
              <div className="form-grid">
                {dialog === "allergy" && (
                  <>
                    <label className="full">
                      المادة المسببة
                      <input
                        autoFocus
                        required
                        value={allergy.substance}
                        onChange={(event) =>
                          setAllergy({
                            ...allergy,
                            substance: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      النوع
                      <select
                        value={allergy.allergyType}
                        onChange={(event) =>
                          setAllergy({
                            ...allergy,
                            allergyType: event.target
                              .value as AllergyInput["allergyType"],
                          })
                        }
                      >
                        <option value="DRUG">دواء</option>
                        <option value="FOOD">طعام</option>
                        <option value="MATERIAL">مادة</option>
                        <option value="OTHER">أخرى</option>
                      </select>
                    </label>
                    <label>
                      الشدة
                      <select
                        value={allergy.severity}
                        onChange={(event) =>
                          setAllergy({
                            ...allergy,
                            severity: event.target
                              .value as AllergyInput["severity"],
                          })
                        }
                      >
                        <option value="MILD">خفيفة</option>
                        <option value="MODERATE">متوسطة</option>
                        <option value="SEVERE">شديدة</option>
                      </select>
                    </label>
                    <label className="full">
                      الأعراض
                      <textarea
                        value={allergy.symptoms || ""}
                        onChange={(event) =>
                          setAllergy({
                            ...allergy,
                            symptoms: event.target.value || null,
                          })
                        }
                      />
                    </label>
                    <label className="full">
                      ملاحظات
                      <textarea
                        value={allergy.notes || ""}
                        onChange={(event) =>
                          setAllergy({
                            ...allergy,
                            notes: event.target.value || null,
                          })
                        }
                      />
                    </label>
                  </>
                )}
                {dialog === "condition" && (
                  <>
                    <label className="full">
                      اسم المرض
                      <input
                        autoFocus
                        required
                        value={condition.name}
                        onChange={(event) =>
                          setCondition({
                            ...condition,
                            name: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      تاريخ التشخيص
                      <input
                        type="date"
                        value={condition.diagnosedAt || ""}
                        onChange={(event) =>
                          setCondition({
                            ...condition,
                            diagnosedAt: event.target.value || null,
                          })
                        }
                      />
                    </label>
                    <label>
                      الحالة
                      <select
                        value={condition.status}
                        onChange={(event) =>
                          setCondition({
                            ...condition,
                            status: event.target
                              .value as ChronicConditionInput["status"],
                          })
                        }
                      >
                        <option value="ACTIVE">نشط</option>
                        <option value="CONTROLLED">مسيطر عليه</option>
                        <option value="IN_REMISSION">في هدوء</option>
                      </select>
                    </label>
                    <label className="full">
                      خطة المتابعة
                      <textarea
                        value={condition.followupPlan || ""}
                        onChange={(event) =>
                          setCondition({
                            ...condition,
                            followupPlan: event.target.value || null,
                          })
                        }
                      />
                    </label>
                    <label className="full">
                      ملاحظات
                      <textarea
                        value={condition.notes || ""}
                        onChange={(event) =>
                          setCondition({
                            ...condition,
                            notes: event.target.value || null,
                          })
                        }
                      />
                    </label>
                  </>
                )}
                {dialog === "vitals" && (
                  <>
                    {(
                      [
                        ["heightCm", "الطول (سم)", "0.1"],
                        ["weightKg", "الوزن (كغ)", "0.1"],
                        ["systolic", "الضغط الانقباضي", "1"],
                        ["diastolic", "الضغط الانبساطي", "1"],
                        ["pulse", "النبض", "1"],
                        ["temperatureC", "الحرارة °C", "0.1"],
                        ["spo2", "الأكسجين SpO2 %", "1"],
                      ] as const
                    ).map(([key, label, step]) => (
                      <label key={key}>
                        {label}
                        <input
                          type="number"
                          step={step}
                          value={vitals[key] ?? ""}
                          onChange={(event) =>
                            setVitals({
                              ...vitals,
                              [key]: event.target.value
                                ? Number(event.target.value)
                                : null,
                            })
                          }
                        />
                      </label>
                    ))}
                    <label className="full">
                      ملاحظات
                      <textarea
                        value={vitals.notes || ""}
                        onChange={(event) =>
                          setVitals({
                            ...vitals,
                            notes: event.target.value || null,
                          })
                        }
                      />
                    </label>
                  </>
                )}
                {dialog === "visit" && (
                  <>
                    <label className="full">
                      سبب الزيارة
                      <input
                        autoFocus
                        required
                        value={visit.visitReason}
                        onChange={(event) =>
                          setVisit({
                            ...visit,
                            visitReason: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="full">
                      الأعراض
                      <textarea
                        value={visit.symptoms || ""}
                        onChange={(event) =>
                          setVisit({
                            ...visit,
                            symptoms: event.target.value || null,
                          })
                        }
                      />
                    </label>
                    <label className="full">
                      التشخيص الأساسي
                      <input
                        value={diagnosis}
                        onChange={(event) => setDiagnosis(event.target.value)}
                      />
                    </label>
                    <label className="full">
                      الملاحظات السريرية
                      <textarea
                        value={visit.clinicalNotes || ""}
                        onChange={(event) =>
                          setVisit({
                            ...visit,
                            clinicalNotes: event.target.value || null,
                          })
                        }
                      />
                    </label>
                    <label className="full">
                      الخطة العلاجية
                      <textarea
                        value={visit.treatmentPlan || ""}
                        onChange={(event) =>
                          setVisit({
                            ...visit,
                            treatmentPlan: event.target.value || null,
                          })
                        }
                      />
                    </label>
                    <label className="full">
                      التعليمات والنصائح
                      <textarea
                        value={visit.educationInstructions || ""}
                        onChange={(event) =>
                          setVisit({
                            ...visit,
                            educationInstructions: event.target.value || null,
                          })
                        }
                      />
                    </label>
                    <label className="full">
                      خطة المتابعة
                      <textarea
                        value={visit.followupPlan || ""}
                        onChange={(event) =>
                          setVisit({
                            ...visit,
                            followupPlan: event.target.value || null,
                          })
                        }
                      />
                    </label>
                  </>
                )}
                {dialog === "prescription" && (
                  <>
                    <label className="full">
                      اسم الدواء
                      <input
                        autoFocus
                        required
                        value={prescription.items[0].medicationName}
                        onChange={(e) =>
                          setPrescription({
                            ...prescription,
                            items: [
                              {
                                ...prescription.items[0],
                                medicationName: e.target.value,
                              },
                            ],
                          })
                        }
                      />
                    </label>
                    <label>
                      الجرعة
                      <input
                        required
                        value={prescription.items[0].dosage}
                        onChange={(e) =>
                          setPrescription({
                            ...prescription,
                            items: [
                              {
                                ...prescription.items[0],
                                dosage: e.target.value,
                              },
                            ],
                          })
                        }
                      />
                    </label>
                    <label>
                      الشكل الدوائي
                      <input
                        value={prescription.items[0].dosageForm || ""}
                        onChange={(e) =>
                          setPrescription({
                            ...prescription,
                            items: [
                              {
                                ...prescription.items[0],
                                dosageForm: e.target.value || null,
                              },
                            ],
                          })
                        }
                      />
                    </label>
                    <label>
                      عدد المرات
                      <input
                        required
                        placeholder="مثال: مرتان يومياً"
                        value={prescription.items[0].frequency}
                        onChange={(e) =>
                          setPrescription({
                            ...prescription,
                            items: [
                              {
                                ...prescription.items[0],
                                frequency: e.target.value,
                              },
                            ],
                          })
                        }
                      />
                    </label>
                    <label>
                      مدة الاستخدام
                      <input
                        required
                        placeholder="مثال: 7 أيام"
                        value={prescription.items[0].duration}
                        onChange={(e) =>
                          setPrescription({
                            ...prescription,
                            items: [
                              {
                                ...prescription.items[0],
                                duration: e.target.value,
                              },
                            ],
                          })
                        }
                      />
                    </label>
                    <label className="full">
                      طريقة الاستخدام
                      <textarea
                        value={prescription.items[0].instructions || ""}
                        onChange={(e) =>
                          setPrescription({
                            ...prescription,
                            items: [
                              {
                                ...prescription.items[0],
                                instructions: e.target.value || null,
                              },
                            ],
                          })
                        }
                      />
                    </label>
                    <label className="full">
                      ملاحظات الوصفة
                      <textarea
                        value={prescription.notes || ""}
                        onChange={(e) =>
                          setPrescription({
                            ...prescription,
                            notes: e.target.value || null,
                          })
                        }
                      />
                    </label>
                  </>
                )}
                {dialog === "lab" && (
                  <>
                    <label className="full">
                      اسم التحليل
                      <input
                        autoFocus
                        required
                        value={lab.testName}
                        onChange={(e) =>
                          setLab({ ...lab, testName: e.target.value })
                        }
                      />
                    </label>
                    <label className="full">
                      ملاحظات الطلب
                      <textarea
                        value={lab.orderNotes || ""}
                        onChange={(e) =>
                          setLab({ ...lab, orderNotes: e.target.value || null })
                        }
                      />
                    </label>
                  </>
                )}
                {dialog === "imaging" && (
                  <>
                    <label className="full">
                      نوع الأشعة
                      <input
                        autoFocus
                        required
                        value={imaging.imagingType}
                        onChange={(e) =>
                          setImaging({
                            ...imaging,
                            imagingType: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="full">
                      سبب الطلب
                      <textarea
                        required
                        value={imaging.reason}
                        onChange={(e) =>
                          setImaging({ ...imaging, reason: e.target.value })
                        }
                      />
                    </label>
                    <label className="full">
                      التقرير (اختياري)
                      <textarea
                        value={imaging.report || ""}
                        onChange={(e) =>
                          setImaging({
                            ...imaging,
                            report: e.target.value || null,
                          })
                        }
                      />
                    </label>
                  </>
                )}
                {dialog === "followup" && (
                  <>
                    <label className="full">
                      سبب المتابعة
                      <input
                        autoFocus
                        required
                        value={followup.reason}
                        onChange={(e) =>
                          setFollowup({ ...followup, reason: e.target.value })
                        }
                      />
                    </label>
                    <label className="full">
                      تاريخ ووقت الاستحقاق
                      <input
                        required
                        type="datetime-local"
                        value={followup.dueAt}
                        onChange={(e) =>
                          setFollowup({ ...followup, dueAt: e.target.value })
                        }
                      />
                    </label>
                    <label className="full">
                      ملاحظات
                      <textarea
                        value={followup.notes || ""}
                        onChange={(e) =>
                          setFollowup({
                            ...followup,
                            notes: e.target.value || null,
                          })
                        }
                      />
                    </label>
                  </>
                )}
              </div>
              {error && <div className="inline-form-error">{error}</div>}
              <div className="modal-actions">
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => setDialog(null)}
                >
                  إلغاء
                </button>
                <button className="button primary" disabled={saving}>
                  {saving ? "جارٍ الحفظ..." : "حفظ"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
