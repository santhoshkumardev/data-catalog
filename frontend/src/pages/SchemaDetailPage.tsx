import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Layers, Table2, Eye, Link as LinkIcon, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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
  const [tab, setTab] = useState<"tables" | "comments">("tables");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc" | null>(null);

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

  const filteredTables = tables.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const sortedTables = sortDir
    ? [...filteredTables].sort((a, b) =>
        sortDir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
      )
    : filteredTables;

  return (
    <div>
      <Breadcrumb items={[{ label: "Databases", to: "/databases" }, { label: db.name, to: `/databases/${db.id}` }, { label: schema.name }]} />

      {/* Header card */}
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

      {/* Tabs */}
      <div className="flex gap-4 border-b mb-4">
        <button
          onClick={() => setTab("tables")}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === "tables" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          Tables ({tables.length})
        </button>
        <button
          onClick={() => setTab("comments")}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === "comments" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          Comments
        </button>
      </div>

      {/* Tables tab */}
      {tab === "tables" && (
        <div>
          <div className="mb-3">
            <input
              type="text"
              placeholder="Search tables..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">
                    <button
                      onClick={() => setSortDir((d) => d === null ? "asc" : d === "asc" ? "desc" : null)}
                      className="flex items-center gap-1 hover:text-blue-600 focus:outline-none"
                      title="Sort by name"
                    >
                      Name
                      {sortDir === "asc" ? (
                        <ArrowUp size={13} className="text-blue-600" />
                      ) : sortDir === "desc" ? (
                        <ArrowDown size={13} className="text-blue-600" />
                      ) : (
                        <ArrowUpDown size={13} className="text-gray-400" />
                      )}
                    </button>
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Type</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Rows</th>
                </tr>
              </thead>
              <tbody>
                {sortedTables.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-gray-400 text-sm">
                      {searchQuery ? "No tables match your search." : "No tables found."}
                    </td>
                  </tr>
                ) : sortedTables.map((t) => {
                  const icon = (() => {
                    switch (t.object_type) {
                      case "view": return <Eye size={15} className="text-blue-500" />;
                      case "materialized_view": return <Layers size={15} className="text-indigo-500" />;
                      case "synonym": return <LinkIcon size={15} className="text-orange-500" />;
                      default: return <Table2 size={15} className="text-green-500" />;
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
                    <tr key={t.id} className={`border-b hover:bg-gray-50 ${isDeleted ? "opacity-50" : ""}`}>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          {icon}
                          <Link to={`/tables/${t.id}`} className={`font-medium text-blue-600 hover:underline ${isDeleted ? "line-through" : ""}`}>
                            {t.name}
                          </Link>
                          {!isDeleted && <EndorsementBadge entityType="table" entityId={t.id} />}
                          {isDeleted && (
                            <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                              Removed {new Date(t.deleted_at!).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2">{badge}</td>
                      <td className="px-4 py-2 text-right text-gray-400 text-xs">
                        {t.row_count != null && !isDeleted ? t.row_count.toLocaleString() : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "comments" && <CommentSection entityType="schema" entityId={id!} />}
    </div>
  );
}
