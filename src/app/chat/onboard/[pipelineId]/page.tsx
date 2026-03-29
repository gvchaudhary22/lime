"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle, XCircle, Loader2, ArrowRight, RotateCw, FileText, Shield, Code, Bug, Zap, BookOpen, Settings, AlertTriangle, Users, Database, Globe2 } from "lucide-react";
import { api } from "@/lib/api";

interface PassInfo {
  pass_type: string;
  pass_order: number;
  status: string;
  generated_file?: string;
  cost_usd: number;
  duration_seconds: number;
}

interface PipelineData {
  id: string;
  repository_id: string;
  status: string;
  current_step: string;
  total_steps: number;
  completed_steps: number;
  context_score: number;
  cost_usd: number;
  error_message?: string;
  passes?: PassInfo[];
}

const passLabels: Record<string, { label: string; icon: typeof FileText }> = {
  architecture: { label: "Architecture & Overview", icon: FileText },
  code_patterns: { label: "Code Patterns", icon: Code },
  domain_glossary: { label: "Domain Glossary", icon: BookOpen },
  api_contracts: { label: "API Contracts", icon: Globe2 },
  test_strategy: { label: "Test Strategy", icon: CheckCircle },
  security: { label: "Security Context", icon: Shield },
  dependencies: { label: "Service Dependencies", icon: Database },
  environment: { label: "Environment Config", icon: Settings },
  error_codes: { label: "Error Codes", icon: AlertTriangle },
  debugging: { label: "Debugging Playbooks", icon: Bug },
  roles_safety: { label: "Roles & Safety Rules", icon: Users },
  finalization: { label: "Quick Start Guide", icon: Zap },
};

export default function PipelineProgressPage() {
  const { pipelineId } = useParams<{ pipelineId: string }>();
  const router = useRouter();

  const [pipeline, setPipeline] = useState<PipelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadPipeline();
    // Poll every 3 seconds
    pollRef.current = setInterval(loadPipeline, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [pipelineId]);

  useEffect(() => {
    if (pipeline && (pipeline.status === "completed" || pipeline.status === "failed")) {
      if (pollRef.current) clearInterval(pollRef.current);
    }
  }, [pipeline?.status]);

  const loadPipeline = async () => {
    try {
      const res = await api.getPipelineStatus(pipelineId);
      if (res.success && res.data) {
        setPipeline(res.data);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  };

  if (loading || !pipeline) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
      </div>
    );
  }

  const isComplete = pipeline.status === "completed";
  const isFailed = pipeline.status === "failed";
  const isRunning = !isComplete && !isFailed;

  return (
    <div className="flex flex-col h-full bg-[#060b18]">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">
              {isComplete ? "Analysis Complete" : isFailed ? "Analysis Failed" : "Analyzing Repository..."}
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              {isRunning && `Step ${pipeline.completed_steps} of ${pipeline.total_steps} — ${pipeline.current_step || "Starting..."}`}
              {isComplete && `Generated ${pipeline.passes?.filter(p => p.status === "completed").length || 0} context files`}
              {isFailed && (pipeline.error_message || "An error occurred")}
            </p>
          </div>
          {isComplete && (
            <button
              onClick={() => router.push("/chat/projects")}
              className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors"
            >
              Start Chatting <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">
          {/* Score card */}
          {isComplete && (
            <div className="mb-8 p-6 rounded-2xl bg-gradient-to-br from-sky-500/10 to-violet-500/10 border border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Context Strength Score</p>
                  <p className="text-4xl font-bold text-white mt-1">
                    {pipeline.context_score.toFixed(1)}
                    <span className="text-lg text-gray-400">/100</span>
                  </p>
                  <p className="text-sm text-sky-400 mt-1">
                    {pipeline.context_score >= 76
                      ? "Strong — AI has deep understanding"
                      : pipeline.context_score >= 51
                      ? "Good — AI can handle most tasks"
                      : pipeline.context_score >= 26
                      ? "Basic — AI can handle simple tasks"
                      : "Weak — Consider adding more context"}
                  </p>
                </div>
                <div className="text-right text-sm text-gray-400">
                  <p>Cost: ${pipeline.cost_usd.toFixed(4)}</p>
                  <p>{pipeline.passes?.filter(p => p.status === "completed").length || 0} files generated</p>
                </div>
              </div>
            </div>
          )}

          {/* Progress bar */}
          {isRunning && (
            <div className="mb-6">
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-500 rounded-full transition-all duration-500"
                  style={{ width: `${(pipeline.completed_steps / pipeline.total_steps) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Pass timeline */}
          <div className="space-y-2">
            {(pipeline.passes || []).map((pass) => {
              const info = passLabels[pass.pass_type] || { label: pass.pass_type, icon: FileText };
              const Icon = info.icon;
              const isActive = pass.status === "running";
              const isDone = pass.status === "completed";
              const isFail = pass.status === "failed";

              return (
                <div
                  key={pass.pass_order}
                  className={`flex items-center gap-4 p-3 rounded-xl transition-colors ${
                    isActive ? "bg-sky-500/10 border border-sky-500/30" :
                    isDone ? "bg-white/[0.03] border border-white/10" :
                    isFail ? "bg-red-500/5 border border-red-500/20" :
                    "bg-white/[0.02] border border-white/5"
                  }`}
                >
                  <div className="flex-shrink-0">
                    {isDone ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : isActive ? (
                      <Loader2 className="w-5 h-5 text-sky-400 animate-spin" />
                    ) : isFail ? (
                      <XCircle className="w-5 h-5 text-red-400" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-white/20" />
                    )}
                  </div>
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isDone ? "text-gray-400" : isActive ? "text-sky-400" : "text-gray-600"}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${isDone || isActive ? "text-white" : "text-gray-500"}`}>
                      {info.label}
                    </p>
                    {pass.generated_file && isDone && (
                      <p className="text-xs text-gray-500">{pass.generated_file}</p>
                    )}
                  </div>
                  {isDone && pass.duration_seconds > 0 && (
                    <span className="text-xs text-gray-500">{pass.duration_seconds}s</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Error state */}
          {isFailed && (
            <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-red-400 text-sm">{pipeline.error_message || "Analysis failed"}</p>
              <button
                onClick={() => router.push("/chat/onboard")}
                className="mt-3 flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                <RotateCw className="w-4 h-4" /> Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
