"use client";

import { X } from "lucide-react";
import type { FilterOptions, PrListFilters, ProcessingStatus } from "@/types/pr-feed";

interface Props {
  value: PrListFilters;
  options: FilterOptions | null;
  onChange: (next: PrListFilters) => void;
  onReset: () => void;
}

const STATUS_VALUES: ProcessingStatus[] = [
  "pending",
  "processing",
  "done",
  "failed",
];

function Select({
  label,
  value,
  onChange,
  options,
  testId,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  options: string[];
  testId?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-400">
      {label}
      <select
        data-testid={testId}
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

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  testId,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  placeholder?: string;
  testId?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-400">
      {label}
      <input
        data-testid={testId}
        type="text"
        value={value || ""}
        placeholder={placeholder}
        onChange={(e) =>
          onChange(e.target.value === "" ? undefined : e.target.value)
        }
        className="rounded border border-white/[0.06] bg-[#0a0f1e] px-2 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:border-cyan-500/40 focus:outline-none"
      />
    </label>
  );
}

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-400">
      {label}
      <input
        type="date"
        value={value || ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? undefined : e.target.value)
        }
        // `[color-scheme:dark]` flips Chrome/Safari's native date picker
        // (calendar icon, mm/dd/yyyy placeholder) to its dark-theme palette
        // so it's legible on the #0a0f1e background.
        className="rounded border border-white/[0.06] bg-[#0a0f1e] px-2 py-1.5 text-sm text-slate-200 focus:border-cyan-500/40 focus:outline-none [color-scheme:dark]"
      />
    </label>
  );
}

export default function FilterBar({ value, options, onChange, onReset }: Props) {
  const patch = (next: Partial<PrListFilters>) =>
    onChange({ ...value, ...next });

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4 lg:grid-cols-5">
        <Select
          label="Org"
          value={value.org}
          onChange={(v) => patch({ org: v })}
          options={options?.orgs || []}
          testId="filter-org"
        />
        <Select
          label="Repo"
          value={value.repo}
          onChange={(v) => patch({ repo: v })}
          options={options?.repos || []}
        />
        <TextInput
          label="Author"
          value={value.author}
          onChange={(v) => patch({ author: v })}
          placeholder="username"
        />
        <Select
          label="Base branch"
          value={value.base_branch}
          onChange={(v) => patch({ base_branch: v })}
          options={options?.base_branches || []}
        />
        <TextInput
          label="Search title"
          value={value.q}
          onChange={(v) => patch({ q: v })}
          placeholder="title substring"
          testId="filter-q"
        />
        <DateInput
          label="Merged after"
          value={value.merged_after}
          onChange={(v) => patch({ merged_after: v })}
        />
        <DateInput
          label="Merged before"
          value={value.merged_before}
          onChange={(v) => patch({ merged_before: v })}
        />
        <div className="flex flex-col gap-1 text-xs text-slate-400">
          Processing status
          <div className="flex flex-wrap gap-1 py-1">
            {STATUS_VALUES.map((s) => {
              const active = value.processing_status === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() =>
                    patch({ processing_status: active ? undefined : s })
                  }
                  className={`rounded-full border px-2 py-0.5 text-[11px] capitalize transition ${
                    active
                      ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200"
                      : "border-white/[0.06] text-slate-400 hover:border-white/20"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-end">
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
    </div>
  );
}
