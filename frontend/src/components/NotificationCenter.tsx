import { useEffect, useState } from "react";
import { operationsApi } from "../api/client";
export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  async function load() {
    try {
      const r = await operationsApi.notifications();
      setItems(r.items);
      setUnread(r.unread);
    } catch {}
  }
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 60000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="notification-center">
      <button
        className="header-icon"
        aria-label={`الإشعارات، ${unread} غير مقروء`}
        onClick={() => setOpen(!open)}
      >
        ♢{unread > 0 && <b>{unread > 99 ? "99+" : unread}</b>}
      </button>
      {open && (
        <div className="header-popover notifications-popover">
          <header>
            <strong>الإشعارات</strong>
            <button onClick={() => setOpen(false)}>×</button>
          </header>
          {items.length === 0 ? (
            <div className="popover-empty">لا توجد إشعارات جديدة.</div>
          ) : (
            items.slice(0, 15).map((x) => (
              <article
                key={x.id}
                className={!x.isRead ? "unread" : ""}
                onClick={() => {
                  void operationsApi.readNotification(x.id);
                  setItems((v) =>
                    v.map((i) => (i.id === x.id ? { ...i, isRead: true } : i)),
                  );
                  setUnread((v) => Math.max(0, v - 1));
                }}
              >
                <span>
                  {x.type.includes("OVERDUE") || x.type.includes("LATE")
                    ? "!"
                    : "◷"}
                </span>
                <div>
                  <strong>{x.title}</strong>
                  <p>{x.message}</p>
                  <time>
                    {new Intl.DateTimeFormat("ar-JO", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(new Date(x.createdAt))}
                  </time>
                </div>
              </article>
            ))
          )}
        </div>
      )}
    </div>
  );
}
