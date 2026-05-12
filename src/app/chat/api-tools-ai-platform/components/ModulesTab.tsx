"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, GripVertical, Save } from "lucide-react";
import {
  AiPlatformApiError,
  listModules,
  listPlatforms,
  reorderModules,
  setModuleOwner,
  type AiPlatformModule,
} from "@/lib/ai-platform-api";
import { MODULE_OWNERS, type ModuleOwner } from "@/types/api-tools";
import SortableList from "@/components/primitives/SortableList";

export default function ModulesTab() {
  const [serverOrder, setServerOrder] = useState<AiPlatformModule[] | null>(null);
  const [localOrder, setLocalOrder] = useState<AiPlatformModule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [ownerStatus, setOwnerStatus] = useState<
    Record<string, "saving" | "saved" | "error">
  >({});
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [activePlatform, setActivePlatform] = useState<string>("");

  useEffect(() => {
    let alive = true;
    listPlatforms()
      .then((rows) => alive && setPlatforms(rows))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setLocalOrder(null);
    setServerOrder(null);
    setSaveStatus("idle");
    setOwnerStatus({});
    listModules(activePlatform || undefined)
      .then((rows) => {
        if (!alive) return;
        setServerOrder(rows);
        setLocalOrder(rows);
      })
      .catch((err) => alive && setError(_msg(err)));
    return () => {
      alive = false;
    };
  }, [activePlatform]);

  const dirty =
    serverOrder !== null &&
    localOrder !== null &&
    serverOrder.map((m) => m.module_name).join(",") !==
      localOrder.map((m) => m.module_name).join(",");

  const handleOwnerChange = async (moduleName: string, raw: string) => {
    const next: ModuleOwner | null = raw === "" ? null : (raw as ModuleOwner);
    const prev =
      (localOrder ?? []).find((m) => m.module_name === moduleName)?.owner ?? null;
    if (next === prev) return;

    const applyOwner = (rows: AiPlatformModule[] | null) =>
      rows?.map((m) =>
        m.module_name === moduleName ? { ...m, owner: next } : m,
      ) ?? null;
    setLocalOrder((rows) => applyOwner(rows));
    setServerOrder((rows) => applyOwner(rows));
    setOwnerStatus((s) => ({ ...s, [moduleName]: "saving" }));

    try {
      await setModuleOwner(moduleName, { owner: next });
      setOwnerStatus((s) => ({ ...s, [moduleName]: "saved" }));
    } catch (err) {
      const rollback = (rows: AiPlatformModule[] | null) =>
        rows?.map((m) =>
          m.module_name === moduleName ? { ...m, owner: prev } : m,
        ) ?? null;
      setLocalOrder((rows) => rollback(rows));
      setServerOrder((rows) => rollback(rows));
      setOwnerStatus((s) => ({ ...s, [moduleName]: "error" }));
      setError(_msg(err));
    }
  };

  const handleSave = async () => {
    if (!localOrder || saving) return;
    setSaving(true);
    setSaveStatus("idle");
    const snapshot = localOrder;
    try {
      await reorderModules({
        ordered_module_names: snapshot.map((m) => m.module_name),
      });
      setServerOrder(snapshot);
      setSaveStatus("saved");
    } catch (err) {
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
        <div className="flex items-center gap-3">
          <label className="text-xs text-zinc-400">Platform</label>
          <select
            value={activePlatform}
            onChange={(e) => setActivePlatform(e.target.value)}
            disabled={saving}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
          >
            <option value="">All modules</option>
            {platforms.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <p className="text-xs text-zinc-500">
            Drag to reorder. Save persists the new display_order.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saveStatus === "saved" && !dirty && (
            <span className="text-xs text-emerald-400">Saved.</span>
          )}
          {saveStatus === "error" && (
            <span className="text-xs text-red-400">
              Save failed — rolled back.
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="flex items-center gap-1 rounded bg-cyan-700 px-3 py-1 text-xs text-white disabled:opacity-50 hover:bg-cyan-600"
          >
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Save className="h-3 w-3" />
            )}
            Save order
          </button>
        </div>
      </div>

      <div className="divide-y divide-zinc-800 rounded border border-zinc-800 bg-zinc-900/30">
        <SortableList<AiPlatformModule>
          items={localOrder}
          getId={(m) => m.module_name}
          disabled={saving}
          onReorder={setLocalOrder}
          renderItem={(m, { isDragging }) => {
            const status = ownerStatus[m.module_name];
            return (
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
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-zinc-400">Owner</label>
                    <select
                      value={m.owner ?? ""}
                      disabled={status === "saving" || saving}
                      onChange={(e) =>
                        handleOwnerChange(m.module_name, e.target.value)
                      }
                      className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
                    >
                      <option value="">—</option>
                      {MODULE_OWNERS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                    {status === "saving" && (
                      <Loader2 className="h-3 w-3 animate-spin text-zinc-500" />
                    )}
                    {status === "saved" && (
                      <span className="text-xs text-emerald-400">✓</span>
                    )}
                    {status === "error" && (
                      <span className="text-xs text-red-400">!</span>
                    )}
                  </div>
                  <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
                    order {m.display_order ?? "—"}
                  </span>
                </div>
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}

function _msg(err: unknown): string {
  if (err instanceof AiPlatformApiError) return `${err.status} — ${err.message}`;
  return err instanceof Error ? err.message : "request failed";
}
