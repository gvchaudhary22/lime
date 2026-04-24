import type { ReactNode } from "react";

export default function PrFeedLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#060b18] text-slate-100">
      <header className="border-b border-white/[0.05] bg-[#0a0f1e]/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <nav className="text-sm text-slate-400">
            <span>Chat</span>
            <span className="mx-2 text-slate-600">›</span>
            <span className="text-slate-100">PR Feed</span>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </div>
  );
}
