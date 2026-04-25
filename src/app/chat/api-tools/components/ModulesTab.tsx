"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { listAdminModules, AiplatformkbApiError } from "@/lib/aiplatformkb-api";
import type { AdminModule } from "@/types/api-tools";

/**
 * Modules tab — Wave 3-LIME-B scaffold.
 *
 * Shows the current ordered list of modules with their display_order.
 * Drag-to-reorder + Save button arrive in Wave 3-LIME-D once the
 * SortableList primitive exists (3-LIME-C).
 */
export default function ModulesTab() {
  const [modules, setModules] = useState<AdminModule[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listAdminModules()
      .then((rows) => {
        if (alive) setModules(rows);
      })
      .catch((err) => {
        if (!alive) return;
        if (err instanceof AiplatformkbApiError) {
          setError(`${err.status} — ${err.message}`);
        } else {
          setError(err instanceof Error ? err.message : "fetch failed");
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded border border-red-900/50 bg-red-950/40 p-4 text-sm text-red-300">
        <AlertTriangle className="h-4 w-4" />
        <span>Failed to load modules: {error}</span>
      </div>
    );
  }

  if (modules === null) {
    return (
      <div className="flex items-center gap-2 text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading modules…</span>
      </div>
    );
  }

  if (modules.length === 0) {
    return (
      <div className="rounded border border-zinc-800 bg-zinc-900/50 p-6 text-sm text-zinc-400">
        No modules registered. Phase-12 module_descriptions table appears empty.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-400">
        Drag-to-reorder lands in a follow-up wave. For now, this lists modules
        in their current display order (NULL display_order sorts last).
      </p>
      <ul className="divide-y divide-zinc-800 rounded border border-zinc-800 bg-zinc-900/30">
        {modules.map((m) => (
          <li
            key={m.module_name}
            className="flex items-center justify-between px-4 py-3"
          >
            <div>
              <div className="text-sm font-medium">{m.display_name ?? m.module_name}</div>
              <div className="text-xs text-zinc-500">{m.module_name}</div>
            </div>
            <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
              order {m.display_order ?? "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
