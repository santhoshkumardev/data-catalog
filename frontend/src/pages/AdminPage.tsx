import { useEffect, useState } from "react";
import { Shield, Users, Clock, ChevronDown, ChevronRight } from "lucide-react";
import { getUsers, updateUserRole, getAuditLog, type AuditLogEntry, type Paginated } from "../api/catalog";
import { useAuth } from "../auth/AuthContext";
import Breadcrumb from "../components/Breadcrumb";
import { formatDateTime } from "../utils/formatters";

type Tab = "users" | "audit";

const ROLES = ["admin", "steward", "viewer"] as const;

export default function AdminPage() {
  const { isAdmin, user } = useAuth();
  const [tab, setTab] = useState<Tab>("users");

  if (!isAdmin) return <div className="text-red-500 text-sm">Access denied. Admin only.</div>;

  return (
    <div>
      <Breadcrumb items={[{ label: "Admin" }]} />
      <div className="flex gap-4 mb-4">
        <button onClick={() => setTab("users")} className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded ${tab === "users" ? "bg-blue-600 text-white" : "bg-white border text-gray-700 hover:bg-gray-50"}`}>
          <Users size={14} /> Users & Roles
        </button>
        <button onClick={() => setTab("audit")} className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded ${tab === "audit" ? "bg-blue-600 text-white" : "bg-white border text-gray-700 hover:bg-gray-50"}`}>
          <Clock size={14} /> Audit Log
        </button>
      </div>
      {tab === "users" ? <UsersTab currentUserId={user?.id} /> : <AuditTab />}
    </div>
  );
}

function UsersTab({ currentUserId }: { currentUserId?: string }) {
  const [users, setUsers] = useState<{ id: string; email: string; name: string; role: string }[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => { getUsers().then(setUsers); }, []);

  const handleRoleChange = async (userId: string, role: string) => {
    setSaving(userId);
    try {
      await updateUserRole(userId, role);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="bg-white border rounded-lg">
      <div className="px-4 py-3 border-b bg-gray-50">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Shield size={16} /> User Management</h2>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="text-left px-4 py-2 font-medium text-gray-600">Name</th>
            <th className="text-left px-4 py-2 font-medium text-gray-600">Email</th>
            <th className="text-left px-4 py-2 font-medium text-gray-600">Role</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b hover:bg-gray-50">
              <td className="px-4 py-2 font-medium">{u.name}</td>
              <td className="px-4 py-2 text-gray-500">{u.email}</td>
              <td className="px-4 py-2">
                {u.id === currentUserId ? (
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{u.role} (you)</span>
                ) : (
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    disabled={saving === u.id}
                    className="border rounded px-2 py-1 text-sm disabled:opacity-50"
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditTab() {
  const [data, setData] = useState<Paginated<AuditLogEntry> | null>(null);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    getAuditLog(page, 30, typeFilter || undefined).then(setData);
  }, [page, typeFilter]);

  const actionColor = (action: string) => {
    if (action === "create") return "text-green-600 bg-green-50";
    if (action === "update") return "text-blue-600 bg-blue-50";
    if (action === "delete") return "text-red-600 bg-red-50";
    return "text-gray-600 bg-gray-50";
  };

  return (
    <div className="bg-white border rounded-lg">
      <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Clock size={16} /> Audit Log</h2>
        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} className="border rounded px-2 py-1 text-sm">
          <option value="">All entity types</option>
          {["database", "schema", "table", "column", "query", "article", "glossary", "user"].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      <div className="divide-y">
        {data?.items.map((entry) => (
          <div key={entry.id}>
            <div
              className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer"
              onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
            >
              {expanded === entry.id ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${actionColor(entry.action)}`}>{entry.action}</span>
              <span className="text-xs text-gray-400">{entry.entity_type}</span>
              <span className="text-sm">{entry.actor_name || "system"}</span>
              <span className="text-xs text-gray-400 ml-auto">{formatDateTime(entry.created_at)}</span>
            </div>
            {expanded === entry.id && (
              <div className="px-4 py-3 bg-gray-50 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-semibold text-gray-600 mb-1">Entity</div>
                    <div>{entry.entity_type} / {entry.entity_id}</div>
                    {entry.request_id && <div className="text-gray-400 mt-1">Request: {entry.request_id}</div>}
                  </div>
                  <div>
                    {entry.old_data && (
                      <div className="mb-2">
                        <div className="font-semibold text-gray-600 mb-1">Previous</div>
                        <pre className="bg-white border rounded p-2 overflow-auto max-h-32">{JSON.stringify(entry.old_data, null, 2)}</pre>
                      </div>
                    )}
                    {entry.new_data && (
                      <div>
                        <div className="font-semibold text-gray-600 mb-1">New</div>
                        <pre className="bg-white border rounded p-2 overflow-auto max-h-32">{JSON.stringify(entry.new_data, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {data && data.total > data.size && (
        <div className="flex items-center justify-center gap-3 px-4 py-3 border-t">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border rounded text-sm disabled:opacity-50">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {Math.ceil(data.total / data.size)}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(data.total / data.size)} className="px-3 py-1 border rounded text-sm disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
}
