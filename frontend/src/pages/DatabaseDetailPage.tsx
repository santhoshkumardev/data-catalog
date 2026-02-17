import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Database, Layers, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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
  const [tab, setTab] = useState<"schemas" | "comments" | "history">("schemas");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc" | null>(null);

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

  const filteredSchemas = schemas.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const sortedSchemas = sortDir
    ? [...filteredSchemas].sort((a, b) =>
        sortDir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
      )
    : filteredSchemas;

  return (
    <div>
      <Breadcrumb items={[{ label: "Databases", to: "/databases" }, { label: db.name }]} />

      {/* Header card */}
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

      {/* Tabs */}
      <div className="flex gap-4 border-b mb-4">
        <button
          onClick={() => setTab("schemas")}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === "schemas" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          Schemas ({schemas.length})
        </button>
        <button
          onClick={() => setTab("comments")}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === "comments" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          Comments
        </button>
        <button
          onClick={() => setTab("history")}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === "history" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          Version History
        </button>
      </div>

      {/* Schemas tab */}
      {tab === "schemas" && (
        <div>
          <div className="mb-3">
            <input
              type="text"
              placeholder="Search schemas..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); }}
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
                </tr>
              </thead>
              <tbody>
                {sortedSchemas.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-gray-400 text-sm">
                      {searchQuery ? "No schemas match your search." : "No schemas found."}
                    </td>
                  </tr>
                ) : sortedSchemas.map((s) => {
                  const isDeleted = !!s.deleted_at;
                  return (
                    <tr key={s.id} className={`border-b hover:bg-gray-50 ${isDeleted ? "opacity-50" : ""}`}>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <Layers size={15} className="text-purple-500" />
                          <Link to={`/schemas/${s.id}`} className={`font-medium text-blue-600 hover:underline ${isDeleted ? "line-through" : ""}`}>
                            {s.name}
                          </Link>
                          {!isDeleted && <EndorsementBadge entityType="schema" entityId={s.id} />}
                          {isDeleted && (
                            <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                              Removed {new Date(s.deleted_at!).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "comments" && <CommentSection entityType="database" entityId={id!} />}
      {tab === "history" && <VersionHistory entityType="database" entityId={id!} />}
    </div>
  );
}
