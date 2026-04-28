"use client";

import { useEffect, useState, type ComponentPropsWithoutRef } from "react";
import { AlertTriangle, Eye, EyeOff, Loader2, Lock, X } from "lucide-react";

import {
  AiplatformkbApiError,
  getOperationDetails,
} from "@/lib/aiplatformkb-api";
import { VISIBILITY_EXPLAINER } from "@/lib/api-tools-copy";
import type {
  ElkPerIndexBreakdown,
  OperationDetails,
} from "@/types/api-tools";

/**
 * <OperationDetailsDrawer/> — Phase 16.
 *
 * Slide-from-right read-only drawer that surfaces the full api_listing row
 * + LEFT-JOINed elk_api_hits breakdown for one operation. Triggered by the
 * "Details" button on each row in ApisTab.
 *
 * Pattern mirrors src/components/pr-feed/ImpactDetailDrawer.tsx:
 *   - role="dialog" aria-modal
 *   - Escape key closes (document keydown listener, scoped to open state)
 *   - Backdrop click closes
 *   - Internal scroll for long descriptions
 *
 * Lifecycle: open === detailsOpId !== null in the parent (ApisTab).
 * Re-opening fetches fresh data — drawer never holds stale state across
 * separate operations.
 */
interface Props {
  operationId: number | null;
  onClose: () => void;
}

interface FetchState {
  status: "idle" | "loading" | "loaded" | "error";
  data: OperationDetails | null;
  error: string | null;
}

const INITIAL_STATE: FetchState = {
  status: "idle",
  data: null,
  error: null,
};

export default function OperationDetailsDrawer({ operationId, onClose }: Props) {
  const [state, setState] = useState<FetchState>(INITIAL_STATE);
  const [retryNonce, setRetryNonce] = useState(0);

  // Escape key — only listen while drawer open.
  useEffect(() => {
    if (operationId === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [operationId, onClose]);

  // Fetch when operationId changes (or Retry bumps retryNonce). The
  // alive-guard prevents a stale promise from overwriting the next
  // operation's data when the user switches rows mid-request, and applies
  // equally to retry attempts.
  useEffect(() => {
    if (operationId === null) {
      setState(INITIAL_STATE);
      return;
    }
    let alive = true;
    setState({ status: "loading", data: null, error: null });
    getOperationDetails(operationId)
      .then((data) => {
        if (!alive) return;
        setState({ status: "loaded", data, error: null });
      })
      .catch((err: unknown) => {
        if (!alive) return;
        const msg =
          err instanceof AiplatformkbApiError
            ? `${err.status} — ${err.message}`
            : err instanceof Error
              ? err.message
              : "request failed";
        setState({ status: "error", data: null, error: msg });
      });
    return () => {
      alive = false;
    };
  }, [operationId, retryNonce]);

  if (operationId === null) return null;

  const headerLine = state.data
    ? `${state.data.http_method} ${state.data.path}`
    : "Loading operation…";

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="op-details-drawer-title"
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col border-l border-white/[0.06] bg-[#0a0f1e] shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <div className="font-mono text-xs text-slate-500">
              api_listing #{operationId}
            </div>
            <div
              id="op-details-drawer-title"
              className="mt-0.5 font-mono text-sm text-slate-100"
            >
              {headerLine}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 transition hover:bg-white/[0.05] hover:text-slate-100"
            aria-label="Close drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 text-sm">
          {state.status === "loading" && (
            <div
              data-testid="drawer-loading"
              className="flex items-center gap-2 text-slate-400"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading details…</span>
            </div>
          )}

          {state.status === "error" && (
            <div
              data-testid="drawer-error"
              className="flex items-start gap-2 rounded border border-red-900/50 bg-red-950/40 p-3 text-red-300"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">
                <div className="font-medium">Failed to load details</div>
                <div className="mt-0.5 text-xs text-red-200/70">
                  {state.error}
                </div>
                <button
                  type="button"
                  onClick={() => setRetryNonce((n) => n + 1)}
                  className="mt-2 rounded border border-red-700/60 bg-red-900/30 px-2 py-0.5 text-xs hover:bg-red-900/50"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {state.status === "loaded" && state.data && (
            <>
              <Section label="Identity">
                <KV label="api_id" value={state.data.api_id} mono />
                <KV label="repo_name" value={state.data.repo_name} mono />
                <KV label="base_url" value={state.data.base_url} mono />
                <KV label="tool_name" value={state.data.tool_name} mono />
              </Section>

              <Section label="Description">
                <p
                  data-testid="drawer-description"
                  className="whitespace-pre-wrap break-words text-slate-200"
                >
                  {state.data.description || (
                    <span className="text-slate-500">— (no description)</span>
                  )}
                </p>
              </Section>

              <Section label="Classification">
                <KV
                  label="platform"
                  value={state.data.platform}
                  badge={
                    state.data.platform_curated ? (
                      <CuratedBadge testid="drawer-platform-lock-badge" />
                    ) : null
                  }
                />
                <KV
                  label="module"
                  value={state.data.module}
                  badge={
                    state.data.module_curated ? (
                      <CuratedBadge testid="drawer-module-lock-badge" />
                    ) : null
                  }
                />
                <KV label="sub_module" value={state.data.sub_module} />
                <KV
                  label="agent"
                  value={state.data.agent}
                  badge={
                    state.data.agent_curated ? (
                      <CuratedBadge testid="drawer-agent-lock-badge" />
                    ) : null
                  }
                />
                <KV
                  label="persona"
                  value={state.data.persona}
                  badge={
                    state.data.persona_curated ? (
                      <CuratedBadge testid="drawer-persona-lock-badge" />
                    ) : null
                  }
                />
                <KV label="intent" value={state.data.intent} />
                <KV label="seller_menu_key" value={state.data.seller_menu_key} />
                <KV label="ui_section" value={state.data.ui_section} />
                <KV label="ui_subsection" value={state.data.ui_subsection} />
                <KV label="page_url" value={state.data.page_url} mono />
              </Section>

              <Section label="Routing & risk">
                <KV label="api_version" value={state.data.api_version} />
                <KV label="auth_type" value={state.data.auth_type} />
                <KV label="auth_scope" value={state.data.auth_scope} />
                <KV
                  label="rate_limit_rpm"
                  value={state.data.rate_limit_rpm?.toString() ?? null}
                />
                <KV label="approval_mode" value={state.data.approval_mode} />
                <KV label="risk_level" value={state.data.risk_level} />
                <KV label="read_write_type" value={state.data.read_write_type} />
              </Section>

              <Section label="Code provenance">
                <KV label="controller" value={state.data.controller} mono />
                <KV label="source_file" value={state.data.source_file} mono />
              </Section>

              <Section label="ELK details" data-testid="drawer-elk-section">
                <ElkBlock elk={state.data.elk} />
              </Section>

              <Section label="Visibility" data-testid="drawer-visibility-section">
                <div className="mb-3 flex items-center gap-2">
                  {state.data.ai_platform_eligible_api ? (
                    <>
                      <Eye className="h-4 w-4 text-emerald-300" />
                      <span className="font-mono text-xs text-emerald-300">
                        visible
                      </span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-4 w-4 text-zinc-400" />
                      <span className="font-mono text-xs text-zinc-400">
                        hidden
                      </span>
                    </>
                  )}
                </div>
                <pre
                  data-testid="drawer-visibility-explainer"
                  className="whitespace-pre-wrap break-words rounded border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-slate-300"
                >
                  {VISIBILITY_EXPLAINER}
                </pre>
              </Section>

              <Section label="Metadata">
                <KV label="display_order" value={String(state.data.display_order ?? "—")} />
                <KV label="created_at" value={fmtDate(state.data.created_at)} />
                <KV label="updated_at" value={fmtDate(state.data.updated_at)} />
                <KV
                  label="reject_description"
                  value={state.data.reject_description}
                />
              </Section>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────

function Section({
  label,
  children,
  ...rest
}: { label: string; children: React.ReactNode } & ComponentPropsWithoutRef<"section">) {
  return (
    <section {...rest}>
      <h4 className="mb-2 text-xs uppercase tracking-wider text-slate-500">
        {label}
      </h4>
      {children}
    </section>
  );
}

function KV({
  label,
  value,
  mono,
  badge,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 py-0.5 text-xs">
      <span className="flex min-w-[140px] shrink-0 items-center gap-1 text-slate-500">
        {label}
        {badge}
      </span>
      <span
        className={`flex-1 break-words text-slate-200 ${mono ? "font-mono text-[11px]" : ""}`}
      >
        {value && value !== "" ? value : "—"}
      </span>
    </div>
  );
}

// Phase 19 — manual-override lock badge for the Classification section.
// Surfaced when the row's <col>_curated boolean is true, matching the
// Reclassify page's amber-warning idiom.
function CuratedBadge({ testid }: { testid: string }) {
  return (
    <span
      data-testid={testid}
      title="manual override — kb_populate won't re-classify this field"
      className="inline-flex items-center text-amber-400"
    >
      <Lock className="h-3 w-3" />
    </span>
  );
}

function ElkBlock({ elk }: { elk: OperationDetails["elk"] }) {
  const stale = isStale(elk.hit_count_updated_at);

  return (
    <div>
      <KV label="elk_host" value={elk.elk_host} />
      <KV label="elk_index" value={elk.elk_index} mono />
      <KV
        label="hit_count_7d"
        value={elk.hit_count_7d !== null ? elk.hit_count_7d.toLocaleString() : null}
      />
      <KV label="elk_deprecated_api" value={String(elk.elk_deprecated_api)} />
      <KV
        label={stale ? "Last refresh (stale)" : "Last refresh"}
        value={fmtDate(elk.hit_count_updated_at)}
      />
      {stale && (
        <div className="mt-1 rounded border border-amber-900/40 bg-amber-950/30 px-2 py-1 text-[11px] text-amber-300">
          Last refresh &gt; 24 h ago. Run{" "}
          <code className="font-mono">
            pillar_api_catalog_quick_elk_script.py --table-name api_listing
          </code>{" "}
          to refresh.
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

function isStale(iso: string | null): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  return Date.now() - t > STALE_AFTER_MS;
}
