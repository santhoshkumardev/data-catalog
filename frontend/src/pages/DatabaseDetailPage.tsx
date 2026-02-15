import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Database, Layers } from "lucide-react";
import { getDatabase, getSchemas, patchDatabase, type DbConnection, type Schema } from "../api/catalog";
import { trackView } from "../api/analytics";
import { useAuth } from "../auth/AuthContext";
import Breadcrumb from "../components/Breadcrumb";
import InlineEdit from "../components/InlineEdit";
import TagEditor from "../components/TagEditor";
import FavoriteButton from "../components/FavoriteButton";
import CommentSection from "../components/CommentSection";
import VersionHistory from "../components/VersionHistory";

export default function DatabaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isEditor } = useAuth();
  const [db, setDb] = useState<DbConnection | null>(null);
  const [schemas, setSchemas] = useState<Schema[]>([]);

  useEffect(() => {
    if (!id) return;
    getDatabase(id).then(setDb);
    getSchemas(id, 1, 50).then((r) => setSchemas(r.items));
    trackView("database", id);
  }, [id]);

  if (!db) return <div className="text-gray-400">Loading...</div>;

  return (
    <div>
      <Breadcrumb items={[{ label: "Databases", to: "/databases" }, { label: db.name }]} />
      <div className="bg-white rounded-lg border p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Database size={24} className="text-blue-500" />
          <h1 className="text-xl font-bold">{db.name}</h1>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{db.db_type}</span>
          <FavoriteButton entityType="database" entityId={id!} />
        </div>
        <div className="mb-4">
          <div className="text-xs text-gray-400 mb-1">Description</div>
          <InlineEdit
            value={db.description || ""}
            onSave={async (v) => { const updated = await patchDatabase(id!, { description: v }); setDb(updated); }}
            multiline
            canEdit={isEditor}
          />
        </div>
        <div>
          <div className="text-xs text-gray-400 mb-1">Tags</div>
          <TagEditor tags={db.tags || []} onChange={async (tags) => { const updated = await patchDatabase(id!, { tags }); setDb(updated); }} canEdit={isEditor} />
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-3">Schemas ({schemas.length})</h2>
      <div className="grid gap-2">
        {schemas.map((s) => (
          <Link key={s.id} to={`/schemas/${s.id}`} className="flex items-center gap-2 bg-white border rounded p-3 hover:shadow-sm">
            <Layers size={16} className="text-purple-500" />
            <span className="font-medium">{s.name}</span>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6 mt-8">
        <CommentSection entityType="database" entityId={id!} />
        <VersionHistory entityType="database" entityId={id!} />
      </div>
    </div>
  );
}
