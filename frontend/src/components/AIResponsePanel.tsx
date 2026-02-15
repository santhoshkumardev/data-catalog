import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, Sparkles, Database, Table2, FileCode, BookOpen, BookText, Layers, Columns3 } from "lucide-react";
import type { AiResponse } from "../api/ai";
import type { SearchResult } from "../api/catalog";

const ICONS: Record<string, React.ReactNode> = {
  database: <Database size={14} className="text-blue-500" />,
  schema: <Layers size={14} className="text-purple-500" />,
  table: <Table2 size={14} className="text-green-500" />,
  column: <Columns3 size={14} className="text-gray-500" />,
  query: <FileCode size={14} className="text-amber-500" />,
  article: <BookOpen size={14} className="text-indigo-500" />,
  glossary: <BookText size={14} className="text-teal-500" />,
};

const CONF_COLORS: Record<string, string> = {
  high: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-red-100 text-red-800",
};

interface Props {
  question: string;
  response: AiResponse | null;
  loading: boolean;
  relatedResults: SearchResult[];
  onClose: () => void;
  onSeeAll: () => void;
}

export default function AIResponsePanel({ question, response, loading, relatedResults, onClose, onSeeAll }: Props) {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 mb-6">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-violet-600" />
          <span className="font-medium text-violet-900">AI Answer</span>
          {response && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${CONF_COLORS[response.confidence]}`}>
              {response.confidence}
            </span>
          )}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
      </div>
      <div className="text-xs text-violet-600 mb-2">Q: {question}</div>
      {loading ? (
        <div className="space-y-2">
          <div className="h-4 bg-violet-100 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-violet-100 rounded animate-pulse w-1/2" />
        </div>
      ) : response ? (
        <div className="text-sm text-gray-800 whitespace-pre-wrap mb-3">{response.answer}</div>
      ) : null}
      {relatedResults.length > 0 && (
        <div className="mt-3 border-t border-violet-200 pt-3">
          <div className="text-xs text-violet-600 mb-2">Related catalog items</div>
          {relatedResults.slice(0, 5).map((r) => (
            <button
              key={r.id}
              onClick={() => {
                const link = r.entity_type === "table" ? `/tables/${r.id}` : r.entity_type === "query" ? `/queries/${r.id}` : r.entity_type === "article" ? `/articles/${r.id}` : r.entity_type === "glossary" ? `/glossary/${r.id}` : `/databases/${r.id}`;
                navigate(link);
              }}
              className="flex items-center gap-2 w-full px-2 py-1 hover:bg-violet-100 rounded text-left text-sm"
            >
              {ICONS[r.entity_type]}
              <span className="truncate">{r.name}</span>
              <span className="text-xs text-gray-400 ml-auto">{r.breadcrumb.join(" > ")}</span>
            </button>
          ))}
          <button onClick={onSeeAll} className="text-xs text-violet-600 hover:underline mt-1">See all results</button>
        </div>
      )}
    </div>
  );
}
