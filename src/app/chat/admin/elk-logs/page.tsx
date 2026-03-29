"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, Repository, ELKDiagnoseResponse } from "@/lib/api";
import Sidebar from "@/components/layout/Sidebar";
import {
  Search, ExternalLink, Copy, CheckCircle2, AlertTriangle, Info,
  Clock, Filter, Loader2,
} from "lucide-react";

const TIME_RANGES = [
  { label: "15m", value: "15m" },
  { label: "1h", value: "1h" },
  { label: "6h", value: "6h" },
  { label: "24h", value: "24h" },
  { label: "3d", value: "3d" },
  { label: "7d", value: "7d" },
];

const CATEGORIES = [
  { label: "All", value: "" },
  { label: "API", value: "api" },
  { label: "Job", value: "job" },
  { label: "Kafka", value: "kafka" },
  { label: "Webhook", value: "webhook" },
  { label: "Cron", value: "cron" },
];

function getLevelStyle(level: string) {
  const l = level?.toLowerCase() || "";
  if (l.includes("error") || l.includes("fatal")) return "bg-red-500/20 text-red-300 border-red-500/30";
  if (l.includes("warn")) return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
  if (l.includes("info")) return "bg-blue-500/20 text-blue-300 border-blue-500/30";
  if (l.includes("debug")) return "bg-slate-500/20 text-slate-300 border-slate-500/30";
  return "bg-slate-500/20 text-slate-400 border-slate-500/30";
}

export default function ELKLogsPage() {
  const router = useRouter();
  const [repos, setRepos] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState("");
  const [query, setQuery] = useState("");
  const [timeRange, setTimeRange] = useState("24h");
  const [category, setCategory] = useState("");
  const [channelId, setChannelId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ELKDiagnoseResponse | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("mars_token");
    if (!token) { router.push("/"); return; }
    api.listRepositories().then(res => {
      if (res.success && res.data) setRepos(res.data);
    });
  }, [router]);

  const handleSearch = async () => {
    if (!selectedRepoId || !query.trim()) return;
    setLoading(true);
    setResult(null);
    const res = await api.diagnoseELK({
      repository_id: selectedRepoId,
      query: query.trim(),
      channel_id: channelId.trim() || undefined,
      order_id: orderId.trim() || undefined,
    });
    if (res.success && res.data) setResult(res.data);
    setLoading(false);
  };

  const handleCopyLogs = () => {
    if (!result?.logs?.length) return;
    const text = result.logs.map(l =>
      `[${l.timestamp}] [${l.level || "INFO"}] ${l.message}`
    ).join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex h-screen bg-[#0a0a0f] text-white">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.06] shrink-0">
          <h1 className="text-lg font-semibold text-white">ELK Log Search</h1>
          <p className="text-xs text-slate-400 mt-1">Search and diagnose logs across repositories via Kibana</p>
        </div>

        {/* Search controls */}
        <div className="px-6 py-4 border-b border-white/[0.06] space-y-3 shrink-0">
          {/* Row 1: Repo + Query */}
          <div className="flex gap-3">
            <select
              value={selectedRepoId}
              onChange={e => setSelectedRepoId(e.target.value)}
              className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500/30 min-w-[200px]"
            >
              <option value="">Select repository...</option>
              {repos.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                placeholder="Search query (e.g. OrderCreation error, skip_id:12345)"
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500/30"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={!selectedRepoId || !query.trim() || loading}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </button>
          </div>

          {/* Row 2: Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Time range */}
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <div className="flex rounded-lg overflow-hidden border border-white/[0.1]">
                {TIME_RANGES.map(tr => (
                  <button
                    key={tr.value}
                    onClick={() => setTimeRange(tr.value)}
                    className={`px-2.5 py-1 text-xs transition-colors ${
                      timeRange === tr.value
                        ? "bg-purple-600/30 text-purple-300"
                        : "bg-white/[0.03] text-slate-400 hover:text-white"
                    }`}
                  >
                    {tr.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category filter */}
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <div className="flex rounded-lg overflow-hidden border border-white/[0.1]">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.value}
                    onClick={() => setCategory(cat.value)}
                    className={`px-2.5 py-1 text-xs transition-colors ${
                      category === cat.value
                        ? "bg-purple-600/30 text-purple-300"
                        : "bg-white/[0.03] text-slate-400 hover:text-white"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional filters */}
            <input
              type="text"
              value={channelId}
              onChange={e => setChannelId(e.target.value)}
              placeholder="Channel ID"
              className="bg-white/[0.05] border border-white/[0.1] rounded px-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500/30 w-28"
            />
            <input
              type="text"
              value={orderId}
              onChange={e => setOrderId(e.target.value)}
              placeholder="Order ID"
              className="bg-white/[0.05] border border-white/[0.1] rounded px-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500/30 w-28"
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {!result && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <Search className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">Select a repository and enter a search query</p>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mb-3" />
              <p className="text-sm">Searching ELK...</p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* Result header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                    result.method === "elk_api"
                      ? "bg-green-500/20 text-green-300 border border-green-500/30"
                      : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  }`}>
                    {result.method === "elk_api" ? (
                      <><CheckCircle2 className="w-3 h-3" /> Live Results</>
                    ) : (
                      <><AlertTriangle className="w-3 h-3" /> Deep Link Only</>
                    )}
                  </span>
                  <span className="text-xs text-slate-400">{result.total_hits} hits across {result.indexes_searched} indexes</span>
                </div>
                <div className="flex items-center gap-2">
                  {result.logs?.length > 0 && (
                    <button
                      onClick={handleCopyLogs}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] border border-white/[0.1] rounded-lg text-xs text-slate-300 hover:text-white"
                    >
                      {copied ? <CheckCircle2 className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                      {copied ? "Copied!" : "Copy Logs"}
                    </button>
                  )}
                  {result.deep_links?.map((link, i) => (
                    <a
                      key={i}
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 border border-purple-500/30 rounded-lg text-xs text-purple-300 hover:text-purple-200"
                    >
                      <ExternalLink className="w-3 h-3" /> Open in Kibana
                    </a>
                  ))}
                </div>
              </div>

              {/* Search tips (shown when deep_link_only) */}
              {result.method === "deep_link_only" && result.search_tips?.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-medium text-amber-300">Search Tips</span>
                  </div>
                  <ul className="space-y-1">
                    {result.search_tips.map((tip, i) => (
                      <li key={i} className="text-xs text-amber-200/70">{tip}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Log entries */}
              {result.logs?.length > 0 && (
                <div className="space-y-1">
                  {result.logs.map((log, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-colors"
                    >
                      <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap mt-0.5">
                        {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : "--"}
                      </span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border shrink-0 ${getLevelStyle(log.level)}`}>
                        {log.level || "INFO"}
                      </span>
                      <span className="text-xs text-slate-300 break-all flex-1 font-mono">{log.message || "(no message)"}</span>
                      <span className="text-[10px] text-slate-600 whitespace-nowrap shrink-0">{log.index}</span>
                    </div>
                  ))}
                </div>
              )}

              {result.method === "elk_api" && (!result.logs || result.logs.length === 0) && (
                <div className="text-center py-8 text-slate-500">
                  <p className="text-sm">No matching logs found for this query.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
