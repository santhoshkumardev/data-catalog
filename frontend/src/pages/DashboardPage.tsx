import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck, Users, DatabaseZap, AlertCircle,
  CalendarDays, PlayCircle, ExternalLink, ArrowRight,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import type { SearchResult } from "../api/catalog";
import SearchAutocomplete from "../components/SearchAutocomplete";
import AIResponsePanel from "../components/AIResponsePanel";
import type { AiResponse } from "../api/ai";

// ─── Data Landscape — Business Process Journey ─────────────────────────────

const JOURNEY_STAGES = [
  {
    label: "Go-to-Market",
    color: "bg-blue-500",
    light: "bg-blue-50 border-blue-200",
    text: "text-blue-700",
    systems: ["Marketo", "Integrate", "SDL Tridion"],
    desc: "Demand gen & awareness",
  },
  {
    label: "Sales",
    color: "bg-violet-500",
    light: "bg-violet-50 border-violet-200",
    text: "text-violet-700",
    systems: ["Salesforce", "Momentum", "Marketplace"],
    desc: "Lead, quote & close",
  },
  {
    label: "Delivery",
    color: "bg-teal-500",
    light: "bg-teal-50 border-teal-200",
    text: "text-teal-700",
    systems: ["Financial Force", "Siebel", "Akamai Platform"],
    desc: "Order & onboarding",
  },
  {
    label: "Operations",
    color: "bg-amber-500",
    light: "bg-amber-50 border-amber-200",
    text: "text-amber-700",
    systems: ["AIS", "EBS", "Luna / Pulsar"],
    desc: "Usage & billing",
  },
  {
    label: "Success",
    color: "bg-emerald-500",
    light: "bg-emerald-50 border-emerald-200",
    text: "text-emerald-700",
    systems: ["Avaya", "Walker CSAT", "ABI"],
    desc: "Support & renewal",
  },
];

function DataLandscape() {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <p className="text-xs text-gray-500 mb-3 leading-relaxed shrink-0">
        How Akamai's key systems map across the end-to-end customer journey — from generating
        interest through to renewal and upsell.
      </p>
      <div className="flex gap-2 flex-1 min-h-0">
        {JOURNEY_STAGES.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2 flex-1 min-w-0">
            <div className={`flex-1 flex flex-col border rounded-xl p-2.5 h-full min-w-0 overflow-hidden ${s.light}`}>
              <div className="flex items-center gap-1 mb-1 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${s.color}`} />
                <span className={`text-xs font-semibold ${s.text} truncate`}>{s.label}</span>
              </div>
              <p className="text-xs text-gray-400 mb-2 leading-tight">{s.desc}</p>
              <div className="flex flex-col gap-1 mt-auto min-w-0 overflow-hidden">
                {s.systems.map((sys) => (
                  <span
                    key={sys}
                    className="text-xs bg-white border border-gray-200 text-gray-600 px-1.5 py-0.5 rounded-md truncate block"
                  >
                    {sys}
                  </span>
                ))}
              </div>
            </div>
            {i < JOURNEY_STAGES.length - 1 && (
              <ArrowRight size={12} className="text-gray-300 shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Process Articles — Confluence Links ───────────────────────────────────

const PROCESS_ARTICLES = [
  { name: "Lead",          color: "bg-blue-500",    desc: "Prospect data from initial contact in Marketo & Salesforce" },
  { name: "Campaign",      color: "bg-violet-500",  desc: "Marketing campaign performance, attribution and spend" },
  { name: "Opportunity",   color: "bg-indigo-500",  desc: "Sales pipeline stages and deal progression" },
  { name: "Contract",      color: "bg-teal-500",    desc: "Executed agreements including terms and contract values" },
  { name: "Product Usage", color: "bg-cyan-500",    desc: "Customer consumption metrics from the Akamai platform" },
  { name: "Invoice",       color: "bg-amber-500",   desc: "Billing records generated post-delivery" },
  { name: "Revenue",       color: "bg-emerald-500", desc: "Recognized revenue aligned to ASC 606 standards" },
  { name: "COGS",          color: "bg-rose-500",    desc: "Cost of goods sold across delivery infrastructure" },
];

function ProcessArticles() {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <p className="text-xs text-gray-500 mb-2 leading-relaxed shrink-0">
        Business process docs hosted in Confluence — click any topic to open it.
      </p>
      <div className="flex-1 overflow-y-auto min-h-0">
        {PROCESS_ARTICLES.map((a) => (
          <a
            key={a.name}
            href="#"
            className="group flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-teal-50 transition-colors"
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${a.color}`} />
            <span className="text-xs font-semibold text-gray-800 group-hover:text-teal-700 w-24 shrink-0">
              {a.name}
            </span>
            <span className="text-xs text-gray-400 flex-1 truncate">{a.desc}</span>
            <ExternalLink size={10} className="text-gray-300 group-hover:text-teal-400 shrink-0" />
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── Support Actions ───────────────────────────────────────────────────────

const SUPPORT_ACTIONS = [
  { icon: <ShieldCheck size={16} className="text-teal-500" />, title: "Get Access",           desc: "Request access to a database or dataset",   label: "Submit request"   },
  { icon: <Users size={16} className="text-teal-500" />,       title: "Become a Steward",     desc: "Take ownership of a data domain",            label: "Learn more"       },
  { icon: <DatabaseZap size={16} className="text-teal-500" />, title: "Onboard a Data Source", desc: "Register a new system to the catalog",      label: "Start onboarding" },
  { icon: <AlertCircle size={16} className="text-teal-500" />, title: "Report an Issue",      desc: "Flag data quality or metadata problems",     label: "Report now"       },
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
    <div className="h-full flex flex-col gap-3">

      {/* Welcome + Search */}
      <div className="shrink-0">
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          Welcome{user?.name ? `, ${user.name}` : ""}
        </h1>
        <SearchAutocomplete large enableAI onAIResult={handleAI} />
      </div>

      {aiRes && (
        <div className="shrink-0">
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

      {/* 2×2 tile grid — top row taller (3fr), bottom shorter (2fr) */}
      <div className="grid grid-cols-2 gap-4 flex-1 min-h-0" style={{ gridTemplateRows: "3fr 2fr" }}>

        {/* ── Tile 1: Data Landscape ──────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col min-h-0 overflow-hidden">
          <h2 className="text-sm font-semibold text-gray-900 mb-1 shrink-0">Akamai Data Landscape</h2>
          <DataLandscape />
        </div>

        {/* ── Tile 2: Process Articles ────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-between mb-1 shrink-0">
            <h2 className="text-sm font-semibold text-gray-900">Process Articles</h2>
            <a href="#" className="text-xs text-teal-600 hover:underline">Open Confluence →</a>
          </div>
          <ProcessArticles />
        </div>

        {/* ── Tile 3: Let's Talk Data ─────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col min-h-0 overflow-hidden">
          <h2 className="text-sm font-semibold text-gray-900 mb-2 shrink-0">Let's Talk Data</h2>

          {/* Featured session */}
          <div className="bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-100 rounded-xl p-3 mb-2 shrink-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-teal-700 uppercase tracking-wide">Latest Recording</span>
              <span className="flex items-center gap-1 text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">
                <CalendarDays size={10} /> Jan 15, 2026
              </span>
            </div>
            <p className="text-xs font-semibold text-gray-900 mb-0.5">Demystifying Data Lineage at Scale</p>
            <p className="text-xs text-gray-500 mb-2">Priya Nair · Data Platform Engineering</p>
            <a
              href="#"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <PlayCircle size={11} /> Watch Recording
            </a>
          </div>

          {/* Upcoming session */}
          <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-2.5 border border-gray-100 shrink-0">
            <div className="text-center bg-white border border-gray-200 rounded-lg px-2 py-1 shrink-0 min-w-[40px]">
              <div className="text-xs text-gray-400 uppercase leading-none">Feb</div>
              <div className="text-sm font-bold text-teal-600 leading-tight">19</div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-800 truncate">Building a Data Contract for the CRM Domain</p>
              <p className="text-xs text-gray-400 mt-0.5">Marcus Lee · 3:00 PM ET</p>
            </div>
            <a href="#" className="text-xs text-teal-600 hover:underline shrink-0">Register →</a>
          </div>
        </div>

        {/* ── Tile 4: Getting Support ─────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col min-h-0 overflow-hidden">
          <h2 className="text-sm font-semibold text-gray-900 mb-2 shrink-0">Getting Support</h2>
          <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
            {SUPPORT_ACTIONS.map((a) => (
              <div
                key={a.title}
                className="flex flex-col gap-1 bg-gray-50 hover:bg-teal-50 border border-gray-100 hover:border-teal-200 rounded-xl p-3 transition-colors group overflow-hidden"
              >
                <div className="flex items-center gap-1.5 shrink-0">
                  {a.icon}
                  <span className="text-xs font-semibold text-gray-800 truncate">{a.title}</span>
                </div>
                <p className="text-xs text-gray-500 leading-tight line-clamp-2 flex-1">{a.desc}</p>
                <a href="#" className="text-xs text-teal-600 group-hover:text-teal-700 font-medium hover:underline shrink-0">
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
