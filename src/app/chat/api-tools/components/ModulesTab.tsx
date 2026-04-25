"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, GripVertical, Save } from "lucide-react";
import {
  AiplatformkbApiError,
  listAdminModules,
  reorderModules,
} from "@/lib/aiplatformkb-api";
import type { AdminModule } from "@/types/api-tools";
import SortableList from "@/components/primitives/SortableList";

/**
 * Modules tab — Wave 3-LIME-D.
 *
 * Drag-to-reorder modules. Save button writes through to
 * POST /admin/modules/reorder with optimistic UI: local state updates
 * on drag, only the server call commits. On error, local order is
 * rolled back to the last server-confirmed list.
 */
export default function ModulesTab() {
  const [serverOrder, setServerOrder] = useState<AdminModule[] | null>(null);
  const [localOrder, setLocalOrder] = useState<AdminModule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");

  useEffect(() => {
    let alive = true;
    listAdminModules()
      .then((rows) => {
        if (!alive) return;
        setServerOrder(rows);
        setLocalOrder(rows);
      })
      .catch((err) => alive && setError(_msg(err)));
    return () => { alive = false; };
  }, []);

  const dirty =
    serverOrder !== null &&
    localOrder !== null &&
    serverOrder.map((m) => m.module_name).join(",") !==
      localOrder.map((m) => m.module_name).join(",");

  const handleSave = async () => {
    if (!localOrder || saving) return;
    setSaving(true);
    setSaveStatus("idle");
    const snapshot = localOrder;
    try {
      await reorderModules({ ordered_modules: snapshot.map((m) => m.module_name) });
      setServerOrder(snapshot);
      setSaveStatus("saved");
    } catch (err) {
      // Rollback to last server-confirmed order.
      setLocalOrder(serverOrder);
      setError(_msg(err));
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  };

  if (error && localOrder === null) {
    return (
      <div className="flex items-center gap-2 rounded border border-red-900/50 bg-red-950/40 p-4 text-sm text-red-300">
        <AlertTriangle className="h-4 w-4" />
        <span>Failed to load modules: {error}</span>
      </div>
    );
  }

  if (localOrder === null) {
    return (
      <div className="flex items-center gap-2 text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading modules…</span>
      </div>
    );
  }

  if (localOrder.length === 0) {
    return (
      <div className="rounded border border-zinc-800 bg-zinc-900/50 p-6 text-sm text-zinc-400">
        No modules registered.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-400">
          Drag rows to reorder. Save persists the new display_order to the spec.
        </p>
        <div className="flex items-center gap-2">
          {saveStatus === "saved" && !dirty && (
            <span className="text-xs text-emerald-400">Saved.</span>
          )}
          {saveStatus === "error" && (
            <span className="text-xs text-red-400">Save failed — rolled back.</span>
          )}
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="flex items-center gap-1 rounded bg-cyan-700 px-3 py-1 text-xs text-white disabled:opacity-50 hover:bg-cyan-600"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Save order
          </button>
        </div>
      </div>

      <div className="divide-y divide-zinc-800 rounded border border-zinc-800 bg-zinc-900/30">
        <SortableList<AdminModule>
          items={localOrder}
          getId={(m) => m.module_name}
          disabled={saving}
          onReorder={setLocalOrder}
          renderItem={(m, { isDragging }) => (
            <div
              className={
                "flex items-center justify-between px-4 py-3 " +
                (isDragging ? "bg-zinc-800/40" : "")
              }
            >
              <div className="flex items-center gap-3">
                <GripVertical className="h-4 w-4 text-zinc-600" />
                <div>
                  <div className="text-sm font-medium">
                    {m.display_name ?? m.module_name}
                  </div>
                  <div className="text-xs text-zinc-500">{m.module_name}</div>
                </div>
              </div>
              <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
                order {m.display_order ?? "—"}
              </span>
            </div>
          )}
        />
      </div>
    </div>
  );
}

function _msg(err: unknown): string {
  if (err instanceof AiplatformkbApiError) return `${err.status} — ${err.message}`;
  return err instanceof Error ? err.message : "request failed";
}
