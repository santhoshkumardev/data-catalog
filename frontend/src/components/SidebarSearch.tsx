import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Database, Layers, Table2, Columns3, FileCode, BookOpen, BookText } from "lucide-react";
import { search, type SearchResult } from "../api/catalog";

interface DbNode { name: string; id: string; schemas: SchemaNode[]; }
interface SchemaNode { name: string; id: string; tables: TableNode[]; matched: boolean; }
interface TableNode { name: string; id: string; columns: ColNode[]; matched: boolean; }
interface ColNode { name: string; id: string; }
interface QueryNode { name: string; id: string; }
interface ArticleNode { name: string; id: string; }
interface GlossaryNode { name: string; id: string; }

function buildTree(results: SearchResult[]) {
  const dbs: Record<string, DbNode> = {};
  const queries: QueryNode[] = [];
  const articles: ArticleNode[] = [];
  const glossary: GlossaryNode[] = [];

  for (const r of results) {
    if (r.entity_type === "query") { queries.push({ name: r.name, id: r.id }); continue; }
    if (r.entity_type === "article") { articles.push({ name: r.name, id: r.id }); continue; }
    if (r.entity_type === "glossary") { glossary.push({ name: r.name, id: r.id }); continue; }

    const dbName = r.breadcrumb[0] || "Unknown";
    if (!dbs[dbName]) dbs[dbName] = { name: dbName, id: "", schemas: [] };
    const db = dbs[dbName];

    if (r.entity_type === "database") { db.id = r.id; continue; }
    if (!db.id && r.connection_id) db.id = r.connection_id;

    const schemaName = r.breadcrumb[1] || "default";
    let schema = db.schemas.find((s) => s.name === schemaName);
    if (!schema) { schema = { name: schemaName, id: r.schema_id || r.parent_id || "", tables: [], matched: false }; db.schemas.push(schema); }

    if (r.entity_type === "schema") { schema.id = r.id; schema.matched = true; continue; }

    const tableName = r.entity_type === "table" ? r.name : r.breadcrumb[2] || "";
    let table = schema.tables.find((t) => t.name === tableName);
    if (!table) { table = { name: tableName, id: r.entity_type === "table" ? r.id : r.parent_id || "", columns: [], matched: false }; schema.tables.push(table); }

    if (r.entity_type === "table") { table.matched = true; continue; }
    if (r.entity_type === "column") { table.columns.push({ name: r.name, id: r.id }); }
  }
  return { dbs: Object.values(dbs), queries, articles, glossary };
}

export default function SidebarSearch({ filter }: { filter: string }) {
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    if (!filter.trim()) { setResults([]); return; }
    const t = setTimeout(() => {
      search(filter, "all", 1, 30).then((res) => setResults(res.results));
    }, 250);
    return () => clearTimeout(t);
  }, [filter]);

  if (!filter.trim() || results.length === 0) return null;

  const { dbs, queries, articles, glossary } = buildTree(results);

  return (
    <div className="text-sm border-t border-gray-700 pt-2 mt-2">
      <div className="text-xs text-gray-400 px-2 mb-1 uppercase tracking-wider">Search Results</div>
      {dbs.map((db) => (
        <div key={db.name}>
          <Link to={db.id ? `/databases/${db.id}` : "#"} className="flex items-center gap-1 px-2 py-0.5 text-gray-300 hover:bg-gray-800 rounded">
            <Database size={14} className="text-blue-400" />
            <span>{db.name}</span>
          </Link>
          {db.schemas.map((s) => (
            <div key={s.id} className="ml-4">
              <Link to={`/schemas/${s.id}`} className="flex items-center gap-1 px-2 py-0.5 hover:bg-gray-800 rounded">
                <Layers size={14} className="text-purple-400" />
                <span>{s.name}</span>
                {s.matched && <span className="text-[10px] bg-purple-800 text-purple-200 px-1 rounded ml-1">match</span>}
              </Link>
              {s.tables.map((t) => (
                <div key={t.id} className="ml-4">
                  <Link to={`/tables/${t.id}`} className="flex items-center gap-1 px-2 py-0.5 hover:bg-gray-800 rounded">
                    <Table2 size={14} className="text-green-400" />
                    <span>{t.name}</span>
                    {t.matched && <span className="text-[10px] bg-green-800 text-green-200 px-1 rounded ml-1">match</span>}
                  </Link>
                  {t.columns.map((c) => (
                    <Link key={c.id} to={`/tables/${t.id}`} className="flex items-center gap-1 ml-4 px-2 py-0.5 hover:bg-gray-800 rounded text-gray-400">
                      <Columns3 size={12} /> {c.name}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
      {queries.map((q) => (
        <Link key={q.id} to={`/queries/${q.id}`} className="flex items-center gap-1 px-2 py-0.5 hover:bg-gray-800 rounded">
          <FileCode size={14} className="text-amber-400" /> {q.name}
        </Link>
      ))}
      {articles.map((a) => (
        <Link key={a.id} to={`/articles/${a.id}`} className="flex items-center gap-1 px-2 py-0.5 hover:bg-gray-800 rounded">
          <BookOpen size={14} className="text-indigo-400" /> {a.name}
        </Link>
      ))}
      {glossary.map((g) => (
        <Link key={g.id} to={`/glossary/${g.id}`} className="flex items-center gap-1 px-2 py-0.5 hover:bg-gray-800 rounded">
          <BookText size={14} className="text-teal-400" /> {g.name}
        </Link>
      ))}
    </div>
  );
}
