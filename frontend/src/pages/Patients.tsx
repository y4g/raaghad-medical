import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { ApiError, Patient, PatientInput } from "shared";
import { Link, useSearchParams } from "react-router-dom";
import { patientApi } from "../api/client";

const emptyForm: PatientInput = {
  fullName: "",
  phone: "",
  dateOfBirth: "",
  gender: "ذكر",
  nationalId: null,
  bloodType: null,
  address: null,
  heightCm: null,
  weightKg: null,
  emergencyContactName: null,
  emergencyContactPhone: null,
  notes: null,
};
type FieldErrors = ApiError["errors"];
const firstError = (errors: FieldErrors, key: keyof PatientInput) => {
  const value = errors?.[key];
  return Array.isArray(value) ? value[0] : value;
};

export default function Patients() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formErrors, setFormErrors] = useState<FieldErrors>();
  const [editing, setEditing] = useState<Patient | null>(null);
  const [form, setForm] = useState<PatientInput>(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<Patient | null>(null);
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      openCreate();
      const next = new URLSearchParams(searchParams);
      next.delete("new");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const loadPatients = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await patientApi.list({
        query,
        page,
        archived: includeArchived,
      });
      setPatients(result.items);
      setTotal(result.total);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setLoading(false);
    }
  }, [query, page, includeArchived]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPatients(), 250);
    return () => window.clearTimeout(timer);
  }, [loadPatients]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormErrors(undefined);
    setModalOpen(true);
  }
  function openEdit(patient: Patient) {
    setEditing(patient);
    setForm({
      fullName: patient.fullName,
      phone: patient.phone,
      dateOfBirth: patient.dateOfBirth,
      gender: patient.gender,
      nationalId: patient.nationalId,
      bloodType: patient.bloodType,
      address: patient.address,
      heightCm: patient.heightCm,
      weightKg: patient.weightKg,
      emergencyContactName: patient.emergencyContactName,
      emergencyContactPhone: patient.emergencyContactPhone,
      notes: patient.notes,
    });
    setFormErrors(undefined);
    setModalOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setFormErrors(undefined);
    try {
      const result = editing
        ? await patientApi.update(editing.id, form)
        : await patientApi.create(form);
      setNotice(result.message);
      setModalOpen(false);
      await loadPatients();
    } catch (requestError) {
      const apiError = requestError as Error & { details?: FieldErrors };
      setFormErrors(apiError.details);
      setError(apiError.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleArchive() {
    if (!archiveTarget) return;
    setSaving(true);
    try {
      const result = await patientApi.archive(
        archiveTarget.id,
        !archiveTarget.isArchived,
      );
      setNotice(result.message);
      setArchiveTarget(null);
      await loadPatients();
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const pages = Math.max(1, Math.ceil(total / 25));

  return (
    <div className="page-stack patients-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">السجل الطبي</span>
          <h1>المرضى</h1>
          <p>بحث وإدارة السجلات الأساسية دون حذف التاريخ الطبي.</p>
        </div>
        <button className="button primary" onClick={openCreate}>
          ＋ إضافة مريض
        </button>
      </div>
      {notice && (
        <div className="alert success" role="status">
          <span>✓</span>
          {notice}
          <button onClick={() => setNotice("")} aria-label="إغلاق">
            ×
          </button>
        </div>
      )}
      {error && (
        <div className="alert error" role="alert">
          <span>!</span>
          {error}
          <button onClick={() => setError("")} aria-label="إغلاق">
            ×
          </button>
        </div>
      )}
      <section className="records-card">
        <div className="records-toolbar">
          <div>
            <h2>سجل المرضى</h2>
            <p>{total} سجلًا مطابقًا</p>
          </div>
          <div className="patient-filters">
            <label className="search-box">
              <span>⌕</span>
              <span className="sr-only">بحث</span>
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="الاسم، الهاتف، رقم الملف أو الرقم الوطني"
              />
            </label>
            <label className="archive-filter">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(event) => {
                  setIncludeArchived(event.target.checked);
                  setPage(1);
                }}
              />{" "}
              عرض المؤرشف
            </label>
          </div>
        </div>
        {loading ? (
          <div className="table-skeleton">
            {[1, 2, 3, 4].map((item) => (
              <div key={item}>
                <span />
                <span />
                <span />
              </div>
            ))}
          </div>
        ) : patients.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">♙</div>
            <h3>{query ? "لا توجد نتائج مطابقة" : "لا توجد سجلات مرضى"}</h3>
            <p>
              {query
                ? "جرّب الاسم أو رقم الهاتف أو رقم الملف."
                : "أضف أول مريض لبدء العمل."}
            </p>
            {!query && (
              <button className="button primary" onClick={openCreate}>
                إضافة أول مريض
              </button>
            )}
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>المريض</th>
                  <th>رقم الملف</th>
                  <th>الهاتف</th>
                  <th>العمر</th>
                  <th>فصيلة الدم</th>
                  <th>تنبيهات</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((patient) => (
                  <tr
                    key={patient.id}
                    className={patient.isArchived ? "archived-row" : ""}
                  >
                    <td>
                      <div className="patient-name">
                        <span>{patient.fullName.charAt(0)}</span>
                        <div>
                          <Link
                            className="patient-record-link"
                            to={`/patients/${patient.id}`}
                          >
                            <strong>{patient.fullName}</strong>
                          </Link>
                          <small>
                            {patient.gender} ·{" "}
                            {patient.isArchived ? "مؤرشف" : "فعال"}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="medical-number">
                        {patient.medicalNumber}
                      </span>
                    </td>
                    <td dir="ltr">{patient.phone}</td>
                    <td>{patient.age} سنة</td>
                    <td>{patient.bloodType || "—"}</td>
                    <td>
                      <div className="clinical-flags">
                        {patient.hasAllergies && (
                          <span className="flag allergy">! حساسية</span>
                        )}
                        {patient.hasChronicConditions && (
                          <span className="flag chronic">● مرض مزمن</span>
                        )}
                        {!patient.hasAllergies &&
                          !patient.hasChronicConditions &&
                          "—"}
                      </div>
                    </td>
                    <td>
                      <div className="row-actions">
                        <Link to={`/patients/${patient.id}`}>فتح الملف</Link>
                        <button onClick={() => openEdit(patient)}>تعديل</button>
                        <button
                          className={patient.isArchived ? "" : "danger-link"}
                          onClick={() => setArchiveTarget(patient)}
                        >
                          {patient.isArchived ? "استعادة" : "أرشفة"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <div className="pagination">
            <button
              disabled={page === 1}
              onClick={() => setPage((value) => value - 1)}
            >
              السابق
            </button>
            <span>
              صفحة {page} من {pages}
            </span>
            <button
              disabled={page === pages}
              onClick={() => setPage((value) => value + 1)}
            >
              التالي
            </button>
          </div>
        )}
      </section>

      {modalOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) =>
            event.target === event.currentTarget &&
            !saving &&
            setModalOpen(false)
          }
        >
          <section
            className="modal patient-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="patient-form-title"
          >
            <div className="modal-header">
              <div>
                <span className="eyebrow">
                  {editing ? editing.medicalNumber : "سجل جديد"}
                </span>
                <h2 id="patient-form-title">
                  {editing ? "تعديل بيانات المريض" : "إضافة مريض جديد"}
                </h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setModalOpen(false)}
                aria-label="إغلاق"
              >
                ×
              </button>
            </div>
            <form onSubmit={submit}>
              <div className="form-section">
                <h3>البيانات الأساسية</h3>
                <div className="form-grid">
                  <label className="full">
                    الاسم الكامل
                    <input
                      autoFocus
                      required
                      value={form.fullName}
                      onChange={(event) =>
                        setForm({ ...form, fullName: event.target.value })
                      }
                    />
                    {firstError(formErrors, "fullName") && (
                      <small className="field-error">
                        {firstError(formErrors, "fullName")}
                      </small>
                    )}
                  </label>
                  <label>
                    رقم الهاتف
                    <input
                      required
                      dir="ltr"
                      value={form.phone}
                      onChange={(event) =>
                        setForm({ ...form, phone: event.target.value })
                      }
                    />
                    {firstError(formErrors, "phone") && (
                      <small className="field-error">
                        {firstError(formErrors, "phone")}
                      </small>
                    )}
                  </label>
                  <label>
                    تاريخ الميلاد
                    <input
                      required
                      type="date"
                      value={form.dateOfBirth}
                      max={new Date().toISOString().slice(0, 10)}
                      onChange={(event) =>
                        setForm({ ...form, dateOfBirth: event.target.value })
                      }
                    />
                    {firstError(formErrors, "dateOfBirth") && (
                      <small className="field-error">
                        {firstError(formErrors, "dateOfBirth")}
                      </small>
                    )}
                  </label>
                  <label>
                    الجنس
                    <select
                      value={form.gender}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          gender: event.target.value as PatientInput["gender"],
                        })
                      }
                    >
                      <option>ذكر</option>
                      <option>أنثى</option>
                    </select>
                  </label>
                  <label>
                    الرقم الوطني (اختياري)
                    <input
                      dir="ltr"
                      value={form.nationalId || ""}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          nationalId: event.target.value || null,
                        })
                      }
                    />
                  </label>
                  <label>
                    فصيلة الدم
                    <select
                      value={form.bloodType || ""}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          bloodType: event.target.value || null,
                        })
                      }
                    >
                      <option value="">غير محددة</option>
                      {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(
                        (type) => (
                          <option key={type}>{type}</option>
                        ),
                      )}
                    </select>
                  </label>
                  <label className="full">
                    العنوان
                    <input
                      value={form.address || ""}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          address: event.target.value || null,
                        })
                      }
                    />
                  </label>
                </div>
              </div>
              <div className="form-section">
                <h3>القياسات والتواصل</h3>
                <div className="form-grid">
                  <label>
                    الطول (سم)
                    <input
                      type="number"
                      min="30"
                      max="250"
                      step="0.1"
                      value={form.heightCm ?? ""}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          heightCm: event.target.value
                            ? Number(event.target.value)
                            : null,
                        })
                      }
                    />
                  </label>
                  <label>
                    الوزن (كغ)
                    <input
                      type="number"
                      min="1"
                      max="500"
                      step="0.1"
                      value={form.weightKg ?? ""}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          weightKg: event.target.value
                            ? Number(event.target.value)
                            : null,
                        })
                      }
                    />
                  </label>
                  <label>
                    اسم جهة اتصال للطوارئ
                    <input
                      value={form.emergencyContactName || ""}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          emergencyContactName: event.target.value || null,
                        })
                      }
                    />
                  </label>
                  <label>
                    هاتف الطوارئ
                    <input
                      dir="ltr"
                      value={form.emergencyContactPhone || ""}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          emergencyContactPhone: event.target.value || null,
                        })
                      }
                    />
                  </label>
                  <label className="full">
                    ملاحظات إدارية
                    <textarea
                      value={form.notes || ""}
                      onChange={(event) =>
                        setForm({ ...form, notes: event.target.value || null })
                      }
                    />
                  </label>
                </div>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => setModalOpen(false)}
                >
                  إلغاء
                </button>
                <button className="button primary" disabled={saving}>
                  {saving
                    ? "جارٍ الحفظ..."
                    : editing
                      ? "حفظ التعديلات"
                      : "إضافة المريض"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {archiveTarget && (
        <div className="modal-backdrop">
          <section
            className="modal confirm-modal"
            role="alertdialog"
            aria-modal="true"
          >
            <div className="delete-symbol">
              {archiveTarget.isArchived ? "↺" : "⌁"}
            </div>
            <h2>
              {archiveTarget.isArchived
                ? "استعادة سجل المريض؟"
                : "أرشفة سجل المريض؟"}
            </h2>
            <p>
              {archiveTarget.isArchived
                ? "سيعود السجل إلى قائمة المرضى الفعالين."
                : "سيختفي من القائمة النشطة مع بقاء تاريخه الطبي محفوظًا."}
            </p>
            <div className="modal-actions">
              <button
                className="button ghost"
                onClick={() => setArchiveTarget(null)}
              >
                إلغاء
              </button>
              <button
                className="button primary"
                onClick={toggleArchive}
                disabled={saving}
              >
                {saving
                  ? "يرجى الانتظار..."
                  : archiveTarget.isArchived
                    ? "استعادة"
                    : "أرشفة"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
