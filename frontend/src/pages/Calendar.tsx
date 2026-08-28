import { useEffect, useMemo, useState } from "react";
import type { Appointment } from "shared";
import { appointmentApi } from "../api/client";
import { useAuth } from "../auth/AuthContext";
type View = "day" | "week" | "month";
const dayMs = 86400000;
const startDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const add = (d: Date, n: number) => new Date(d.getTime() + n * dayMs);
const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
function range(view: View, anchor: Date) {
  if (view === "day") {
    const s = startDay(anchor);
    return [s, add(s, 1)] as const;
  }
  if (view === "week") {
    const s = add(startDay(anchor), -anchor.getDay());
    return [s, add(s, 7)] as const;
  }
  const s = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const grid = add(startDay(s), -s.getDay());
  return [grid, add(grid, 42)] as const;
}
export default function CalendarPage() {
  const { user } = useAuth();
  const canMove = Boolean(user?.permissions.includes("appointments.manage"));
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(new Date());
  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dragId, setDragId] = useState("");
  const [from, to] = useMemo(() => range(view, anchor), [view, anchor]);
  async function load() {
    setLoading(true);
    try {
      setItems(
        (await appointmentApi.list(from.toISOString(), to.toISOString())).items,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [from.toISOString(), to.toISOString()]);
  function shift(n: number) {
    const d = new Date(anchor);
    if (view === "month") d.setMonth(d.getMonth() + n);
    else d.setDate(d.getDate() + n * (view === "week" ? 7 : 1));
    setAnchor(d);
  }
  async function move(target: Date, hour?: number, minute = 0) {
    const item = items.find((x) => x.id === dragId);
    if (!item || !canMove) return;
    const old = new Date(item.startAt);
    const next = new Date(target);
    next.setHours(
      hour ?? old.getHours(),
      hour === undefined ? old.getMinutes() : minute,
      0,
      0,
    );
    try {
      const r = await appointmentApi.reschedule(item.id, next.toISOString());
      setNotice(r.message);
      setDragId("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const days = Array.from(
    { length: view === "month" ? 42 : view === "week" ? 7 : 1 },
    (_, i) => add(from, i),
  );
  const slots = Array.from({ length: 17 }, (_, i) => ({
    h: 9 + Math.floor(i / 2),
    m: (i % 2) * 30,
  }));
  return (
    <div className="page-stack calendar-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">جدول العيادة</span>
          <h1>تقويم المواعيد</h1>
          <p>عرض يومي وأسبوعي وشهري مع منع التعارض عند إعادة الجدولة.</p>
        </div>
        <div className="calendar-controls">
          <button onClick={() => shift(-1)}>‹ السابق</button>
          <button onClick={() => setAnchor(new Date())}>اليوم</button>
          <button onClick={() => shift(1)}>التالي ›</button>
        </div>
      </div>
      {error && (
        <div className="alert error">
          <span>!</span>
          {error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}
      {notice && (
        <div className="alert success">
          <span>✓</span>
          {notice}
          <button onClick={() => setNotice("")}>×</button>
        </div>
      )}
      <div className="calendar-toolbar">
        <strong>
          {new Intl.DateTimeFormat("ar-JO", {
            month: "long",
            year: "numeric",
          }).format(anchor)}
        </strong>
        <div>
          {(["day", "week", "month"] as View[]).map((v) => (
            <button
              key={v}
              className={view === v ? "active" : ""}
              onClick={() => setView(v)}
            >
              {v === "day" ? "يومي" : v === "week" ? "أسبوعي" : "شهري"}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="record-body-skeleton" />
      ) : view === "month" ? (
        <div className="month-grid">
          {days.map((day) => (
            <section
              key={day.toISOString()}
              className={`${day.getMonth() !== anchor.getMonth() ? "outside" : ""} ${same(day, new Date()) ? "today" : ""}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => void move(day)}
            >
              <header>
                <b>{day.getDate()}</b>
                <span>
                  {new Intl.DateTimeFormat("ar-JO", {
                    weekday: "short",
                  }).format(day)}
                </span>
              </header>
              {items
                .filter((x) => same(new Date(x.startAt), day))
                .map((item) => (
                  <AppointmentChip
                    key={item.id}
                    item={item}
                    canDrag={canMove}
                    onDrag={() => setDragId(item.id)}
                  />
                ))}
            </section>
          ))}
        </div>
      ) : (
        <div className={`time-calendar ${view}`}>
          {days.map((day) => (
            <section className="calendar-day" key={day.toISOString()}>
              <header>
                <strong>
                  {new Intl.DateTimeFormat("ar-JO", { weekday: "long" }).format(
                    day,
                  )}
                </strong>
                <span>
                  {day.getDate()}/{day.getMonth() + 1}
                </span>
              </header>
              <div className="time-slots">
                {slots.map((slot) => {
                  const at = items.filter((x) => {
                    const d = new Date(x.startAt);
                    return (
                      same(d, day) &&
                      d.getHours() === slot.h &&
                      d.getMinutes() === slot.m
                    );
                  });
                  return (
                    <div
                      className="time-slot"
                      key={`${slot.h}-${slot.m}`}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => void move(day, slot.h, slot.m)}
                    >
                      <time>
                        {String(slot.h).padStart(2, "0")}:
                        {String(slot.m).padStart(2, "0")}
                      </time>
                      <div>
                        {at.map((item) => (
                          <AppointmentChip
                            key={item.id}
                            item={item}
                            canDrag={canMove}
                            onDrag={() => setDragId(item.id)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}{" "}
      {canMove && (
        <p className="drag-hint">
          اسحب بطاقة الموعد إلى يوم أو وقت آخر؛ سيمنع النظام أي تعارض تلقائياً.
        </p>
      )}
    </div>
  );
}
function AppointmentChip({
  item,
  canDrag,
  onDrag,
}: {
  item: Appointment;
  canDrag: boolean;
  onDrag: () => void;
}) {
  return (
    <article
      className={`calendar-appointment status-${item.status.toLowerCase()}`}
      draggable={canDrag}
      onDragStart={onDrag}
    >
      <strong>
        {new Date(item.startAt).toLocaleTimeString("ar-JO", {
          hour: "2-digit",
          minute: "2-digit",
        })}{" "}
        · {item.patientName}
      </strong>
      <span>
        {item.reason} · {item.statusLabel}
      </span>
    </article>
  );
}
