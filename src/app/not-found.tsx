"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#060b18] flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-white mb-4">404</h1>
        <p className="text-slate-400 text-lg mb-8">Page not found</p>
        <button
          onClick={() => router.push("/chat")}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-semibold text-sm transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to MARS
        </button>
      </div>
    </div>
  );
}
