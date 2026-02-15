import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { getArticles, type ArticleDoc, type Paginated } from "../api/catalog";

export default function ArticlesPage() {
  const [data, setData] = useState<Paginated<ArticleDoc> | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  useEffect(() => { getArticles(page, 20).then(setData); }, [page]);

  const filtered = data?.items.filter((a) =>
    !search || a.title.toLowerCase().includes(search.toLowerCase()) || a.sme_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Articles</h1>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter articles..." className="border rounded px-3 py-1.5 text-sm w-64" />
      </div>
      <div className="space-y-2">
        {filtered?.map((a) => (
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
