"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Activity,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import { api, CubeAPMAlert } from "@/lib/api";

const severityConfig: Record<string, { color: string; bg: string }> = {
  critical: { color: "text-red-400", bg: "bg-red-500/20 border-red-500/30" },
  high: { color: "text-orange-400", bg: "bg-orange-500/20 border-orange-500/30" },
  medium: { color: "text-yellow-400", bg: "bg-yellow-500/20 border-yellow-500/30" },
  low: { color: "text-green-400", bg: "bg-green-500/20 border-green-500/30" },
};

const statusOptions = ["open", "assigned", "resolved", "ignored"];

export default function CubeAPMAlertsPage() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<CubeAPMAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [repoFilter, setRepoFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("mars_token");
    if (!token) {
      router.push("/");
      return;
    }
    fetchAlerts();
  }, [router]);

  useEffect(() => {
    fetchAlerts();
  }, [repoFilter]);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await api.listCubeAPMAlerts(repoFilter || undefined);
      if (res.success && res.data) setAlerts(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const triggerScan = async () => {
    setScanning(true);
    try {
      await api.triggerCubeAPMScan(repoFilter ? { repo_id: repoFilter } : undefined);
    } catch {
      // ignore
    } finally {
      setScanning(false);
      fetchAlerts();
    }
  };

  const updateStatus = async (id: string, status: string) => {
    await api.updateCubeAPMAlert(id, { status });
    fetchAlerts();
  };

  const severityColor = (s: string) => {
    const cfg = severityConfig[s];
    return cfg ? `${cfg.bg} ${cfg.color}` : "bg-slate-500/20 border-slate-500/30 text-slate-400";
  };

  const alertTypeLabel = (t: string) => {
    switch (t) {
      case "latency_spike": return "Latency Spike";
      case "error_rate": return "Error Rate";
      case "throughput_drop": return "Throughput Drop";
      case "slow_query": return "Slow Query";
      default: return t;
    }
  };

  const formatMetricValue = (alert: CubeAPMAlert) => {
    if (alert.alert_type === "error_rate") return `${alert.metric_value.toFixed(1)}%`;
    return `${alert.metric_value.toFixed(0)}ms`;
  };

  const repos = Array.from(new Set(alerts.map((a) => a.repo_id).filter(Boolean)));

  const activeAlerts = alerts.filter((a) => a.status !== "resolved" && a.status !== "ignored");
  const statsBySeverity = (sev: string) => activeAlerts.filter((a) => a.severity === sev).length;

  return (
    <div className="flex h-screen bg-[#0a0a0a]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Activity className="w-6 h-6 text-sky-400" />
                CubeAPM Alerts
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Performance anomaly detection across onboarded services
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Repo filter */}
              <select
                value={repoFilter}
                onChange={(e) => setRepoFilter(e.target.value)}
                className="bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-slate-300"
              >
                <option value="">All Repos</option>
                {repos.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <button
                onClick={fetchAlerts}
                className="px-3 py-2 bg-[#1a1a1a] border border-[#333] rounded-lg text-sm text-slate-300 hover:bg-[#222] flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
              <button
                onClick={triggerScan}
                disabled={scanning}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 rounded-lg text-sm text-white font-medium flex items-center gap-2 disabled:opacity-50"
              >
                {scanning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Activity className="w-4 h-4" />
                )}
                {scanning ? "Scanning..." : "Trigger Scan"}
              </button>
            </div>
          </div>

          {/* Scan status indicator */}
          {scanning && (
            <div className="mb-4 bg-sky-500/10 border border-sky-500/30 rounded-lg px-4 py-3 flex items-center gap-2 text-sky-300 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Scan in progress — detecting performance anomalies...
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {(["critical", "high", "medium", "low"] as const).map((sev) => {
              const count = statsBySeverity(sev);
              const cfg = severityConfig[sev];
              return (
                <div key={sev} className="bg-[#111] border border-[#222] rounded-xl p-4">
                  <div className={`text-sm capitalize ${cfg?.color || "text-slate-400"}`}>{sev}</div>
                  <div className="text-2xl font-bold text-white mt-1">{count}</div>
                </div>
              );
            })}
          </div>

          {/* Alerts Table */}
          <div className="bg-[#111] rounded-xl border border-[#222] overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
              </div>
            ) : alerts.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                No alerts found. Run a scan to detect performance anomalies.
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#222] text-gray-400 text-sm">
                    <th className="text-left p-4 w-8"></th>
                    <th className="text-left p-4">Service</th>
                    <th className="text-left p-4">Type</th>
                    <th className="text-left p-4">Endpoint</th>
                    <th className="text-left p-4">Value</th>
                    <th className="text-left p-4">Severity</th>
                    <th className="text-left p-4">Status</th>
                    <th className="text-left p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((alert) => (
                    <>
                      <tr
                        key={alert.id}
                        className="border-b border-[#1a1a1a] hover:bg-[#151515] cursor-pointer"
                        onClick={() =>
                          setExpandedId(expandedId === alert.id ? null : alert.id)
                        }
                      >
                        <td className="p-4 text-slate-500">
                          {expandedId === alert.id ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </td>
                        <td className="p-4 text-white font-medium">{alert.service_name}</td>
                        <td className="p-4 text-slate-300">{alertTypeLabel(alert.alert_type)}</td>
                        <td className="p-4 text-slate-400 text-sm max-w-[200px] truncate">
                          {alert.endpoint || "\u2014"}
                        </td>
                        <td className="p-4 text-white font-mono">{formatMetricValue(alert)}</td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-1 text-xs rounded-full border ${severityColor(alert.severity)}`}
                          >
                            {alert.severity}
                          </span>
                        </td>
                        <td className="p-4" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={alert.status}
                            onChange={(e) => updateStatus(alert.id, e.target.value)}
                            className="bg-[#1a1a1a] border border-[#333] rounded px-2 py-1 text-sm text-slate-300"
                          >
                            {statusOptions.map((s) => (
                              <option key={s} value={s}>
                                {s.charAt(0).toUpperCase() + s.slice(1)}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-4" onClick={(e) => e.stopPropagation()}>
                          {alert.sample_trace_id && (
                            <button className="text-sky-400 hover:text-sky-300 text-sm flex items-center gap-1">
                              <ExternalLink className="w-3 h-3" /> Trace
                            </button>
                          )}
                        </td>
                      </tr>
                      {expandedId === alert.id && (
                        <tr key={`${alert.id}-detail`} className="border-b border-[#1a1a1a]">
                          <td colSpan={8} className="p-0">
                            <div className="bg-[#0d0d0d] px-8 py-5 space-y-3">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-slate-500">Service:</span>{" "}
                                  <span className="text-white">{alert.service_name}</span>
                                </div>
                                <div>
                                  <span className="text-slate-500">Alert Type:</span>{" "}
                                  <span className="text-white">{alertTypeLabel(alert.alert_type)}</span>
                                </div>
                                <div>
                                  <span className="text-slate-500">Endpoint:</span>{" "}
                                  <span className="text-white font-mono text-xs">
                                    {alert.endpoint || "N/A"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-500">Metric Value:</span>{" "}
                                  <span className="text-white font-mono">
                                    {formatMetricValue(alert)}
                                  </span>
                                </div>
                                {alert.threshold && (
                                  <div>
                                    <span className="text-slate-500">Threshold:</span>{" "}
                                    <span className="text-white font-mono">{alert.threshold}</span>
                                  </div>
                                )}
                                {alert.sample_trace_id && (
                                  <div>
                                    <span className="text-slate-500">Trace ID:</span>{" "}
                                    <span className="text-sky-400 font-mono text-xs">
                                      {alert.sample_trace_id}
                                    </span>
                                  </div>
                                )}
                                {alert.repo_id && (
                                  <div>
                                    <span className="text-slate-500">Repo ID:</span>{" "}
                                    <span className="text-white">{alert.repo_id}</span>
                                  </div>
                                )}
                                {alert.detected_at && (
                                  <div>
                                    <span className="text-slate-500">Detected At:</span>{" "}
                                    <span className="text-white">
                                      {new Date(alert.detected_at).toLocaleString()}
                                    </span>
                                  </div>
                                )}
                              </div>
                              {alert.description && (
                                <div className="text-sm">
                                  <span className="text-slate-500">Description:</span>
                                  <p className="text-slate-300 mt-1">{alert.description}</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
