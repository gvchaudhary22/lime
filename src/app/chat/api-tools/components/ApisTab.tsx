"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, GripVertical, Loader2, Save } from "lucide-react";
import {
  AiplatformkbApiError,
  listAdminModules,
  listAdminOperations,
  reorderOperations,
} from "@/lib/aiplatformkb-api";
import type { AdminModule, AdminOperation } from "@/types/api-tools";
import SortableList from "@/components/primitives/SortableList";

const PLATFORMS = [
  "seller_panel", "icrm_platform", "app_platform", "oneapp", "ondc",
  "zop_platform", "hyperlocal", "external_panel", "srx", "internal", "cargo",
];

/**
 * APIs tab — Wave 3-LIME-D.
 *
 * Drag-to-reorder operations within (platform, module). Optimistic UI
 * with rollback on error; "Save order" persists the curated stripe.
 */
export default function ApisTab() {
  const [modules, setModules] = useState<AdminModule[] | null>(null);
  const [platform, setPlatform] = useState("seller_panel");
  const [moduleName, setModuleName] = useState("");
  const [serverOps, setServerOps] = useState<AdminOperation[] | null>(null);
  const [localOps, setLocalOps] = useState<AdminOperation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");

  useEffect(() => {
    listAdminModules()
      .then((rows) => {
        setModules(rows);
        if (rows.length > 0 && !moduleName) setModuleName(rows[0].module_name);
      })
      .catch((err) => setError(_msg(err)));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!moduleName) return;
    setServerOps(null);
    setLocalOps(null);
    setError(null);
    setSaveStatus("idle");
    listAdminOperations({ platform, module: moduleName })
      .then((ops) => {
        setServerOps(ops);
        setLocalOps(ops);
      })
      .catch((err) => setError(_msg(err)));
  }, [platform, moduleName]);

  const dirty =
    serverOps !== null &&
    localOps !== null &&
    serverOps.map((o) => o.id).join(",") !== localOps.map((o) => o.id).join(",");

  const handleSave = async () => {
    if (!localOps || saving) return;
    setSaving(true);
    setSaveStatus("idle");
    const snapshot = localOps;
    try {
      await reorderOperations({
        platform,
        module: moduleName,
        ordered_ids: snapshot.map((o) => o.id),
      });
      setServerOps(snapshot);
      setSaveStatus("saved");
    } catch (err) {
      setLocalOps(serverOps);
      setError(_msg(err));
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-zinc-400">
          Platform&nbsp;
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
          >
            {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="text-xs text-zinc-400">
          Module&nbsp;
          <select
            value={moduleName}
            onChange={(e) => setModuleName(e.target.value)}
            disabled={modules === null}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 disabled:opacity-50"
          >
            {(modules ?? []).map((m) => (
              <option key={m.module_name} value={m.module_name}>{m.module_name}</option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex items-center gap-2">
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

      {error && (
        <div className="flex items-center gap-2 rounded border border-red-900/50 bg-red-950/40 p-3 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {localOps === null && !error && (
        <div className="flex items-center gap-2 text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading operations…</span>
        </div>
      )}

      {localOps !== null && localOps.length === 0 && !error && (
        <div className="rounded border border-zinc-800 bg-zinc-900/50 p-6 text-sm text-zinc-400">
          No operations in {platform} / {moduleName}.
        </div>
      )}

      {localOps !== null && localOps.length > 0 && (
        <div className="divide-y divide-zinc-800 rounded border border-zinc-800 bg-zinc-900/30">
          <SortableList<AdminOperation>
            items={localOps}
            getId={(o) => o.id}
            disabled={saving}
            onReorder={setLocalOps}
            renderItem={(op, { isDragging }) => (
              <div
                className={
                  "flex items-center justify-between px-4 py-3 " +
                  (isDragging ? "bg-zinc-800/40" : "")
                }
              >
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-zinc-600" />
                  <span className={_methodBadge(op.http_method)}>{op.http_method}</span>
                  <code className="text-xs text-zinc-300">{op.path}</code>
                </div>
                <span className="text-xs text-zinc-500">
                  order {op.display_order ?? "—"} · hits {op.hit_count_7d ?? 0}
                </span>
              </div>
            )}
          />
        </div>
      )}
    </div>
  );
}

function _msg(err: unknown): string {
  if (err instanceof AiplatformkbApiError) return `${err.status} — ${err.message}`;
  return err instanceof Error ? err.message : "request failed";
}

function _methodBadge(m: string): string {
  const base = "rounded px-2 py-0.5 text-xs font-mono ";
  switch (m.toUpperCase()) {
    case "GET":    return base + "bg-blue-900/40 text-blue-300";
    case "POST":   return base + "bg-emerald-900/40 text-emerald-300";
    case "PATCH":  return base + "bg-amber-900/40 text-amber-300";
    case "DELETE": return base + "bg-red-900/40 text-red-300";
    default:       return base + "bg-zinc-800 text-zinc-300";
  }
}
