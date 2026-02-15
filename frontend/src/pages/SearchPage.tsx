import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, Database, Layers, Table2, Columns3, FileCode, BookOpen, BookText } from "lucide-react";
import { search, type SearchResult, type SearchResponse } from "../api/catalog";

const ICONS: Record<string, React.ReactNode> = {
  database: <Database size={16} className="text-blue-500" />,
  schema: <Layers size={16} className="text-purple-500" />,
  table: <Table2 size={16} className="text-green-500" />,
  column: <Columns3 size={16} className="text-gray-500" />,
  query: <FileCode size={16} className="text-amber-500" />,
  article: <BookOpen size={16} className="text-indigo-500" />,
  glossary: <BookText size={16} className="text-teal-500" />,
};

const LINKS: Record<string, (r: SearchResult) => string> = {
  database: (r) => `/databases/${r.id}`,
  schema: (r) => `/schemas/${r.id}`,
  table: (r) => `/tables/${r.id}`,
  column: (r) => `/tables/${r.parent_id}`,
  query: (r) => `/queries/${r.id}`,
  article: (r) => `/articles/${r.id}`,
  glossary: (r) => `/glossary/${r.id}`,
};

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const typeFilter = params.get("type") || "all";
  const [query, setQuery] = useState(q);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q) return;
    setLoading(true);
    search(q, typeFilter, 1, 50).then(setResults).finally(() => setLoading(false));
  }, [q, typeFilter]);

  const doSearch = () => {
    if (query.trim()) setParams({ q: query, type: typeFilter });
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex gap-2 mb-4">
        <div className="flex-1 flex items-center gap-2 border rounded-lg px-3 py-2 bg-white">
          <Search size={16} className="text-gray-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doSearch()} placeholder="Search..." className="flex-1 outline-none text-sm" />
        </div>
        <select value={typeFilter} onChange={(e) => setParams({ q, type: e.target.value })} className="border rounded px-3 py-2 text-sm">
          <option value="all">All types</option>
          <option value="database">Databases</option>
          <option value="schema">Schemas</option>
          <option value="table">Tables</option>
          <option value="column">Columns</option>
          <option value="query">Queries</option>
          <option value="article">Articles</option>
          <option value="glossary">Glossary</option>
        </select>
        <button onClick={doSearch} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">Search</button>
      </div>

      {loading && <div className="text-gray-400">Searching...</div>}
      {results && <div className="text-sm text-gray-500 mb-3">{results.total} results</div>}
      <div className="space-y-2">
        {results?.results.map((r) => (
          <Link key={r.id + r.entity_type} to={LINKS[r.entity_type]?.(r) || "/"} className="flex items-start gap-3 bg-white border rounded-lg p-4 hover:shadow-sm">
            <div className="mt-0.5">{ICONS[r.entity_type]}</div>
            <div className="min-w-0">
              <div className="font-medium">{r.name}</div>
              <div className="text-xs text-gray-400">{r.breadcrumb.join(" > ")}</div>
              {r.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{r.description}</p>}
              {r.tags && r.tags.length > 0 && (
                <div className="flex gap-1 mt-1">{r.tags.map((t) => <span key={t} className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full">{t}</span>)}</div>
              )}
            </div>
            <span className="text-xs text-gray-400 shrink-0 ml-auto">{r.entity_type}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
