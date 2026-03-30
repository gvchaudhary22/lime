"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  Loader2,
  ArrowUpCircle,
  History,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import {
  api,
  InfraVersionResponse,
  PropagationStatusResponse,
  RepoPropagationState,
  InfraUpdateResponse,
} from "@/lib/api";

type Tab = "status" | "versions";

export default function InfraPropagationPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("status");
  const [loading, setLoading] = useState(false);

  // Status tab state
  const [status, setStatus] = useState<PropagationStatusResponse | null>(null);
  const [propagating, setPropagating] = useState<Record<string, boolean>>({});
  const [propagatingAll, setPropagatingAll] = useState(false);

  // Versions tab state
  const [versions, setVersions] = useState<InfraVersionResponse[]>([]);
  const [bumpDesc, setBumpDesc] = useState("");
  const [bumping, setBumping] = useState(false);

  // History modal
  const [historyRepo, setHistoryRepo] = useState<string | null>(null);
  const [historyRepoName, setHistoryRepoName] = useState("");
  const [history, setHistory] = useState<InfraUpdateResponse[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("mars_token");
    if (!token) {
      router.push("/");
      return;
    }
    fetchData();
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchData();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    setLoading(true);
    if (tab === "status") {
      const res = await api.getInfraStatus();
      if (res.success && res.data) setStatus(res.data);
    } else {
      const res = await api.getInfraVersions();
      if (res.success && res.data) setVersions(res.data);
    }
    setLoading(false);
  };

  const handleBumpVersion = async () => {
    if (!bumpDesc.trim()) return;
    setBumping(true);
    const res = await api.bumpInfraVersion({ description: bumpDesc.trim() });
    if (res.success) {
      setBumpDesc("");
      fetchData();
    }
    setBumping(false);
  };

  const handlePropagate = async (repoId: string) => {
    setPropagating((prev) => ({ ...prev, [repoId]: true }));
    await api.propagateToRepo(repoId);
    setPropagating((prev) => ({ ...prev, [repoId]: false }));
    fetchData();
  };

  const handlePropagateAll = async () => {
    setPropagatingAll(true);
    await api.propagateToAll();
    setPropagatingAll(false);
    fetchData();
  };

  const openHistory = async (repo: RepoPropagationState) => {
    setHistoryRepo(repo.repo_id);
    setHistoryRepoName(repo.repo_name);
    setHistoryLoading(true);
    const res = await api.getInfraHistory(repo.repo_id);
    if (res.success && res.data) setHistory(res.data);
    setHistoryLoading(false);
  };

  const statusIcon = (s: string) => {
    switch (s) {
      case "completed":
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-400" />;
      case "running":
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const staleCount =
    status?.repos?.filter((r) => r.needs_update).length ?? 0;

  return (
    <div className="flex h-screen bg-[#0a0a0a]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">
                Infrastructure Propagation
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                Manage AI infrastructure template versions and propagate
                updates to onboarded repositories
              </p>
            </div>
            <button
              onClick={fetchData}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-[#111] rounded-lg p-1 w-fit">
            {(["status", "versions"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  tab === t
                    ? "bg-[#1a1a2e] text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {t === "status" ? "Repo Status" : "Version History"}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
          ) : tab === "status" ? (
            <div>
              {/* Summary bar */}
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-[#111] rounded-lg px-4 py-2 text-sm">
                  <span className="text-gray-400">Template Version: </span>
                  <span className="text-white font-mono font-bold">
                    v{status?.latest_version ?? 0}
                  </span>
                </div>
                <div className="bg-[#111] rounded-lg px-4 py-2 text-sm">
                  <span className="text-gray-400">Repos: </span>
                  <span className="text-white font-bold">
                    {status?.repos?.length ?? 0}
                  </span>
                </div>
                {staleCount > 0 && (
                  <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg px-4 py-2 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-400" />
                    <span className="text-yellow-300">
                      {staleCount} repo{staleCount > 1 ? "s" : ""} need
                      {staleCount === 1 ? "s" : ""} update
                    </span>
                  </div>
                )}
                {staleCount > 0 && (
                  <button
                    onClick={handlePropagateAll}
                    disabled={propagatingAll}
                    className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {propagatingAll ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowUpCircle className="w-4 h-4" />
                    )}
                    Update All
                  </button>
                )}
              </div>

              {/* Repos table */}
              <div className="bg-[#111] rounded-xl border border-[#222] overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#222] text-gray-400 text-sm">
                      <th className="text-left p-4">Repository</th>
                      <th className="text-center p-4">Current</th>
                      <th className="text-center p-4">Latest</th>
                      <th className="text-center p-4">Status</th>
                      <th className="text-center p-4">Last Synced</th>
                      <th className="text-right p-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status?.repos?.map((repo) => (
                      <tr
                        key={repo.repo_id}
                        className={`border-b border-[#1a1a1a] ${
                          repo.needs_update ? "bg-yellow-900/10" : ""
                        }`}
                      >
                        <td className="p-4 text-white font-medium">
                          {repo.repo_name}
                        </td>
                        <td className="p-4 text-center">
                          <span className="font-mono text-gray-300">
                            v{repo.infra_version}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span className="font-mono text-gray-300">
                            v{repo.latest_version}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span className="flex items-center justify-center gap-1.5">
                            {repo.needs_update ? (
                              <>
                                <AlertCircle className="w-4 h-4 text-yellow-400" />
                                <span className="text-yellow-300 text-sm">
                                  Stale
                                </span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-4 h-4 text-green-400" />
                                <span className="text-green-300 text-sm">
                                  Current
                                </span>
                              </>
                            )}
                          </span>
                        </td>
                        <td className="p-4 text-center text-gray-400 text-sm">
                          {repo.last_synced
                            ? new Date(repo.last_synced).toLocaleDateString()
                            : "Never"}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openHistory(repo)}
                              className="p-1.5 text-gray-400 hover:text-white transition-colors"
                              title="View history"
                            >
                              <History className="w-4 h-4" />
                            </button>
                            {repo.needs_update && (
                              <button
                                onClick={() => handlePropagate(repo.repo_id)}
                                disabled={propagating[repo.repo_id]}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-md text-sm transition-colors"
                              >
                                {propagating[repo.repo_id] ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <ArrowUpCircle className="w-3.5 h-3.5" />
                                )}
                                Update
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(!status?.repos || status.repos.length === 0) && (
                      <tr>
                        <td
                          colSpan={6}
                          className="p-8 text-center text-gray-500"
                        >
                          No onboarded repositories found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div>
              {/* Bump version form */}
              <div className="bg-[#111] rounded-xl border border-[#222] p-4 mb-6">
                <h3 className="text-white font-medium mb-3">
                  Bump Template Version
                </h3>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={bumpDesc}
                    onChange={(e) => setBumpDesc(e.target.value)}
                    placeholder="Describe what changed (e.g., 'Added new security rules')"
                    className="flex-1 bg-[#0a0a0a] border border-[#333] rounded-lg px-4 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handleBumpVersion}
                    disabled={bumping || !bumpDesc.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {bumping ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowUpCircle className="w-4 h-4" />
                    )}
                    Bump
                  </button>
                </div>
              </div>

              {/* Version history */}
              <div className="space-y-3">
                {versions.map((v) => (
                  <div
                    key={v.version}
                    className="bg-[#111] rounded-xl border border-[#222] p-4 flex items-center gap-4"
                  >
                    <div className="bg-blue-600/20 text-blue-400 font-mono font-bold text-sm px-3 py-1 rounded-lg">
                      v{v.version}
                    </div>
                    <div className="flex-1">
                      <p className="text-white text-sm">{v.description}</p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {new Date(v.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
                {versions.length === 0 && (
                  <div className="text-center text-gray-500 py-12">
                    No template versions yet. Bump the first version above.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* History modal */}
          {historyRepo && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
              <div className="bg-[#111] rounded-xl border border-[#222] w-full max-w-2xl max-h-[70vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b border-[#222]">
                  <h3 className="text-white font-medium">
                    Update History &mdash; {historyRepoName}
                  </h3>
                  <button
                    onClick={() => setHistoryRepo(null)}
                    className="text-gray-400 hover:text-white"
                  >
                    &times;
                  </button>
                </div>
                <div className="p-4">
                  {historyLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                    </div>
                  ) : history.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">
                      No propagation history
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {history.map((h) => (
                        <div
                          key={h.id}
                          className="bg-[#0a0a0a] rounded-lg p-3 flex items-start gap-3"
                        >
                          {statusIcon(h.status)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-white text-sm font-medium">
                                v{h.from_version} &rarr; v{h.to_version}
                              </span>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full ${
                                  h.status === "completed"
                                    ? "bg-green-900/30 text-green-400"
                                    : h.status === "failed"
                                    ? "bg-red-900/30 text-red-400"
                                    : "bg-blue-900/30 text-blue-400"
                                }`}
                              >
                                {h.status}
                              </span>
                            </div>
                            {h.files_updated > 0 && (
                              <p className="text-gray-400 text-xs mt-1">
                                {h.files_updated} files updated
                              </p>
                            )}
                            {h.error_message && (
                              <p className="text-red-400 text-xs mt-1">
                                {h.error_message}
                              </p>
                            )}
                            {h.completed_at && (
                              <p className="text-gray-500 text-xs mt-1">
                                {new Date(h.completed_at).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
