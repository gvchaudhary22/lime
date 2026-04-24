"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function PrFeedListError({ error, reset }: Props) {
  return (
    <div className="flex h-screen bg-[#0c0515]">
      <Sidebar activePage="pr-feed" />
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-md rounded-xl border border-rose-500/20 bg-rose-500/5 p-6 text-sm">
          <div className="mb-3 flex items-center gap-2 text-rose-300">
            <AlertTriangle className="h-5 w-5" />
            <h2 className="text-base font-semibold">
              PR Feed failed to render
            </h2>
          </div>
          <p className="mb-4 text-slate-300">{error.message}</p>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 rounded border border-white/[0.06] px-3 py-1.5 text-xs text-slate-200 transition hover:border-white/20"
          >
            <RotateCw className="h-3 w-3" />
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
