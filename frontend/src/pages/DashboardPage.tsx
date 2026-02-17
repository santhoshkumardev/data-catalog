import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck, Users, DatabaseZap, AlertCircle,
  ExternalLink, CalendarDays, PlayCircle, ChevronRight,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import type { SearchResult } from "../api/catalog";
import SearchAutocomplete from "../components/SearchAutocomplete";
import AIResponsePanel from "../components/AIResponsePanel";
import type { AiResponse } from "../api/ai";

// ─── Data Landscape Chart ──────────────────────────────────────────────────

const LANDSCAPE_DATA = [
  { system: "CRM",         objects: 312, color: "#0ea5e9" },
  { system: "Finance",     objects: 278, color: "#6366f1" },
  { system: "Network",     objects: 195, color: "#14b8a6" },
  { system: "Security",    objects: 241, color: "#f59e0b" },
  { system: "Marketing",   objects: 163, color: "#ec4899" },
  { system: "Engineering", objects: 389, color: "#22c55e" },
];

function HorizontalBarChart() {
  const max = Math.max(...LANDSCAPE_DATA.map((d) => d.objects));
  return (
    <div className="mt-4 space-y-3">
      {LANDSCAPE_DATA.map((d) => (
        <div key={d.system} className="flex items-center gap-3 text-sm">
          <span className="w-24 text-right text-gray-500 shrink-0">{d.system}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
            <div
              className="h-5 rounded-full transition-all duration-700"
              style={{
                width: `${(d.objects / max) * 100}%`,
                backgroundColor: d.color,
              }}
            />
          </div>
          <span className="w-10 text-xs text-gray-500 shrink-0">{d.objects}</span>
        </div>
      ))}
      <p className="text-xs text-gray-400 pt-1 text-right">Data objects per system</p>
    </div>
  );
}

// ─── Process Articles ──────────────────────────────────────────────────────

const ARTICLES = [
  {
    title: "Data Governance Framework v2.1",
    tags: ["Governance", "Policy"],
    date: "Jan 2026",
  },
  {
    title: "How to Onboard a New Data Source",
    tags: ["Onboarding", "Engineering"],
    date: "Dec 2025",
  },
  {
    title: "PII Classification & Handling Guidelines",
    tags: ["Security", "Compliance"],
    date: "Nov 2025",
  },
  {
    title: "CRM Data Dictionary — Field Reference",
    tags: ["CRM", "Reference"],
    date: "Oct 2025",
  },
  {
    title: "Monthly Data Quality Scorecard Process",
    tags: ["Quality", "Ops"],
    date: "Sep 2025",
  },
];

const TAG_COLORS: Record<string, string> = {
  Governance:  "bg-blue-100 text-blue-700",
  Policy:      "bg-slate-100 text-slate-600",
  Onboarding:  "bg-teal-100 text-teal-700",
  Engineering: "bg-indigo-100 text-indigo-700",
  Security:    "bg-red-100 text-red-700",
  Compliance:  "bg-orange-100 text-orange-700",
  CRM:         "bg-sky-100 text-sky-700",
  Reference:   "bg-purple-100 text-purple-700",
  Quality:     "bg-green-100 text-green-700",
  Ops:         "bg-yellow-100 text-yellow-700",
};

// ─── Support Actions ───────────────────────────────────────────────────────

const SUPPORT_ACTIONS = [
  {
    icon: <ShieldCheck size={22} className="text-teal-500" />,
    title: "Get Access",
    desc: "Request access to a database, schema, or dataset.",
    label: "Submit request",
  },
  {
    icon: <Users size={22} className="text-teal-500" />,
    title: "Become a Steward",
    desc: "Take ownership of a data domain and help others.",
    label: "Learn more",
  },
  {
    icon: <DatabaseZap size={22} className="text-teal-500" />,
    title: "Onboard a Data Source",
    desc: "Register a new system and connect it to the catalog.",
    label: "Start onboarding",
  },
  {
    icon: <AlertCircle size={22} className="text-teal-500" />,
    title: "Report an Issue",
    desc: "Flag data quality problems or incorrect metadata.",
    label: "Report now",
  },
];

// ─── Dashboard ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [aiQ, setAiQ] = useState("");
  const [aiRes, setAiRes] = useState<AiResponse | null>(null);
  const [aiRelated, setAiRelated] = useState<SearchResult[]>([]);

  const handleAI = (q: string, r: AiResponse, results: SearchResult[]) => {
    setAiQ(q);
    setAiRes(r);
    setAiRelated(results);
  };

  return (
    <div className="max-w-5xl mx-auto pb-12">
      {/* Hero */}
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome{user?.name ? `, ${user.name}` : ""}
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Your single source of truth for Akamai's data landscape
        </p>
      </div>

      {/* Search */}
      <div className="mb-8 mt-4">
        <SearchAutocomplete large enableAI onAIResult={handleAI} />
      </div>

      {aiRes && (
        <div className="mb-8">
          <AIResponsePanel
            question={aiQ}
            response={aiRes}
            loading={false}
            relatedResults={aiRelated}
            onClose={() => setAiRes(null)}
            onSeeAll={() => navigate(`/search?q=${encodeURIComponent(aiQ)}`)}
          />
        </div>
      )}

      {/* 2×2 tile grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Tile 1: Akamai Data Landscape ─────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col">
          <div className="flex items-start justify-between mb-1">
            <h2 className="text-base font-semibold text-gray-900">Akamai Data Landscape</h2>
            <span className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full font-medium">
              {LANDSCAPE_DATA.reduce((a, d) => a + d.objects, 0).toLocaleString()} objects
            </span>
          </div>
          <p className="text-sm text-gray-500 leading-relaxed">
            An at-a-glance view of catalogued data objects across Akamai's core business systems.
            Use this to understand where data lives and plan your discovery journey.
          </p>
          <HorizontalBarChart />
        </div>

        {/* ── Tile 2: Process Articles ───────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col">
          <div className="flex items-start justify-between mb-1">
            <h2 className="text-base font-semibold text-gray-900">Process Articles</h2>
            <a href="#" className="text-xs text-teal-600 hover:underline flex items-center gap-0.5">
              View all <ChevronRight size={12} />
            </a>
          </div>
          <p className="text-sm text-gray-500 mb-4 leading-relaxed">
            Curated guides, runbooks, and standards to help you work with data effectively and confidently.
          </p>
          <div className="space-y-3 flex-1">
            {ARTICLES.map((a) => (
              <div key={a.title} className="flex items-start justify-between gap-3 pb-3 border-b last:border-0 last:pb-0">
                <div className="flex-1 min-w-0">
                  <a
                    href="#"
                    className="text-sm font-medium text-gray-800 hover:text-teal-600 leading-snug block truncate"
                  >
                    {a.title}
                  </a>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {a.tags.map((tag) => (
                      <span
                        key={tag}
                        className={`text-xs px-1.5 py-0.5 rounded font-medium ${TAG_COLORS[tag] ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-gray-400">{a.date}</span>
                  <a href="#" className="text-gray-400 hover:text-teal-600">
                    <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tile 3: Let's Talk Data ────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Let's Talk Data</h2>
          <p className="text-sm text-gray-500 mb-4 leading-relaxed">
            Monthly sessions where data practitioners share insights, best practices, and lessons learned.
          </p>

          {/* Featured session */}
          <div className="bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-100 rounded-xl p-4 mb-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <span className="text-xs font-semibold text-teal-700 uppercase tracking-wide">Latest Recording</span>
              <span className="flex items-center gap-1 text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">
                <CalendarDays size={11} /> Jan 15, 2026
              </span>
            </div>
            <h3 className="font-semibold text-gray-900 leading-snug mb-0.5">
              Demystifying Data Lineage at Scale
            </h3>
            <p className="text-xs text-gray-500 mb-1">Speaker: Priya Nair, Data Platform Engineering</p>
            <p className="text-sm text-gray-600 mb-3 leading-relaxed">
              How Akamai traces data flows across 6 production systems — tools, gotchas, and lessons from the field.
            </p>
            <a
              href="#"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <PlayCircle size={13} /> Watch Recording
            </a>
          </div>

          {/* Upcoming session */}
          <div className="flex items-start gap-3 bg-gray-50 rounded-xl p-3 border border-gray-100">
            <div className="text-center bg-white border border-gray-200 rounded-lg px-2 py-1 shrink-0 min-w-[44px]">
              <div className="text-xs text-gray-400 uppercase tracking-wide leading-none">Feb</div>
              <div className="text-lg font-bold text-teal-600 leading-tight">19</div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 leading-snug">
                Building a Data Contract for the CRM Domain
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Speaker: Marcus Lee · 3:00 PM ET</p>
            </div>
            <a href="#" className="text-xs text-teal-600 hover:underline shrink-0 mt-1">Register →</a>
          </div>
        </div>

        {/* ── Tile 4: Getting Support ───────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Getting Support</h2>
          <p className="text-sm text-gray-500 mb-4 leading-relaxed">
            Need help? Here are the most common ways to get started or get unstuck quickly.
          </p>
          <div className="grid grid-cols-2 gap-3 flex-1">
            {SUPPORT_ACTIONS.map((a) => (
              <div
                key={a.title}
                className="flex flex-col gap-2 bg-gray-50 hover:bg-teal-50 border border-gray-100 hover:border-teal-200 rounded-xl p-4 transition-colors group"
              >
                <div className="flex items-center gap-2">
                  {a.icon}
                  <span className="text-sm font-semibold text-gray-800">{a.title}</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{a.desc}</p>
                <a
                  href="#"
                  className="text-xs text-teal-600 group-hover:text-teal-700 font-medium hover:underline mt-auto"
                >
                  {a.label} →
                </a>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
