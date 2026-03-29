"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  Settings2,
  Key,
  Upload,
  Trash2,
  Eye,
  ExternalLink,
  Loader2,
  Save,
  Shield,
  Activity,
  DollarSign,
  FolderOpen,
  Bot,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import FileEditor from "@/components/project/FileEditor";
import {
  api,
  ProjectDetail,
  ProjectFile,
  ServiceConfig,
  Capability,
  ReadinessResult,
  OnboardingArtifact,
  RepositoryAgent,
  OnboardingStatusResponse,
} from "@/lib/api";
import { Globe, CheckCircle, XCircle, RefreshCw } from "lucide-react";

type Tab = "files" | "onboarding" | "agents" | "services" | "settings" | "governance";

const ALL_SERVICES = [
  { type: "development", label: "Development", description: "Development environment and tools" },
  { type: "code_intelligence", label: "Code Intelligence", description: "AI-powered code analysis and suggestions" },
  { type: "jira", label: "Jira", description: "Jira project management integration", fields: [{ key: "url", label: "Jira URL" }, { key: "project_key", label: "Project Key" }] },
  { type: "monitoring", label: "Monitoring", description: "Application monitoring and alerting", fields: [{ key: "url", label: "Monitoring URL" }] },
  { type: "slack", label: "Slack", description: "Slack notifications and alerts", fields: [{ key: "webhook_url", label: "Webhook URL" }, { key: "channel", label: "Channel" }] },
  { type: "telegram", label: "Telegram", description: "Telegram bot notifications", fields: [{ key: "bot_token", label: "Bot Token" }, { key: "chat_id", label: "Chat ID" }] },
  { type: "elk", label: "ELK", description: "Elasticsearch, Logstash, Kibana logs", fields: [{ key: "url", label: "ELK URL" }, { key: "index", label: "Index Path" }] },
];

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("files");
  const [uploading, setUploading] = useState(false);

  // File editor state
  const [editingFile, setEditingFile] = useState<{
    id: string;
    name: string;
    content: string;
  } | null>(null);

  // Services state
  const [serviceStates, setServiceStates] = useState<
    Record<string, { enabled: boolean; config: Record<string, string> }>
  >({});
  const [savingServices, setSavingServices] = useState(false);
  const [servicesSaved, setServicesSaved] = useState(false);

  // QA env URL state
  const [qaEnvUrl, setQaEnvUrl] = useState("");
  const [savingQaEnv, setSavingQaEnv] = useState(false);
  const [qaEnvSaveResult, setQaEnvSaveResult] = useState<{ verified: boolean; message: string } | null>(null);

  // v1.1 state
  const [repoId, setRepoId] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [backendURL, setBackendURL] = useState("");
  const [validatingHealth, setValidatingHealth] = useState(false);

  // Onboarding artifacts state
  const [artifacts, setArtifacts] = useState<OnboardingArtifact[]>([]);
  const [artifactsLoading, setArtifactsLoading] = useState(false);
  const [artifactsLoaded, setArtifactsLoaded] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState<{ path: string; content: string } | null>(null);
  const [artifactContentLoading, setArtifactContentLoading] = useState(false);

  // Agents state
  const [agents, setAgents] = useState<RepositoryAgent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agentsLoaded, setAgentsLoaded] = useState(false);

  // Onboarding status bar state
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("mars_token");
    if (!token) {
      router.push("/");
      return;
    }
    fetchProject();
  }, [projectId, router]);

  // Initialize service states when project loads
  useEffect(() => {
    if (!project) return;
    const states: Record<string, { enabled: boolean; config: Record<string, string> }> = {};
    for (const svc of ALL_SERVICES) {
      const existing = project.services?.find((s) => s.service_type === svc.type);
      states[svc.type] = {
        enabled: existing?.is_enabled ?? false,
        config: (existing?.config as Record<string, string>) ?? {},
      };
    }
    setServiceStates(states);
  }, [project]);

  // Auto-poll onboarding status when running
  useEffect(() => {
    if (onboardingStatus?.status === "running") {
      const interval = setInterval(fetchOnboardingStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [onboardingStatus?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchProject = async () => {
    const res = await api.getProjectDetail(projectId);
    if (res.success && res.data) {
      setProject(res.data);
      setQaEnvUrl(res.data.qa_env_url || "");
    }
    setLoading(false);
    fetchOnboardingStatus();
  };

  const fetchOnboardingStatus = async () => {
    setStatusLoading(true);
    const res = await api.getOnboardingStatus(projectId);
    if (res.success && res.data) {
      setOnboardingStatus(res.data);
    }
    setStatusLoading(false);
  };

  const handleSaveQaEnvUrl = async () => {
    if (!qaEnvUrl.trim()) return;
    setSavingQaEnv(true);
    setQaEnvSaveResult(null);
    const res = await api.updateQaEnvUrl(projectId, qaEnvUrl.trim());
    setSavingQaEnv(false);
    if (res.success && res.data) {
      setQaEnvSaveResult({
        verified: res.data.qa_env_verified,
        message: res.data.qa_env_verified
          ? "QA environment verified successfully"
          : "QA environment URL saved but health check failed",
      });
      fetchProject();
    } else {
      setQaEnvSaveResult({ verified: false, message: res.error || "Failed to update QA env URL" });
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setUploading(true);
    for (const file of Array.from(e.target.files)) {
      await api.uploadProjectFile(projectId, file);
    }
    setUploading(false);
    fetchProject();
    e.target.value = "";
  };

  const handleDeleteFile = async (fileId: string) => {
    await api.deleteFile(projectId, fileId);
    fetchProject();
  };

  const handleViewFile = async (file: ProjectFile) => {
    const res = await api.getFileContent(projectId, file.id);
    if (res.success && res.data) {
      setEditingFile({
        id: file.id,
        name: file.file_name,
        content: res.data.content,
      });
    }
  };

  const toggleService = (serviceType: string) => {
    setServiceStates((prev) => ({
      ...prev,
      [serviceType]: {
        ...prev[serviceType],
        enabled: !prev[serviceType]?.enabled,
      },
    }));
    setServicesSaved(false);
  };

  const updateServiceConfig = (serviceType: string, key: string, value: string) => {
    setServiceStates((prev) => ({
      ...prev,
      [serviceType]: {
        ...prev[serviceType],
        config: { ...prev[serviceType]?.config, [key]: value },
      },
    }));
    setServicesSaved(false);
  };

  const handleSaveServices = async () => {
    setSavingServices(true);
    const services = ALL_SERVICES.map((svc) => ({
      service_type: svc.type,
      is_enabled: serviceStates[svc.type]?.enabled ?? false,
      config: serviceStates[svc.type]?.config ?? {},
    }));
    const res = await api.saveServiceConfig(projectId, services);
    setSavingServices(false);
    if (res.success) {
      setServicesSaved(true);
      setTimeout(() => setServicesSaved(false), 2000);
      fetchProject();
    }
  };

  const fetchGovernanceData = async (rid: string) => {
    const [readinessRes, capsRes] = await Promise.all([
      api.getReadiness(rid),
      api.getCapabilities(rid),
    ]);
    if (readinessRes.success && readinessRes.data) {
      setReadiness(readinessRes.data);
      setBackendURL("");
    }
    if (capsRes.success && capsRes.data) {
      setCapabilities(capsRes.data);
    }
  };

  // Try to find linked repo when switching to governance tab
  useEffect(() => {
    if (tab !== "governance" || repoId) return;
    const findRepo = async () => {
      // Try to find a repo matching this project by name
      const res = await api.getContextScore(projectId);
      if (res.success && res.data) {
        // The project has a linked repo via context score
        setRepoId(projectId);
        fetchGovernanceData(projectId);
      }
    };
    findRepo();
  }, [tab, repoId, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch onboarding artifacts when tab is selected
  useEffect(() => {
    if (tab !== "onboarding" || artifactsLoaded) return;
    const fetchArtifacts = async () => {
      setArtifactsLoading(true);
      const res = await api.listOnboardingArtifacts(projectId);
      if (res.success && res.data) {
        const filtered = res.data.filter(
          (a) => !a.relative_path.endsWith(".DS_Store") && !a.path.endsWith(".DS_Store")
        );
        setArtifacts(filtered);
      }
      setArtifactsLoading(false);
      setArtifactsLoaded(true);
    };
    fetchArtifacts();
  }, [tab, artifactsLoaded, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch agents when tab is selected
  useEffect(() => {
    if (tab !== "agents" || agentsLoaded) return;
    if (!project?.repository_id) {
      setAgentsLoaded(true);
      return;
    }
    const fetchAgents = async () => {
      setAgentsLoading(true);
      const res = await api.listRepoAgents(project.repository_id);
      if (res.success && res.data) {
        setAgents(res.data);
      }
      setAgentsLoading(false);
      setAgentsLoaded(true);
    };
    fetchAgents();
  }, [tab, agentsLoaded, project?.repository_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleViewArtifact = async (artifact: OnboardingArtifact) => {
    if (artifact.is_dir) return;
    setArtifactContentLoading(true);
    const res = await api.getArtifactContent(projectId, artifact.path);
    if (res.success && res.data) {
      setSelectedArtifact({ path: artifact.relative_path, content: res.data.content });
    }
    setArtifactContentLoading(false);
  };

  const handleValidateHealth = async () => {
    if (!repoId) return;
    setValidatingHealth(true);
    const res = await api.validateHealth(repoId);
    setValidatingHealth(false);
    if (res.success) {
      fetchGovernanceData(repoId);
    }
  };

  const handleSaveBackendURL = async () => {
    if (!repoId || !backendURL.trim()) return;
    const res = await api.setBackendURL(repoId, backendURL.trim());
    if (res.success) {
      fetchGovernanceData(repoId);
    }
  };

  const readinessBadge = (status: string) => {
    const colors: Record<string, string> = {
      ready: "bg-green-500/10 text-green-400 border-green-500/20",
      needs_review: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
      blocked: "bg-red-500/10 text-red-400 border-red-500/20",
    };
    return colors[status] || "bg-white/[0.05] text-slate-400 border-white/[0.08]";
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-[#0c0515]">
        <Sidebar activePage="projects" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-screen bg-[#0c0515]">
        <Sidebar activePage="projects" />
        <div className="flex-1 flex items-center justify-center text-slate-400">
          Project not found
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0c0515]">
      <Sidebar activePage="projects" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-6 pb-4">
          <button
            onClick={() => router.push("/chat/projects")}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Projects
          </button>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">{project.name}</h1>
              {project.description && (
                <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                  {project.description}
                </p>
              )}
              {project.link && (
                <a
                  href={project.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300 mt-2 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {project.link}
                </a>
              )}
            </div>
            {project.api_key && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <Key className="w-4 h-4 text-purple-400" />
                <div>
                  <div className="text-xs text-slate-400">
                    {project.api_key.name}
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    {project.api_key.masked_key}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-6 border-b border-white/[0.06]">
            {(
              [
                { id: "files" as Tab, label: "Files", icon: FileText },
                { id: "onboarding" as Tab, label: "Onboarding", icon: FolderOpen },
                { id: "agents" as Tab, label: "Agents", icon: Bot },
                { id: "services" as Tab, label: "Services", icon: Settings2 },
                { id: "settings" as Tab, label: "Settings", icon: Key },
                { id: "governance" as Tab, label: "Governance", icon: Shield },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  tab === t.id
                    ? "text-purple-400 border-purple-500"
                    : "text-slate-400 border-transparent hover:text-white"
                }`}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-8 pb-8">
          {/* Onboarding Status Bar */}
          {onboardingStatus && onboardingStatus.status !== "no_pipeline" && (
            <div className="mb-6 bg-[#111] rounded-xl border border-[#222] p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-white flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Onboarding Pipeline
                </h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  onboardingStatus.status === "completed" ? "bg-green-500/20 text-green-400" :
                  onboardingStatus.status === "failed" ? "bg-red-500/20 text-red-400" :
                  onboardingStatus.status === "running" ? "bg-blue-500/20 text-blue-400" :
                  onboardingStatus.status === "cancelled" ? "bg-yellow-500/20 text-yellow-400" :
                  "bg-gray-500/20 text-gray-400"
                }`}>
                  {onboardingStatus.status}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-[#1a1a1a] rounded-full h-2 mb-3">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    onboardingStatus.status === "completed" ? "bg-green-500" :
                    onboardingStatus.status === "failed" ? "bg-red-500" :
                    "bg-blue-500"
                  }`}
                  style={{ width: `${onboardingStatus.progress_percent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                <span>{onboardingStatus.current_step || onboardingStatus.phase}</span>
                <span>{onboardingStatus.progress_percent}%</span>
              </div>

              {/* Error message */}
              {onboardingStatus.status === "failed" && onboardingStatus.error_message && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-3">
                  <p className="text-red-400 text-xs">{onboardingStatus.error_message}</p>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={async () => {
                        await api.resumeOnboarding(projectId);
                        fetchOnboardingStatus();
                      }}
                      className="text-xs bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 px-3 py-1 rounded"
                    >
                      Resume Onboarding
                    </button>
                    <button
                      onClick={async () => {
                        await api.retryOnboarding(onboardingStatus.pipeline_id);
                        fetchOnboardingStatus();
                      }}
                      className="text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 px-3 py-1 rounded"
                    >
                      Force Unlock &amp; Reset
                    </button>
                  </div>
                </div>
              )}

              {/* Checkpoint timeline */}
              {onboardingStatus.checkpoints && onboardingStatus.checkpoints.length > 0 && (
                <div className="border-t border-[#222] pt-3">
                  <p className="text-xs text-gray-500 mb-2">Checkpoints</p>
                  <div className="flex gap-4">
                    {onboardingStatus.checkpoints.map((cp, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${
                          cp.status === "completed" ? "bg-green-500" :
                          cp.status === "running" ? "bg-blue-500 animate-pulse" :
                          cp.status === "failed" ? "bg-red-500" :
                          "bg-gray-600"
                        }`} />
                        <span className="text-xs text-gray-400">{cp.name.replace(/_/g, " ")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Completed info */}
              {onboardingStatus.status === "completed" && onboardingStatus.files_generated > 0 && (
                <p className="text-xs text-green-400 mt-1">{onboardingStatus.files_generated} files generated</p>
              )}
            </div>
          )}

          {/* Files Tab */}
          {tab === "files" && (
            <div className="pt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-slate-300">
                  Context Files ({project.files?.length || 0})
                </h3>
                <label className="flex items-center gap-2 px-4 py-2 bg-white/[0.08] hover:bg-white/[0.12] text-white text-sm rounded-lg cursor-pointer transition-colors">
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  Upload
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    accept=".md,.txt,.json,.yaml,.yml,.xml,.csv"
                    onChange={handleUpload}
                  />
                </label>
              </div>

              {project.files && project.files.length > 0 ? (
                <div className="space-y-2">
                  {project.files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                    >
                      <FileText className="w-5 h-5 text-purple-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">
                          {file.file_name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {(file.file_size / 1024).toFixed(1)}KB
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {file.is_editable && (
                          <button
                            onClick={() => handleViewFile(file)}
                            className="p-2 text-slate-400 hover:text-white hover:bg-white/[0.08] rounded-lg transition-colors"
                            title="View / Edit"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteFile(file.id)}
                          className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500 text-sm">
                  No files uploaded yet
                </div>
              )}
            </div>
          )}

          {/* Onboarding Tab */}
          {tab === "onboarding" && (
            <div className="pt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-slate-300">
                  Onboarding Artifacts
                </h3>
              </div>

              {artifactsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                </div>
              ) : artifacts.length > 0 ? (
                <div className="flex gap-6">
                  {/* File tree */}
                  <div className="w-1/3 space-y-1">
                    {artifacts.map((artifact) => {
                      const depth = artifact.relative_path.split("/").length - 1;
                      return (
                        <button
                          key={artifact.path}
                          onClick={() => handleViewArtifact(artifact)}
                          disabled={artifact.is_dir}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                            selectedArtifact?.path === artifact.relative_path
                              ? "bg-purple-500/10 border border-purple-500/20"
                              : artifact.is_dir
                              ? "bg-transparent cursor-default"
                              : "hover:bg-white/[0.04] border border-transparent"
                          }`}
                          style={{ paddingLeft: `${12 + depth * 16}px` }}
                        >
                          {artifact.is_dir ? (
                            <FolderOpen className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                          ) : (
                            <FileText className="w-4 h-4 text-purple-400 flex-shrink-0" />
                          )}
                          <span className="text-sm text-white truncate">
                            {artifact.relative_path.split("/").pop()}
                          </span>
                          {!artifact.is_dir && (
                            <span className="text-xs text-slate-500 ml-auto flex-shrink-0">
                              {artifact.size < 1024
                                ? `${artifact.size}B`
                                : `${(artifact.size / 1024).toFixed(1)}KB`}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Content viewer */}
                  <div className="flex-1 min-w-0">
                    {artifactContentLoading ? (
                      <div className="flex items-center justify-center py-12 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                        <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                      </div>
                    ) : selectedArtifact ? (
                      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
                          <span className="text-xs text-slate-400 font-mono">
                            {selectedArtifact.path}
                          </span>
                        </div>
                        <pre className="p-4 text-sm text-slate-300 font-mono overflow-x-auto max-h-[60vh] overflow-y-auto whitespace-pre-wrap break-words">
                          {selectedArtifact.content}
                        </pre>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-12 rounded-lg border border-white/[0.06] bg-white/[0.02] text-sm text-slate-500">
                        Select a file to view its content
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500 text-sm">
                  No artifacts found. This project may not have completed onboarding or has no linked repository.
                </div>
              )}
            </div>
          )}

          {/* Agents Tab */}
          {tab === "agents" && (
            <div className="pt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-slate-300">
                  Repository Agents
                </h3>
              </div>

              {!project.repository_id ? (
                <div className="text-center py-12 text-slate-500 text-sm">
                  Project not linked to a repository
                </div>
              ) : agentsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                </div>
              ) : agents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {agents.map((agent) => (
                    <div
                      key={agent.id}
                      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                            <Bot className="w-5 h-5 text-purple-400" />
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-white">
                              {agent.name}
                            </h4>
                            <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded bg-white/[0.06] text-slate-400">
                              {agent.platform}
                            </span>
                          </div>
                        </div>
                        <span className="flex items-center gap-1.5 text-xs">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              agent.enabled ? "bg-green-400" : "bg-slate-500"
                            }`}
                          />
                          <span className={agent.enabled ? "text-green-400" : "text-slate-500"}>
                            {agent.enabled ? "Enabled" : "Disabled"}
                          </span>
                        </span>
                      </div>
                      {agent.description && (
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {agent.description}
                        </p>
                      )}
                      {agent.file_path && (
                        <div className="mt-3 text-xs text-slate-500 font-mono truncate">
                          {agent.file_path}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500 text-sm">
                  No agents found for this repository
                </div>
              )}
            </div>
          )}

          {/* Services Tab */}
          {tab === "services" && (
            <div className="pt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-slate-300">
                  Services
                </h3>
                <div className="flex items-center gap-3">
                  {servicesSaved && (
                    <span className="text-sm text-green-400">Saved</span>
                  )}
                  <button
                    onClick={handleSaveServices}
                    disabled={savingServices}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {savingServices ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save Changes
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {ALL_SERVICES.map((svc) => {
                  const state = serviceStates[svc.type];
                  const isEnabled = state?.enabled ?? false;

                  return (
                    <div
                      key={svc.type}
                      className={`rounded-xl border transition-colors ${
                        isEnabled
                          ? "border-purple-500/20 bg-white/[0.03]"
                          : "border-white/[0.06] bg-white/[0.02]"
                      }`}
                    >
                      <div className="flex items-center gap-4 px-5 py-4">
                        <button
                          onClick={() => toggleService(svc.type)}
                          className="flex-shrink-0"
                        >
                          {isEnabled ? (
                            <div className="w-10 h-6 rounded-full bg-purple-600 flex items-center justify-end px-0.5 transition-colors">
                              <div className="w-5 h-5 rounded-full bg-white" />
                            </div>
                          ) : (
                            <div className="w-10 h-6 rounded-full bg-white/[0.1] flex items-center px-0.5 transition-colors">
                              <div className="w-5 h-5 rounded-full bg-slate-500" />
                            </div>
                          )}
                        </button>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-white">
                            {svc.label}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {svc.description}
                          </div>
                        </div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            isEnabled
                              ? "bg-green-500/10 text-green-400"
                              : "bg-white/[0.05] text-slate-500"
                          }`}
                        >
                          {isEnabled ? "Active" : "Disabled"}
                        </span>
                      </div>

                      {/* Config fields (shown when enabled and service has fields) */}
                      {isEnabled && svc.fields && svc.fields.length > 0 && (
                        <div className="px-5 pb-4 pt-1 border-t border-white/[0.04]">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                            {svc.fields.map((field) => (
                              <div key={field.key}>
                                <label className="block text-xs text-slate-400 mb-1">
                                  {field.label}
                                </label>
                                <input
                                  type="text"
                                  value={state?.config?.[field.key] || ""}
                                  onChange={(e) =>
                                    updateServiceConfig(svc.type, field.key, e.target.value)
                                  }
                                  placeholder={field.label}
                                  className="w-full px-3 py-2 rounded-lg bg-[#0c0515] border border-white/[0.08] text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {tab === "settings" && (
            <div className="pt-4 space-y-6">
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-3">
                  Project Info
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-32">Status:</span>
                    <span className="text-white capitalize">
                      {project.status}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-32">Onboarding:</span>
                    <span className="text-white capitalize">
                      {project.onboarding_step.replace("_", " ")}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-32">Conversations:</span>
                    <span className="text-white">
                      {project.conversation_count}
                    </span>
                  </div>
                </div>
              </div>

              {/* QA Environment URL */}
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-purple-400" />
                  QA Environment URL
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="url"
                      value={qaEnvUrl}
                      onChange={(e) => { setQaEnvUrl(e.target.value); setQaEnvSaveResult(null); }}
                      placeholder="https://qa-api.example.com"
                      className="flex-1 px-3 py-2 rounded-lg bg-[#0c0515] border border-white/[0.08] text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all"
                    />
                    <button
                      onClick={handleSaveQaEnvUrl}
                      disabled={savingQaEnv || !qaEnvUrl.trim()}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                    >
                      {savingQaEnv ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      Verify & Save
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    {project.qa_env_verified ? (
                      <span className="flex items-center gap-1.5 text-xs text-green-400">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Verified — project is chat-ready
                      </span>
                    ) : project.qa_env_url ? (
                      <span className="flex items-center gap-1.5 text-xs text-yellow-400">
                        <XCircle className="w-3.5 h-3.5" />
                        Not verified — health check failed. Project won&apos;t appear in chat.
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">
                        Set a QA environment URL to enable chat for this project.
                      </span>
                    )}
                  </div>
                  {qaEnvSaveResult && (
                    <div className={`text-xs px-3 py-2 rounded-lg ${
                      qaEnvSaveResult.verified
                        ? "bg-green-500/10 text-green-400 border border-green-500/20"
                        : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                    }`}>
                      {qaEnvSaveResult.message}
                    </div>
                  )}
                </div>
              </div>

              {project.api_key && (
                <div>
                  <h3 className="text-sm font-medium text-slate-300 mb-3">
                    API Gateway Key
                  </h3>
                  <div className="px-4 py-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                    <div className="text-sm text-white">
                      {project.api_key.name}
                    </div>
                    <div className="text-xs text-slate-500 font-mono mt-1">
                      {project.api_key.masked_key} ({project.api_key.provider})
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Governance Tab */}
          {tab === "governance" && (
            <div className="pt-4 space-y-6">
              {/* Readiness Section */}
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-400" />
                  Context Readiness
                </h3>
                {readiness ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${readinessBadge(readiness.context_readiness)}`}>
                        {readiness.context_readiness.replace("_", " ").toUpperCase()}
                      </span>
                      <span className="text-xs text-slate-500">
                        Score: {readiness.context_score} | Health: {readiness.backend_health_status}
                      </span>
                    </div>
                    {readiness.details && (
                      <p className="text-xs text-slate-500">{readiness.details}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Loading readiness data...</p>
                )}
              </div>

              {/* Backend URL Section */}
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-3">
                  Backend Health
                </h3>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={backendURL}
                    onChange={(e) => setBackendURL(e.target.value)}
                    placeholder="https://api.example.com"
                    className="flex-1 px-3 py-2 rounded-lg bg-[#0c0515] border border-white/[0.08] text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all"
                  />
                  <button
                    onClick={handleSaveBackendURL}
                    disabled={!backendURL.trim()}
                    className="px-4 py-2 bg-white/[0.08] hover:bg-white/[0.12] disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                  >
                    Save URL
                  </button>
                  <button
                    onClick={handleValidateHealth}
                    disabled={validatingHealth || !repoId}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                  >
                    {validatingHealth ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Activity className="w-4 h-4" />
                    )}
                    Validate
                  </button>
                </div>
              </div>

              {/* Capabilities Section */}
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-purple-400" />
                  Execution Capabilities
                </h3>
                {capabilities.length > 0 ? (
                  <div className="space-y-2">
                    {capabilities.map((cap) => (
                      <div
                        key={cap.id}
                        className="flex items-center justify-between px-4 py-3 rounded-lg border border-white/[0.06] bg-white/[0.02]"
                      >
                        <div>
                          <span className="text-sm text-white font-mono">{cap.capability}</span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          cap.enabled
                            ? "bg-green-500/10 text-green-400"
                            : "bg-white/[0.05] text-slate-500"
                        }`}>
                          {cap.enabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No capabilities configured yet</p>
                )}
              </div>

              {/* Budget Section */}
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-purple-400" />
                  AI Budget
                </h3>
                <div className="px-4 py-4 rounded-lg border border-white/[0.06] bg-white/[0.02] space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Spent</span>
                    <span className="text-white font-mono">
                      ${(project.ai_spent_usd || 0).toFixed(2)} / ${(project.ai_budget_usd || 0).toFixed(2)}
                    </span>
                  </div>
                  {(() => {
                    const budget = project.ai_budget_usd || 0;
                    const spent = project.ai_spent_usd || 0;
                    const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
                    const color = pct < 50 ? "bg-green-500" : pct < 80 ? "bg-yellow-500" : "bg-red-500";
                    return (
                      <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${color}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* File editor modal */}
      {editingFile && (
        <FileEditor
          isOpen={true}
          onClose={() => setEditingFile(null)}
          projectId={projectId}
          fileId={editingFile.id}
          fileName={editingFile.name}
          initialContent={editingFile.content}
          onSaved={fetchProject}
        />
      )}
    </div>
  );
}
