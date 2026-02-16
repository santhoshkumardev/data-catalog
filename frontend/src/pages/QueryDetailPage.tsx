import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FileCode, Trash2 } from "lucide-react";
import { getQuery, patchQuery, deleteQuery, type QueryDoc } from "../api/catalog";
import { trackView } from "../api/analytics";
import { useAuth } from "../auth/AuthContext";
import Breadcrumb from "../components/Breadcrumb";
import InlineEdit from "../components/InlineEdit";
import SqlEditor from "../components/SqlEditor";

import CommentSection from "../components/CommentSection";
import StewardSection from "../components/StewardSection";
import EndorsementBadge from "../components/EndorsementBadge";

export default function QueryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isSteward } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState<QueryDoc | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
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
          <EndorsementBadge entityType="query" entityId={id!} />
          {query.database_name && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{query.database_name}</span>}

          <div className="ml-auto flex gap-2">
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
        <StewardSection entityType="query" entityId={id!} />
        <div className="mt-4">
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

      <CommentSection entityType="query" entityId={id!} />
    </div>
  );
}
