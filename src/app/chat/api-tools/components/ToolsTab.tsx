"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Plus } from "lucide-react";
import {
  AiplatformkbApiError,
  getToolApis,
  listTools,
} from "@/lib/aiplatformkb-api";
import type { AdminTool, ToolMember, ToolStatus } from "@/types/api-tools";

const STATUS_FILTERS: { key: ToolStatus | "all"; label: string }[] = [
  { key: "all",      label: "All" },
  { key: "active",   label: "Active" },
  { key: "draft",    label: "Draft" },
  { key: "archived", label: "Archived" },
];

/**
 * Tools tab — Wave 3-LIME-B scaffold.
 *
 * Split layout: left = tools list (filterable by status), right = members
 * of the selected tool. Drag-reorder within members + "+ New Tool" form
 * + member CRUD wire up in Wave 3-LIME-D.
 */
export default function ToolsTab() {
  const [tools, setTools] = useState<AdminTool[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<ToolStatus | "all">("all");
  const [selected, setSelected] = useState<number | null>(null);
  const [members, setMembers] = useState<ToolMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listTools()
      .then((rows) => {
        setTools(rows);
        if (rows.length > 0 && selected === null) {
          setSelected(rows[0].id);
        }
      })
      .catch((err) => setError(_msg(err)));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selected === null) return;
    setMembers(null);
    getToolApis(selected)
      .then(setMembers)
      .catch((err) => setError(_msg(err)));
  }, [selected]);

  const visible = (tools ?? []).filter(
    (t) => statusFilter === "all" || t.status === statusFilter
  );
  const selectedTool = (tools ?? []).find((t) => t.id === selected) ?? null;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* ── Left: tools list ─────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={
                  "rounded px-2 py-1 text-xs " +
                  (statusFilter === f.key
                    ? "bg-cyan-900/40 text-cyan-300"
                    : "text-zinc-400 hover:bg-zinc-800/40")
                }
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            disabled
            title="Available in Wave 3-LIME-D"
            className="flex items-center gap-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-500"
          >
            <Plus className="h-3 w-3" /> New tool
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded border border-red-900/50 bg-red-950/40 p-3 text-sm text-red-300">
            <AlertTriangle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {tools === null && !error && (
          <div className="flex items-center gap-2 text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading tools…</span>
          </div>
        )}

        {tools !== null && visible.length === 0 && !error && (
          <div className="rounded border border-zinc-800 bg-zinc-900/50 p-4 text-sm text-zinc-400">
            No tools in this status filter. Create one once the New-tool form lands (Wave 3-LIME-D).
          </div>
        )}

        {visible.length > 0 && (
          <ul className="divide-y divide-zinc-800 rounded border border-zinc-800 bg-zinc-900/30">
            {visible.map((t) => (
              <li
                key={t.id}
                onClick={() => setSelected(t.id)}
                className={
                  "cursor-pointer px-3 py-2 transition-colors " +
                  (t.id === selected ? "bg-cyan-950/40" : "hover:bg-zinc-800/30")
                }
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t.name}</span>
                  <span className={_statusBadge(t.status)}>{t.status}</span>
                </div>
                {t.description && (
                  <div className="mt-1 truncate text-xs text-zinc-500">{t.description}</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Right: selected-tool members ────────────────── */}
      <div className="space-y-3">
        {selectedTool === null ? (
          <div className="rounded border border-zinc-800 bg-zinc-900/50 p-6 text-sm text-zinc-400">
            Select a tool to see its API members.
          </div>
        ) : (
          <>
            <div>
              <h3 className="text-sm font-semibold">{selectedTool.name}</h3>
              <p className="text-xs text-zinc-400">
                {selectedTool.description || "No description."}
              </p>
            </div>
            {members === null ? (
              <div className="flex items-center gap-2 text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading members…</span>
              </div>
            ) : members.length === 0 ? (
              <div className="rounded border border-zinc-800 bg-zinc-900/50 p-4 text-sm text-zinc-400">
                No APIs attached. Use the APIs tab → Add to tool (Wave 3-LIME-D).
              </div>
            ) : (
              <ul className="divide-y divide-zinc-800 rounded border border-zinc-800 bg-zinc-900/30">
                {members.map((m) => (
                  <li
                    key={m.api_listing_id}
                    className="flex items-center justify-between px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                        {m.http_method}
                      </span>
                      <code className="text-xs text-zinc-300">{m.path}</code>
                    </div>
                    <span className="text-xs text-zinc-500">pos {m.position}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function _msg(err: unknown): string {
  if (err instanceof AiplatformkbApiError) return `${err.status} — ${err.message}`;
  return err instanceof Error ? err.message : "request failed";
}

function _statusBadge(s: ToolStatus): string {
  const base = "rounded px-2 py-0.5 text-xs ";
  switch (s) {
    case "active":   return base + "bg-emerald-900/40 text-emerald-300";
    case "draft":    return base + "bg-amber-900/40 text-amber-300";
    case "archived": return base + "bg-zinc-800 text-zinc-400";
  }
}
