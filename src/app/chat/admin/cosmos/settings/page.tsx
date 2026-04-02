"use client";

import { useState } from "react";
import { Save, Settings, Sliders, Cpu } from "lucide-react";

interface ToggleState {
  wave3LangGraph: boolean;
  wave4Neo4j: boolean;
  hydeExpansion: boolean;
  claudeQueryIntelligence: boolean;
  claudeReranking: boolean;
  mmrDiversity: boolean;
}

export default function SettingsPage() {
  const [toggles, setToggles] = useState<ToggleState>({
    wave3LangGraph: true,
    wave4Neo4j: true,
    hydeExpansion: true,
    claudeQueryIntelligence: true,
    claudeReranking: true,
    mmrDiversity: true,
  });

  const [thresholds, setThresholds] = useState({
    maxContextTokens: "8000",
    confidenceThreshold: "0.75",
    pprAlpha: "0.15",
  });

  const [models, setModels] = useState({
    queryIntelligence: "claude-haiku-4-5",
    reranking: "claude-sonnet-4",
    response: "claude-sonnet-4",
  });

  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleSwitch = (key: keyof ToggleState) => {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const waveToggles: { key: keyof ToggleState; label: string }[] = [
    { key: "wave3LangGraph", label: "Wave 3 LangGraph" },
    { key: "wave4Neo4j", label: "Wave 4 Neo4j" },
    { key: "hydeExpansion", label: "HyDE Expansion" },
    { key: "claudeQueryIntelligence", label: "Claude Query Intelligence" },
    { key: "claudeReranking", label: "Claude Reranking" },
    { key: "mmrDiversity", label: "MMR Diversity" },
  ];

  const modelOptions = [
    "claude-haiku-4-5",
    "claude-sonnet-4",
    "claude-opus-4",
    "claude-sonnet-4-5",
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Wave Configuration */}
      <div className="bg-[#111830] border border-white/[0.06] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-5">
          <Settings className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-white">Wave Configuration</h3>
        </div>
        <div className="space-y-4">
          {waveToggles.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm text-slate-300">{label}</span>
              <button
                onClick={() => toggleSwitch(key)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  toggles[key] ? "bg-purple-600" : "bg-slate-700"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    toggles[key] ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Thresholds */}
      <div className="bg-[#111830] border border-white/[0.06] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-5">
          <Sliders className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Thresholds</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Max Context Tokens</label>
            <input
              type="number"
              value={thresholds.maxContextTokens}
              onChange={(e) => setThresholds((p) => ({ ...p, maxContextTokens: e.target.value }))}
              className="w-full bg-[#0a0e1a] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/40 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Confidence Threshold</label>
            <input
              type="number"
              step="0.01"
              value={thresholds.confidenceThreshold}
              onChange={(e) => setThresholds((p) => ({ ...p, confidenceThreshold: e.target.value }))}
              className="w-full bg-[#0a0e1a] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/40 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">PPR Alpha</label>
            <input
              type="number"
              step="0.01"
              value={thresholds.pprAlpha}
              onChange={(e) => setThresholds((p) => ({ ...p, pprAlpha: e.target.value }))}
              className="w-full bg-[#0a0e1a] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/40 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Models */}
      <div className="bg-[#111830] border border-white/[0.06] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-5">
          <Cpu className="w-4 h-4 text-orange-400" />
          <h3 className="text-sm font-semibold text-white">Models</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Query Intelligence</label>
            <select
              value={models.queryIntelligence}
              onChange={(e) => setModels((p) => ({ ...p, queryIntelligence: e.target.value }))}
              className="w-full bg-[#0a0e1a] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/40 transition-colors appearance-none cursor-pointer"
            >
              {modelOptions.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Reranking</label>
            <select
              value={models.reranking}
              onChange={(e) => setModels((p) => ({ ...p, reranking: e.target.value }))}
              className="w-full bg-[#0a0e1a] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/40 transition-colors appearance-none cursor-pointer"
            >
              {modelOptions.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Response</label>
            <select
              value={models.response}
              onChange={(e) => setModels((p) => ({ ...p, response: e.target.value }))}
              className="w-full bg-[#0a0e1a] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/40 transition-colors appearance-none cursor-pointer"
            >
              {modelOptions.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className={`flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-lg transition-all ${
            saved
              ? "bg-green-600 text-white"
              : "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white"
          }`}
        >
          <Save className="w-4 h-4" />
          {saved ? "Saved!" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
