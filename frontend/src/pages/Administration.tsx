import { useEffect, useMemo, useState, type FormEvent } from "react";
import { adminApi } from "../api/client";
type Tab = "doctors" | "hours" | "reasons" | "users" | "roles";
export default function Administration() {
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<Tab>("doctors");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState<"doctor" | "reason" | "user" | null>(null);
  const [query, setQuery] = useState("");
  const [doctor, setDoctor] = useState({
    fullName: "",
    specialty: "طب الأسرة",
    phone: "",
    licenseNumber: "",
    isActive: true,
  });
  const [reason, setReason] = useState({
    category: "عام",
    nameAr: "",
    isActive: true,
  });
  const [newUser, setNewUser] = useState({
    fullName: "",
    email: "",
    password: "",
    roleId: "",
    phone: "",
  });
  async function load() {
    try {
      setData(await adminApi.get());
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const reasons = useMemo(
    () =>
      data?.reasons.filter(
        (x: any) => !query || `${x.nameAr} ${x.category}`.includes(query),
      ) ?? [],
    [data, query],
  );
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      const r =
        modal === "doctor"
          ? await adminApi.addDoctor(doctor)
          : modal === "reason"
            ? await adminApi.addReason(reason)
            : await adminApi.addUser(newUser);
      setNotice(r.message);
      setModal(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  if (!data) return <div className="record-body-skeleton" />;
  return (
    <div className="page-stack admin-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">إعدادات النظام</span>
          <h1>الإدارة والصلاحيات</h1>
          <p>إدارة الأطباء والمستخدمين وأسباب الزيارة والصلاحيات.</p>
        </div>
        {tab !== "roles" && tab !== "hours" && (
          <button
            className="button primary"
            onClick={() => {
              setModal(
                tab === "doctors"
                  ? "doctor"
                  : tab === "reasons"
                    ? "reason"
                    : "user",
              );
              if (tab === "users")
                setNewUser({ ...newUser, roleId: data.roles[0]?.id || "" });
            }}
          >
            ＋ إضافة
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
        {(
          [
            ["doctors", "الأطباء"],
            ["hours", "ساعات العمل"],
            ["reasons", "أسباب الزيارة"],
            ["users", "المستخدمون"],
            ["roles", "الصلاحيات"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "doctors" && (
        <section className="clinical-card">
          <div className="card-heading">
            <div>
              <h2>الأطباء</h2>
              <p>
                يظهر اختيار الطبيب في الحجز تلقائياً عند وجود أكثر من طبيب فعال.
              </p>
            </div>
          </div>
          <div className="admin-grid">
            {data.doctors.map((x: any) => (
              <article key={x.id}>
                <span className="admin-avatar">د</span>
                <div>
                  <strong>{x.fullName}</strong>
                  <small>
                    {x.specialty} · {x.isActive ? "فعال" : "معطل"}
                  </small>
                  <p>
                    {x.phone || "لا يوجد هاتف"}{" "}
                    {x.licenseNumber ? `· ترخيص ${x.licenseNumber}` : ""}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    const r = await adminApi.updateDoctor(x.id, {
                      ...x,
                      isActive: !x.isActive,
                    });
                    setNotice(r.message);
                    await load();
                  }}
                >
                  {x.isActive ? "تعطيل" : "تفعيل"}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
      {tab === "hours" && (
        <HoursPanel
          doctors={data.doctors}
          current={data.workingHours}
          onSaved={setNotice}
        />
      )}
      {tab === "reasons" && (
        <section className="clinical-card">
          <div className="card-heading">
            <div>
              <h2>أسباب الزيارة</h2>
              <p>{data.reasons.length} سبباً قابلاً للبحث والتعطيل.</p>
            </div>
            <input
              className="mini-search"
              placeholder="بحث"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="reason-admin-list">
            {reasons.map((x: any) => (
              <article key={x.id} className={!x.isActive ? "inactive" : ""}>
                <div>
                  <strong>{x.nameAr}</strong>
                  <small>
                    {x.category} · استُخدم {x.usageCount} مرة
                  </small>
                </div>
                <button
                  onClick={async () => {
                    const r = await adminApi.updateReason(x.id, {
                      category: x.category,
                      nameAr: x.nameAr,
                      isActive: !x.isActive,
                    });
                    setNotice(r.message);
                    await load();
                  }}
                >
                  {x.isActive ? "تعطيل" : "تفعيل"}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
      {tab === "users" && (
        <section className="clinical-card">
          <div className="card-heading">
            <h2>المستخدمون</h2>
          </div>
          <div className="condition-list">
            {data.users.map((x: any) => (
              <article key={x.id}>
                <span className="admin-avatar">{x.fullName.charAt(0)}</span>
                <div>
                  <strong>{x.fullName}</strong>
                  <small>
                    {x.email} · {x.roleName}
                  </small>
                </div>
                <select
                  value={x.roleId}
                  onChange={async (e) => {
                    const r = await adminApi.updateUser(x.id, {
                      roleId: e.target.value,
                      isActive: x.isActive,
                    });
                    setNotice(r.message);
                    await load();
                  }}
                >
                  {data.roles.map((role: any) => (
                    <option key={role.id} value={role.id}>
                      {role.nameAr}
                    </option>
                  ))}
                </select>
                <button
                  onClick={async () => {
                    const r = await adminApi.updateUser(x.id, {
                      roleId: x.roleId,
                      isActive: !x.isActive,
                    });
                    setNotice(r.message);
                    await load();
                  }}
                >
                  {x.isActive ? "تعطيل" : "تفعيل"}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
      {tab === "roles" && (
        <div className="roles-grid">
          {data.roles.map((role: any) => (
            <RoleCard
              key={role.id}
              role={role}
              permissions={data.permissions}
              onSaved={async (m) => {
                setNotice(m);
                await load();
              }}
            />
          ))}
        </div>
      )}
      {modal && (
        <div className="modal-backdrop">
          <section className="modal">
            <div className="modal-header">
              <h2>
                {modal === "doctor"
                  ? "إضافة طبيب"
                  : modal === "reason"
                    ? "إضافة سبب زيارة"
                    : "إنشاء مستخدم"}
              </h2>
              <button className="icon-button" onClick={() => setModal(null)}>
                ×
              </button>
            </div>
            <form onSubmit={submit}>
              <div className="form-grid">
                {modal === "doctor" && (
                  <>
                    <label className="full">
                      اسم الطبيب
                      <input
                        required
                        value={doctor.fullName}
                        onChange={(e) =>
                          setDoctor({ ...doctor, fullName: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      التخصص
                      <input
                        required
                        value={doctor.specialty}
                        onChange={(e) =>
                          setDoctor({ ...doctor, specialty: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      الهاتف
                      <input
                        value={doctor.phone}
                        onChange={(e) =>
                          setDoctor({ ...doctor, phone: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      رقم الترخيص
                      <input
                        value={doctor.licenseNumber}
                        onChange={(e) =>
                          setDoctor({
                            ...doctor,
                            licenseNumber: e.target.value,
                          })
                        }
                      />
                    </label>
                  </>
                )}
                {modal === "reason" && (
                  <>
                    <label>
                      الفئة
                      <input
                        required
                        value={reason.category}
                        onChange={(e) =>
                          setReason({ ...reason, category: e.target.value })
                        }
                      />
                    </label>
                    <label className="full">
                      اسم السبب بالعربية
                      <input
                        required
                        value={reason.nameAr}
                        onChange={(e) =>
                          setReason({ ...reason, nameAr: e.target.value })
                        }
                      />
                    </label>
                  </>
                )}
                {modal === "user" && (
                  <>
                    <label className="full">
                      الاسم الكامل
                      <input
                        required
                        value={newUser.fullName}
                        onChange={(e) =>
                          setNewUser({ ...newUser, fullName: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      البريد الإلكتروني
                      <input
                        type="email"
                        required
                        value={newUser.email}
                        onChange={(e) =>
                          setNewUser({ ...newUser, email: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      الهاتف
                      <input
                        value={newUser.phone}
                        onChange={(e) =>
                          setNewUser({ ...newUser, phone: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      الدور
                      <select
                        value={newUser.roleId}
                        onChange={(e) =>
                          setNewUser({ ...newUser, roleId: e.target.value })
                        }
                      >
                        {data.roles.map((x: any) => (
                          <option key={x.id} value={x.id}>
                            {x.nameAr}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="full">
                      كلمة المرور المؤقتة
                      <input
                        type="password"
                        required
                        minLength={12}
                        value={newUser.password}
                        onChange={(e) =>
                          setNewUser({ ...newUser, password: e.target.value })
                        }
                      />
                      <small>
                        12 حرفاً على الأقل، ثم تُسلّم للمستخدم بطريقة آمنة.
                      </small>
                    </label>
                  </>
                )}
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => setModal(null)}
                >
                  إلغاء
                </button>
                <button className="button primary">حفظ</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
function RoleCard({
  role,
  permissions,
  onSaved,
}: {
  role: any;
  permissions: any[];
  onSaved: (m: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>(role.permissions);
  return (
    <section className="clinical-card role-card">
      <div className="card-heading">
        <div>
          <h2>{role.nameAr}</h2>
          <p>{role.descriptionAr}</p>
        </div>
      </div>
      <div className="permission-list">
        {permissions.map((p) => (
          <label key={p.code}>
            <input
              type="checkbox"
              checked={selected.includes(p.code)}
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? [...selected, p.code]
                    : selected.filter((x) => x !== p.code),
                )
              }
            />
            <span>
              {p.nameAr}
              <small>{p.category}</small>
            </span>
          </label>
        ))}
      </div>
      <button
        className="button primary"
        onClick={async () =>
          onSaved((await adminApi.saveRole(role.id, selected)).message)
        }
      >
        حفظ الصلاحيات
      </button>
    </section>
  );
}

function HoursPanel({
  doctors,
  current,
  onSaved,
}: {
  doctors: any[];
  current: any[];
  onSaved: (m: string) => void;
}) {
  const [doctorId, setDoctorId] = useState(doctors[0]?.id || "");
  const defaults = () =>
    Array.from({ length: 7 }, (_, dayOfWeek) => ({
      dayOfWeek,
      startTime: "09:00",
      endTime: "17:00",
      isWorking: dayOfWeek >= 0 && dayOfWeek <= 4,
    }));
  const [hours, setHours] = useState(defaults);
  useEffect(() => {
    const rows = current.filter((x) => x.doctor_id === doctorId);
    setHours(
      rows.length === 7
        ? rows.map((x) => ({
            dayOfWeek: x.day_of_week,
            startTime: String(x.start_time).slice(0, 5),
            endTime: String(x.end_time).slice(0, 5),
            isWorking: x.is_working,
          }))
        : defaults(),
    );
  }, [doctorId, current]);
  const names = [
    "الأحد",
    "الاثنين",
    "الثلاثاء",
    "الأربعاء",
    "الخميس",
    "الجمعة",
    "السبت",
  ];
  return (
    <section className="clinical-card">
      <div className="card-heading">
        <div>
          <h2>ساعات العمل</h2>
          <p>تُستخدم لتحديد جدول كل طبيب ومدة المواعيد المتاحة.</p>
        </div>
        <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
          {doctors.map((x) => (
            <option key={x.id} value={x.id}>
              {x.fullName}
            </option>
          ))}
        </select>
      </div>
      <div className="working-hours">
        {hours.map((h, index) => (
          <div key={h.dayOfWeek}>
            <label className="day-toggle">
              <input
                type="checkbox"
                checked={h.isWorking}
                onChange={(e) =>
                  setHours(
                    hours.map((x, i) =>
                      i === index ? { ...x, isWorking: e.target.checked } : x,
                    ),
                  )
                }
              />
              {names[h.dayOfWeek]}
            </label>
            <label>
              من
              <input
                type="time"
                disabled={!h.isWorking}
                value={h.startTime}
                onChange={(e) =>
                  setHours(
                    hours.map((x, i) =>
                      i === index ? { ...x, startTime: e.target.value } : x,
                    ),
                  )
                }
              />
            </label>
            <label>
              إلى
              <input
                type="time"
                disabled={!h.isWorking}
                value={h.endTime}
                onChange={(e) =>
                  setHours(
                    hours.map((x, i) =>
                      i === index ? { ...x, endTime: e.target.value } : x,
                    ),
                  )
                }
              />
            </label>
          </div>
        ))}
      </div>
      <button
        className="button primary hours-save"
        onClick={async () =>
          onSaved((await adminApi.saveHours(doctorId, hours)).message)
        }
      >
        حفظ ساعات العمل
      </button>
    </section>
  );
}
