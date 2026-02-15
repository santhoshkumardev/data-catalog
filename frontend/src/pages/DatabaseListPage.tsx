import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Database } from "lucide-react";
import { getDatabases, type DbConnection, type Paginated } from "../api/catalog";

export default function DatabaseListPage() {
  const [data, setData] = useState<Paginated<DbConnection> | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => { getDatabases(page).then(setData); }, [page]);

  if (!data) return <div className="text-gray-400">Loading...</div>;

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Databases</h1>
      <div className="grid gap-3">
        {data.items.map((db) => (
          <Link key={db.id} to={`/databases/${db.id}`} className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-1">
              <Database size={16} className="text-blue-500" />
              <span className="font-semibold">{db.name}</span>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{db.db_type}</span>
            </div>
            {db.description && <p className="text-sm text-gray-500 mt-1">{db.description}</p>}
            {db.tags && db.tags.length > 0 && (
              <div className="flex gap-1 mt-2">
                {db.tags.map((t) => <span key={t} className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">{t}</span>)}
              </div>
            )}
          </Link>
        ))}
      </div>
      {data.total > data.size && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border rounded text-sm disabled:opacity-50">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {Math.ceil(data.total / data.size)}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(data.total / data.size)} className="px-3 py-1 border rounded text-sm disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
}
