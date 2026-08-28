import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { operationsApi } from "../api/client";
export default function GlobalSearch() {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any>({
    patients: [],
    appointments: [],
    visits: [],
  });
  useEffect(() => {
    if (q.trim().length < 2) {
      setResults({ patients: [], appointments: [], visits: [] });
      return;
    }
    const t = setTimeout(
      () =>
        operationsApi
          .search(q)
          .then(setResults)
          .catch(() => {}),
      220,
    );
    return () => clearTimeout(t);
  }, [q]);
  function go(id: string) {
    setOpen(false);
    setQ("");
    nav(`/patients/${id}`);
  }
  return (
    <div className="global-search">
      <button
        className="header-icon"
        aria-label="البحث العام"
        onClick={() => setOpen(!open)}
      >
        ⌕
      </button>
      {open && (
        <div className="header-popover search-popover">
          <header>
            <strong>بحث سريع</strong>
            <button onClick={() => setOpen(false)}>×</button>
          </header>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="مريض، هاتف، ملف، موعد أو زيارة"
          />
          {q.length >= 2 && (
            <div className="global-results">
              {results.patients.map((x: any) => (
                <button key={`p${x.id}`} onClick={() => go(x.id)}>
                  <b>{x.fullName}</b>
                  <small>
                    {x.medicalNumber} · {x.phone}
                  </small>
                </button>
              ))}
              {results.appointments.map((x: any) => (
                <button key={`a${x.id}`} onClick={() => go(x.patientId)}>
                  <b>موعد: {x.patientName}</b>
                  <small>{new Date(x.startAt).toLocaleString("ar-JO")}</small>
                </button>
              ))}
              {results.visits.map((x: any) => (
                <button key={`v${x.id}`} onClick={() => go(x.patientId)}>
                  <b>زيارة: {x.patientName}</b>
                  <small>{x.reason}</small>
                </button>
              ))}
              {results.patients.length +
                results.appointments.length +
                results.visits.length ===
                0 && <div className="popover-empty">لا توجد نتائج.</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
