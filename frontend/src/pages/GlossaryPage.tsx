import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookText, Plus } from "lucide-react";
import { getGlossaryTerms, createGlossaryTerm, type GlossaryTerm, type PaginatedGlossary } from "../api/glossary";
import { useAuth } from "../auth/AuthContext";
import Breadcrumb from "../components/Breadcrumb";

export default function GlossaryPage() {
  const { isSteward } = useAuth();
  const [data, setData] = useState<PaginatedGlossary | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDef, setNewDef] = useState("");
  const [creating, setCreating] = useState(false);

  const load = () => { getGlossaryTerms(page, 20, search || undefined).then(setData); };
  useEffect(load, [page, search]);

  const handleCreate = async () => {
    if (!newName.trim() || !newDef.trim()) return;
    setCreating(true);
    try {
      await createGlossaryTerm({ name: newName.trim(), definition: newDef.trim(), status: "draft" });
      setNewName("");
      setNewDef("");
      setShowCreate(false);
      load();
    } finally {
      setCreating(false);
    }
  };

  const statusBadge = (status: string) => {
    if (status === "approved") return <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">approved</span>;
    return <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">draft</span>;
  };

  return (
    <div>
      <Breadcrumb items={[{ label: "Glossary" }]} />
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Business Glossary</h1>
        <div className="flex items-center gap-2">
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search terms..." className="border rounded px-3 py-1.5 text-sm w-64" />
          {isSteward && (
            <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
              <Plus size={14} /> New Term
            </button>
          )}
        </div>
      </div>

      {showCreate && (
        <div className="bg-white border rounded-lg p-4 mb-4">
          <div className="mb-3">
            <label className="text-xs text-gray-500 block mb-1">Term Name</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} className="border rounded px-3 py-1.5 text-sm w-full" placeholder="e.g. Revenue" />
          </div>
          <div className="mb-3">
            <label className="text-xs text-gray-500 block mb-1">Definition</label>
            <textarea value={newDef} onChange={(e) => setNewDef(e.target.value)} rows={3} className="border rounded px-3 py-1.5 text-sm w-full" placeholder="Clear business definition..." />
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={creating} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded disabled:opacity-50">{creating ? "Creating..." : "Create"}</button>
            <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-sm text-gray-500">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {data?.items.map((term) => (
          <Link key={term.id} to={`/glossary/${term.id}`} className="flex items-start gap-3 bg-white border rounded-lg p-4 hover:shadow-sm">
            <BookText size={18} className="text-teal-500 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{term.name}</span>
                {statusBadge(term.status)}
              </div>
              <div className="text-sm text-gray-500 mt-1 line-clamp-2">{term.definition}</div>
              {term.tags && term.tags.length > 0 && (
                <div className="flex gap-1 mt-1">{term.tags.map((t) => <span key={t} className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full">{t}</span>)}</div>
              )}
            </div>
            {term.owner_name && <span className="text-xs text-gray-400 shrink-0 ml-auto">{term.owner_name}</span>}
          </Link>
        ))}
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
