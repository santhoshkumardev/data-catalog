import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Key } from "lucide-react";
import { getColumnContext, patchColumn } from "../api/catalog";
import { trackView } from "../api/analytics";
import { useAuth } from "../auth/AuthContext";
import Breadcrumb from "../components/Breadcrumb";
import InlineEdit from "../components/InlineEdit";
import TagEditor from "../components/TagEditor";
import ProfilingStats from "../components/ProfilingStats";
import CommentSection from "../components/CommentSection";
import EndorsementBadge from "../components/EndorsementBadge";

export default function ColumnDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isEditor } = useAuth();

  const { data: ctx, refetch } = useQuery({
    queryKey: ["columnContext", id],
    queryFn: () => getColumnContext(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (id) trackView("column", id);
  }, [id]);

  if (!ctx) return <div className="text-gray-400">Loading...</div>;

  const column = ctx;
  const table = ctx.table;
  const schema = ctx.context.schema_obj;
  const db = ctx.context.database;

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Databases", to: "/databases" },
          { label: db.name, to: `/databases/${db.id}` },
          { label: schema.name, to: `/schemas/${schema.id}` },
          { label: table.name, to: `/tables/${table.id}` },
          { label: column.name },
        ]}
      />

      <div className="bg-white rounded-lg border p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          {column.is_primary_key && <Key size={20} className="text-amber-500" />}
          <h1 className="text-xl font-bold font-mono">{column.name}</h1>
          <EndorsementBadge entityType="column" entityId={id!} />
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
            {column.data_type}
          </span>
          {column.is_primary_key && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">Primary Key</span>
          )}
          <span className="text-xs text-gray-400">
            {column.is_nullable ? "Nullable" : "Not Null"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-xs text-gray-400 mb-1">Title</div>
            <InlineEdit
              value={column.title || ""}
              onSave={async (v) => {
                await patchColumn(id!, { title: v });
                refetch();
              }}
              canEdit={isEditor}
            />
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">Tags</div>
            <TagEditor
              tags={column.tags || []}
              onChange={async (tags) => {
                await patchColumn(id!, { tags });
                refetch();
              }}
              canEdit={isEditor}
            />
          </div>
        </div>

        <div className="mt-4">
          <div className="text-xs text-gray-400 mb-1">Description</div>
          <InlineEdit
            value={column.description || ""}
            onSave={async (v) => {
              await patchColumn(id!, { description: v });
              refetch();
            }}
            multiline
            canEdit={isEditor}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold mb-3">Profiling</h2>
          <div className="bg-white border rounded-lg p-4">
            <ProfilingStats columnId={id!} />
          </div>
        </div>
        <div>
          <CommentSection entityType="column" entityId={id!} />
        </div>
      </div>
    </div>
  );
}
