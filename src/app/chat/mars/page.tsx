"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Package,
  Play,
  Zap,
  GitBranch,
  Globe,
  RefreshCw,
  Download,
  Trash2,
  ChevronRight,
  Loader2,
  CheckCircle,
  AlertCircle,
  Terminal,
  Activity,
  Search,
  Box,
  Cpu,
  FileText,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import {
  api,
  MarsPackage,
  MarsWaveResponse,
  MarsForgeResponse,
  MarsPromoteResponse,
  MarsNexusResponse,
  MarsStateHistoryResponse,
  MarsSyncResponse,
} from "@/lib/api";

type Tab = "packages" | "commands" | "state" | "registry";
type PackageFilter = "all" | "agent" | "skill" | "command" | "workflow";

interface ProjectOption {
  id: string;
  name: string;
}

interface CommandResult {
  ok: boolean;
  message: string;
  detail?: string;
}

export default function MarsRuntimePage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("packages");
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProject, setSelectedProject] = useState("");

  // Packages tab
  const [packages, setPackages] = useState<MarsPackage[]>([]);
  const [pkgFilter, setPkgFilter] = useState<PackageFilter>("all");
  const [pkgSearch, setPkgSearch] = useState("");
  const [pkgLoading, setPkgLoading] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);

  // Commands tab
  const [waveObjective, setWaveObjective] = useState("");
  const [forgeDesc, setForgeDesc] = useState("");
  const [forgeSkills, setForgeSkills] = useState("");
  const [promotePackage, setPromotePackage] = useState("");
  const [nexusTargets, setNexusTargets] = useState("");
  const [nexusObjective, setNexusObjective] = useState("");
  const [cmdRunning, setCmdRunning] = useState<string | null>(null);
  const [cmdResult, setCmdResult] = useState<CommandResult | null>(null);

  // State tab
  const [stateData, setStateData] = useState<MarsStateHistoryResponse | null>(null);
  const [stateLoading, setStateLoading] = useState(false);

  // Registry tab
  const [syncResult, setSyncResult] = useState<MarsSyncResponse | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("mars_token");
    if (!token) { router.push("/"); return; }
    fetchProjects();
    fetchPackages();
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchPackages();
  }, [pkgFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedProject && tab === "state") fetchState();
  }, [selectedProject, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchProjects = async () => {
    const res = await api.getProjects();
    if (res.success && res.data) {
      const opts = res.data.map((p) => ({ id: p.id, name: p.name }));
      setProjects(opts);
      if (opts.length > 0) setSelectedProject(opts[0].id);
    }
  };

  const fetchPackages = async () => {
    setPkgLoading(true);
    const res = await api.marsListPackages(
      pkgFilter === "all" ? undefined : pkgFilter,
      false
    );
    if (res.success && res.data) setPackages(res.data);
    setPkgLoading(false);
  };

  const fetchState = async () => {
    if (!selectedProject) return;
    setStateLoading(true);
    const res = await api.marsGetState(selectedProject);
    if (res.success && res.data) setStateData(res.data);
    setStateLoading(false);
  };

  const handleInstall = async (pkg: MarsPackage) => {
    if (!selectedProject) return;
    setInstalling(pkg.name);
    const res = await api.marsInstallPackage({
      project_id: selectedProject,
      package_name: pkg.name,
      userland: false,
    });
    setInstalling(null);
    if (res.success) {
      setCmdResult({ ok: true, message: `Installed ${pkg.name} → .claude/${pkg.type}s/${pkg.name}.md` });
    } else {
      setCmdResult({ ok: false, message: res.error || "Install failed" });
    }
  };

  const runCommand = async (cmd: string, fn: () => Promise<{ ok: boolean; message: string; detail?: string }>) => {
    setCmdRunning(cmd);
    setCmdResult(null);
    const result = await fn();
    setCmdResult(result);
    setCmdRunning(null);
  };

  const handleWave = () =>
    runCommand("wave", async () => {
      if (!selectedProject || !waveObjective.trim()) return { ok: false, message: "Project and objective required" };
      const res = await api.marsCommandWave({ project_id: selectedProject, objective: waveObjective });
      if (res.success && res.data) {
        const d = res.data as MarsWaveResponse;
        return { ok: true, message: `Wave dispatched`, detail: `wave_id: ${d.wave_id} | status: ${d.status}` };
      }
      return { ok: false, message: res.error || "Wave failed" };
    });

  const handleForge = () =>
    runCommand("forge", async () => {
      if (!selectedProject || !forgeDesc.trim()) return { ok: false, message: "Project and description required" };
      const skills = forgeSkills.split(",").map((s) => s.trim()).filter(Boolean);
      const res = await api.marsCommandForge({ project_id: selectedProject, description: forgeDesc, skills });
      if (res.success && res.data) {
        const d = res.data as MarsForgeResponse;
        return { ok: true, message: `Agent forged: ${d.package_name}`, detail: d.message };
      }
      return { ok: false, message: res.error || "Forge failed" };
    });

  const handlePromote = () =>
    runCommand("promote", async () => {
      if (!promotePackage.trim()) return { ok: false, message: "Package name required" };
      const res = await api.marsCommandPromote({ package_name: promotePackage });
      if (res.success && res.data) {
        const d = res.data as MarsPromoteResponse;
        return { ok: true, message: d.message };
      }
      return { ok: false, message: res.error || "Promote failed" };
    });

  const handleNexus = () =>
    runCommand("nexus", async () => {
      if (!selectedProject || !nexusObjective.trim()) return { ok: false, message: "Lead project and objective required" };
      const targets = nexusTargets.split(",").map((s) => s.trim()).filter(Boolean);
      const res = await api.marsCommandNexus({
        lead_project_id: selectedProject,
        target_project_ids: targets,
        objective: nexusObjective,
      });
      if (res.success && res.data) {
        const d = res.data as MarsNexusResponse;
        return { ok: true, message: `Nexus dispatched`, detail: `nexus_id: ${d.nexus_operation_id} | waves: ${d.wave_ids?.length ?? 0}` };
      }
      return { ok: false, message: res.error || "Nexus failed" };
    });

  const handleStatus = () =>
    runCommand("status", async () => {
      if (!selectedProject) return { ok: false, message: "Select a project" };
      const res = await api.marsCommandStatus(selectedProject);
      if (res.success && res.data) {
        return { ok: true, message: `Phase: ${res.data.phase}`, detail: `project_id: ${res.data.project_id}` };
      }
      return { ok: false, message: res.error || "Status failed" };
    });

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    const res = await api.marsSyncPackages();
    if (res.success && res.data) setSyncResult(res.data);
    setSyncing(false);
    fetchPackages();
  };

  const filteredPackages = packages.filter((p) =>
    pkgSearch === "" ||
    p.name.toLowerCase().includes(pkgSearch.toLowerCase()) ||
    p.description.toLowerCase().includes(pkgSearch.toLowerCase())
  );

  const typeIcon = (type: string) => {
    if (type === "agent") return <Cpu className="w-3.5 h-3.5" />;
    if (type === "skill") return <Zap className="w-3.5 h-3.5" />;
    if (type === "command") return <Terminal className="w-3.5 h-3.5" />;
    return <Box className="w-3.5 h-3.5" />;
  };

  const typeColor = (type: string) => {
    if (type === "agent") return "bg-purple-500/10 text-purple-400 border-purple-500/20";
    if (type === "skill") return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    if (type === "command") return "bg-green-500/10 text-green-400 border-green-500/20";
    return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "packages", label: "Packages", icon: <Package className="w-4 h-4" /> },
    { id: "commands", label: "Commands", icon: <Play className="w-4 h-4" /> },
    { id: "state", label: "State", icon: <Activity className="w-4 h-4" /> },
    { id: "registry", label: "Registry", icon: <RefreshCw className="w-4 h-4" /> },
  ];

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Globe className="w-5 h-5 text-orange-400" />
              MARS Runtime
            </h1>
            <p className="text-xs text-white/40 mt-0.5">
              Package manager · Command surface · Orchestration control panel
            </p>
          </div>
          {/* Project selector */}
          <select
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white/80 focus:outline-none focus:border-orange-500/50"
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
          >
            <option value="">Select project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Tabs */}
        <div className="border-b border-white/5 px-6 flex gap-1 pt-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-t transition-colors ${
                tab === t.id
                  ? "text-orange-400 border-b-2 border-orange-400 bg-orange-400/5"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
          <div className="ml-auto pb-2 flex items-center gap-1 text-xs text-white/30">
            <span>{packages.length} packages synced</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">

          {/* ── Packages Tab ── */}
          {tab === "packages" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {/* Type filter */}
                <div className="flex gap-1">
                  {(["all", "agent", "skill", "command", "workflow"] as PackageFilter[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setPkgFilter(f)}
                      className={`px-3 py-1 rounded-full text-xs capitalize transition-colors ${
                        pkgFilter === f
                          ? "bg-orange-500 text-white"
                          : "bg-white/5 text-white/50 hover:bg-white/10"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-orange-500/50"
                    placeholder="Search packages…"
                    value={pkgSearch}
                    onChange={(e) => setPkgSearch(e.target.value)}
                  />
                </div>
                <button
                  onClick={fetchPackages}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${pkgLoading ? "animate-spin" : ""}`} />
                </button>
              </div>

              {pkgLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-white/30" />
                </div>
              ) : filteredPackages.length === 0 ? (
                <div className="text-center py-12 text-white/30">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No packages found. Run a registry sync first.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredPackages.map((pkg) => (
                    <div
                      key={pkg.id}
                      className="bg-white/3 border border-white/6 rounded-xl p-4 hover:border-white/12 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs border ${typeColor(pkg.type)}`}>
                              {typeIcon(pkg.type)}
                              {pkg.type}
                            </span>
                            {pkg.is_core && (
                              <span className="px-1.5 py-0.5 rounded text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20">
                                core
                              </span>
                            )}
                          </div>
                          <p className="font-medium text-sm truncate">{pkg.name}</p>
                          <p className="text-xs text-white/40 mt-0.5 line-clamp-2">{pkg.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-xs text-white/25">v{pkg.version}</span>
                        <button
                          disabled={!selectedProject || installing === pkg.name}
                          onClick={() => handleInstall(pkg)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {installing === pkg.name ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Download className="w-3 h-3" />
                          )}
                          Install
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Install result toast */}
              {cmdResult && (
                <div className={`fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm ${
                  cmdResult.ok ? "bg-green-500/10 border border-green-500/30 text-green-400" : "bg-red-500/10 border border-red-500/30 text-red-400"
                }`}>
                  {cmdResult.ok ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {cmdResult.message}
                  <button onClick={() => setCmdResult(null)} className="ml-2 opacity-50 hover:opacity-100">×</button>
                </div>
              )}
            </div>
          )}

          {/* ── Commands Tab ── */}
          {tab === "commands" && (
            <div className="max-w-2xl space-y-4">
              {/* Result banner */}
              {cmdResult && (
                <div className={`flex items-start gap-3 p-4 rounded-xl border text-sm ${
                  cmdResult.ok ? "bg-green-500/8 border-green-500/20 text-green-300" : "bg-red-500/8 border-red-500/20 text-red-300"
                }`}>
                  {cmdResult.ok ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                  <div>
                    <p className="font-medium">{cmdResult.message}</p>
                    {cmdResult.detail && <p className="text-xs mt-0.5 opacity-60 font-mono">{cmdResult.detail}</p>}
                  </div>
                  <button onClick={() => setCmdResult(null)} className="ml-auto opacity-40 hover:opacity-70">×</button>
                </div>
              )}

              {/* Wave */}
              <CommandCard
                icon={<Zap className="w-4 h-4 text-yellow-400" />}
                title="/mars:wave"
                description="Dispatch parallel subagents to work on an objective for the selected project."
                running={cmdRunning === "wave"}
                onRun={handleWave}
              >
                <textarea
                  rows={2}
                  placeholder="Objective — e.g. Fix the rate limiter on carrier API calls"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-orange-500/50 resize-none"
                  value={waveObjective}
                  onChange={(e) => setWaveObjective(e.target.value)}
                />
              </CommandCard>

              {/* Forge */}
              <CommandCard
                icon={<Cpu className="w-4 h-4 text-purple-400" />}
                title="/mars:forge"
                description="Create a new agent tailored to a specific task. Stored as a userland package."
                running={cmdRunning === "forge"}
                onRun={handleForge}
              >
                <input
                  placeholder="Description — e.g. An agent that reviews DB migrations"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-orange-500/50"
                  value={forgeDesc}
                  onChange={(e) => setForgeDesc(e.target.value)}
                />
                <input
                  placeholder="Skills (comma-separated, optional) — e.g. db-patterns, safety-context"
                  className="w-full mt-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-orange-500/50"
                  value={forgeSkills}
                  onChange={(e) => setForgeSkills(e.target.value)}
                />
              </CommandCard>

              {/* Promote */}
              <CommandCard
                icon={<ChevronRight className="w-4 h-4 text-green-400" />}
                title="/mars:promote"
                description="Promote a userland agent to core status. Requires 85% success rate."
                running={cmdRunning === "promote"}
                onRun={handlePromote}
              >
                <input
                  placeholder="Package name — e.g. my-forged-agent"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-orange-500/50"
                  value={promotePackage}
                  onChange={(e) => setPromotePackage(e.target.value)}
                />
              </CommandCard>

              {/* Nexus */}
              <CommandCard
                icon={<GitBranch className="w-4 h-4 text-blue-400" />}
                title="/mars:nexus"
                description="Orchestrate multiple repos simultaneously. Lead project + target project IDs."
                running={cmdRunning === "nexus"}
                onRun={handleNexus}
              >
                <input
                  placeholder="Target project IDs (comma-separated)"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-orange-500/50"
                  value={nexusTargets}
                  onChange={(e) => setNexusTargets(e.target.value)}
                />
                <textarea
                  rows={2}
                  placeholder="Objective — same task dispatched to all repos"
                  className="w-full mt-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-orange-500/50 resize-none"
                  value={nexusObjective}
                  onChange={(e) => setNexusObjective(e.target.value)}
                />
              </CommandCard>

              {/* Status */}
              <CommandCard
                icon={<Activity className="w-4 h-4 text-orange-400" />}
                title="/mars:status"
                description="Get the current STATE.md phase for the selected project."
                running={cmdRunning === "status"}
                onRun={handleStatus}
              />
            </div>
          )}

          {/* ── State Tab ── */}
          {tab === "state" && (
            <div className="space-y-4 max-w-3xl">
              <div className="flex items-center gap-3">
                <button
                  onClick={fetchState}
                  disabled={!selectedProject || stateLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 disabled:opacity-40 text-sm transition-colors"
                >
                  {stateLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Refresh STATE.md
                </button>
              </div>

              {stateLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-white/30" />
                </div>
              ) : !stateData ? (
                <div className="text-center py-12 text-white/30">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No state found. Select a project and refresh.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Current state */}
                  {stateData.current && (
                    <div className="bg-white/3 border border-white/6 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium">Current STATE.md</h3>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20">
                            {stateData.current.phase}
                          </span>
                          <span className="text-xs text-white/25 font-mono">{stateData.current.checksum.slice(0, 12)}…</span>
                        </div>
                      </div>
                      <pre className="text-xs text-white/60 bg-black/30 rounded-lg p-3 overflow-auto max-h-48 font-mono whitespace-pre-wrap">
                        {stateData.current.content}
                      </pre>
                      <p className="text-xs text-white/25 mt-2">
                        Updated {new Date(stateData.current.created_at).toLocaleString()}
                      </p>
                    </div>
                  )}

                  {/* History */}
                  {stateData.history && stateData.history.length > 1 && (
                    <div className="bg-white/3 border border-white/6 rounded-xl p-4">
                      <h3 className="text-sm font-medium mb-3">Snapshot History</h3>
                      <div className="space-y-2">
                        {stateData.history.slice(0, 10).map((snap, i) => (
                          <div key={snap.id} className="flex items-center gap-3 text-xs text-white/50">
                            <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[10px]">{i + 1}</span>
                            <span className="font-mono text-white/30">{snap.checksum.slice(0, 10)}…</span>
                            <span className="px-1.5 py-0.5 rounded bg-white/5 text-white/40">{snap.phase}</span>
                            <span className="ml-auto">{new Date(snap.created_at).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Registry Tab ── */}
          {tab === "registry" && (
            <div className="max-w-lg space-y-4">
              <div className="bg-white/3 border border-white/6 rounded-xl p-5">
                <h3 className="font-medium mb-1">Registry Sync</h3>
                <p className="text-sm text-white/40 mb-4">
                  Pull all packages from <code className="text-orange-400 text-xs">MARS_REGISTRY_PATH</code> (mars.registry.json) into the database.
                  Packages whose content is unchanged are skipped automatically.
                </p>
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm hover:bg-orange-600 disabled:opacity-50 transition-colors"
                >
                  {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {syncing ? "Syncing…" : "Sync from Registry"}
                </button>
                {syncResult && (
                  <div className="mt-4 p-3 rounded-lg bg-green-500/8 border border-green-500/20 text-sm text-green-300">
                    <p className="font-medium">{syncResult.message}</p>
                    <p className="text-xs mt-1 text-green-400/60">
                      {syncResult.synced} synced · {syncResult.skipped} skipped (unchanged)
                    </p>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                {(["agent", "skill", "command", "workflow"] as const).map((type) => {
                  const count = packages.filter((p) => p.type === type).length;
                  return (
                    <div key={type} className={`flex items-center gap-3 p-4 rounded-xl border ${typeColor(type)} bg-opacity-5`}>
                      <div className={`p-2 rounded-lg border ${typeColor(type)}`}>
                        {typeIcon(type)}
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{count}</p>
                        <p className="text-xs capitalize opacity-60">{type}s</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-white/3 border border-white/6 rounded-xl p-4 text-xs text-white/40 space-y-1 font-mono">
                <p className="text-white/60 font-sans text-sm font-medium mb-2">Environment</p>
                <p>MARS_REGISTRY_PATH=./mars.registry.json</p>
                <p>MARS_SYNC_INTERVAL_HOURS=24</p>
                <p>MARS_CORE_INSTALL_PATH=.claude</p>
                <p>MARS_USERLAND_PATH=.mars</p>
                <p>FF_MARS_RUNTIME_ENABLED=true</p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ── CommandCard sub-component ──
function CommandCard({
  icon,
  title,
  description,
  running,
  onRun,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  running: boolean;
  onRun: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-white/3 border border-white/6 rounded-xl p-4 hover:border-white/10 transition-colors">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-white/5">{icon}</div>
          <div>
            <p className="font-mono text-sm font-medium">{title}</p>
            <p className="text-xs text-white/40">{description}</p>
          </div>
        </div>
        <button
          onClick={onRun}
          disabled={running}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 disabled:opacity-40 text-xs transition-colors"
        >
          {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
          Run
        </button>
      </div>
      {children && <div className="space-y-0">{children}</div>}
    </div>
  );
}
