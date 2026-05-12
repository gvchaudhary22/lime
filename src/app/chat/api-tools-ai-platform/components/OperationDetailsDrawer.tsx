"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Eye, EyeOff, Loader2, X } from "lucide-react";
import {
  AiPlatformApiError,
  getOperationDetails,
  type AiPlatformOperationDetails,
} from "@/lib/ai-platform-api";
import { VISIBILITY_EXPLAINER } from "@/lib/api-tools-copy";

/**
 * Slide-from-right read-only drawer surfacing the full operation row +
 * ELK summary from ai-platform's `POST /kb/operations/details`. Pattern
 * mirrors the existing OperationDetailsDrawer but consumes the
 * `_details_payload` shape (no per-index ELK breakdown — ai-platform
 * doesn't surface that).
 */
interface Props {
  apiId: string | null;
  onClose: () => void;
}

interface FetchState {
  status: "idle" | "loading" | "loaded" | "error";
  data: AiPlatformOperationDetails | null;
  error: string | null;
}

const INITIAL_STATE: FetchState = { status: "idle", data: null, error: null };

export default function OperationDetailsDrawer({ apiId, onClose }: Props) {
  const [state, setState] = useState<FetchState>(INITIAL_STATE);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (apiId === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [apiId, onClose]);

  useEffect(() => {
    if (apiId === null) {
      setState(INITIAL_STATE);
      return;
    }
    let alive = true;
    setState({ status: "loading", data: null, error: null });
    getOperationDetails(apiId)
      .then((data) => {
        if (!alive) return;
        setState({ status: "loaded", data, error: null });
      })
      .catch((err: unknown) => {
        if (!alive) return;
        const msg =
          err instanceof AiPlatformApiError
            ? `${err.status} — ${err.message}`
            : err instanceof Error
              ? err.message
              : "request failed";
        setState({ status: "error", data: null, error: msg });
      });
    return () => { alive = false; };
  }, [apiId, retryNonce]);

  if (apiId === null) return null;

  const op = state.data?.operation;
  const headerLine = op ? `${op.http_method} ${op.path}` : "Loading operation…";

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
        aria-labelledby="ai-op-details-drawer-title"
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col border-l border-white/[0.06] bg-[#0a0f1e] shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <div className="font-mono text-xs text-slate-500">api_id {apiId}</div>
            <div
              id="ai-op-details-drawer-title"
              className="mt-0.5 font-mono text-sm text-slate-200"
            >
              {headerLine}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close details"
            className="rounded p-1 text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm text-slate-300">
          {state.status === "loading" && (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading details…</span>
            </div>
          )}

          {state.status === "error" && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded border border-red-900/50 bg-red-950/40 p-3 text-red-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <div className="flex-1">
                  <div>{state.error}</div>
                </div>
              </div>
              <button
                onClick={() => setRetryNonce((n) => n + 1)}
                className="rounded bg-cyan-700 px-3 py-1 text-xs text-white hover:bg-cyan-600"
              >
                Retry
              </button>
            </div>
          )}

          {state.status === "loaded" && state.data && op && (
            <div className="space-y-5">
              <Section title="Identity">
                <Row label="api_id" value={op.api_id} mono />
                <Row label="org" value={op.org} />
                <Row label="repo_name" value={state.data.repo_name} mono />
                <Row label="base_url" value={state.data.base_url} mono />
              </Section>

              <Section title="Routing">
                <Row label="http_method" value={op.http_method} mono />
                <Row label="path" value={op.path} mono />
                <Row label="api_version" value={state.data.api_version} />
                <Row label="auth_type" value={state.data.auth_type} />
                <Row label="auth_scope" value={state.data.auth_scope} />
                <Row label="rate_limit_rpm" value={fmtNum(state.data.rate_limit_rpm)} />
              </Section>

              <Section title="Classification">
                <Row label="platform" value={op.platform} mono />
                <Row label="module" value={op.module} mono />
                <Row label="sub_module" value={op.sub_module} mono />
                <Row label="agent" value={op.agent} />
                <Row label="persona" value={op.persona} />
                <Row label="intent" value={state.data.intent} />
                <Row label="tool_name" value={state.data.tool_name} mono />
              </Section>

              <Section title="UI placement">
                <Row label="seller_menu_key" value={state.data.seller_menu_key} mono />
                <Row label="ui_section" value={state.data.ui_section} />
                <Row label="ui_subsection" value={state.data.ui_subsection} />
                <Row label="page_url" value={state.data.page_url} mono />
              </Section>

              <Section title="Code provenance">
                <Row label="controller" value={state.data.controller} mono />
                <Row label="source_file" value={state.data.source_file} mono />
                <Row
                  label="description"
                  value={state.data.description}
                  multiline
                />
              </Section>

              <Section title="Risk & curation">
                <Row label="approval_mode" value={state.data.approval_mode} />
                <Row label="risk_level" value={op.risk_level} />
                <Row label="read_write_type" value={op.read_write_type} />
                <Row label="display_order" value={fmtNum(op.display_order)} />
                <div className="flex items-center justify-between gap-3 py-1">
                  <span
                    className="text-xs text-slate-500"
                    title={VISIBILITY_EXPLAINER}
                  >
                    ai_platform_eligible_api
                  </span>
                  <span
                    className={
                      "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs " +
                      (op.ai_platform_eligible_api
                        ? "bg-emerald-900/30 text-emerald-300"
                        : "bg-zinc-800 text-zinc-400")
                    }
                  >
                    {op.ai_platform_eligible_api ? (
                      <Eye className="h-3 w-3" />
                    ) : (
                      <EyeOff className="h-3 w-3" />
                    )}
                    {op.ai_platform_eligible_api ? "visible" : "hidden"}
                  </span>
                </div>
                <Row label="module_curated" value={fmtBool(op.module_curated)} />
                <Row label="agent_curated" value={fmtBool(op.agent_curated)} />
                <Row label="persona_curated" value={fmtBool(op.persona_curated)} />
                <Row label="platform_curated" value={fmtBool(op.platform_curated)} />
                <Row
                  label="reject_description"
                  value={state.data.reject_description}
                  multiline
                />
              </Section>

              <Section title="ELK summary">
                <Row label="elk.host" value={state.data.elk.host} mono />
                <Row label="elk.index" value={state.data.elk.index} mono />
                <Row label="elk.hit_count_7d" value={fmtNum(state.data.elk.hit_count_7d)} />
                <Row label="elk.hit_count_updated_at" value={state.data.elk.hit_count_updated_at} mono />
                <Row label="elk.deprecated_api" value={fmtBool(state.data.elk.deprecated_api)} />
              </Section>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-cyan-400/70">
        {title}
      </h3>
      <div className="divide-y divide-white/[0.04] rounded border border-white/[0.06] bg-white/[0.02]">
        {children}
      </div>
    </section>
  );
}

function Row({
  label,
  value,
  mono,
  multiline,
}: {
  label: string;
  value: string | number | null;
  mono?: boolean;
  multiline?: boolean;
}) {
  const v = value === null || value === undefined || value === "" ? "—" : String(value);
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2">
      <span className="text-xs text-slate-500">{label}</span>
      <span
        className={
          "text-right text-xs text-slate-200 " +
          (mono ? "font-mono " : "") +
          (multiline ? "whitespace-pre-wrap break-words" : "truncate")
        }
        style={multiline ? { maxWidth: "70%" } : { maxWidth: "60%" }}
      >
        {v}
      </span>
    </div>
  );
}

function fmtNum(n: number | null | undefined): string | null {
  return n === null || n === undefined ? null : String(n);
}

function fmtBool(b: boolean | null | undefined): string {
  return b ? "true" : "false";
}
