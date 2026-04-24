interface PageProps {
  params: { prId: string };
}

export default function PrFeedDetailPage({ params }: PageProps) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-[#0a0f1e] p-8">
      <h1 className="text-xl font-semibold text-slate-100">
        PR #{params.prId}
      </h1>
      <p className="mt-2 text-sm text-slate-400">
        Detail page scaffold — header, sync_run summary, impacts table, and
        drawer arrive in Wave 2B.
      </p>
    </div>
  );
}
