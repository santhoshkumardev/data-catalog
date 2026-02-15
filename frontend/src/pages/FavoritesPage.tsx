import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Database, Layers, Table2, FileCode, BookOpen, BookText } from "lucide-react";
import { getMyFavorites, type Favorite } from "../api/social";
import Breadcrumb from "../components/Breadcrumb";
import { timeAgo } from "../utils/formatters";

const ICONS: Record<string, React.ReactNode> = {
  database: <Database size={16} className="text-blue-500" />,
  schema: <Layers size={16} className="text-purple-500" />,
  table: <Table2 size={16} className="text-green-500" />,
  query: <FileCode size={16} className="text-amber-500" />,
  article: <BookOpen size={16} className="text-indigo-500" />,
  glossary: <BookText size={16} className="text-teal-500" />,
};

const LINKS: Record<string, (id: string) => string> = {
  database: (id) => `/databases/${id}`,
  schema: (id) => `/schemas/${id}`,
  table: (id) => `/tables/${id}`,
  query: (id) => `/queries/${id}`,
  article: (id) => `/articles/${id}`,
  glossary: (id) => `/glossary/${id}`,
};

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    getMyFavorites().then(setFavorites).finally(() => setLoading(false));
  }, []);

  const types = [...new Set(favorites.map((f) => f.entity_type))];
  const filtered = filter === "all" ? favorites : favorites.filter((f) => f.entity_type === filter);

  return (
    <div>
      <Breadcrumb items={[{ label: "Favorites" }]} />
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Heart size={20} className="text-red-400" /> Favorites
          <span className="text-sm font-normal text-gray-400">({favorites.length})</span>
        </h1>
        {types.length > 1 && (
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="border rounded px-3 py-1.5 text-sm">
            <option value="all">All types</option>
            {types.map((t) => <option key={t} value={t}>{t}s</option>)}
          </select>
        )}
      </div>

      {loading && <div className="text-gray-400 text-sm">Loading...</div>}

      {!loading && favorites.length === 0 && (
        <div className="bg-white border rounded-lg p-8 text-center text-gray-400 text-sm">
          No favorites yet. Click the heart icon on any entity to bookmark it.
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((fav) => {
          const link = LINKS[fav.entity_type]?.(fav.entity_id);
          if (!link) return null;
          return (
            <Link key={fav.id} to={link} className="flex items-center gap-3 bg-white border rounded-lg p-4 hover:shadow-sm">
              <div>{ICONS[fav.entity_type] || <Heart size={16} className="text-gray-400" />}</div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{fav.entity_id}</div>
                <div className="text-xs text-gray-400">{fav.entity_type}</div>
              </div>
              <span className="text-xs text-gray-400 shrink-0">{timeAgo(fav.created_at)}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
