"use client";

import { Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Wrench } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import ModulesTab from "./components/ModulesTab";
import ApisTab from "./components/ApisTab";
import ToolsTab from "./components/ToolsTab";

type TabKey = "modules" | "apis" | "tools";
const TABS: { key: TabKey; label: string }[] = [
  { key: "modules", label: "Modules" },
  { key: "apis", label: "APIs" },
  { key: "tools", label: "Tools" },
];

export default function ApiToolsPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <ApiToolsPageInner />
    </Suspense>
  );
}

function PageFallback() {
  return (
    <div className="flex h-screen bg-[#0c0515]">
      <Sidebar activePage="api-tools" />
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
      </div>
    </div>
  );
}

function ApiToolsPageInner() {
  const router = useRouter();
  const sp = useSearchParams();

  const tab: TabKey = useMemo(() => {
    const t = sp.get("tab");
    return (TABS.find((x) => x.key === t)?.key ?? "modules") as TabKey;
  }, [sp]);

  const setTab = (next: TabKey) => {
    const usp = new URLSearchParams(sp.toString());
    usp.set("tab", next);
    router.replace(`/chat/api-tools?${usp.toString()}`);
  };

  return (
    <div className="flex h-screen bg-[#0c0515] text-zinc-100">
      <Sidebar activePage="api-tools" />
      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-3 border-b border-zinc-800 px-6 py-4">
          <Wrench className="h-5 w-5 text-cyan-400" />
          <div>
            <h1 className="text-lg font-semibold">API Tools</h1>
            <p className="text-xs text-zinc-400">
              Curate <code className="text-cyan-300">/docs/ai-platform</code>{" "}
              — drag-reorder modules & operations · compose M:N tools.
            </p>
          </div>
        </header>

        <nav
          role="tablist"
          aria-label="API Tools curation tabs"
          className="flex gap-1 border-b border-zinc-800 px-6"
        >
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={
                  "px-4 py-2 text-sm transition-colors " +
                  (active
                    ? "border-b-2 border-cyan-400 text-cyan-300"
                    : "text-zinc-400 hover:text-zinc-100")
                }
              >
                {t.label}
              </button>
            );
          })}
        </nav>

        <section className="flex-1 overflow-auto p-6">
          {tab === "modules" && <ModulesTab />}
          {tab === "apis" && <ApisTab />}
          {tab === "tools" && <ToolsTab />}
        </section>
      </main>
    </div>
  );
}
