import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Table2, Key, Eye, Layers, Link as LinkIcon, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { getTableContext, getColumns, patchTable, patchColumn, type Column } from "../api/catalog";
import { getClassification, type Classification } from "../api/governance";
import { trackView } from "../api/analytics";
import { useAuth } from "../auth/AuthContext";
import Breadcrumb from "../components/Breadcrumb";
import InlineEdit from "../components/InlineEdit";
import TagEditor from "../components/TagEditor";

import ClassificationBadge from "../components/ClassificationBadge";
import LineageView from "../components/LineageView";
import CommentSection from "../components/CommentSection";
import VersionHistory from "../components/VersionHistory";
import ProfilingStats from "../components/ProfilingStats";
import StewardSection from "../components/StewardSection";
import EndorsementBadge from "../components/EndorsementBadge";

export default function TableDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isEditor } = useAuth();
  const [classification, setClassification] = useState<Classification | null>(null);
  const [tab, setTab] = useState<"columns" | "lineage" | "definition" | "comments">("columns");
  const [expandedCol, setExpandedCol] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [colPage, setColPage] = useState(1);
  const [sortDir, setSortDir] = useState<"asc" | "desc" | null>(null);
  const COL_PAGE_SIZE = 25;

  const { data: ctx, refetch: refetchCtx } = useQuery({
    queryKey: ["tableContext", id],
    queryFn: () => getTableContext(id!),
    enabled: !!id,
  });

  const { data: columnsData, refetch: refetchColumns } = useQuery({
    queryKey: ["columns", id],
    queryFn: () => getColumns(id!, 1, 200),
    enabled: !!id,
  });

  const columns = columnsData?.items ?? [];

  useEffect(() => {
    if (!id) return;
    getClassification("table", id).then(setClassification).catch(() => {});
    trackView("table", id);
  }, [id]);

  if (!ctx) return <div className="text-gray-400">Loading...</div>;

  const table = ctx;
  const schema = ctx.context.schema_obj;
  const db = ctx.context.database;

  const isView = table.object_type === "view" || table.object_type === "materialized_view";
  const objectTypeIcon = (() => {
    switch (table.object_type) {
      case "view": return <Eye size={24} className="text-blue-500" />;
      case "materialized_view": return <Layers size={24} className="text-indigo-500" />;
      case "synonym": return <LinkIcon size={24} className="text-orange-500" />;
      default: return <Table2 size={24} className="text-green-500" />;
    }
  })();
  const objectTypeBadge = (() => {
    switch (table.object_type) {
      case "view": return <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">View</span>;
      case "materialized_view": return <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">Materialized View</span>;
      case "synonym": return <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">Synonym</span>;
      default: return null;
    }
  })();

  return (
    <div>
      <Breadcrumb items={[
        { label: "Databases", to: "/databases" },
        { label: db.name, to: `/databases/${db.id}` },
        { label: schema.title ? `${schema.title} (${schema.name})` : schema.name, to: `/schemas/${schema.id}` },
        { label: table.title ? `${table.title} (${table.name})` : table.name },
      ]} />

      {table.deleted_at && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-center gap-2">
          <span className="text-red-600 text-sm font-medium">This object was removed from source on {new Date(table.deleted_at).toLocaleDateString()}</span>
        </div>
      )}

      <div className={`bg-white rounded-lg border p-6 mb-6 ${table.deleted_at ? "opacity-60" : ""}`}>
        <div className="flex items-center gap-3 mb-4">
          {objectTypeIcon}
          <h1 className="text-xl font-bold">{table.title ? `${table.title} (${table.name})` : table.name}</h1>
          <EndorsementBadge entityType="table" entityId={id!} />
          {objectTypeBadge}
          {classification && <ClassificationBadge level={classification.level} />}
          {table.row_count != null && <span className="text-sm text-gray-400">{table.row_count.toLocaleString()} rows</span>}

        </div>
        <div className="mb-4">
          <div className="text-xs text-gray-400 mb-1">Title</div>
          <InlineEdit value={table.title || ""} onSave={async (v) => { await patchTable(id!, { title: v }); refetchCtx(); }} canEdit={isEditor} />
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-xs text-gray-400 mb-1">Description</div>
            <InlineEdit value={table.description || ""} onSave={async (v) => { await patchTable(id!, { description: v }); refetchCtx(); }} multiline canEdit={isEditor} />
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">Tags</div>
            <TagEditor tags={table.tags || []} onChange={async (tags) => { await patchTable(id!, { tags }); refetchCtx(); }} canEdit={isEditor} />
            {table.sme_name && (
              <div className="mt-3 text-sm text-gray-600">
                <span className="text-xs text-gray-400">SME: </span>{table.sme_name}
                {table.sme_email && <span className="text-gray-400 ml-1">({table.sme_email})</span>}
              </div>
            )}
          </div>
        </div>
        <StewardSection entityType="table" entityId={id!} />
      </div>

      <div className="flex gap-4 border-b mb-4">
        {(["columns", "lineage", ...(isView ? ["definition"] as const : []), "comments"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t as typeof tab)} className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t === "columns" ? `Columns (${columns.length})` : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "columns" && (() => {
        const filteredColumns = columns.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
        const sortedColumns = sortDir
          ? [...filteredColumns].sort((a, b) =>
              sortDir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
            )
          : filteredColumns;
        const totalColPages = Math.ceil(sortedColumns.length / COL_PAGE_SIZE);
        const pagedColumns = sortedColumns.slice((colPage - 1) * COL_PAGE_SIZE, colPage * COL_PAGE_SIZE);
        return (
          <div>
            <div className="mb-3">
              <input
                type="text"
                placeholder="Search columns..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setColPage(1); }}
                className="border rounded px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="bg-white border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">
                      <button
                        onClick={() => {
                          setSortDir((d) => d === null ? "asc" : d === "asc" ? "desc" : null);
                          setColPage(1);
                        }}
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
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Title</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Type</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Nullable</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedColumns.map((col) => (
                    <tr key={col.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1.5">
                          {col.is_primary_key && <Key size={12} className="text-amber-500" />}
                          <Link to={`/columns/${col.id}`} className="font-mono text-sm text-blue-600 hover:underline">{col.name}</Link>
                          <EndorsementBadge entityType="column" entityId={col.id} />
                        </div>
                        <button onClick={() => setExpandedCol(expandedCol === col.id ? null : col.id)} className="text-xs text-gray-400 hover:text-blue-500 mt-0.5">
                          {expandedCol === col.id ? "Hide profiling" : "Show profiling"}
                        </button>
                        {expandedCol === col.id && <ProfilingStats columnId={col.id} />}
                      </td>
                      <td className="px-4 py-2">
                        <InlineEdit
                          value={col.title || ""}
                          onSave={async (v) => { await patchColumn(col.id, { title: v }); refetchColumns(); }}
                          canEdit={isEditor}
                        />
                      </td>
                      <td className="px-4 py-2 text-gray-600 font-mono text-xs">{col.data_type}</td>
                      <td className="px-4 py-2 text-gray-500">{col.is_nullable ? "Yes" : "No"}</td>
                      <td className="px-4 py-2">
                        <InlineEdit
                          value={col.description || ""}
                          onSave={async (v) => { await patchColumn(col.id, { description: v }); refetchColumns(); }}
                          canEdit={isEditor}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sortedColumns.length > COL_PAGE_SIZE && (
              <div className="flex items-center justify-between mt-3 text-sm">
                <span className="text-gray-500">
                  Showing {(colPage - 1) * COL_PAGE_SIZE + 1}–{Math.min(colPage * COL_PAGE_SIZE, sortedColumns.length)} of {sortedColumns.length} columns
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setColPage((p) => Math.max(1, p - 1))}
                    disabled={colPage === 1}
                    className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setColPage((p) => Math.min(totalColPages, p + 1))}
                    disabled={colPage === totalColPages}
                    className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {tab === "lineage" && <LineageView tableId={id!} />}

      {tab === "definition" && (
        <div className="bg-white border rounded-lg p-4">
          <pre className="bg-gray-50 rounded p-4 text-sm font-mono overflow-auto max-h-[60vh] whitespace-pre-wrap">
            {table.view_definition || "No definition available."}
          </pre>
        </div>
      )}

      {tab === "comments" && (
        <div className="grid grid-cols-2 gap-6">
          <CommentSection entityType="table" entityId={id!} />
          <VersionHistory entityType="table" entityId={id!} />
        </div>
      )}
    </div>
  );
}
