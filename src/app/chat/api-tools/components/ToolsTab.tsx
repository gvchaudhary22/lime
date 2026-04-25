"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, GripVertical, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import {
  AiplatformkbApiError,
  archiveTool,
  createTool,
  getToolApis,
  listTools,
  removeApiFromTool,
  reorderToolApis,
} from "@/lib/aiplatformkb-api";
import type { AdminTool, ToolMember, ToolStatus } from "@/types/api-tools";
import SortableList from "@/components/primitives/SortableList";

const STATUS_FILTERS: { key: ToolStatus | "all"; label: string }[] = [
  { key: "all",      label: "All" },
  { key: "active",   label: "Active" },
  { key: "draft",    label: "Draft" },
  { key: "archived", label: "Archived" },
];

/**
 * Tools tab — Wave 3-LIME-D.
 *
 * Left: tools list (status-filterable). Right: selected-tool member list,
 * drag-reorder, per-row delete. "+ New tool" inline form (POST /admin/tools).
 *
 * "Add API" cross-action lives on the APIs tab in Wave 3-LIME-D follow-up;
 * for now this tab supports browsing + reordering existing memberships.
 */
export default function ToolsTab() {
  const [tools, setTools] = useState<AdminTool[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<ToolStatus | "all">("all");
  const [selected, setSelected] = useState<number | null>(null);

  // Members: server vs local for optimistic reorder.
  const [serverMembers, setServerMembers] = useState<ToolMember[] | null>(null);
  const [localMembers, setLocalMembers] = useState<ToolMember[] | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingMembership, setSavingMembership] = useState(false);

  // New-tool form state.
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const refreshTools = async () => {
    try {
      const rows = await listTools();
      setTools(rows);
      if (rows.length > 0 && selected === null) setSelected(rows[0].id);
    } catch (err) {
      setError(_msg(err));
    }
  };

  const refreshMembers = async (toolId: number) => {
    try {
      const rows = await getToolApis(toolId);
      setServerMembers(rows);
      setLocalMembers(rows);
    } catch (err) {
      setError(_msg(err));
    }
  };

  useEffect(() => { refreshTools(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selected === null) return;
    setServerMembers(null);
    setLocalMembers(null);
    setError(null);
    refreshMembers(selected);
  }, [selected]);

  const visibleTools = (tools ?? []).filter(
    (t) => statusFilter === "all" || t.status === statusFilter
  );
  const selectedTool = (tools ?? []).find((t) => t.id === selected) ?? null;

  const memberDirty =
    serverMembers !== null &&
    localMembers !== null &&
    serverMembers.map((m) => m.api_listing_id).join(",") !==
      localMembers.map((m) => m.api_listing_id).join(",");

  // ── handlers ────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!newName.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await createTool({ name: newName.trim(), description: newDescription || null });
      setNewName(""); setNewDescription(""); setShowNewForm(false);
      await refreshTools();
    } catch (err) {
      setError(_msg(err));
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (toolId: number) => {
    if (!window.confirm("Archive this tool? (status set to 'archived'; can be un-archived later)")) return;
    setError(null);
    try {
      await archiveTool(toolId);
      await refreshTools();
    } catch (err) {
      setError(_msg(err));
    }
  };

  const handleSaveMemberOrder = async () => {
    if (!localMembers || selectedTool === null || savingMembership) return;
    setSavingMembership(true);
    const snapshot = localMembers;
    try {
      await reorderToolApis(selectedTool.id, {
        ordered_api_ids: snapshot.map((m) => m.api_listing_id),
      });
      setServerMembers(snapshot);
    } catch (err) {
      setLocalMembers(serverMembers);
      setError(_msg(err));
    } finally {
      setSavingMembership(false);
    }
  };

  const handleRemoveMember = async (apiId: number) => {
    if (!selectedTool || !localMembers) return;
    setError(null);
    try {
      await removeApiFromTool(selectedTool.id, apiId);
      await refreshMembers(selectedTool.id);
    } catch (err) {
      setError(_msg(err));
    }
  };

  // ── render ──────────────────────────────────────────────────────────

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Left: tools list */}
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
            onClick={() => setShowNewForm((s) => !s)}
            className="flex items-center gap-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
          >
            <Plus className="h-3 w-3" /> New tool
          </button>
        </div>

        {showNewForm && (
          <div className="space-y-2 rounded border border-cyan-900/50 bg-cyan-950/20 p-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="tool name (must be unique)"
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
            />
            <input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="description (optional)"
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || saving}
                className="rounded bg-cyan-700 px-2 py-1 text-xs text-white disabled:opacity-50"
              >
                {saving ? "Creating…" : "Create draft"}
              </button>
              <button
                onClick={() => { setShowNewForm(false); setNewName(""); setNewDescription(""); }}
                className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded border border-red-900/50 bg-red-950/40 p-3 text-sm text-red-300">
            <AlertTriangle className="h-4 w-4" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto"><X className="h-3 w-3" /></button>
          </div>
        )}

        {tools === null && !error && (
          <div className="flex items-center gap-2 text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading tools…</span>
          </div>
        )}

        {tools !== null && visibleTools.length === 0 && (
          <div className="rounded border border-zinc-800 bg-zinc-900/50 p-4 text-sm text-zinc-400">
            No tools in this filter. Create one with “New tool”.
          </div>
        )}

        {visibleTools.length > 0 && (
          <ul className="divide-y divide-zinc-800 rounded border border-zinc-800 bg-zinc-900/30">
            {visibleTools.map((t) => (
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
                  <div className="flex items-center gap-2">
                    <span className={_statusBadge(t.status)}>{t.status}</span>
                    {t.status !== "archived" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleArchive(t.id); }}
                        title="Archive (soft delete)"
                        className="text-zinc-500 hover:text-red-400"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
                {t.description && (
                  <div className="mt-1 truncate text-xs text-zinc-500">{t.description}</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Right: selected-tool members */}
      <div className="space-y-3">
        {selectedTool === null ? (
          <div className="rounded border border-zinc-800 bg-zinc-900/50 p-6 text-sm text-zinc-400">
            Select a tool to see its API members.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">{selectedTool.name}</h3>
                <p className="text-xs text-zinc-400">
                  {selectedTool.description || "No description."}
                </p>
              </div>
              <button
                onClick={handleSaveMemberOrder}
                disabled={!memberDirty || savingMembership}
                className="flex items-center gap-1 rounded bg-cyan-700 px-3 py-1 text-xs text-white disabled:opacity-50 hover:bg-cyan-600"
              >
                {savingMembership ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Save order
              </button>
            </div>

            {localMembers === null ? (
              <div className="flex items-center gap-2 text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading members…</span>
              </div>
            ) : localMembers.length === 0 ? (
              <div className="rounded border border-zinc-800 bg-zinc-900/50 p-4 text-sm text-zinc-400">
                No APIs attached. Use the APIs tab → Add to tool (next iteration).
              </div>
            ) : (
              <div className="divide-y divide-zinc-800 rounded border border-zinc-800 bg-zinc-900/30">
                <SortableList<ToolMember>
                  items={localMembers}
                  getId={(m) => m.api_listing_id}
                  disabled={savingMembership}
                  onReorder={setLocalMembers}
                  renderItem={(m, { isDragging }) => (
                    <div className={
                      "flex items-center justify-between px-3 py-2 " +
                      (isDragging ? "bg-zinc-800/40" : "")
                    }>
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-zinc-600" />
                        <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                          {m.http_method}
                        </span>
                        <code className="text-xs text-zinc-300">{m.path}</code>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">pos {m.position}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemoveMember(m.api_listing_id); }}
                          title="Remove from tool"
                          className="text-zinc-500 hover:text-red-400"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )}
                />
              </div>
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
