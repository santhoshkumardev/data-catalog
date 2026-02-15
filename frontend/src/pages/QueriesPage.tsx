import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileCode } from "lucide-react";
import { getQueries, type QueryDoc, type Paginated } from "../api/catalog";

export default function QueriesPage() {
  const [data, setData] = useState<Paginated<QueryDoc> | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  useEffect(() => { getQueries(page, 20).then(setData); }, [page]);

  const filtered = data?.items.filter((q) =>
    !search || q.name.toLowerCase().includes(search.toLowerCase()) || q.database_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Queries</h1>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter queries..." className="border rounded px-3 py-1.5 text-sm w-64" />
      </div>
      <div className="space-y-2">
        {filtered?.map((q) => (
          <Link key={q.id} to={`/queries/${q.id}`} className="flex items-start gap-3 bg-white border rounded-lg p-4 hover:shadow-sm">
            <FileCode size={18} className="text-amber-500 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="font-medium">{q.name}</div>
              {q.database_name && <div className="text-xs text-gray-400">{q.database_name}</div>}
              {q.description && <div className="text-sm text-gray-500 mt-1 line-clamp-1" dangerouslySetInnerHTML={{ __html: q.description }} />}
            </div>
            {q.creator_name && <span className="text-xs text-gray-400 shrink-0 ml-auto">{q.creator_name}</span>}
          </Link>
        ))}
      </div>
      {data && data.total > data.size && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border rounded text-sm disabled:opacity-50">Prev</button>
          <span className="text-sm text-gray-500">Page {page}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(data.total / data.size)} className="px-3 py-1 border rounded text-sm disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
}
