import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookText } from "lucide-react";
import { getGlossaryTerms, type GlossaryTerm } from "../api/glossary";

export default function GlossaryTree({ filter }: { filter: string }) {
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    getGlossaryTerms(1, 30).then((res) => {
      setTerms(res.items);
      setTotal(res.total);
    });
  }, []);

  const filtered = filter
    ? terms.filter((t) => t.name.toLowerCase().includes(filter.toLowerCase()))
    : terms;

  return (
    <div className="text-sm">
      {filtered.map((t) => (
        <Link key={t.id} to={`/glossary/${t.id}`} className="flex items-center gap-1 px-2 py-1 hover:text-white rounded">
          <BookText size={14} className="text-teal-400 shrink-0" />
          <span className="truncate">{t.name}</span>
          {t.status === "draft" && <span className="text-[10px] text-yellow-500 ml-auto">draft</span>}
        </Link>
      ))}
      {total > terms.length && <div className="text-gray-500 text-xs px-2 py-1">+{total - terms.length} more...</div>}
    </div>
  );
}
