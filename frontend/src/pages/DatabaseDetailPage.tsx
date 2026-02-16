import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Database, Layers } from "lucide-react";
import { getDatabase, getSchemas, patchDatabase } from "../api/catalog";
import { trackView } from "../api/analytics";
import { useAuth } from "../auth/AuthContext";
import Breadcrumb from "../components/Breadcrumb";
import InlineEdit from "../components/InlineEdit";
import TagEditor from "../components/TagEditor";

import CommentSection from "../components/CommentSection";
import VersionHistory from "../components/VersionHistory";
import StewardSection from "../components/StewardSection";
import EndorsementBadge from "../components/EndorsementBadge";

export default function DatabaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isEditor } = useAuth();

  const { data: db, refetch: refetchDb } = useQuery({
    queryKey: ["database", id],
    queryFn: () => getDatabase(id!),
    enabled: !!id,
  });

  const { data: schemasData } = useQuery({
    queryKey: ["schemas", id],
    queryFn: () => getSchemas(id!, 1, 50, true),
    enabled: !!id,
  });

  const schemas = schemasData?.items ?? [];

  useEffect(() => {
    if (id) trackView("database", id);
  }, [id]);

  if (!db) return <div className="text-gray-400">Loading...</div>;

  return (
    <div>
      <Breadcrumb items={[{ label: "Databases", to: "/databases" }, { label: db.name }]} />
      <div className="bg-white rounded-lg border p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Database size={24} className="text-blue-500" />
          <h1 className="text-xl font-bold">{db.name}</h1>
          <EndorsementBadge entityType="database" entityId={id!} />
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{db.db_type}</span>

        </div>
        <div className="mb-4">
          <div className="text-xs text-gray-400 mb-1">Description</div>
          <InlineEdit
            value={db.description || ""}
            onSave={async (v) => { await patchDatabase(id!, { description: v }); refetchDb(); }}
            multiline
            canEdit={isEditor}
          />
        </div>
        <div>
          <div className="text-xs text-gray-400 mb-1">Tags</div>
          <TagEditor tags={db.tags || []} onChange={async (tags) => { await patchDatabase(id!, { tags }); refetchDb(); }} canEdit={isEditor} />
        </div>
        <StewardSection entityType="database" entityId={id!} />
      </div>

      <h2 className="text-lg font-semibold mb-3">Schemas ({schemas.length})</h2>
      <div className="grid gap-2">
        {schemas.map((s) => {
          const isDeleted = !!s.deleted_at;
          return (
            <Link key={s.id} to={`/schemas/${s.id}`} className={`flex items-center gap-2 bg-white border rounded p-3 hover:shadow-sm ${isDeleted ? "opacity-50" : ""}`}>
              <Layers size={16} className="text-purple-500" />
              <span className={`font-medium ${isDeleted ? "line-through" : ""}`}>{s.name}</span>
              {!isDeleted && <EndorsementBadge entityType="schema" entityId={s.id} />}
              {isDeleted && (
                <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                  Removed {new Date(s.deleted_at!).toLocaleDateString()}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-6 mt-8">
        <CommentSection entityType="database" entityId={id!} />
        <VersionHistory entityType="database" entityId={id!} />
      </div>
    </div>
  );
}
