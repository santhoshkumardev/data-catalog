import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FileCode, Trash2, Play } from "lucide-react";
import { getQuery, patchQuery, deleteQuery, executeQuery, type QueryDoc, type QueryRunResult } from "../api/catalog";
import { trackView } from "../api/analytics";
import { useAuth } from "../auth/AuthContext";
import Breadcrumb from "../components/Breadcrumb";
import InlineEdit from "../components/InlineEdit";
import SqlEditor from "../components/SqlEditor";
import FavoriteButton from "../components/FavoriteButton";
import CommentSection from "../components/CommentSection";

export default function QueryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isSteward } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState<QueryDoc | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [runResult, setRunResult] = useState<QueryRunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [sqlDraft, setSqlDraft] = useState<string | null>(null);
  const [savingSql, setSavingSql] = useState(false);

  useEffect(() => {
    if (!id) return;
    getQuery(id).then(setQuery);
    trackView("query", id);
  }, [id]);

  const handleDelete = async () => {
    await deleteQuery(id!);
    navigate("/queries");
  };

  const handleRun = async () => {
    if (!query) return;
    setRunning(true);
    setRunError("");
    try {
      const result = await executeQuery(query.sql_text, 50);
      setRunResult(result);
    } catch (err: any) {
      setRunError(err.response?.data?.detail || "Query failed");
    } finally {
      setRunning(false);
    }
  };

  if (!query) return <div className="text-gray-400">Loading...</div>;

  return (
    <div>
      <Breadcrumb items={[{ label: "Queries", to: "/queries" }, { label: query.name }]} />
      <div className="bg-white rounded-lg border p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <FileCode size={24} className="text-amber-500" />
          <div className="flex-1">
            <InlineEdit value={query.name} onSave={async (v) => { const u = await patchQuery(id!, { name: v }); setQuery(u); }} placeholder="Query name..." canEdit={isSteward} />
          </div>
          {query.database_name && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{query.database_name}</span>}
          <FavoriteButton entityType="query" entityId={id!} />
          <div className="ml-auto flex gap-2">
            <button onClick={handleRun} disabled={running} className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50">
              <Play size={14} /> {running ? "Running..." : "Run"}
            </button>
            {isSteward && !confirmDelete && (
              <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1 px-3 py-1 text-red-600 border border-red-300 text-sm rounded hover:bg-red-50">
                <Trash2 size={14} /> Delete
              </button>
            )}
            {confirmDelete && (
              <div className="flex items-center gap-2">
                <button onClick={handleDelete} className="px-3 py-1 bg-red-600 text-white text-sm rounded">Confirm</button>
                <button onClick={() => setConfirmDelete(false)} className="px-3 py-1 text-sm text-gray-500">Cancel</button>
              </div>
            )}
          </div>
        </div>
        <div className="mb-4">
          <div className="text-xs text-gray-400 mb-1">Description</div>
          <InlineEdit value={query.description || ""} onSave={async (v) => { const u = await patchQuery(id!, { description: v }); setQuery(u); }} multiline canEdit={isSteward} />
        </div>
        <div>
          <div className="text-xs text-gray-400 mb-1">SQL</div>
          <SqlEditor
            value={sqlDraft ?? query.sql_text}
            onChange={isSteward ? (v) => setSqlDraft(v) : undefined}
            readOnly={!isSteward}
          />
          {isSteward && sqlDraft !== null && sqlDraft !== query.sql_text && (
            <div className="flex gap-2 mt-2">
              <button
                onClick={async () => { setSavingSql(true); const u = await patchQuery(id!, { sql_text: sqlDraft }); setQuery(u); setSqlDraft(null); setSavingSql(false); }}
                disabled={savingSql}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Save SQL
              </button>
              <button onClick={() => setSqlDraft(null)} className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800">
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {runError && <div className="bg-red-50 text-red-600 text-sm rounded p-3 mb-4">{runError}</div>}
      {runResult && (
        <div className="bg-white border rounded-lg mb-6 overflow-auto">
          <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50">
            <span className="text-sm text-gray-600">{runResult.row_count} rows{runResult.truncated ? " (truncated)" : ""}</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                {runResult.columns.map((c) => <th key={c} className="text-left px-3 py-1.5 font-medium text-gray-600">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {runResult.rows.map((row, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  {row.map((cell, j) => <td key={j} className="px-3 py-1.5 font-mono text-xs">{String(cell ?? "")}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CommentSection entityType="query" entityId={id!} />
    </div>
  );
}
