"use client";

import { X } from "lucide-react";
import type {
  ApiStatus,
  DeprecationState,
  FilterOptions,
  ImpactStatus,
  ImpactType,
  PrDetailFilters,
} from "@/types/pr-feed";

interface Props {
  value: PrDetailFilters;
  options: FilterOptions | null;
  onChange: (next: PrDetailFilters) => void;
  onReset: () => void;
}

const IMPACT_STATUSES: ImpactStatus[] = [
  "impacted",
  "eligible_no_change",
  "deprecated_skipped",
  "new_pending",
];
const API_STATUSES: ApiStatus[] = ["new", "existing"];
const IMPACT_TYPES: ImpactType[] = [
  "direct_route",
  "direct_controller",
  "direct_indirect",
];
const DEPRECATION_STATES: DeprecationState[] = ["active", "deprecated"];
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function Chip({
  label,
  active,
  onClick,
  testId,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={`rounded-full border px-2 py-0.5 text-[11px] capitalize transition ${
        active
          ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200"
          : "border-white/[0.06] text-slate-400 hover:border-white/20"
      }`}
    >
      {label.replace(/_/g, " ")}
    </button>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  options: string[];
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-400">
      {label}
      <select
        value={value || ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? undefined : e.target.value)
        }
        className="rounded border border-white/[0.06] bg-[#0a0f1e] px-2 py-1.5 text-sm text-slate-200 focus:border-cyan-500/40 focus:outline-none"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function ImpactsFilterBar({
  value,
  options,
  onChange,
  onReset,
}: Props) {
  const patch = (next: Partial<PrDetailFilters>) =>
    onChange({ ...value, ...next });

  const toggleImpactStatus = (s: ImpactStatus) => {
    const current = value.impact_status || [];
    const has = current.includes(s);
    const next = has ? current.filter((v) => v !== s) : [...current, s];
    patch({ impact_status: next.length === 0 ? undefined : next });
  };

  const toggleApiStatus = (s: ApiStatus) =>
    patch({ api_status: value.api_status === s ? undefined : s });

  const toggleImpactType = (t: ImpactType) =>
    patch({ impact_type: value.impact_type === t ? undefined : t });

  const toggleDeprecation = (d: DeprecationState) =>
    patch({ deprecation_state: value.deprecation_state === d ? undefined : d });

  const toggleMethod = (m: string) =>
    patch({ http_method: value.http_method === m ? undefined : m });

  const selected = value.impact_status || [];

  return (
    <div className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <FilterRow label="Impact status">
        {IMPACT_STATUSES.map((s) => (
          <Chip
            key={s}
            label={s}
            active={selected.includes(s)}
            onClick={() => toggleImpactStatus(s)}
            testId={`impact-chip-${s}`}
          />
        ))}
      </FilterRow>

      <FilterRow label="API status">
        {API_STATUSES.map((s) => (
          <Chip
            key={s}
            label={s}
            active={value.api_status === s}
            onClick={() => toggleApiStatus(s)}
          />
        ))}
      </FilterRow>

      <FilterRow label="Impact type">
        {IMPACT_TYPES.map((t) => (
          <Chip
            key={t}
            label={t}
            active={value.impact_type === t}
            onClick={() => toggleImpactType(t)}
          />
        ))}
      </FilterRow>

      <FilterRow label="Deprecation">
        {DEPRECATION_STATES.map((d) => (
          <Chip
            key={d}
            label={d}
            active={value.deprecation_state === d}
            onClick={() => toggleDeprecation(d)}
          />
        ))}
      </FilterRow>

      <FilterRow label="HTTP method">
        {HTTP_METHODS.map((m) => (
          <Chip
            key={m}
            label={m}
            active={value.http_method === m}
            onClick={() => toggleMethod(m)}
          />
        ))}
      </FilterRow>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Select
          label="Platform"
          value={value.platform}
          onChange={(v) => patch({ platform: v })}
          options={options?.platforms || []}
        />
        <Select
          label="Domain"
          value={value.domain}
          onChange={(v) => patch({ domain: v })}
          options={options?.domains || []}
        />
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Min confidence ({(value.min_confidence ?? 0).toFixed(2)})
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={value.min_confidence ?? 0}
            onChange={(e) => {
              const n = parseFloat(e.target.value);
              patch({ min_confidence: n === 0 ? undefined : n });
            }}
            data-testid="min-confidence-slider"
            aria-label="Minimum confidence score"
            className="accent-cyan-400"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Path search
          <input
            type="text"
            value={value.q || ""}
            placeholder="/orders/..."
            onChange={(e) =>
              patch({ q: e.target.value === "" ? undefined : e.target.value })
            }
            className="rounded border border-white/[0.06] bg-[#0a0f1e] px-2 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:border-cyan-500/40 focus:outline-none"
          />
        </label>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1 rounded border border-white/[0.06] px-3 py-1.5 text-xs text-slate-300 transition hover:border-white/20"
        >
          <X className="h-3 w-3" />
          Reset
        </button>
      </div>
    </div>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="min-w-[120px] text-xs text-slate-500">{label}</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}
