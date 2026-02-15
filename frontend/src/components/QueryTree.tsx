import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileCode } from "lucide-react";
import { getQueries, type QueryDoc } from "../api/catalog";

export default function QueryTree({ filter, refreshKey }: { filter: string; refreshKey: number }) {
  const [queries, setQueries] = useState<QueryDoc[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    getQueries(1, 30).then((res) => {
      setQueries(res.items);
      setTotal(res.total);
    });
  }, [refreshKey]);

  const filtered = filter
    ? queries.filter((q) => q.name.toLowerCase().includes(filter.toLowerCase()) || q.sme_name?.toLowerCase().includes(filter.toLowerCase()))
    : queries;

  return (
    <div className="text-sm">
      {filtered.map((q) => (
        <Link key={q.id} to={`/queries/${q.id}`} className="flex items-center gap-1 px-2 py-1 hover:bg-gray-800 rounded">
          <FileCode size={14} className="text-amber-400 shrink-0" />
          <span className="truncate">{q.name}</span>
        </Link>
      ))}
      {total > queries.length && <div className="text-gray-500 text-xs px-2 py-1">+{total - queries.length} more...</div>}
    </div>
  );
}
