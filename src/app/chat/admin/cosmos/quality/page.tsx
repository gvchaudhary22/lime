"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, CheckCircle2, MinusCircle, Brain,
  Loader2, FileText, Lightbulb, ArrowRight, X,
  ThumbsDown, BarChart3, User, Clock, Zap,
  RefreshCw,
} from "lucide-react";
import {
  api,
  ChatQualityRow, ChatQualityResponse,
  DiagnosisResult, DiagnosticRecommendation, FixAction,
} from "@/lib/api";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const confidenceColor = (c: number) =>
  c >= 0.8 ? "text-green-400" : c >= 0.5 ? "text-yellow-400" : "text-red-400";

const confidenceBg = (c: number) =>
  c >= 0.8 ? "bg-green-500" : c >= 0.5 ? "bg-yellow-500" : "bg-red-500";

const categoryColors: Record<string, string> = {
  kb_missing:              "bg-red-500/15 text-red-400 border-red-500/30",
  embedding_poor:          "bg-orange-500/15 text-orange-400 border-orange-500/30",
  threshold_misconfigured: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  technique_failure:       "bg-purple-500/15 text-purple-400 border-purple-500/30",
  correct:                 "bg-green-500/15 text-green-400 border-green-500/30",
  partial:                 "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

const priorityDot: Record<string, string> = {
  high:   "bg-red-400",
  medium: "bg-yellow-400",
  low:    "bg-slate-400",
};

const BUCKET_CONFIG = {
  poor:    { label: "Needs Attention",  icon: AlertTriangle,  color: "text-red-400",    border: "border-red-500/30",    bg: "bg-red-500/10",    tab: "text-red-400 border-red-500/40"    },
  partial: { label: "Partial",          icon: MinusCircle,    color: "text-yellow-400", border: "border-yellow-500/30", bg: "bg-yellow-500/10", tab: "text-yellow-400 border-yellow-500/40" },
  good:    { label: "Good",             icon: CheckCircle2,   color: "text-green-400",  border: "border-green-500/30",  bg: "bg-green-500/10",  tab: "text-green-400 border-green-500/40"  },
} as const;

type BucketKey = keyof typeof BUCKET_CONFIG;

// Mock data shown while the MARS API / Kafka consumer is not yet wired
const MOCK_DATA: ChatQualityResponse = {
  stats: { poor_count: 14, partial_count: 27, good_count: 58, avg_confidence: 0.71 },
  poor: [
    { query_id: "q1", user_email: "agent@icrm.in", company_id: 1001, query: "Order #98765 ka status kya hai?", response_preview: "I don't have enough information to answer.", confidence: 0.22, bucket: "poor", agent: "order_ops", latency_ms: 890, wave_count: 3, created_at: "2026-04-02T09:12:00Z", has_trace: true },
    { query_id: "q2", user_email: "support@shiprocket.in", company_id: 1002, query: "NDR resolution kaise kare?", response_preview: "Please contact the courier partner directly.", confidence: 0.18, bucket: "poor", agent: "ndr_resolver", latency_ms: 1200, wave_count: 2, created_at: "2026-04-02T08:45:00Z", has_trace: true },
    { query_id: "q3", user_email: "ops@seller.com", company_id: 1003, query: "COD remittance cycle what?", response_preview: "I don't know.", confidence: 0.09, bucket: "poor", agent: "billing_ops", latency_ms: 430, wave_count: 1, created_at: "2026-04-01T22:10:00Z", has_trace: false },
  ],
  partial: [
    { query_id: "q4", user_email: "agent@icrm.in", company_id: 1001, query: "Shipment SH-4432 pickup scheduled?", response_preview: "The shipment appears to be awaiting pickup but I could not confirm.", confidence: 0.64, bucket: "partial", agent: "shipment_ops", latency_ms: 760, wave_count: 4, created_at: "2026-04-02T10:01:00Z", has_trace: true },
    { query_id: "q5", user_email: "ops@seller.com", company_id: 1003, query: "Cancel karo order aur refund do", response_preview: "Order cancellation initiated. Refund timeline unclear.", confidence: 0.57, bucket: "partial", agent: "order_ops", latency_ms: 980, wave_count: 5, created_at: "2026-04-02T09:30:00Z", has_trace: true },
  ],
  good: [
    { query_id: "q6", user_email: "agent@icrm.in", company_id: 1001, query: "AWB tracking update for 1234567890", response_preview: "Shipment is in transit. Last scan: Delhi Hub at 08:30.", confidence: 0.94, bucket: "good", agent: "shipment_ops", latency_ms: 320, wave_count: 2, created_at: "2026-04-02T10:20:00Z", has_trace: true },
    { query_id: "q7", user_email: "support@shiprocket.in", company_id: 1002, query: "Weight discrepancy dispute process", response_preview: "To raise a weight discrepancy: Go to AWB > Disputes > New. Upload unboxing video within 48hrs.", confidence: 0.91, bucket: "good", agent: "billing_ops", latency_ms: 540, wave_count: 3, created_at: "2026-04-02T09:55:00Z", has_trace: true },
  ],
};

// ─── Row Component ────────────────────────────────────────────────────────────

function QualityRow({
  row,
  onDiagnose,
  onCorrectAnswer,
  diagnosing,
  diagnosis,
}: {
  row: ChatQualityRow;
  onDiagnose: (row: ChatQualityRow) => void;
  onCorrectAnswer: (row: ChatQualityRow) => void;
  diagnosing: boolean;
  diagnosis: DiagnosisResult | null;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-[#0c1020] border border-white/[0.05] rounded-xl overflow-hidden">
      {/* Row header */}
      <div className="flex items-center gap-4 p-4">
        {/* Confidence bar */}
        <div className="w-16 shrink-0">
          <div className="text-xs font-bold text-center mb-1">
            <span className={confidenceColor(row.confidence)}>{(row.confidence * 100).toFixed(0)}%</span>
          </div>
          <div className="h-1.5 bg-[#0a0e1a] rounded-full">
            <div className={`h-full rounded-full ${confidenceBg(row.confidence)}`}
              style={{ width: `${row.confidence * 100}%` }} />
          </div>
        </div>

        {/* Query + meta */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white truncate">{row.query}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
            <span className="flex items-center gap-1"><User className="w-3 h-3" />{row.user_email}</span>
            <span className="flex items-center gap-1"><Zap className="w-3 h-3" />{row.agent}</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{row.latency_ms}ms</span>
            <span>{row.wave_count} waves</span>
          </div>
          <p className="text-xs text-slate-600 mt-1 truncate italic">{row.response_preview}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => { onDiagnose(row); setExpanded(true); }}
            disabled={diagnosing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#111830] border border-white/[0.06] hover:border-purple-500/30 text-slate-300 hover:text-white rounded-lg transition-all disabled:opacity-50">
            {diagnosing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3 text-purple-400" />}
            Diagnose
          </button>
          <button onClick={() => onCorrectAnswer(row)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#111830] border border-white/[0.06] hover:border-blue-500/30 text-slate-300 hover:text-white rounded-lg transition-all">
            <ThumbsDown className="w-3 h-3 text-blue-400" />
            Correct
          </button>
        </div>
      </div>

      {/* Inline diagnosis */}
      {expanded && diagnosis && (
        <div className="border-t border-white/[0.04] p-4 space-y-3 bg-[#0a0e1a]">
          <div className="flex items-center gap-3">
            <Brain className="w-4 h-4 text-purple-400" />
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${categoryColors[diagnosis.category] || ""}`}>
              {diagnosis.category.replace(/_/g, " ")}
            </span>
            {diagnosis.failed_wave && (
              <span className="text-xs text-yellow-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Wave {diagnosis.failed_wave} failed
              </span>
            )}
            <span className="ml-auto text-xs text-slate-600">{diagnosis.analysis_latency_ms}ms</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{diagnosis.root_cause}</p>

          {diagnosis.recommendations.length > 0 && (
            <div className="space-y-1.5">
              {diagnosis.recommendations.map((r: DiagnosticRecommendation, i: number) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${priorityDot[r.priority]}`} />
                  <span className="text-xs text-slate-400">{r.description}</span>
                </div>
              ))}
            </div>
          )}

          {diagnosis.fix_actions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {diagnosis.fix_actions.map((f: FixAction, i: number) => (
                <span key={i} className="text-xs bg-[#111830] border border-white/[0.06] rounded px-2 py-1 text-slate-400 font-mono">
                  {f.action}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChatQualityPage() {
  const router = useRouter();
  const [loading, setLoading]                 = useState(false);
  const [data, setData]                       = useState<ChatQualityResponse>(MOCK_DATA);
  const [activeTab, setActiveTab]             = useState<BucketKey>("poor");
  const [diagnosingId, setDiagnosingId]       = useState<string | null>(null);
  const [diagnoses, setDiagnoses]             = useState<Record<string, DiagnosisResult>>({});
  // Correct-answer modal
  const [correctRow, setCorrectRow]           = useState<ChatQualityRow | null>(null);
  const [expectedAnswer, setExpectedAnswer]   = useState("");
  const [submitting, setSubmitting]           = useState(false);
  const [submitDone, setSubmitDone]           = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("mars_token");
    if (!token) { router.push("/"); return; }
    fetchData();
  }, [router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await api.getChatQuality();
    if (res.success && res.data) setData(res.data);
    // else: keep mock data (API not yet implemented on MARS)
    setLoading(false);
  }, []);

  const handleDiagnose = useCallback(async (row: ChatQualityRow) => {
    setDiagnosingId(row.query_id);
    const res = await api.diagnoseQuery({
      query: row.query,
      wave_trace: [],
      final_response: row.response_preview,
      conversation_id: row.conversation_id,
    });
    if (res.success && res.data) {
      setDiagnoses(prev => ({ ...prev, [row.query_id]: res.data! }));
    }
    setDiagnosingId(null);
  }, []);

  const handleSubmitFeedback = useCallback(async () => {
    if (!correctRow || !expectedAnswer.trim()) return;
    setSubmitting(true);
    const res = await api.submitTrainingFeedback({
      query: correctRow.query,
      actual_response: correctRow.response_preview,
      expected_response: expectedAnswer,
      conversation_id: correctRow.conversation_id,
    });
    setSubmitting(false);
    if (res.success && res.data) setSubmitDone(res.data.contribution_id);
    setCorrectRow(null);
    setExpectedAnswer("");
  }, [correctRow, expectedAnswer]);

  const rows = data[activeTab] as ChatQualityRow[];
  const cfg  = BUCKET_CONFIG[activeTab];

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Poor (<50%)",     count: data.stats.poor_count,    color: "text-red-400",    icon: AlertTriangle },
          { label: "Partial (50-80%)",count: data.stats.partial_count, color: "text-yellow-400", icon: MinusCircle },
          { label: "Good (>80%)",     count: data.stats.good_count,    color: "text-green-400",  icon: CheckCircle2 },
          { label: "Avg Confidence",  count: null,                     color: confidenceColor(data.stats.avg_confidence), icon: BarChart3 },
        ].map(({ label, count, color, icon: Icon }) => (
          <div key={label} className="bg-[#111830] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs text-slate-500">{label}</span>
            </div>
            <p className={`text-2xl font-bold ${color}`}>
              {count !== null ? count : `${(data.stats.avg_confidence * 100).toFixed(0)}%`}
            </p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-[#0a0e1a] rounded-xl p-1 w-fit">
        {(Object.entries(BUCKET_CONFIG) as [BucketKey, typeof BUCKET_CONFIG[BucketKey]][]).map(([key, c]) => {
          const Icon = c.icon;
          const count = data[key].length;
          return (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === key
                  ? `bg-[#111830] border ${c.tab}`
                  : "text-slate-500 hover:text-slate-300"
              }`}>
              <Icon className={`w-4 h-4 ${activeTab === key ? c.color : ""}`} />
              {c.label}
              <span className={`text-xs rounded-full px-1.5 py-0.5 ${activeTab === key ? `${c.bg} ${c.color}` : "bg-white/[0.04] text-slate-600"}`}>
                {count}
              </span>
            </button>
          );
        })}
        <button onClick={fetchData} disabled={loading}
          className="ml-2 p-2 text-slate-500 hover:text-white transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Note when showing mock data */}
      {!loading && (
        <div className="bg-blue-500/[0.06] border border-blue-500/20 rounded-lg px-4 py-2.5 flex items-center gap-2 text-xs text-blue-400">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Showing sample data. Real data will appear once the MARS Kafka consumer (topic: <span className="font-mono mx-1">stage-cosmos-query-trace</span>) is active.
        </div>
      )}

      {/* Success toast */}
      {submitDone && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-2.5 flex items-center gap-2 text-xs text-green-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Training feedback submitted — contribution ID: <span className="font-mono ml-1">{submitDone}</span>
        </div>
      )}

      {/* Rows */}
      <div className="space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
          </div>
        )}
        {!loading && rows.length === 0 && (
          <div className="text-center py-12">
            <cfg.icon className={`w-10 h-10 ${cfg.color} mx-auto mb-3 opacity-30`} />
            <p className="text-sm text-slate-500">No {cfg.label.toLowerCase()} responses yet</p>
          </div>
        )}
        {!loading && rows.map(row => (
          <QualityRow
            key={row.query_id}
            row={row}
            onDiagnose={handleDiagnose}
            onCorrectAnswer={r => { setCorrectRow(r); setSubmitDone(null); }}
            diagnosing={diagnosingId === row.query_id}
            diagnosis={diagnoses[row.query_id] || null}
          />
        ))}
      </div>

      {/* Correct Answer Modal */}
      {correctRow && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#111830] border border-white/[0.08] rounded-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-yellow-400" /> Provide Correct Answer
              </h3>
              <button onClick={() => setCorrectRow(null)}>
                <X className="w-4 h-4 text-slate-500 hover:text-white transition-colors" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-1">Query:</p>
            <p className="text-sm text-slate-300 italic mb-3">{correctRow.query}</p>
            <p className="text-xs text-slate-500 mb-1">COSMOS answered:</p>
            <p className="text-xs text-slate-500 italic mb-3 bg-[#0a0e1a] rounded p-2">{correctRow.response_preview}</p>
            <textarea value={expectedAnswer} onChange={e => setExpectedAnswer(e.target.value)}
              placeholder="Enter the correct/expected answer for training..."
              className="w-full bg-[#0a0e1a] border border-white/[0.08] rounded-lg px-4 py-3 text-sm text-white placeholder-slate-600 resize-none h-32 focus:outline-none focus:border-purple-500/40 transition-colors" />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setCorrectRow(null)}
                className="flex-1 px-4 py-2.5 border border-white/[0.08] text-slate-400 text-sm rounded-lg hover:text-white transition-colors">
                Cancel
              </button>
              <button onClick={handleSubmitFeedback} disabled={submitting || !expectedAnswer.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-sm rounded-lg transition-all disabled:opacity-50">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Submit for Training
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
