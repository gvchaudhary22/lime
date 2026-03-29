"use client";

import { useState } from "react";
import { Check, RefreshCw, X } from "lucide-react";
import { api } from "@/lib/api";

interface ActionButtonsProps {
  conversationId: string;
  onRephrase: () => void;
  onActionComplete: (action: string) => void;
}

export default function ActionButtons({
  conversationId,
  onRephrase,
  onActionComplete,
}: ActionButtonsProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleApprove = async () => {
    setLoading("approve");
    const res = await api.approveAction(conversationId);
    setLoading(null);
    if (res.success) {
      onActionComplete("approved");
    }
  };

  const handleReject = async () => {
    setLoading("reject");
    const res = await api.rejectAction(conversationId);
    setLoading(null);
    if (res.success) {
      onActionComplete("rejected");
    }
  };

  return (
    <div className="flex items-center gap-2 mt-3">
      <button
        onClick={handleApprove}
        disabled={loading !== null}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 transition-colors text-xs font-medium disabled:opacity-50"
      >
        <Check className="w-3.5 h-3.5" />
        {loading === "approve" ? "Approving..." : "Approve"}
      </button>

      <button
        onClick={onRephrase}
        disabled={loading !== null}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 transition-colors text-xs font-medium disabled:opacity-50"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Rephrase
      </button>

      <button
        onClick={handleReject}
        disabled={loading !== null}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30 transition-colors text-xs font-medium disabled:opacity-50"
      >
        <X className="w-3.5 h-3.5" />
        {loading === "reject" ? "Rejecting..." : "Reject"}
      </button>
    </div>
  );
}
