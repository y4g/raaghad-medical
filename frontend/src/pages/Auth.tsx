import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";

type AuthMode = "login" | "register";

export default function AuthPage() {
  const { setupRequired, login, setup, registerDoctor } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [fullName, setFullName] = useState("د. رغد حسين");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [specialty, setSpecialty] = useState("طب الأسرة");
  const [phone, setPhone] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const registering = !setupRequired && mode === "register";

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
    setPassword("");
    setConfirmPassword("");
    if (nextMode === "register") setFullName("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      if (setupRequired) {
        await setup({ fullName, email, password });
      } else if (registering) {
        if (password !== confirmPassword) {
          setError("كلمتا المرور غير متطابقتين.");
          return;
        }
        await registerDoctor({
          fullName,
          email,
          password,
          specialty,
          phone: phone || undefined,
          licenseNumber: licenseNumber || undefined,
        });
      } else {
        await login(email, password);
      }
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const heading = setupRequired
    ? "إعداد النظام لأول مرة"
    : registering
      ? "إنشاء حساب طبيب جديد"
      : "مرحبًا بعودتك";
  const description = setupRequired
    ? "أنشئي حساب الطبيبة والمدير الأول للعيادة."
    : registering
      ? "أدخل بياناتك المهنية لإنشاء حساب محفوظ في نظام العيادة."
      : "سجّلي الدخول للوصول إلى مساحة عمل العيادة.";

  return (
    <main className="auth-page">
      <section className="auth-welcome">
        <div className="auth-brand">
          <span className="auth-logo" aria-hidden="true">
            ✚
          </span>
          <div>
            <strong>عيادة د. رغد حسين</strong>
            <small>طب الأسرة</small>
          </div>
        </div>
        <div className="welcome-copy">
          <span className="eyebrow">رعاية تبدأ بالاهتمام</span>
          <h1>
            إدارة هادئة.
            <br />
            رعاية أقرب.
          </h1>
          <p>
            مساحة عمل آمنة ومنظمة تساعد فريق العيادة على متابعة كل مريض باهتمام.
          </p>
        </div>
        <div className="care-points">
          <span>● سجلات طبية منظمة</span>
          <span>● مواعيد ومتابعات واضحة</span>
          <span>● خصوصية وصلاحيات محمية</span>
        </div>
        <div className="soft-orb orb-one" />
        <div className="soft-orb orb-two" />
      </section>
      <section className="auth-form-side">
        <div className={`auth-card ${registering ? "registration-card" : ""}`}>
          <div className="auth-card-heading">
            <span className="mini-mark">✚</span>
            <h2>{heading}</h2>
            <p>{description}</p>
          </div>
          {error && (
            <div className="alert error" role="alert">
              <span>!</span>
              {error}
            </div>
          )}
          <form onSubmit={submit} className="auth-form">
            {(setupRequired || registering) && (
              <label>
                الاسم الكامل
                <input
                  autoFocus
                  required
                  minLength={2}
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  autoComplete="name"
                  placeholder="د. الاسم الكامل"
                />
              </label>
            )}
            {registering && (
              <div className="auth-fields-grid">
                <label>
                  التخصص
                  <input
                    required
                    minLength={2}
                    value={specialty}
                    onChange={(event) => setSpecialty(event.target.value)}
                  />
                </label>
                <label>
                  رقم الهاتف <small>اختياري</small>
                  <input
                    type="tel"
                    dir="ltr"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    autoComplete="tel"
                  />
                </label>
                <label className="full">
                  رقم الترخيص <small>اختياري</small>
                  <input
                    dir="ltr"
                    value={licenseNumber}
                    onChange={(event) => setLicenseNumber(event.target.value)}
                  />
                </label>
              </div>
            )}
            <label>
              البريد الإلكتروني
              <input
                autoFocus={!setupRequired && !registering}
                required
                type="email"
                dir="ltr"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                autoComplete="username"
              />
            </label>
            <label>
              كلمة المرور
              <div className="password-field">
                <input
                  required
                  minLength={10}
                  type={showPassword ? "text" : "password"}
                  dir="ltr"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="10 أحرف على الأقل"
                  autoComplete={
                    setupRequired || registering
                      ? "new-password"
                      : "current-password"
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? "إخفاء" : "إظهار"}
                </button>
              </div>
            </label>
            {registering && (
              <label>
                تأكيد كلمة المرور
                <input
                  required
                  minLength={10}
                  type={showPassword ? "text" : "password"}
                  dir="ltr"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                />
              </label>
            )}
            {(setupRequired || registering) && (
              <small className="password-hint">
                استخدم كلمة مرور طويلة وفريدة تحتوي على حروف وأرقام ورموز.
              </small>
            )}
            <button
              type="submit"
              className="button primary auth-submit"
              disabled={submitting}
            >
              {submitting
                ? "يرجى الانتظار..."
                : setupRequired
                  ? "إنشاء الحساب وبدء العمل"
                  : registering
                    ? "إنشاء الحساب والدخول"
                    : "تسجيل الدخول"}
            </button>
          </form>
          {!setupRequired && (
            <div className="auth-switch">
              <span>
                {registering
                  ? "لديك حساب محفوظ بالفعل؟"
                  : "انضم طبيب جديد إلى العيادة؟"}
              </span>
              <button
                type="button"
                onClick={() => changeMode(registering ? "login" : "register")}
              >
                {registering ? "العودة لتسجيل الدخول" : "إنشاء حساب طبيب جديد"}
              </button>
            </div>
          )}
          <p className="privacy-note">
            بيانات العيادة محمية ولا يمكن الوصول إليها دون تسجيل الدخول.
          </p>
        </div>
      </section>
    </main>
  );
}
