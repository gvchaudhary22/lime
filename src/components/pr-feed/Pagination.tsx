import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  total: number;
  limit: number;
  offset: number;
  onChange: (offset: number) => void;
}

export default function Pagination({ total, limit, offset, onChange }: Props) {
  const start = total === 0 ? 0 : offset + 1;
  const end = Math.min(offset + limit, total);
  const prevDisabled = offset <= 0;
  const nextDisabled = offset + limit >= total;

  return (
    <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-3 text-xs text-slate-400">
      <div>
        Showing <span className="text-slate-200">{start}</span>–
        <span className="text-slate-200">{end}</span> of{" "}
        <span className="text-slate-200">{total}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={prevDisabled}
          onClick={() => onChange(Math.max(0, offset - limit))}
          className="inline-flex items-center gap-1 rounded border border-white/[0.06] px-2 py-1 text-slate-300 transition hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-3 w-3" />
          Prev
        </button>
        <button
          type="button"
          disabled={nextDisabled}
          onClick={() => onChange(offset + limit)}
          className="inline-flex items-center gap-1 rounded border border-white/[0.06] px-2 py-1 text-slate-300 transition hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
