import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, ChevronDown, Database, Layers, Table2, Eye, Link as LinkIcon } from "lucide-react";
import { getDatabases, getSchemas, getTables, type DbConnection, type Schema, type Table } from "../api/catalog";
import { useEndorsement } from "../hooks/useEndorsement";

interface SchemaState {
  tables: Table[];
  expanded: boolean;
  loading: boolean;
}

interface DbState {
  db: DbConnection;
  expanded: boolean;
  schemas: Schema[];
  schemaStates: Record<string, SchemaState>;
  loading: boolean;
}

function EndorsementDot({ entityType, entityId }: { entityType: string; entityId: string }) {
  const { data } = useEndorsement(entityType, entityId);
  if (!data) return null;
  const color = data.status === "endorsed" ? "bg-green-400" : data.status === "warned" ? "bg-yellow-400" : "bg-red-400";
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${color} shrink-0`} title={data.status} />;
}

export default function DatabaseTree({ filter }: { filter: string }) {
  const [dbs, setDbs] = useState<DbState[]>([]);

  useEffect(() => {
    getDatabases(1, 50).then((res) =>
      setDbs(res.items.map((db) => ({ db, expanded: false, schemas: [], schemaStates: {}, loading: false })))
    );
  }, []);

  const toggleDb = async (idx: number) => {
    setDbs((prev) => {
      const copy = [...prev];
      const d = { ...copy[idx] };
      d.expanded = !d.expanded;
      if (d.expanded && d.schemas.length === 0) {
        d.loading = true;
        copy[idx] = d;
        getSchemas(d.db.id, 1, 50, true).then((res) =>
          setDbs((p) => {
            const c = [...p];
            c[idx] = { ...c[idx], schemas: res.items, loading: false };
            return c;
          })
        );
      }
      copy[idx] = d;
      return copy;
    });
  };

  const toggleSchema = async (dbIdx: number, schemaId: string) => {
    setDbs((prev) => {
      const copy = [...prev];
      const d = { ...copy[dbIdx], schemaStates: { ...copy[dbIdx].schemaStates } };
      const ss = d.schemaStates[schemaId] || { tables: [], expanded: false, loading: false };
      const next = { ...ss, expanded: !ss.expanded };
      if (next.expanded && next.tables.length === 0) {
        next.loading = true;
        d.schemaStates[schemaId] = next;
        copy[dbIdx] = d;
        getTables(schemaId, 1, 50, true).then((res) =>
          setDbs((p) => {
            const c = [...p];
            const dd = { ...c[dbIdx], schemaStates: { ...c[dbIdx].schemaStates } };
            dd.schemaStates[schemaId] = { ...dd.schemaStates[schemaId], tables: res.items, loading: false };
            c[dbIdx] = dd;
            return c;
          })
        );
      }
      d.schemaStates[schemaId] = next;
      copy[dbIdx] = d;
      return copy;
    });
  };

  const filtered = filter
    ? dbs.filter((d) => d.db.name.toLowerCase().includes(filter.toLowerCase()))
    : dbs;

  return (
    <div className="text-sm">
      {filtered.map((d, di) => (
        <div key={d.db.id}>
          <div className="flex items-center gap-1 px-2 py-1 hover:bg-gray-800 rounded">
            <button onClick={() => toggleDb(di)} className="shrink-0">
              {d.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            <Database size={14} className="text-blue-400 shrink-0" />
            <Link to={`/databases/${d.db.id}`} className="truncate hover:text-white">{d.db.name}</Link>
            <EndorsementDot entityType="database" entityId={d.db.id} />
          </div>
          {d.expanded && (
            <div className="ml-4">
              {d.loading && <div className="text-gray-500 text-xs px-2 py-1">Loading...</div>}
              {d.schemas.map((s) => {
                const ss = d.schemaStates[s.id];
                return (
                  <div key={s.id}>
                    <div className="flex items-center gap-1 px-2 py-1 hover:bg-gray-800 rounded">
                      <button onClick={() => toggleSchema(di, s.id)} className="shrink-0">
                        {ss?.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                      <Layers size={14} className="text-purple-400 shrink-0" />
                      <Link to={`/schemas/${s.id}`} className={`truncate hover:text-white ${s.deleted_at ? "line-through opacity-50" : ""}`}>{s.name}</Link>
                      <EndorsementDot entityType="schema" entityId={s.id} />
                    </div>
                    {ss?.expanded && (
                      <div className="ml-4">
                        {ss.loading && <div className="text-gray-500 text-xs px-2 py-1">Loading...</div>}
                        {ss.tables.map((t) => {
                          const icon = (() => {
                            switch (t.object_type) {
                              case "view": return <Eye size={14} className="text-blue-400" />;
                              case "materialized_view": return <Layers size={14} className="text-indigo-400" />;
                              case "synonym": return <LinkIcon size={14} className="text-orange-400" />;
                              default: return <Table2 size={14} className="text-green-400" />;
                            }
                          })();
                          return (
                            <Link key={t.id} to={`/tables/${t.id}`} className={`flex items-center gap-1 px-2 py-1 hover:bg-gray-800 rounded ${t.deleted_at ? "opacity-50" : ""}`}>
                              {icon}
                              <span className={`truncate ${t.deleted_at ? "line-through" : ""}`}>{t.name}</span>
                              <EndorsementDot entityType="table" entityId={t.id} />
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
