import { useEffect, useState } from "react";
import { Webhook, Plus, Trash2, ChevronDown, ChevronRight, Circle } from "lucide-react";
import { getWebhooks, createWebhook, updateWebhook, deleteWebhook, getWebhookEvents, type Webhook as WebhookType, type WebhookEvent } from "../api/webhooks";
import { useAuth } from "../auth/AuthContext";
import Breadcrumb from "../components/Breadcrumb";
import { formatDateTime } from "../utils/formatters";

const EVENT_TYPES = [
  "entity.created", "entity.updated", "entity.deleted",
  "comment.added", "approval.requested", "approval.reviewed",
];

export default function WebhooksPage() {
  const { isSteward } = useAuth();
  const [webhooks, setWebhooks] = useState<WebhookType[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [events, setEvents] = useState<WebhookEvent[]>([]);

  // Create form state
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const load = () => { getWebhooks().then(setWebhooks); };
  useEffect(load, []);

  const handleCreate = async () => {
    if (!name.trim() || !url.trim() || selectedEvents.length === 0) return;
    setCreating(true);
    try {
      await createWebhook({ name: name.trim(), url: url.trim(), secret: secret || undefined, events: selectedEvents });
      setName(""); setUrl(""); setSecret(""); setSelectedEvents([]); setShowCreate(false);
      load();
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (wh: WebhookType) => {
    await updateWebhook(wh.id, { is_active: !wh.is_active });
    load();
  };

  const handleDelete = async (id: string) => {
    await deleteWebhook(id);
    load();
  };

  const handleExpand = async (id: string) => {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    const data = await getWebhookEvents(id, 1, 10);
    setEvents(data.items);
  };

  const toggleEvent = (evt: string) => {
    setSelectedEvents((prev) => prev.includes(evt) ? prev.filter((e) => e !== evt) : [...prev, evt]);
  };

  if (!isSteward) return <div className="text-red-500 text-sm">Access denied. Steward only.</div>;

  return (
    <div>
      <Breadcrumb items={[{ label: "Webhooks" }]} />
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Webhook size={20} /> Webhooks
        </h1>
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
          <Plus size={14} /> New Webhook
        </button>
      </div>

      {showCreate && (
        <div className="bg-white border rounded-lg p-4 mb-4">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="border rounded px-3 py-1.5 text-sm w-full" placeholder="My Webhook" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">URL</label>
              <input value={url} onChange={(e) => setUrl(e.target.value)} className="border rounded px-3 py-1.5 text-sm w-full" placeholder="https://example.com/webhook" />
            </div>
          </div>
          <div className="mb-3">
            <label className="text-xs text-gray-500 block mb-1">Secret (optional, for HMAC signing)</label>
            <input value={secret} onChange={(e) => setSecret(e.target.value)} type="password" className="border rounded px-3 py-1.5 text-sm w-full" placeholder="webhook-secret" />
          </div>
          <div className="mb-3">
            <label className="text-xs text-gray-500 block mb-1">Events</label>
            <div className="flex flex-wrap gap-2">
              {EVENT_TYPES.map((evt) => (
                <button key={evt} onClick={() => toggleEvent(evt)} className={`text-xs px-2 py-1 rounded border ${selectedEvents.includes(evt) ? "bg-blue-100 text-blue-700 border-blue-300" : "bg-white text-gray-600 border-gray-200"}`}>
                  {evt}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={creating} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded disabled:opacity-50">{creating ? "Creating..." : "Create"}</button>
            <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-sm text-gray-500">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white border rounded-lg divide-y">
        {webhooks.length === 0 && (
          <div className="p-8 text-center text-gray-400 text-sm">No webhooks configured.</div>
        )}
        {webhooks.map((wh) => (
          <div key={wh.id}>
            <div className="flex items-center gap-3 p-4 hover:bg-gray-50 cursor-pointer" onClick={() => handleExpand(wh.id)}>
              {expanded === wh.id ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
              <Circle size={8} className={wh.is_active ? "text-green-500 fill-green-500" : "text-gray-300 fill-gray-300"} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{wh.name}</div>
                <div className="text-xs text-gray-400 truncate">{wh.url}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {wh.events.map((e) => (
                    <span key={e} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{e}</span>
                  ))}
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleToggleActive(wh); }} className={`text-xs px-2 py-1 rounded border ${wh.is_active ? "text-green-600 border-green-300" : "text-gray-400 border-gray-200"}`}>
                  {wh.is_active ? "Active" : "Inactive"}
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(wh.id); }} className="text-gray-400 hover:text-red-500">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            {expanded === wh.id && (
              <div className="px-4 pb-4">
                <div className="text-xs font-semibold text-gray-500 mb-2">Recent Deliveries</div>
                {events.length === 0 ? (
                  <div className="text-xs text-gray-400">No deliveries yet.</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-1 font-medium text-gray-500">Event</th>
                        <th className="text-left py-1 font-medium text-gray-500">Status</th>
                        <th className="text-left py-1 font-medium text-gray-500">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((ev) => (
                        <tr key={ev.id} className="border-b">
                          <td className="py-1">{ev.event_type}</td>
                          <td className="py-1">
                            <span className={`px-1.5 py-0.5 rounded ${ev.status_code && ev.status_code >= 200 && ev.status_code < 300 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
                              {ev.status_code || "pending"}
                            </span>
                          </td>
                          <td className="py-1 text-gray-400">{formatDateTime(ev.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
