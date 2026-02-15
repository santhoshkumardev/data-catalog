import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Check, CheckCheck } from "lucide-react";
import { getNotifications, markNotificationRead, markAllRead, type Notification } from "../api/social";
import Breadcrumb from "../components/Breadcrumb";
import { timeAgo } from "../utils/formatters";

const ENTITY_LINKS: Record<string, (id: string) => string> = {
  database: (id) => `/databases/${id}`,
  schema: (id) => `/schemas/${id}`,
  table: (id) => `/tables/${id}`,
  query: (id) => `/queries/${id}`,
  article: (id) => `/articles/${id}`,
  glossary: (id) => `/glossary/${id}`,
};

export default function NotificationsPage() {
  const [data, setData] = useState<{ total: number; page: number; size: number; items: Notification[] } | null>(null);
  const [page, setPage] = useState(1);

  const load = () => { getNotifications(page, 30).then(setData); };
  useEffect(load, [page]);

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    setData((prev) => prev ? { ...prev, items: prev.items.map((n) => (n.id === id ? { ...n, is_read: true } : n)) } : null);
  };

  const handleMarkAllRead = async () => {
    await markAllRead();
    setData((prev) => prev ? { ...prev, items: prev.items.map((n) => ({ ...n, is_read: true })) } : null);
  };

  const unreadCount = data?.items.filter((n) => !n.is_read).length || 0;

  return (
    <div>
      <Breadcrumb items={[{ label: "Notifications" }]} />
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Bell size={20} /> Notifications
          {unreadCount > 0 && <span className="text-sm font-normal bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{unreadCount} unread</span>}
        </h1>
        {unreadCount > 0 && (
          <button onClick={handleMarkAllRead} className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
            <CheckCheck size={14} /> Mark all as read
          </button>
        )}
      </div>

      <div className="bg-white border rounded-lg divide-y">
        {data?.items.length === 0 && (
          <div className="p-8 text-center text-gray-400 text-sm">No notifications yet.</div>
        )}
        {data?.items.map((n) => {
          const link = n.entity_type && n.entity_id ? ENTITY_LINKS[n.entity_type]?.(n.entity_id) : null;
          const content = (
            <div className={`flex items-start gap-3 p-4 ${!n.is_read ? "bg-blue-50/50" : ""}`}>
              <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${n.is_read ? "bg-transparent" : "bg-blue-500"}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{n.title}</div>
                {n.body && <div className="text-sm text-gray-500 mt-0.5">{n.body}</div>}
                <div className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</div>
              </div>
              {!n.is_read && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleMarkRead(n.id); }}
                  className="text-gray-400 hover:text-blue-500 shrink-0"
                  title="Mark as read"
                >
                  <Check size={16} />
                </button>
              )}
            </div>
          );

          return link ? (
            <Link key={n.id} to={link} className="block hover:bg-gray-50">{content}</Link>
          ) : (
            <div key={n.id}>{content}</div>
          );
        })}
      </div>

      {data && data.total > data.size && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border rounded text-sm disabled:opacity-50">Prev</button>
          <span className="text-sm text-gray-500">Page {page}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(data.total / data.size)} className="px-3 py-1 border rounded text-sm disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
}
