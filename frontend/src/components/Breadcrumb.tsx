import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

export interface Crumb {
  label: string;
  to?: string;
}

export default function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav className="flex items-center gap-1 text-sm text-black mb-4">
      {items.map((c, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight size={14} />}
          {c.to ? (
            <Link to={c.to} className="hover:text-blue-600 hover:underline">{c.label}</Link>
          ) : (
            <span className="text-black font-medium">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
