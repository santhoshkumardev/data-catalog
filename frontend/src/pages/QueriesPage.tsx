import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FileCode } from "lucide-react";
import { getQueries } from "../api/catalog";
import Pagination from "../components/Pagination";

export default function QueriesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data } = useQuery({
    queryKey: ["queries", page, debouncedSearch],
    queryFn: () => getQueries(page, 20, undefined, debouncedSearch || undefined),
  });

  const totalPages = data ? Math.ceil(data.total / data.size) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Queries</h1>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search queries..." className="border rounded px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      {!data ? (
        <div className="text-gray-400">Loading...</div>
      ) : (
        <>
          <div className="space-y-2">
            {data.items.map((q) => (
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
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
