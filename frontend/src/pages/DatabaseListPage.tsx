import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Database } from "lucide-react";
import { getDatabases } from "../api/catalog";
import Pagination from "../components/Pagination";

export default function DatabaseListPage() {
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
    queryKey: ["databases", page, debouncedSearch],
    queryFn: () => getDatabases(page, 20, debouncedSearch || undefined),
  });

  if (!data) return <div className="text-gray-400">Loading...</div>;

  const totalPages = Math.ceil(data.total / data.size);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Databases</h1>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search databases..."
          className="border rounded px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="grid gap-3">
        {data.items.map((db) => (
          <Link key={db.id} to={`/databases/${db.id}`} className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-1">
              <Database size={16} className="text-blue-500" />
              <span className="font-semibold">{db.name}</span>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{db.db_type}</span>
            </div>
            {db.tags && db.tags.length > 0 && (
              <div className="flex gap-1 mt-2">
                {db.tags.map((t) => <span key={t} className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">{t}</span>)}
              </div>
            )}
          </Link>
        ))}
      </div>
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
