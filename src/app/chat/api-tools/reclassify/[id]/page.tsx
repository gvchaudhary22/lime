"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Lock,
  Sparkles,
  Wand2,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import {
  AiplatformkbApiError,
  getOperationDetails,
  getOperationSuggest,
  listAdminAgents,
  listAdminModules,
  listAdminPlatforms,
  setOperationClassification,
} from "@/lib/aiplatformkb-api";
import type {
  AdminModule,
  OperationDetails,
  OperationSuggest,
  SetClassificationPayload,
} from "@/types/api-tools";

// Phase-19 amendment — persona dropdown removed; platform took its place.
// The platform list is fetched from /admin/platforms at mount; the agent
// list is fetched from /admin/agents?platform=<current> and re-fetched
// whenever the curator switches the platform. No hardcoded enum drift.

// Helper — empty string is the "no value" sentinel for the agent dropdown.
// Convert to null/undefined when comparing against the loaded record.
const _trim = (v: string | null | undefined): string => (v ?? "").trim();

export default function ReclassifyPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <ReclassifyPageInner />
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

// ── Page state ──────────────────────────────────────────────────────────

type DetailsState =
  | { status: "loading" }
  | { status: "loaded"; data: OperationDetails }
  | { status: "error"; error: string };

type SuggestState =
  | { status: "loading" }
  | { status: "loaded"; data: OperationSuggest }
  | { status: "error" };

function ReclassifyPageInner() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const idNum = useMemo(() => {
    const n = Number(params?.id);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [params?.id]);

  const [detailsState, setDetailsState] = useState<DetailsState>({
    status: "loading",
  });
  const [suggestState, setSuggestState] = useState<SuggestState>({
    status: "loading",
  });
  const [modules, setModules] = useState<AdminModule[] | null>(null);
  // Phase-19 amendment — fetched once at mount; ground truth is the
  // distinct set of api_listing.platform values.
  const [platforms, setPlatforms] = useState<string[]>([]);
  // Phase-19 amendment — re-fetched whenever the curator switches
  // platform so the dropdown options track the row's surface.
  const [agents, setAgents] = useState<string[]>([]);

  // Form state (independent of detailsState so curator edits don't get
  // clobbered by an unrelated re-fetch).
  const [moduleValue, setModuleValue] = useState<string>("");
  const [agentValue, setAgentValue] = useState<string>("");
  const [platformValue, setPlatformValue] = useState<string>("");
  // True when curator clicked "Use suggestion" — Save still flips locks
  // even when the chosen values match the current DB row.
  const [usedSuggestion, setUsedSuggestion] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Refetch nonce — bump to retry initial load on error.
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (idNum === null) {
      setDetailsState({ status: "error", error: "invalid operation id" });
      return;
    }
    let alive = true;
    setDetailsState({ status: "loading" });
    setSuggestState({ status: "loading" });

    // 1. Details first — drives the platform-scoped modules + agents
    //    fetch + form initial values. Suggest + platforms fire in parallel.
    getOperationDetails(idNum)
      .then((data) => {
        if (!alive) return;
        setDetailsState({ status: "loaded", data });
        setModuleValue(data.module);
        setAgentValue(data.agent ?? "");
        setPlatformValue(data.platform ?? "");
        // Now load the platform-scoped module + agent lists.
        listAdminModules(data.platform)
          .then((rows) => {
            if (alive) setModules(rows);
          })
          .catch((err) => {
            if (alive) setDetailsState({ status: "error", error: _msg(err) });
          });
        listAdminAgents(data.platform)
          .then((rows) => {
            if (alive) setAgents(rows);
          })
          .catch(() => {
            // Best-effort — empty agent list still lets the curator
            // pick "(no agent)" or rely on Use-suggestion fallback.
            if (alive) setAgents([]);
          });
      })
      .catch((err) => {
        if (alive) setDetailsState({ status: "error", error: _msg(err) });
      });

    // Phase-19 amendment — platforms are independent of details; fetch
    // in parallel so the dropdown is ready as soon as the page renders.
    listAdminPlatforms()
      .then((rows) => {
        if (alive) setPlatforms(rows);
      })
      .catch(() => {
        // Best-effort — degrade to "current platform only" by leaving
        // the list empty; the loaded value will still display via the
        // fallback <option> rendered below.
        if (alive) setPlatforms([]);
      });

    getOperationSuggest(idNum)
      .then((data) => {
        if (alive) setSuggestState({ status: "loaded", data });
      })
      .catch(() => {
        // Suggest is best-effort. UI degrades to "no suggestion" rather
        // than blocking the page.
        if (alive) setSuggestState({ status: "error" });
      });

    return () => {
      alive = false;
    };
  }, [idNum, retryNonce]);

  const details = detailsState.status === "loaded" ? detailsState.data : null;

  // Save enabled when any field differs from the current DB record OR the
  // curator pressed "Use suggestion" (intent = lock the values in even if
  // they match the LLM's pick).
  const dirty = useMemo(() => {
    if (!details) return false;
    if (usedSuggestion) return true;
    return (
      moduleValue !== details.module ||
      _trim(agentValue) !== _trim(details.agent) ||
      platformValue !== (details.platform ?? "")
    );
  }, [details, moduleValue, agentValue, platformValue, usedSuggestion]);

  const handleUseSuggestion = () => {
    if (suggestState.status !== "loaded") return;
    const s = suggestState.data;
    if (s.module) setModuleValue(s.module);
    if (s.agent !== null && s.agent !== undefined) {
      // The suggested agent might not be in the current platform-scoped
      // dropdown. Append it so the <option> renders before we set the
      // selected value.
      const suggestedAgent = s.agent;
      setAgents((prev) =>
        prev.includes(suggestedAgent) ? prev : [...prev, suggestedAgent].sort(),
      );
      setAgentValue(suggestedAgent);
    }
    // Phase-20 — suggest now returns a 4th enum (platform). When the
    // suggested platform is in the allowed `platforms` array, fill it
    // and re-fetch the platform-scoped agent list. Mirror the same
    // defense the platform-onChange path uses: if the suggested agent
    // isn't in the new platform's list, append it so the <option>
    // renders.
    if (s.platform && platforms.includes(s.platform)) {
      const suggestedPlatform = s.platform;
      setPlatformValue(suggestedPlatform);
      listAdminAgents(suggestedPlatform)
        .then((rows) => {
          if (s.agent && !rows.includes(s.agent)) {
            setAgents([...rows, s.agent].sort());
          } else {
            setAgents(rows);
          }
        })
        .catch(() => {
          // Best-effort — fallback dropdown stays valid because we
          // already appended the suggested agent above.
        });
    }
    setUsedSuggestion(true);
  };

  const handleSave = async () => {
    if (!details || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      // Build PATCH body — only send changed fields. If the curator clicked
      // "Use suggestion" and accepted unchanged values, send all 3 anyway
      // (intent = flip the lock flags).
      const body: SetClassificationPayload = {};
      const moduleChanged = moduleValue !== details.module;
      const agentChanged = _trim(agentValue) !== _trim(details.agent);
      const platformChanged = platformValue !== (details.platform ?? "");

      if (usedSuggestion) {
        if (moduleValue) body.module = moduleValue;
        if (_trim(agentValue)) body.agent = _trim(agentValue);
        // Phase-20 — suggest now returns platform too. If the curator
        // accepted the suggestion and the platform value is non-empty,
        // ship it as part of the lock-flip payload.
        if (platformValue) body.platform = platformValue;
      } else {
        if (moduleChanged) body.module = moduleValue;
        if (agentChanged) body.agent = _trim(agentValue);
        if (platformChanged && platformValue) body.platform = platformValue;
      }

      const res = await setOperationClassification(idNum!, body);
      // Redirect to APIs tab scoped to the (possibly new) platform/module
      // so the row appears under its new home immediately.
      router.replace(
        `/chat/api-tools?tab=apis&platform=${encodeURIComponent(
          res.platform,
        )}&module=${encodeURIComponent(res.module)}`,
      );
    } catch (err) {
      setSaveError(_msg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#0c0515] text-zinc-100">
      <Sidebar activePage="api-tools" />
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b border-white/[0.06] px-8 pb-4 pt-6">
          <button
            type="button"
            onClick={() => router.back()}
            data-testid="reclassify-cancel-button"
            className="mb-2 inline-flex items-center gap-1 text-xs text-slate-400 transition hover:text-cyan-400"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to API Tools
          </button>
          <div className="flex items-center gap-3">
            <Wand2 className="h-6 w-6 text-cyan-400" />
            <h1 className="text-2xl font-bold text-white">
              Reclassify operation
            </h1>
          </div>
          {details && (
            <div className="mt-1 font-mono text-sm text-slate-400">
              <span className="text-emerald-300">{details.http_method}</span>{" "}
              {details.path}
              <span className="ml-3 text-xs text-slate-500">
                api_listing #{details.id} · {details.platform}
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-8 py-6">
          {detailsState.status === "loading" && (
            <div
              data-testid="reclassify-page-loading"
              className="flex items-center gap-2 text-slate-400"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading operation…</span>
            </div>
          )}

          {detailsState.status === "error" && (
            <div
              role="alert"
              data-testid="reclassify-page-error"
              className="flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
            >
              <AlertTriangle className="h-4 w-4" />
              <span className="flex-1">{detailsState.error}</span>
              <button
                type="button"
                onClick={() => setRetryNonce((n) => n + 1)}
                className="rounded border border-rose-700/60 bg-rose-900/30 px-2 py-0.5 text-xs hover:bg-rose-900/50"
              >
                Retry
              </button>
            </div>
          )}

          {detailsState.status === "loaded" && details && (
            <>
              <AiSuggestionPanel
                state={suggestState}
                onUse={handleUseSuggestion}
              />

              <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <h2 className="mb-4 text-xs uppercase tracking-wider text-slate-500">
                  Classification
                </h2>

                <div className="space-y-4">
                  <FieldRow
                    label="Platform"
                    locked={details.platform_curated}
                    lockTestid="reclassify-platform-lock-badge"
                  >
                    <select
                      value={platformValue}
                      onChange={(e) => {
                        const next = e.target.value;
                        setPlatformValue(next);
                        setUsedSuggestion(false);
                        // Re-fetch agents scoped to the new platform; reset
                        // the agent value if the previous pick isn't in the
                        // new list (it would otherwise render as a stale
                        // <option> with no source row backing it).
                        listAdminAgents(next)
                          .then((rows) => {
                            setAgents(rows);
                            if (agentValue && !rows.includes(agentValue)) {
                              setAgentValue("");
                            }
                          })
                          .catch(() => {
                            setAgents([]);
                          });
                      }}
                      data-testid="reclassify-platform-select"
                      className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-slate-200"
                    >
                      <option value="">— (no platform)</option>
                      {/* If current platform isn't in the fetched list yet,
                          render it first so the loaded value displays. */}
                      {platformValue &&
                        !platforms.includes(platformValue) && (
                          <option value={platformValue}>{platformValue}</option>
                        )}
                      {platforms.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </FieldRow>

                  <FieldRow
                    label="Module"
                    locked={details.module_curated}
                    lockTestid="reclassify-module-lock-badge"
                  >
                    <select
                      value={moduleValue}
                      onChange={(e) => {
                        setModuleValue(e.target.value);
                        setUsedSuggestion(false);
                      }}
                      data-testid="reclassify-module-select"
                      disabled={modules === null}
                      className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-slate-200 disabled:opacity-50"
                    >
                      {/* If current module isn't in the list, render it first
                          so the loaded value displays correctly. */}
                      {modules &&
                        !modules.some((m) => m.module_name === moduleValue) &&
                        moduleValue && (
                          <option value={moduleValue}>{moduleValue}</option>
                        )}
                      {(modules ?? []).map((m) => (
                        <option key={m.module_name} value={m.module_name}>
                          {m.module_name}
                        </option>
                      ))}
                    </select>
                  </FieldRow>

                  <FieldRow
                    label="Agent"
                    locked={details.agent_curated}
                    lockTestid="reclassify-agent-lock-badge"
                  >
                    <select
                      value={agentValue}
                      onChange={(e) => {
                        setAgentValue(e.target.value);
                        setUsedSuggestion(false);
                      }}
                      data-testid="reclassify-agent-select"
                      className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-slate-200"
                    >
                      <option value="">— (no agent)</option>
                      {/* If current agent isn't in the fetched list yet,
                          render it first so the loaded value displays. */}
                      {agentValue && !agents.includes(agentValue) && (
                        <option value={agentValue}>{agentValue}</option>
                      )}
                      {agents.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </FieldRow>
                </div>
              </section>

              <div className="flex items-start gap-2 rounded border border-amber-900/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
                <Lock className="mt-0.5 h-3 w-3 shrink-0" />
                <span>
                  Each field saved here becomes a manual override —
                  kb_populate will preserve your choice on future syncs.
                </span>
              </div>

              {saveError && (
                <div
                  role="alert"
                  data-testid="reclassify-save-error"
                  className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
                >
                  <AlertTriangle className="h-4 w-4" />
                  <span>{saveError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="rounded border border-zinc-700 bg-zinc-900 px-4 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!dirty || saving}
                  data-testid="reclassify-save-button"
                  className="flex items-center gap-1 rounded bg-cyan-700 px-4 py-1.5 text-sm text-white transition-colors hover:bg-cyan-600 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : null}
                  Save
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────

function AiSuggestionPanel({
  state,
  onUse,
}: {
  state: SuggestState;
  onUse: () => void;
}) {
  return (
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-cyan-400" />
        <h2 className="text-xs uppercase tracking-wider text-slate-500">
          AI suggestion
        </h2>
      </div>

      {state.status === "loading" && (
        <div
          data-testid="reclassify-ai-spinner"
          className="flex items-center gap-2 text-slate-400"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Thinking…</span>
        </div>
      )}

      {state.status === "error" && (
        <div
          data-testid="reclassify-ai-fallback"
          className="text-sm text-slate-400"
        >
          AI suggestion unavailable — pick manually.
        </div>
      )}

      {state.status === "loaded" && state.data.fallback && (
        <div
          data-testid="reclassify-ai-fallback"
          className="text-sm text-slate-400"
        >
          {state.data.reasoning ||
            "AI suggestion unavailable — pick manually."}
        </div>
      )}

      {state.status === "loaded" && !state.data.fallback && (
        <div data-testid="reclassify-ai-content" className="space-y-2 text-sm">
          <SuggestKV label="Module" value={state.data.module} />
          <SuggestKV label="Agent" value={state.data.agent} />
          {/* Phase-20 — Platform row added; the LLM now picks a 4th
              enum and the page's platform dropdown can consume it.
              Persona row stays hidden (no persona dropdown in the form
              since the Phase-19 amendment). */}
          <SuggestKV label="Platform" value={state.data.platform} />
          {state.data.reasoning && (
            <p className="mt-2 whitespace-pre-wrap text-xs text-slate-300">
              <span className="text-slate-500">Reasoning: </span>
              {state.data.reasoning}
            </p>
          )}
          <div className="pt-2">
            <button
              type="button"
              onClick={onUse}
              data-testid="reclassify-ai-use-button"
              className="flex items-center gap-1 rounded bg-cyan-900/40 px-3 py-1 text-xs text-cyan-200 transition-colors hover:bg-cyan-900/60"
            >
              <Wand2 className="h-3 w-3" />
              Use suggestion
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function SuggestKV({ label, value }: { label: string; value: string | null }) {
  const testid = `reclassify-ai-row-${label.toLowerCase()}`;
  return (
    <div className="flex gap-3" data-testid={testid}>
      <span className="min-w-[80px] text-xs uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <span className="font-mono text-slate-200">
        {value && value !== "" ? value : <span className="text-slate-500">—</span>}
      </span>
    </div>
  );
}

function FieldRow({
  label,
  locked,
  lockTestid,
  children,
}: {
  label: string;
  locked: boolean;
  lockTestid: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-2 text-xs text-slate-400">
        {label}
        {locked && (
          <span
            data-testid={lockTestid}
            title="manual override — kb_populate won't re-classify this field"
            className="inline-flex items-center gap-0.5 text-amber-400"
          >
            <Lock className="h-3 w-3" />
            manual override
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

function _msg(err: unknown): string {
  if (err instanceof AiplatformkbApiError) return `${err.status} — ${err.message}`;
  return err instanceof Error ? err.message : "request failed";
}

