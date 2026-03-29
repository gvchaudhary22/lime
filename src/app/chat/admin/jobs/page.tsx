"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface JobInfo {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  enabled_by: string;
  schedule: string;
  can_run: boolean;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningJob, setRunningJob] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  const loadJobs = async () => {
    setLoading(true);
    const res = await api.listJobs();
    if (res.success && res.data) setJobs(res.data);
    setLoading(false);
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const handleRun = async (jobId: string) => {
    setRunningJob(jobId);
    setRunResult(null);
    try {
      const res = await api.runJob(jobId);
      if (res.success) {
        setRunResult({ id: jobId, success: true, message: "Job triggered successfully. Running in background." });
      } else {
        setRunResult({ id: jobId, success: false, message: res.error || "Failed to trigger job" });
      }
    } catch {
      setRunResult({ id: jobId, success: false, message: "Network error" });
    }
    setRunningJob(null);
  };

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-white mb-1">Background Jobs</h1>
      <p className="text-sm text-slate-400 mb-6">
        Scheduled background processes that keep MARS data fresh and learning loops active
      </p>

      {loading ? (
        <p className="text-slate-400 text-sm">Loading jobs...</p>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="bg-slate-800/50 border border-slate-700 rounded-lg p-5"
            >
              {/* Header row */}
              <div className="flex items-start gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-semibold text-base">{job.name}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        job.enabled
                          ? "bg-green-900/40 text-green-300 border border-green-700/50"
                          : "bg-red-900/30 text-red-400 border border-red-700/50"
                      }`}
                    >
                      {job.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">{job.description}</p>
                </div>

                {/* Run button */}
                <div className="shrink-0">
                  {job.can_run ? (
                    <button
                      onClick={() => handleRun(job.id)}
                      disabled={runningJob === job.id || !job.enabled}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        job.enabled
                          ? "bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50"
                          : "bg-slate-700 text-slate-500 cursor-not-allowed"
                      }`}
                    >
                      {runningJob === job.id ? "Triggering..." : "Run Now"}
                    </button>
                  ) : (
                    <span className="text-xs text-slate-500 italic">Auto-trigger only</span>
                  )}
                </div>
              </div>

              {/* Details row */}
              <div className="flex items-center gap-6 text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600">Schedule:</span>
                  <span className="text-slate-400">{job.schedule}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600">Controlled by:</span>
                  <code className="text-slate-400 bg-slate-900/50 px-1.5 py-0.5 rounded text-xs">
                    {job.enabled_by}
                  </code>
                </div>
              </div>

              {/* Run result feedback */}
              {runResult && runResult.id === job.id && (
                <div
                  className={`mt-3 text-sm px-3 py-2 rounded ${
                    runResult.success
                      ? "bg-green-900/20 text-green-300 border border-green-700/30"
                      : "bg-red-900/20 text-red-300 border border-red-700/30"
                  }`}
                >
                  {runResult.message}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
