import { useEffect, useState } from "react";
import { Shield, Users, Clock, ChevronDown, ChevronRight, FolderKey, Plus, X } from "lucide-react";
import {
  getUsers, updateUserRole, getAuditLog, getGroups, createGroup, patchGroup, deleteGroup,
  getGroupMembers, addGroupMember, removeGroupMember,
  type AuditLogEntry, type Paginated, type GroupDoc, type GroupMember,
} from "../api/catalog";
import { useAuth } from "../auth/AuthContext";
import Breadcrumb from "../components/Breadcrumb";
import { formatDateTime } from "../utils/formatters";

type Tab = "users" | "groups" | "audit";

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
        <button onClick={() => setTab("groups")} className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded ${tab === "groups" ? "bg-blue-600 text-white" : "bg-white border text-gray-700 hover:bg-gray-50"}`}>
          <FolderKey size={14} /> Groups
        </button>
        <button onClick={() => setTab("audit")} className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded ${tab === "audit" ? "bg-blue-600 text-white" : "bg-white border text-gray-700 hover:bg-gray-50"}`}>
          <Clock size={14} /> Audit Log
        </button>
      </div>
      {tab === "users" && <UsersTab currentUserId={user?.id} />}
      {tab === "groups" && <GroupsTab />}
      {tab === "audit" && <AuditTab />}
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

function GroupsTab() {
  const [groups, setGroups] = useState<GroupDoc[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", ad_group_name: "", app_role: "viewer", description: "" });
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", ad_group_name: "", app_role: "viewer", description: "" });

  const load = () => getGroups().then(setGroups);
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    await createGroup({
      name: form.name,
      ad_group_name: form.ad_group_name || undefined,
      app_role: form.app_role,
      description: form.description || undefined,
    });
    setForm({ name: "", ad_group_name: "", app_role: "viewer", description: "" });
    setShowCreate(false);
    load();
  };

  const handleEdit = async (id: string) => {
    await patchGroup(id, {
      name: editForm.name || undefined,
      ad_group_name: editForm.ad_group_name || undefined,
      app_role: editForm.app_role || undefined,
      description: editForm.description || undefined,
    });
    setEditId(null);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this group?")) return;
    await deleteGroup(id);
    load();
  };

  const startEdit = (g: GroupDoc) => {
    setEditId(g.id);
    setEditForm({ name: g.name, ad_group_name: g.ad_group_name || "", app_role: g.app_role, description: g.description || "" });
  };

  const roleColor = (role: string) => {
    if (role === "admin") return "bg-red-100 text-red-700";
    if (role === "steward") return "bg-yellow-100 text-yellow-700";
    return "bg-gray-100 text-gray-600";
  };

  return (
    <div className="bg-white border rounded-lg">
      <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><FolderKey size={16} /> Groups</h2>
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
          <Plus size={14} /> New Group
        </button>
      </div>

      {showCreate && (
        <div className="p-4 border-b bg-blue-50">
          <div className="grid grid-cols-4 gap-3 mb-3">
            <input placeholder="Group name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border rounded px-2 py-1.5 text-sm" />
            <input placeholder="AD group name (optional)" value={form.ad_group_name} onChange={(e) => setForm({ ...form, ad_group_name: e.target.value })} className="border rounded px-2 py-1.5 text-sm" />
            <select value={form.app_role} onChange={(e) => setForm({ ...form, app_role: e.target.value })} className="border rounded px-2 py-1.5 text-sm">
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <input placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="border rounded px-2 py-1.5 text-sm" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={!form.name} className="px-3 py-1 bg-blue-600 text-white text-sm rounded disabled:opacity-50">Create</button>
            <button onClick={() => setShowCreate(false)} className="px-3 py-1 text-sm text-gray-500">Cancel</button>
          </div>
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="text-left px-4 py-2 font-medium text-gray-600">Name</th>
            <th className="text-left px-4 py-2 font-medium text-gray-600">AD Group</th>
            <th className="text-left px-4 py-2 font-medium text-gray-600">App Role</th>
            <th className="text-left px-4 py-2 font-medium text-gray-600">Members</th>
            <th className="text-left px-4 py-2 font-medium text-gray-600">Actions</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.id}>
              <td colSpan={5} className="p-0">
                <div>
                  {editId === g.id ? (
                    <div className="px-4 py-3 bg-yellow-50 border-b">
                      <div className="grid grid-cols-4 gap-3 mb-2">
                        <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="border rounded px-2 py-1.5 text-sm" />
                        <input value={editForm.ad_group_name} onChange={(e) => setEditForm({ ...editForm, ad_group_name: e.target.value })} className="border rounded px-2 py-1.5 text-sm" />
                        <select value={editForm.app_role} onChange={(e) => setEditForm({ ...editForm, app_role: e.target.value })} className="border rounded px-2 py-1.5 text-sm">
                          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="border rounded px-2 py-1.5 text-sm" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleEdit(g.id)} className="px-3 py-1 bg-blue-600 text-white text-sm rounded">Save</button>
                        <button onClick={() => setEditId(null)} className="px-3 py-1 text-sm text-gray-500">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="flex items-center border-b hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === g.id ? null : g.id)}
                    >
                      <td className="px-4 py-2 font-medium">{g.name}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs font-mono">{g.ad_group_name || "—"}</td>
                      <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded ${roleColor(g.app_role)}`}>{g.app_role}</span></td>
                      <td className="px-4 py-2 text-gray-500">{g.member_count}</td>
                      <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2">
                          <button onClick={() => startEdit(g)} className="text-xs text-blue-600 hover:underline">Edit</button>
                          <button onClick={() => handleDelete(g.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                        </div>
                      </td>
                    </div>
                  )}
                  {expandedId === g.id && editId !== g.id && <GroupMembersPanel groupId={g.id} onUpdate={load} />}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupMembersPanel({ groupId, onUpdate }: { groupId: string; onUpdate: () => void }) {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [users, setUsers] = useState<{ id: string; email: string; name: string; role: string }[]>([]);
  const [addUserId, setAddUserId] = useState("");

  useEffect(() => {
    getGroupMembers(groupId).then(setMembers);
    getUsers().then(setUsers);
  }, [groupId]);

  const memberIds = new Set(members.map((m) => m.user_id));
  const availableUsers = users.filter((u) => !memberIds.has(u.id));

  const handleAdd = async () => {
    if (!addUserId) return;
    await addGroupMember(groupId, addUserId);
    setAddUserId("");
    getGroupMembers(groupId).then(setMembers);
    onUpdate();
  };

  const handleRemove = async (userId: string) => {
    await removeGroupMember(groupId, userId);
    getGroupMembers(groupId).then(setMembers);
    onUpdate();
  };

  return (
    <div className="px-6 py-3 bg-gray-50 border-b">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-xs font-semibold text-gray-500">Members</span>
        <select value={addUserId} onChange={(e) => setAddUserId(e.target.value)} className="border rounded px-2 py-1 text-xs">
          <option value="">Add member...</option>
          {availableUsers.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
        </select>
        <button onClick={handleAdd} disabled={!addUserId} className="px-2 py-1 bg-blue-600 text-white text-xs rounded disabled:opacity-50">Add</button>
      </div>
      {members.length === 0 ? (
        <div className="text-xs text-gray-400">No members</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1 bg-white border rounded px-2 py-1 text-xs">
              {m.user_name} <span className="text-gray-400">({m.user_email})</span>
              <button onClick={() => handleRemove(m.user_id)} className="text-gray-400 hover:text-red-500"><X size={10} /></button>
            </span>
          ))}
        </div>
      )}
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
          {["database", "schema", "table", "column", "query", "article", "glossary", "user", "group"].map((t) => (
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
