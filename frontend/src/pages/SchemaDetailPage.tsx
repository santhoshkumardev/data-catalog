import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Layers, Table2, Eye, Link as LinkIcon } from "lucide-react";
import { getSchema, getDatabase, getTables, patchSchema } from "../api/catalog";
import { trackView } from "../api/analytics";
import { useAuth } from "../auth/AuthContext";
import Breadcrumb from "../components/Breadcrumb";
import InlineEdit from "../components/InlineEdit";
import TagEditor from "../components/TagEditor";

import CommentSection from "../components/CommentSection";
import StewardSection from "../components/StewardSection";
import EndorsementBadge from "../components/EndorsementBadge";

export default function SchemaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isEditor } = useAuth();

  const { data: schema, refetch: refetchSchema } = useQuery({
    queryKey: ["schema", id],
    queryFn: () => getSchema(id!),
    enabled: !!id,
  });

  const { data: db } = useQuery({
    queryKey: ["database", schema?.connection_id],
    queryFn: () => getDatabase(schema!.connection_id),
    enabled: !!schema?.connection_id,
  });

  const { data: tablesData } = useQuery({
    queryKey: ["tables", id],
    queryFn: () => getTables(id!, 1, 100, true),
    enabled: !!id,
  });

  const tables = tablesData?.items ?? [];

  useEffect(() => {
    if (id) trackView("schema", id);
  }, [id]);

  if (!schema || !db) return <div className="text-gray-400">Loading...</div>;

  return (
    <div>
      <Breadcrumb items={[{ label: "Databases", to: "/databases" }, { label: db.name, to: `/databases/${db.id}` }, { label: schema.name }]} />
      <div className="bg-white rounded-lg border p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Layers size={24} className="text-purple-500" />
          <h1 className="text-xl font-bold">{schema.name}</h1>
          <EndorsementBadge entityType="schema" entityId={id!} />

        </div>
        <div className="mb-4">
          <div className="text-xs text-gray-400 mb-1">Description</div>
          <InlineEdit value={schema.description || ""} onSave={async (v) => { await patchSchema(id!, { description: v }); refetchSchema(); }} multiline canEdit={isEditor} />
        </div>
        <div>
          <div className="text-xs text-gray-400 mb-1">Tags</div>
          <TagEditor tags={schema.tags || []} onChange={async (tags) => { await patchSchema(id!, { tags }); refetchSchema(); }} canEdit={isEditor} />
        </div>
        <StewardSection entityType="schema" entityId={id!} />
      </div>

      <h2 className="text-lg font-semibold mb-3">Objects ({tables.length})</h2>
      <div className="grid gap-2">
        {tables.map((t) => {
          const icon = (() => {
            switch (t.object_type) {
              case "view": return <Eye size={16} className="text-blue-500" />;
              case "materialized_view": return <Layers size={16} className="text-indigo-500" />;
              case "synonym": return <LinkIcon size={16} className="text-orange-500" />;
              default: return <Table2 size={16} className="text-green-500" />;
            }
          })();
          const badge = (() => {
            switch (t.object_type) {
              case "view": return <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">View</span>;
              case "materialized_view": return <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">MView</span>;
              case "synonym": return <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">Synonym</span>;
              default: return null;
            }
          })();
          const isDeleted = !!t.deleted_at;
          return (
            <Link key={t.id} to={`/tables/${t.id}`} className={`flex items-center justify-between bg-white border rounded p-3 hover:shadow-sm ${isDeleted ? "opacity-50" : ""}`}>
              <div className="flex items-center gap-2">
                {icon}
                <span className={`font-medium ${isDeleted ? "line-through" : ""}`}>{t.name}</span>
                {!isDeleted && <EndorsementBadge entityType="table" entityId={t.id} />}
                {badge}
                {isDeleted && (
                  <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                    Removed {new Date(t.deleted_at!).toLocaleDateString()}
                  </span>
                )}
              </div>
              {t.row_count != null && !isDeleted && <span className="text-xs text-gray-400">{t.row_count.toLocaleString()} rows</span>}
            </Link>
          );
        })}
      </div>

      <div className="mt-8">
        <CommentSection entityType="schema" entityId={id!} />
      </div>
    </div>
  );
}
