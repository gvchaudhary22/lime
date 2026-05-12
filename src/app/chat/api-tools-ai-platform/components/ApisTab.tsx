"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Eye,
  EyeOff,
  GripVertical,
  Info,
  Loader2,
  Save,
} from "lucide-react";
import {
  AiPlatformApiError,
  getOperationCounts,
  listModules,
  listOperations,
  listPlatforms,
  reorderOperations,
  setOperationEligibility,
  type AiPlatformModule,
  type AiPlatformOperation,
  type AiPlatformOperationCounts,
} from "@/lib/ai-platform-api";
import { visibilityTooltip } from "@/lib/api-tools-copy";
import SortableList from "@/components/primitives/SortableList";
import OperationDetailsDrawer from "./OperationDetailsDrawer";

/**
 * APIs tab — ai-platform replica.
 *
 * Same UX as `/chat/api-tools` ApisTab but every fetch goes through
 * src/lib/ai-platform-api.ts (POST /kb/* surface). Reclassify and the
 * deprecated filter are omitted — ai-platform's `_operation_payload`
 * does not include a deprecated flag, and the replica scope is the
 * knowledgebase admin surface only.
 */
export default function ApisTab() {
  const [modules, setModules] = useState<AiPlatformModule[] | null>(null);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [platform, setPlatform] = useState("seller_panel");
  const [moduleName, setModuleName] = useState("");
  const [serverOps, setServerOps] = useState<AiPlatformOperation[] | null>(null);
  const [localOps, setLocalOps] = useState<AiPlatformOperation[] | null>(null);
  const [counts, setCounts] = useState<AiPlatformOperationCounts | null>(null);
  const [apiUsableFilter, setApiUsableFilter] = useState<"all" | "visible" | "hidden">("all");
  // ai-platform's _operation_payload doesn't carry an explicit deprecated
  // flag; hit_count_7d <= 0 mirrors elk_deprecated_api ("0 hits in 7d").
  const [showDeprecated, setShowDeprecated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [detailsApiId, setDetailsApiId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listModules(platform || undefined)
      .then((rows) => {
        if (!alive) return;
        setModules(rows);
        setModuleName((cur) =>
          rows.some((r) => r.module_name === cur) ? cur : (rows[0]?.module_name ?? "")
        );
      })
      .catch((err) => { if (alive) setError(_msg(err)); });
    return () => { alive = false; };
  }, [platform]);

  useEffect(() => {
    let alive = true;
    listPlatforms()
      .then((rows) => { if (alive) setPlatforms(rows); })
      .catch(() => { /* graceful degradation — empty dropdown is fine */ });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!moduleName) return;
    let alive = true;
    setServerOps(null);
    setLocalOps(null);
    setError(null);
    setSaveStatus("idle");
    listOperations({ platform, module: moduleName })
      .then((ops) => {
        if (!alive) return;
        setServerOps(ops);
        setLocalOps(ops);
      })
      .catch((err) => { if (alive) setError(_msg(err)); });
    return () => { alive = false; };
  }, [platform, moduleName]);

  useEffect(() => {
    if (!platform) return;
    let alive = true;
    setCounts(null);
    getOperationCounts(platform)
      .then((c) => { if (alive) setCounts(c); })
      .catch((err) => { if (alive) setError(_msg(err)); });
    return () => { alive = false; };
  }, [platform]);

  const visibleOps = useMemo(() => {
    if (!localOps) return null;
    let out = showDeprecated ? localOps : localOps.filter((o) => !_isDeprecated(o));
    if (apiUsableFilter === "visible") {
      out = out.filter((o) => o.ai_platform_eligible_api);
    } else if (apiUsableFilter === "hidden") {
      out = out.filter((o) => !o.ai_platform_eligible_api);
    }
    return out;
  }, [localOps, apiUsableFilter, showDeprecated]);

  const dirty =
    serverOps !== null &&
    localOps !== null &&
    serverOps.map((o) => o.api_id).join(",") !== localOps.map((o) => o.api_id).join(",");

  const handleSave = async () => {
    if (!localOps || saving) return;
    setSaving(true);
    setSaveStatus("idle");
    const snapshot = localOps;
    try {
      await reorderOperations({
        ordered_api_ids: snapshot.map((o) => o.api_id),
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

  const handleToggleEligibility = async (op: AiPlatformOperation) => {
    if (!localOps) return;
    const newFlag = !op.ai_platform_eligible_api;
    const flip = (list: AiPlatformOperation[]) =>
      list.map((o) => (o.api_id === op.api_id ? { ...o, ai_platform_eligible_api: newFlag } : o));
    setLocalOps((prev) => (prev ? flip(prev) : prev));
    setServerOps((prev) => (prev ? flip(prev) : prev));

    try {
      await setOperationEligibility({ api_id: op.api_id, eligible: newFlag });
    } catch (err) {
      const revert = (list: AiPlatformOperation[]) =>
        list.map((o) => (o.api_id === op.api_id ? { ...o, ai_platform_eligible_api: !newFlag } : o));
      setLocalOps((prev) => (prev ? revert(prev) : prev));
      setServerOps((prev) => (prev ? revert(prev) : prev));
      setError(_msg(err));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        {/* LEFT — platform-wide counts panel */}
        <div className="flex items-center gap-3 rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-zinc-500">Platform</div>
            <div className="font-mono text-cyan-300">
              {counts ? (
                <>
                  <span>{counts.total}</span>{" "}
                  <span className="text-zinc-500">total</span>
                  {" · "}
                  <span className="text-emerald-400">{counts.eligible}</span>
                  {" / "}
                  <span className="text-zinc-500">{counts.module_curated} curated</span>
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
            data-testid="apis-tab-platform-select"
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
          >
            {!platforms.includes(platform) && (
              <option value={platform}>{platform}</option>
            )}
            {platforms.map((p) => <option key={p} value={p}>{p}</option>)}
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
        <label className="flex items-center gap-1 text-xs text-zinc-400" title="Treats hit_count_7d == 0 as deprecated (mirrors elk_deprecated_api).">
          <input
            type="checkbox"
            checked={showDeprecated}
            onChange={(e) => setShowDeprecated(e.target.checked)}
            data-testid="show-deprecated"
            className="h-3 w-3 accent-cyan-500"
          />
          Show deprecated
        </label>
        <label
          className="text-xs text-zinc-400"
          title="Filter rows by ai_platform_eligible_api"
        >
          api_usable&nbsp;
          <select
            value={apiUsableFilter}
            onChange={(e) =>
              setApiUsableFilter(e.target.value as "all" | "visible" | "hidden")
            }
            data-testid="api-usable-filter"
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
          >
            <option value="all">All</option>
            <option value="visible">Visible only</option>
            <option value="hidden">Hidden only</option>
          </select>
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
            ? apiUsableFilter !== "all"
              ? `No ${apiUsableFilter} operations in ${platform} / ${moduleName} — change the api_usable filter to see others.`
              : `No active operations in ${platform} / ${moduleName} (all ${localOps.length} have 0 hits in 7d — toggle "Show deprecated" to see them).`
            : `No operations in ${platform} / ${moduleName}.`}
        </div>
      )}

      {visibleOps !== null && visibleOps.length > 0 && (
        <div className="divide-y divide-zinc-800 rounded border border-zinc-800 bg-zinc-900/30">
          <SortableList<AiPlatformOperation>
            items={visibleOps}
            getId={(o) => o.api_id}
            disabled={saving}
            onReorder={(newVisible) => {
              if (!localOps) return setLocalOps(newVisible);
              const visIds = new Set(newVisible.map((o) => o.api_id));
              let visIdx = 0;
              const merged = localOps.map((o) =>
                visIds.has(o.api_id) ? newVisible[visIdx++] : o,
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
                      title="0 hits in last 7 days (elk_deprecated_api proxy)"
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
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDetailsApiId(op.api_id);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    title={`See full details for ${op.api_id}`}
                    data-testid={`details-btn-${op.api_id}`}
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

      <OperationDetailsDrawer
        apiId={detailsApiId}
        onClose={() => setDetailsApiId(null)}
      />
    </div>
  );
}

// ai-platform's _operation_payload does not include the explicit
// deprecated / elk_deprecated_api flags from aiplatformkb. Use
// hit_count_7d <= 0 as a proxy — matches elk_deprecated_api semantics
// ("0 hits in last 7 days") in the source system.
function _isDeprecated(op: AiPlatformOperation): boolean {
  return (op.hit_count_7d ?? 0) <= 0;
}

function _msg(err: unknown): string {
  if (err instanceof AiPlatformApiError) return `${err.status} — ${err.message}`;
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
