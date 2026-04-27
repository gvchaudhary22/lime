"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Eye, EyeOff, GripVertical, Info, Loader2, Save } from "lucide-react";
import {
  AiplatformkbApiError,
  getOperationCounts,
  listAdminModules,
  listAdminOperations,
  reorderOperations,
  setOperationEligibility,
} from "@/lib/aiplatformkb-api";
import { visibilityTooltip } from "@/lib/api-tools-copy";
import type { AdminModule, AdminOperation, OperationCountsResponse } from "@/types/api-tools";
import SortableList from "@/components/primitives/SortableList";
import OperationDetailsDrawer from "@/components/api-tools/OperationDetailsDrawer";

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
function _isDeprecated(op: AdminOperation): boolean {
  return op.deprecated || op.elk_deprecated_api;
}

export default function ApisTab() {
  const [modules, setModules] = useState<AdminModule[] | null>(null);
  const [platform, setPlatform] = useState("seller_panel");
  const [moduleName, setModuleName] = useState("");
  const [serverOps, setServerOps] = useState<AdminOperation[] | null>(null);
  const [localOps, setLocalOps] = useState<AdminOperation[] | null>(null);
  const [counts, setCounts] = useState<OperationCountsResponse | null>(null);
  const [showDeprecated, setShowDeprecated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  // Phase 16 — id of the operation currently shown in the side drawer.
  // null = drawer closed. Set via the per-row "Details" button.
  const [detailsOpId, setDetailsOpId] = useState<number | null>(null);

  // TS-H2 — alive-guard prevents setState on unmounted component if
  // user clicks away before the fetch resolves. Functional-updater on
  // setModuleName (TS-H1) avoids capturing the initial empty closure.
  useEffect(() => {
    let alive = true;
    listAdminModules()
      .then((rows) => {
        if (!alive) return;
        setModules(rows);
        setModuleName((cur) => cur || rows[0]?.module_name || "");
      })
      .catch((err) => { if (alive) setError(_msg(err)); });
    return () => { alive = false; };
  }, []);

  // TS-H2 / TS-M1 — alive-guard prevents a stale promise (e.g. user
  // switched module mid-fetch) from overwriting the currently-displayed
  // ops with a different scope's data.
  useEffect(() => {
    if (!moduleName) return;
    let alive = true;
    setServerOps(null);
    setLocalOps(null);
    setError(null);
    setSaveStatus("idle");
    listAdminOperations({ platform, module: moduleName })
      .then((ops) => {
        if (!alive) return;
        setServerOps(ops);
        setLocalOps(ops);
      })
      .catch((err) => { if (alive) setError(_msg(err)); });
    return () => { alive = false; };
  }, [platform, moduleName]);

  // Fetch platform-level + per-module counts whenever platform changes.
  // Drives the left-aligned counts panel in the toolbar.
  useEffect(() => {
    let alive = true;
    setCounts(null);
    getOperationCounts(platform)
      .then((c) => { if (alive) setCounts(c); })
      .catch((err) => { if (alive) setError(_msg(err)); });
    return () => { alive = false; };
  }, [platform]);

  // Display-time filter — keeps localOps unchanged (Save semantics
  // unaffected) but the SortableList only renders the visible subset.
  const visibleOps = useMemo(() => {
    if (!localOps) return null;
    return showDeprecated ? localOps : localOps.filter((o) => !_isDeprecated(o));
  }, [localOps, showDeprecated]);

  const moduleCounts = counts?.by_module[moduleName];

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

  // Per-row eligibility toggle. Optimistic update with rollback on error.
  // Flipping eligibility is independent of the reorder save flow — it
  // commits per-click, no global Save button.
  const handleToggleEligibility = async (op: AdminOperation) => {
    if (!localOps) return;
    const newFlag = !op.ai_platform_eligible_api;
    // Optimistic flip in BOTH local + server snapshots so the row
    // immediately reflects the new state and Save isn't accidentally
    // dirty-marked by the change.
    const flip = (list: AdminOperation[]) =>
      list.map((o) => (o.id === op.id ? { ...o, ai_platform_eligible_api: newFlag } : o));
    setLocalOps(flip);
    setServerOps((prev) => (prev ? flip(prev) : prev));

    try {
      await setOperationEligibility(op.id, { eligible: newFlag });
    } catch (err) {
      // Rollback both copies.
      const revert = (list: AdminOperation[]) =>
        list.map((o) => (o.id === op.id ? { ...o, ai_platform_eligible_api: !newFlag } : o));
      setLocalOps(revert);
      setServerOps((prev) => (prev ? revert(prev) : prev));
      setError(_msg(err));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        {/* LEFT — counts panel (platform total → module total) */}
        <div className="flex items-center gap-3 rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-zinc-500">Platform</div>
            <div className="font-mono text-cyan-300">
              {counts ? (
                <>
                  <span>{counts.total}</span>{" "}
                  <span className="text-zinc-500">total</span>
                  {" · "}
                  <span className="text-emerald-400">{counts.active}</span>
                  {" / "}
                  <span className="text-zinc-500">{counts.deprecated} dep</span>
                </>
              ) : "—"}
            </div>
          </div>
          <div className="h-8 w-px bg-zinc-800" />
          <div>
            <div className="text-[10px] uppercase tracking-wide text-zinc-500">Module</div>
            <div className="font-mono text-cyan-300">
              {moduleCounts ? (
                <>
                  <span>{moduleCounts.total}</span>{" "}
                  <span className="text-zinc-500">total</span>
                  {" · "}
                  <span className="text-emerald-400">{moduleCounts.active}</span>
                  {" / "}
                  <span className="text-zinc-500">{moduleCounts.deprecated} dep</span>
                </>
              ) : "—"}
            </div>
          </div>
        </div>

        {/* MIDDLE — selectors */}
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
        <label className="flex items-center gap-1 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={showDeprecated}
            onChange={(e) => setShowDeprecated(e.target.checked)}
            className="h-3 w-3 accent-cyan-500"
          />
          Show deprecated
        </label>

        {/* RIGHT — save controls */}
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

      {visibleOps === null && !error && (
        <div className="flex items-center gap-2 text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading operations…</span>
        </div>
      )}

      {visibleOps !== null && visibleOps.length === 0 && !error && (
        <div className="rounded border border-zinc-800 bg-zinc-900/50 p-6 text-sm text-zinc-400">
          {localOps && localOps.length > 0
            ? `No active operations in ${platform} / ${moduleName} (all ${localOps.length} are deprecated — toggle "Show deprecated" to see them).`
            : `No operations in ${platform} / ${moduleName}.`}
        </div>
      )}

      {visibleOps !== null && visibleOps.length > 0 && (
        <div className="divide-y divide-zinc-800 rounded border border-zinc-800 bg-zinc-900/30">
          <SortableList<AdminOperation>
            items={visibleOps}
            getId={(o) => o.id}
            disabled={saving}
            onReorder={(newVisible) => {
              // Display filter is on → reconcile drag against the full
              // localOps so non-displayed (deprecated) rows keep their
              // relative positions. When showDeprecated, visibleOps ===
              // localOps so this is a passthrough.
              if (showDeprecated || !localOps) {
                setLocalOps(newVisible);
                return;
              }
              const visIds = new Set(newVisible.map((o) => o.id));
              let visIdx = 0;
              const merged = localOps.map((o) =>
                visIds.has(o.id) ? newVisible[visIdx++] : o,
              );
              setLocalOps(merged);
            }}
            renderItem={(op, { isDragging }) => {
              const isDep = _isDeprecated(op);
              return (
                <div
                  className={
                    "flex items-center justify-between px-4 py-3 " +
                    (isDragging ? "bg-zinc-800/40" : "") +
                    (isDep ? " opacity-60" : "")
                  }
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <GripVertical className="h-4 w-4 text-zinc-600 shrink-0" />
                    <span className={_methodBadge(op.http_method)}>{op.http_method}</span>
                    <code className="text-xs text-zinc-300 truncate">{op.path}</code>
                    {isDep && (
                      <span
                        title={
                          op.deprecated
                            ? "Curator-marked deprecated"
                            : "ELK-derived: 0 hits in last 7 days"
                        }
                        className="rounded bg-red-900/30 px-1.5 py-0.5 text-[10px] uppercase text-red-300"
                      >
                        deprecated
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-zinc-500">
                      order {op.display_order ?? "—"} · hits {op.hit_count_7d ?? 0}
                    </span>
                    {/* Phase 16 — Details button. stopPropagation defends the
                        SortableList drag pointer-handler underneath (same
                        defense as the eligibility toggle below). */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailsOpId(op.id);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      title={`See full details for #${op.id}`}
                      data-testid={`details-btn-${op.id}`}
                      className="flex items-center gap-1 rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-700"
                    >
                      <Info className="h-3 w-3" />
                      Details
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleEligibility(op);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      title={visibilityTooltip(op.ai_platform_eligible_api)}
                      className={
                        "flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors " +
                        (op.ai_platform_eligible_api
                          ? "bg-emerald-900/30 text-emerald-300 hover:bg-emerald-900/50"
                          : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700")
                      }
                    >
                      {op.ai_platform_eligible_api ? (
                        <Eye className="h-3 w-3" />
                      ) : (
                        <EyeOff className="h-3 w-3" />
                      )}
                      {op.ai_platform_eligible_api ? "visible" : "hidden"}
                    </button>
                  </div>
                </div>
              );
            }}
          />
        </div>
      )}

      {/* Phase 16 — Details drawer. Conditionally rendered so the fetch
          effect inside is bound to the operation id and tears down on
          close. Mounting at sibling level (not inside SortableList) means
          the drawer's overlay/content cannot accidentally inherit drag
          state from a row underneath. */}
      <OperationDetailsDrawer
        operationId={detailsOpId}
        onClose={() => setDetailsOpId(null)}
      />
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
