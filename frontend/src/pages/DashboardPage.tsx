import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Database, Table2, FileCode, BookOpen, BookText, TrendingUp } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { getStats, type Stats, type SearchResult } from "../api/catalog";
import { getTrendingEntities, type PopularEntity } from "../api/analytics";
import { getMyFavorites, type Favorite } from "../api/social";
import SearchAutocomplete from "../components/SearchAutocomplete";
import AIResponsePanel from "../components/AIResponsePanel";
import type { AiResponse } from "../api/ai";

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [trending, setTrending] = useState<PopularEntity[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [aiQ, setAiQ] = useState("");
  const [aiRes, setAiRes] = useState<AiResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRelated, setAiRelated] = useState<SearchResult[]>([]);

  useEffect(() => {
    getStats().then(setStats).catch(() => {});
    getTrendingEntities(5).then(setTrending).catch(() => {});
    getMyFavorites().then(setFavorites).catch(() => {});
  }, []);

  const handleAI = (q: string, r: AiResponse, results: SearchResult[]) => {
    setAiQ(q);
    setAiRes(r);
    setAiRelated(results);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Welcome, {user?.name}</h1>
      <p className="text-gray-500 mb-6">Explore your organization's data catalog</p>

      <div className="mb-6">
        <SearchAutocomplete large enableAI onAIResult={handleAI} />
      </div>

      {aiRes && (
        <AIResponsePanel
          question={aiQ}
          response={aiRes}
          loading={aiLoading}
          relatedResults={aiRelated}
          onClose={() => setAiRes(null)}
          onSeeAll={() => navigate(`/search?q=${encodeURIComponent(aiQ)}`)}
        />
      )}

      {stats && (
        <div className="grid grid-cols-5 gap-4 mb-8">
          {[
            { label: "Databases", value: stats.databases, icon: <Database size={20} className="text-blue-500" /> },
            { label: "Schemas", value: stats.schemas, icon: <Database size={20} className="text-purple-500" /> },
            { label: "Tables", value: stats.tables, icon: <Table2 size={20} className="text-green-500" /> },
            { label: "Columns", value: stats.columns, icon: <Table2 size={20} className="text-gray-500" /> },
            { label: "Queries", value: stats.queries, icon: <FileCode size={20} className="text-amber-500" /> },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-1">{s.icon}<span className="text-xs text-gray-500">{s.label}</span></div>
              <div className="text-2xl font-bold">{s.value.toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {trending.length > 0 && (
          <div className="bg-white rounded-lg border p-4">
            <h2 className="flex items-center gap-2 font-semibold mb-3"><TrendingUp size={16} className="text-orange-500" /> Trending This Week</h2>
            <div className="space-y-2">
              {trending.map((t, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{t.entity_type}: {t.entity_id.slice(0, 8)}...</span>
                  <span className="text-xs text-gray-400">{t.view_count} views</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {favorites.length > 0 && (
          <div className="bg-white rounded-lg border p-4">
            <h2 className="font-semibold mb-3">Your Favorites</h2>
            <div className="space-y-2">
              {favorites.slice(0, 5).map((f) => (
                <div key={f.id} className="text-sm text-gray-700">
                  <span className="text-xs text-gray-400">{f.entity_type}</span> {f.entity_id.slice(0, 8)}...
                </div>
              ))}
              {favorites.length > 5 && <Link to="/favorites" className="text-xs text-blue-600 hover:underline">See all</Link>}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 mt-8">
        <Link to="/databases" className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow">
          <Database size={24} className="text-blue-500 mb-2" />
          <h3 className="font-semibold">Browse Databases</h3>
          <p className="text-sm text-gray-500">Explore schemas, tables, and columns</p>
        </Link>
        <Link to="/glossary" className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow">
          <BookText size={24} className="text-teal-500 mb-2" />
          <h3 className="font-semibold">Business Glossary</h3>
          <p className="text-sm text-gray-500">Standard definitions for key metrics</p>
        </Link>
        <Link to="/articles" className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow">
          <BookOpen size={24} className="text-indigo-500 mb-2" />
          <h3 className="font-semibold">Documentation</h3>
          <p className="text-sm text-gray-500">Articles, runbooks, and guides</p>
        </Link>
      </div>
    </div>
  );
}
