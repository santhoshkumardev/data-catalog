import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { getArticles } from "../api/catalog";
import Pagination from "../components/Pagination";

export default function ArticlesPage() {
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
    queryKey: ["articles", page, debouncedSearch],
    queryFn: () => getArticles(page, 20, debouncedSearch || undefined),
  });

  const totalPages = data ? Math.ceil(data.total / data.size) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Articles</h1>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search articles..." className="border rounded px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      {!data ? (
        <div className="text-gray-400">Loading...</div>
      ) : (
        <>
          <div className="space-y-2">
            {data.items.map((a) => (
              <Link key={a.id} to={`/articles/${a.id}`} className="flex items-start gap-3 bg-white border rounded-lg p-4 hover:shadow-sm">
                <BookOpen size={18} className="text-indigo-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium">{a.title}</div>
                  {a.description && <div className="text-sm text-gray-500 mt-1 line-clamp-1">{a.description}</div>}
                  {a.tags && a.tags.length > 0 && (
                    <div className="flex gap-1 mt-1">{a.tags.map((t) => <span key={t} className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full">{t}</span>)}</div>
                  )}
                </div>
                {a.creator_name && <span className="text-xs text-gray-400 shrink-0 ml-auto">{a.creator_name}</span>}
              </Link>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
