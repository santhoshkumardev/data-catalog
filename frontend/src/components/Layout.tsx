import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Database, FileCode, BookText, Search, Plus, X,
  LogOut, User, Settings, ChevronDown, ChevronRight,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { getDatabases, createQuery, type DbConnection, type QueryCreate } from "../api/catalog";
import DatabaseTree from "./DatabaseTree";
import QueryTree from "./QueryTree";
import GlossaryTree from "./GlossaryTree";
import SidebarSearch from "./SidebarSearch";

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xl max-h-[80vh] overflow-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function NewQueryModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [sql, setSql] = useState("");
  const [dbId, setDbId] = useState("");
  const [dbs, setDbs] = useState<DbConnection[]>([]);
  const [saving, setSaving] = useState(false);

  useState(() => { getDatabases(1, 50).then((r) => setDbs(r.items)); });

  const save = async () => {
    setSaving(true);
    await createQuery({ name, sql_text: sql, connection_id: dbId || undefined });
    setSaving(false);
    onCreated();
    onClose();
  };

  return (
    <ModalShell title="New Query" onClose={onClose}>
      <div className="space-y-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Query name" className="w-full border rounded px-3 py-2 text-sm" />
        <select value={dbId} onChange={(e) => setDbId(e.target.value)} className="w-full border rounded px-3 py-2 text-sm">
          <option value="">Select database (optional)</option>
          {dbs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <textarea value={sql} onChange={(e) => setSql(e.target.value)} placeholder="SQL text" rows={6} className="w-full border rounded px-3 py-2 text-sm font-mono" />
        <button onClick={save} disabled={!name.trim() || !sql.trim() || saving} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
          Create
        </button>
      </div>
    </ModalShell>
  );
}


export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, isSteward, logout } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("");
  const [queryRefresh, setQueryRefresh] = useState(0);
  const [showNewQuery, setShowNewQuery] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Sidebar section collapse — all collapsed by default
  const [dbOpen, setDbOpen] = useState(false);
  const [queryOpen, setQueryOpen] = useState(false);
  const [glossaryOpen, setGlossaryOpen] = useState(false);

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 text-gray-300 flex flex-col shrink-0 overflow-hidden" style={{ background: "#0E3762" }}>
        <div className="px-4 py-3 border-b border-white/20">
          <Link to="/" className="font-bold text-white" style={{ fontSize: "1.25rem" }}>Data Catalog</Link>
          <span className="text-xs text-gray-400 ml-1">v2</span>
        </div>
        <div className="px-3 py-2">
          <div className="flex items-center gap-1 rounded px-2 py-1.5" style={{ background: "#175393" }}>
            <Search size={14} className="text-gray-300" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter..."
              className="bg-transparent text-sm flex-1 outline-none text-gray-200 placeholder-gray-400"
            />
          </div>
        </div>
        <nav className="flex-1 overflow-auto px-2 pb-4 space-y-1">
          {filter.trim() ? (
            <SidebarSearch filter={filter} />
          ) : (
            <>
              {/* Databases */}
              <div>
                <button onClick={() => setDbOpen(!dbOpen)} className="flex items-center gap-1 w-full px-2 py-1.5 text-xs uppercase tracking-wider text-white font-bold hover:text-gray-200">
                  {dbOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <Database size={12} /> Databases
                </button>
                {dbOpen && <DatabaseTree filter="" />}
              </div>

              {/* Queries */}
              <div>
                <div className="flex items-center justify-between px-2 py-1.5">
                  <button onClick={() => setQueryOpen(!queryOpen)} className="flex items-center gap-1 text-xs uppercase tracking-wider text-white font-bold hover:text-gray-200">
                    {queryOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    <FileCode size={12} /> Queries
                  </button>
                  {isSteward && <button onClick={() => setShowNewQuery(true)} className="text-gray-500 hover:text-green-400"><Plus size={14} /></button>}
                </div>
                {queryOpen && <QueryTree filter="" refreshKey={queryRefresh} />}
              </div>

              {/* Articles */}
              <div>
                <div className="flex items-center justify-between px-2 py-1.5">
                  <button onClick={() => setArticleOpen(!articleOpen)} className="flex items-center gap-1 text-xs uppercase tracking-wider text-white font-bold hover:text-gray-200">
                    {articleOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    <BookOpen size={12} /> Articles
                  </button>
                  {isSteward && <button onClick={() => setShowNewArticle(true)} className="text-gray-500 hover:text-green-400"><Plus size={14} /></button>}
                </div>
                {articleOpen && <ArticleTree filter="" refreshKey={articleRefresh} />}
              </div>

              {/* Glossary */}
              <div>
                <button onClick={() => setGlossaryOpen(!glossaryOpen)} className="flex items-center gap-1 w-full px-2 py-1.5 text-xs uppercase tracking-wider text-white font-bold hover:text-gray-200">
                  {glossaryOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <BookText size={12} /> Glossary
                </button>
                {glossaryOpen && <GlossaryTree filter="" />}
              </div>
            </>
          )}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-3 border-b bg-white">
          <div className="flex items-center gap-4">
            <Link to="/databases" className="text-sm font-medium text-black hover:text-blue-600">Databases</Link>
            <Link to="/queries" className="text-sm font-medium text-black hover:text-blue-600">Queries</Link>
            <Link to="/articles" className="text-sm font-medium text-black hover:text-blue-600">Articles</Link>
            <Link to="/glossary" className="text-sm font-medium text-black hover:text-blue-600">Glossary</Link>
            <Link to="/search" className="text-sm font-medium text-black hover:text-blue-600">Search</Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button onClick={() => setUserMenuOpen(!userMenuOpen)} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800">
                <User size={16} />
                <span>{user?.name}</span>
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 mt-1 w-48 bg-white border rounded-lg shadow-lg z-50">
                  <div className="px-3 py-2 text-xs text-gray-400 border-b">{user?.email} ({user?.role})</div>
                  {isAdmin && (
                    <button onClick={() => { setUserMenuOpen(false); navigate("/admin"); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50">
                      <Settings size={14} /> Admin
                    </button>
                  )}
                  {isSteward && (
                    <button onClick={() => { setUserMenuOpen(false); navigate("/webhooks"); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50">
                      <Settings size={14} /> Webhooks
                    </button>
                  )}
                  <button onClick={logout} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-gray-50 border-t">
                    <LogOut size={14} /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 bg-gray-50">
          {children}
        </main>
      </div>

      {showNewQuery && <NewQueryModal onClose={() => setShowNewQuery(false)} onCreated={() => setQueryRefresh((k) => k + 1)} />}
    </div>
  );
}
