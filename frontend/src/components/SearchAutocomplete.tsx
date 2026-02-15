import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Sparkles, Database, Table2, Layers, Columns3, FileCode, BookOpen, BookText } from "lucide-react";
import { search, type SearchResult } from "../api/catalog";
import { askAI, type AiResponse } from "../api/ai";
import { isQuestion } from "../utils/isQuestion";

const ICONS: Record<string, React.ReactNode> = {
  database: <Database size={14} className="text-blue-500" />,
  schema: <Layers size={14} className="text-purple-500" />,
  table: <Table2 size={14} className="text-green-500" />,
  column: <Columns3 size={14} className="text-gray-500" />,
  query: <FileCode size={14} className="text-amber-500" />,
  article: <BookOpen size={14} className="text-indigo-500" />,
  glossary: <BookText size={14} className="text-teal-500" />,
};

const LINKS: Record<string, (r: SearchResult) => string> = {
  database: (r) => `/databases/${r.id}`,
  schema: (r) => `/schemas/${r.id}`,
  table: (r) => `/tables/${r.id}`,
  column: (r) => `/tables/${r.parent_id}`,
  query: (r) => `/queries/${r.id}`,
  article: (r) => `/articles/${r.id}`,
  glossary: (r) => `/glossary/${r.id}`,
};

interface Props {
  large?: boolean;
  enableAI?: boolean;
  onAIResult?: (q: string, r: AiResponse, results: SearchResult[]) => void;
}

export default function SearchAutocomplete({ large, enableAI, onAIResult }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [isAI, setIsAI] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!query.trim()) { setResults([]); setOpen(false); return; }
    const ai = enableAI && isQuestion(query);
    setIsAI(!!ai);
    const timer = setTimeout(async () => {
      if (ai) {
        const [aiRes, searchRes] = await Promise.all([askAI(query), search(query, "all", 1, 5)]);
        onAIResult?.(query, aiRes, searchRes.results);
        setOpen(false);
      } else {
        const res = await search(query, "all", 1, 8);
        setResults(res.results);
        setOpen(res.results.length > 0);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative w-full">
      <div className={`flex items-center gap-2 bg-white border rounded-lg ${large ? "px-4 py-3" : "px-3 py-1.5"}`}>
        {isAI ? <Sparkles size={large ? 20 : 16} className="text-violet-500" /> : <Search size={large ? 20 : 16} className="text-gray-400" />}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && query.trim()) { setOpen(false); navigate(`/search?q=${encodeURIComponent(query)}`); } }}
          placeholder={enableAI ? "Search or ask a question..." : "Search..."}
          className={`flex-1 outline-none ${large ? "text-lg" : "text-sm"}`}
        />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-80 overflow-auto">
          {results.map((r) => (
            <button
              key={r.id + r.entity_type}
              onClick={() => { setOpen(false); navigate(LINKS[r.entity_type]?.(r) || "/"); }}
              className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 text-left text-sm"
            >
              {ICONS[r.entity_type]}
              <div className="min-w-0">
                <div className="truncate font-medium">{r.name}</div>
                <div className="text-xs text-gray-400 truncate">{r.breadcrumb.join(" > ")}</div>
              </div>
              <span className="ml-auto text-xs text-gray-400 shrink-0">{r.entity_type}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
