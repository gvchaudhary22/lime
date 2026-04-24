"use client";

import { AlertTriangle, ArrowLeft, RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function PrFeedDetailError({ error, reset }: Props) {
  const router = useRouter();

  return (
    <div className="flex h-screen bg-[#0c0515]">
      <Sidebar activePage="pr-feed" />
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-md rounded-xl border border-rose-500/20 bg-rose-500/5 p-6 text-sm">
          <div className="mb-3 flex items-center gap-2 text-rose-300">
            <AlertTriangle className="h-5 w-5" />
            <h2 className="text-base font-semibold">
              PR detail failed to render
            </h2>
          </div>
          <p className="mb-4 text-slate-300">{error.message}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1 rounded border border-white/[0.06] px-3 py-1.5 text-xs text-slate-200 transition hover:border-white/20"
            >
              <RotateCw className="h-3 w-3" />
              Try again
            </button>
            <button
              type="button"
              onClick={() => router.push("/chat/pr-feed")}
              className="inline-flex items-center gap-1 rounded border border-white/[0.06] px-3 py-1.5 text-xs text-slate-300 transition hover:border-white/20"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to PR Feed
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
