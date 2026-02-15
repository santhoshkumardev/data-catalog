import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { getUnreadCount, getNotifications, markNotificationRead, type Notification } from "../api/social";
import { timeAgo } from "../utils/formatters";

export default function NotificationBell() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);

  useEffect(() => {
    getUnreadCount().then((r) => setCount(r.count));
    const interval = setInterval(() => getUnreadCount().then((r) => setCount(r.count)), 30000);
    return () => clearInterval(interval);
  }, []);

  const toggleOpen = async () => {
    if (!open) {
      const res = await getNotifications(1, 10);
      setItems(res.items);
    }
    setOpen(!open);
  };

  const markRead = async (id: string) => {
    await markNotificationRead(id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setCount((c) => Math.max(0, c - 1));
  };

  return (
    <div className="relative">
      <button onClick={toggleOpen} className="relative p-1 text-gray-500 hover:text-gray-700">
        <Bell size={20} />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border rounded-lg shadow-lg z-50 max-h-96 overflow-auto">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="font-medium text-sm">Notifications</span>
            <Link to="/notifications" onClick={() => setOpen(false)} className="text-xs text-blue-600 hover:underline">
              See all
            </Link>
          </div>
          {items.length === 0 && <div className="p-4 text-sm text-gray-400 text-center">No notifications</div>}
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => markRead(n.id)}
              className={`w-full text-left px-3 py-2 hover:bg-gray-50 border-b text-sm ${!n.is_read ? "bg-blue-50" : ""}`}
            >
              <div className="font-medium text-gray-800">{n.title}</div>
              {n.body && <div className="text-xs text-gray-500 truncate">{n.body}</div>}
              <div className="text-xs text-gray-400 mt-0.5">{timeAgo(n.created_at)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
