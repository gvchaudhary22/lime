"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Zap, CheckCircle, AlertTriangle, ToggleLeft, ToggleRight } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import { api, CosmosWorkflowSettings } from "@/lib/api";

const PIPELINE_LABELS: Record<string, string> = {
  pipeline1_enabled: "Pipeline 1 — Decision Tree",
  pipeline2_enabled: "Pipeline 2 — TF-IDF RAG",
  pipeline3_enabled: "Pipeline 3 — Hybrid Retrieval",
  pipeline4_enabled: "Pipeline 4 — Claude Tool Use (Wave 2)",
  pipeline5_enabled: "Pipeline 5 — Full Reasoning (Wave 2)",
};

const DEFAULT_SETTINGS: CosmosWorkflowSettings = {
  quality_mode: "balanced",
  force_complex: false,
  model_preference: "auto",
  ignore_cost_budget: false,
  wave1_confidence_threshold: 0.75,
  tier1_respond_threshold: 0.70,
  probe_timeout_sec: 10,
  deep_timeout_sec: 20,
  pipeline1_enabled: true,
  pipeline2_enabled: true,
  pipeline3_enabled: true,
  pipeline4_enabled: true,
  pipeline5_enabled: true,
  enable_ralph: true,
  enable_riper: true,
  enable_hyde: false,
  max_context_tokens: 8000,
  wave3_langgraph_enabled: false,
  wave3_max_iterations: 3,
  wave3_timeout_sec: 15,
  wave4_neo4j_enabled: false,
  wave4_max_depth: 3,
  wave4_timeout_sec: 10,
};

export default function CosmosSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<CosmosWorkflowSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("mars_token");
    if (!token) { router.push("/"); return; }
    fetchSettings();
  }, [router]);

  const fetchSettings = async () => {
    setLoading(true);
    const res = await api.getCosmosSettings();
    if (res.success && res.data) {
      setSettings(res.data);
    }
    setLoading(false);
  };

  const applyPreset = async (preset: "max_quality" | "balanced" | "cost_optimized") => {
    setSaving(true);
    setError("");
    const res = await api.applyCosmosPreset(preset);
    if (res.success && res.data) {
      setSettings(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else {
      setError(res.error || "Failed to apply preset");
    }
    setSaving(false);
  };

  const saveSettings = async () => {
    setSaving(true);
    setError("");
    const res = await api.updateCosmosSettings(settings);
    if (res.success && res.data) {
      setSettings(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else {
      setError(res.error || "Failed to save settings");
    }
    setSaving(false);
  };

  const toggle = (key: keyof CosmosWorkflowSettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }));
  };

  const setNum = (key: keyof CosmosWorkflowSettings, val: number) => {
    setSettings(prev => ({ ...prev, [key]: val }));
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-[#0a0a0a]">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0a0a0a]">
      <Sidebar activePage="admin-cosmos-settings" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Zap className="w-6 h-6 text-purple-400" />
                Cosmos AI Workflow Settings
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                Control quality, cost, model selection and pipeline toggles for every COSMOS query.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {saved && (
                <div className="flex items-center gap-2 text-emerald-400 text-sm">
                  <CheckCircle className="w-4 h-4" /> Saved
                </div>
              )}
              <button
                onClick={saveSettings}
                disabled={saving}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Settings
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Presets */}
          <section className="bg-[#111] rounded-xl border border-[#222] p-5">
            <h2 className="text-white font-semibold mb-4">Quick Presets</h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: "max_quality" as const, label: "Max Quality", desc: "Opus model, all pipelines, no cost gate — best accuracy", color: "purple" },
                { key: "balanced" as const, label: "Balanced", desc: "Auto model, standard thresholds — default", color: "blue" },
                { key: "cost_optimized" as const, label: "Cost Optimized", desc: "Haiku model, fewer pipelines — lowest token spend", color: "emerald" },
              ].map(p => (
                <button
                  key={p.key}
                  onClick={() => applyPreset(p.key)}
                  className={`p-4 rounded-xl border text-left transition-colors ${
                    settings.quality_mode === p.key
                      ? `bg-${p.color}-500/10 border-${p.color}-500/40`
                      : "bg-[#0a0a0a] border-[#333] hover:border-[#444]"
                  }`}
                >
                  <div className={`text-sm font-semibold ${settings.quality_mode === p.key ? `text-${p.color}-400` : "text-white"}`}>
                    {p.label}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{p.desc}</div>
                </button>
              ))}
            </div>
          </section>

          {/* Quality & Model */}
          <section className="bg-[#111] rounded-xl border border-[#222] p-5">
            <h2 className="text-white font-semibold mb-4">Quality &amp; Model</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-2">Model Preference</label>
                <select
                  value={settings.model_preference}
                  onChange={e => setSettings(prev => ({ ...prev, model_preference: e.target.value as CosmosWorkflowSettings["model_preference"] }))}
                  className="w-full bg-[#0a0a0a] border border-[#333] text-white rounded-lg px-3 py-2 text-sm"
                >
                  <option value="auto">Auto (router decides)</option>
                  <option value="opus">Claude Opus (highest quality)</option>
                  <option value="sonnet">Claude Sonnet (balanced)</option>
                  <option value="haiku">Claude Haiku (fastest)</option>
                </select>
              </div>
              <div className="space-y-3">
                <ToggleRow
                  label="Force Complex Mode"
                  sublabel="Treat every query as complex — skip classification"
                  checked={settings.force_complex}
                  onChange={() => toggle("force_complex")}
                />
                <ToggleRow
                  label="Ignore Cost Budget"
                  sublabel="Skip the budget gate — quality first"
                  checked={settings.ignore_cost_budget}
                  onChange={() => toggle("ignore_cost_budget")}
                />
              </div>
            </div>
          </section>

          {/* Thresholds */}
          <section className="bg-[#111] rounded-xl border border-[#222] p-5">
            <h2 className="text-white font-semibold mb-4">Decision Thresholds</h2>
            <div className="space-y-4">
              <SliderRow
                label="Wave-1 Confidence Threshold"
                sublabel="Minimum confidence to skip Wave-2 (higher = more Wave-2 calls)"
                value={settings.wave1_confidence_threshold}
                min={0}
                max={1}
                step={0.05}
                onChange={v => setNum("wave1_confidence_threshold", v)}
              />
              <SliderRow
                label="Tier-1 Respond Threshold"
                sublabel="Minimum confidence to respond from Tier 1 without escalation"
                value={settings.tier1_respond_threshold}
                min={0}
                max={1}
                step={0.05}
                onChange={v => setNum("tier1_respond_threshold", v)}
              />
            </div>
          </section>

          {/* Timeouts */}
          <section className="bg-[#111] rounded-xl border border-[#222] p-5">
            <h2 className="text-white font-semibold mb-4">Timeouts</h2>
            <div className="grid grid-cols-2 gap-4">
              <NumberInput
                label="Probe Timeout (sec)"
                sublabel="Per-probe timeout in Stage-1 parallel gather"
                value={settings.probe_timeout_sec}
                min={1}
                max={300}
                onChange={v => setNum("probe_timeout_sec", v)}
              />
              <NumberInput
                label="Deep Timeout (sec)"
                sublabel="Per-task timeout in Stage-2 deep gather"
                value={settings.deep_timeout_sec}
                min={1}
                max={600}
                onChange={v => setNum("deep_timeout_sec", v)}
              />
            </div>
          </section>

          {/* Pipeline Toggles */}
          <section className="bg-[#111] rounded-xl border border-[#222] p-5">
            <h2 className="text-white font-semibold mb-4">Pipeline Toggles</h2>
            <div className="space-y-3">
              {(Object.keys(PIPELINE_LABELS) as (keyof CosmosWorkflowSettings)[]).map(key => (
                <ToggleRow
                  key={key}
                  label={PIPELINE_LABELS[key]}
                  checked={settings[key] as boolean}
                  onChange={() => toggle(key)}
                />
              ))}
            </div>
          </section>

          {/* Wave 3 + 4 */}
          <section className="bg-[#111] rounded-xl border border-[#222] p-5">
            <h2 className="text-white font-semibold mb-1">Wave 3 — LangGraph Reasoning</h2>
            <p className="text-xs text-gray-500 mb-4">
              Runs after W1+W2. Stateful multi-step reasoning fills context gaps before LLM assembly.
              Requires <code className="bg-[#1a1a1a] px-1 rounded">pip install langgraph</code>.
            </p>
            <div className="space-y-4">
              <ToggleRow
                label="Enable Wave 3 (LangGraph)"
                sublabel="Stateful iterative reasoning on merged W1+W2 context"
                checked={settings.wave3_langgraph_enabled ?? false}
                onChange={() => toggle("wave3_langgraph_enabled")}
              />
              <div className="grid grid-cols-2 gap-4">
                <NumberInput
                  label="Max Iterations"
                  sublabel="Reasoning loop cap (1–5)"
                  value={settings.wave3_max_iterations ?? 3}
                  min={1}
                  max={5}
                  onChange={v => setNum("wave3_max_iterations", v)}
                />
                <NumberInput
                  label="Wave 3 Timeout (sec)"
                  sublabel="Hard timeout for LangGraph stage"
                  value={settings.wave3_timeout_sec ?? 15}
                  min={5}
                  max={60}
                  onChange={v => setNum("wave3_timeout_sec", v)}
                />
              </div>
            </div>
          </section>

          <section className="bg-[#111] rounded-xl border border-[#222] p-5">
            <h2 className="text-white font-semibold mb-1">Wave 4 — Neo4j Graph Enrichment</h2>
            <p className="text-xs text-gray-500 mb-4">
              Runs after W3. Uses W3-refined entities for targeted BFS in Neo4j — more precise than keyword graph search.
              Requires <code className="bg-[#1a1a1a] px-1 rounded">pip install neo4j</code> + Neo4j running.
            </p>
            <div className="space-y-4">
              <ToggleRow
                label="Enable Wave 4 (Neo4j)"
                sublabel="Targeted multi-hop graph traversal from resolved entities"
                checked={settings.wave4_neo4j_enabled ?? false}
                onChange={() => toggle("wave4_neo4j_enabled")}
              />
              <div className="grid grid-cols-2 gap-4">
                <NumberInput
                  label="Max Traversal Depth"
                  sublabel="Graph BFS hops from entity (1–6)"
                  value={settings.wave4_max_depth ?? 3}
                  min={1}
                  max={6}
                  onChange={v => setNum("wave4_max_depth", v)}
                />
                <NumberInput
                  label="Wave 4 Timeout (sec)"
                  sublabel="Hard timeout for Neo4j stage"
                  value={settings.wave4_timeout_sec ?? 10}
                  min={3}
                  max={30}
                  onChange={v => setNum("wave4_timeout_sec", v)}
                />
              </div>
            </div>
          </section>

          {/* Advanced */}
          <section className="bg-[#111] rounded-xl border border-[#222] p-5">
            <h2 className="text-white font-semibold mb-4">Advanced Quality Levers</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <ToggleRow
                label="Enable RALPH"
                sublabel="Post-response self-correction loop"
                checked={settings.enable_ralph}
                onChange={() => toggle("enable_ralph")}
              />
              <ToggleRow
                label="Enable RIPER"
                sublabel="Structured Research-Plan-Execute workflow"
                checked={settings.enable_riper}
                onChange={() => toggle("enable_riper")}
              />
              <ToggleRow
                label="Enable HyDE"
                sublabel="Hypothetical document expansion (higher latency)"
                checked={settings.enable_hyde}
                onChange={() => toggle("enable_hyde")}
              />
            </div>
            <NumberInput
              label="Max Context Tokens"
              sublabel="Maximum tokens injected as context per query"
              value={settings.max_context_tokens}
              min={500}
              max={200000}
              onChange={v => setNum("max_context_tokens", v)}
            />
          </section>
        </div>
      </main>
    </div>
  );
}

// --- sub-components ---

function ToggleRow({
  label,
  sublabel,
  checked,
  onChange,
}: {
  label: string;
  sublabel?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm text-white">{label}</div>
        {sublabel && <div className="text-xs text-gray-500 mt-0.5">{sublabel}</div>}
      </div>
      <button onClick={onChange} className="shrink-0 ml-4">
        {checked ? (
          <ToggleRight className="w-8 h-8 text-purple-400" />
        ) : (
          <ToggleLeft className="w-8 h-8 text-gray-500" />
        )}
      </button>
    </div>
  );
}

function SliderRow({
  label,
  sublabel,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  sublabel?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <div>
          <div className="text-sm text-white">{label}</div>
          {sublabel && <div className="text-xs text-gray-500">{sublabel}</div>}
        </div>
        <span className="text-sm text-purple-400 font-mono">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-purple-500"
      />
      <div className="flex justify-between text-xs text-gray-600 mt-0.5">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function NumberInput({
  label,
  sublabel,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  sublabel?: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      {sublabel && <div className="text-xs text-gray-500 mb-1">{sublabel}</div>}
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(parseInt(e.target.value, 10))}
        className="w-full bg-[#0a0a0a] border border-[#333] text-white rounded-lg px-3 py-2 text-sm"
      />
    </div>
  );
}
