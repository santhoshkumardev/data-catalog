import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { getArticles, type ArticleDoc } from "../api/catalog";

export default function ArticleTree({ filter, refreshKey }: { filter: string; refreshKey: number }) {
  const [articles, setArticles] = useState<ArticleDoc[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    getArticles(1, 30).then((res) => {
      setArticles(res.items);
      setTotal(res.total);
    });
  }, [refreshKey]);

  const filtered = filter
    ? articles.filter((a) => a.title.toLowerCase().includes(filter.toLowerCase()) || a.sme_name?.toLowerCase().includes(filter.toLowerCase()))
    : articles;

  return (
    <div className="text-sm">
      {filtered.map((a) => (
        <Link key={a.id} to={`/articles/${a.id}`} className="flex items-center gap-1 px-2 py-1 hover:text-white rounded">
          <BookOpen size={14} className="text-indigo-400 shrink-0" />
          <span className="truncate">{a.title}</span>
        </Link>
      ))}
      {total > articles.length && <div className="text-gray-500 text-xs px-2 py-1">+{total - articles.length} more...</div>}
    </div>
  );
}
