"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";

interface SuggestionChipsProps {
  repositoryId: string;
  onSendMessage: (message: string) => void;
  onDocsGenerated?: (files: string[]) => void;
}

export default function SuggestionChips({
  repositoryId,
  onSendMessage,
  onDocsGenerated,
}: SuggestionChipsProps) {
  const [generatingBlueprint, setGeneratingBlueprint] = useState(false);

  const handleGenerateBlueprint = async () => {
    setGeneratingBlueprint(true);
    try {
      const res = await api.generateWorkflowDocs({
        repository_id: repositoryId,
        reference_repo: "shiprocket-channels",
      });
      if (res.success && res.data) {
        onDocsGenerated?.(res.data.generated_files);
        onSendMessage(
          `Generated ${res.data.generated_files.length} workflow/context files using shiprocket-channels as reference blueprint (no agents/skills imported). Files: ${res.data.generated_files.join(", ")}`
        );
      }
    } catch (err) {
      onSendMessage(`Failed to generate from blueprint: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
    setGeneratingBlueprint(false);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={handleGenerateBlueprint}
        disabled={generatingBlueprint}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600/20 to-violet-600/20 border border-purple-500/30 rounded-lg text-xs text-purple-300 hover:text-purple-200 hover:border-purple-400/40 transition-all disabled:opacity-50"
      >
        {generatingBlueprint ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <span>📋</span>
        )}
        {generatingBlueprint ? "Generating..." : "Reference shiprocket-channels (9/10)"}
      </button>

      <button
        onClick={() => onSendMessage("Scan this codebase and generate comprehensive documentation covering the tech stack, architecture, key patterns, build commands, and important rules.")}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-slate-400 hover:text-white hover:border-white/[0.15] transition-all"
      >
        <span>📄</span>
        Generate Docs
      </button>

      <button
        onClick={() => onSendMessage("Scan this codebase thoroughly and tell me: What is the tech stack? What are the main modules? What patterns are used? What are the key entry points?")}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-slate-400 hover:text-white hover:border-white/[0.15] transition-all"
      >
        <span>🔍</span>
        Scan codebase
      </button>

      <button
        onClick={() => onSendMessage("Generate workflow documentation files: SAFETY_RULES.md, QUICK_START.md, CODE_PATTERNS.md, and rules files based on the patterns you find in this codebase.")}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-slate-400 hover:text-white hover:border-white/[0.15] transition-all"
      >
        <span>📂</span>
        Setup workflow files
      </button>
    </div>
  );
}
