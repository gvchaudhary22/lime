import type { SyncRunSummary as Summary } from "@/types/pr-feed";

interface Props {
  syncRun: Summary;
}

export default function SyncRunSummary({ syncRun }: Props) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-300">
          Sync Run #{syncRun.id}
        </h3>
        <span className="rounded bg-white/[0.05] px-2 py-0.5 text-[11px] capitalize text-slate-300">
          {syncRun.status}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-xs text-slate-400 md:grid-cols-5">
        <Metric label="Routes processed" value={syncRun.routes_processed} />
        <Metric label="Routes skipped" value={syncRun.routes_skipped} />
        <Metric
          label="Indirect routes"
          value={syncRun.indirect_routes_processed}
        />
        <Metric label="KB files written" value={syncRun.kb_files_written} />
        <Metric label="DB rows upserted" value={syncRun.db_rows_upserted} />
      </div>
      <div className="mt-3 flex gap-6 text-[11px] text-slate-500">
        <span>started {syncRun.started_at || "—"}</span>
        <span>finished {syncRun.finished_at || "—"}</span>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-slate-500">{label}</span>
      <span className="text-lg font-semibold text-slate-100">{value}</span>
    </div>
  );
}
