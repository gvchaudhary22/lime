"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Upload,
  X,
  FileText,
  Key,
  Plus,
  Check,
  Loader2,
  Settings2,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import { api, APIKeyItem, ServiceConfig, Organization } from "@/lib/api";

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const SERVICE_TYPES = [
  {
    type: "development",
    label: "Development",
    description: "Code analysis & feature development",
    fields: [],
  },
  {
    type: "code_intelligence",
    label: "Code Intelligence",
    description: "Repo analysis, flow detection, feature feasibility",
    fields: [],
  },
  {
    type: "jira",
    label: "Jira Integration",
    description: "Connect with Jira for issue tracking",
    fields: [
      { key: "jira_url", label: "Jira URL", placeholder: "https://your-org.atlassian.net" },
      { key: "jira_api_key", label: "Jira API Key", placeholder: "Your Jira API key" },
    ],
  },
  {
    type: "monitoring",
    label: "Monitoring Tools",
    description: "Integrate monitoring and alerting",
    fields: [
      { key: "monitoring_url", label: "Monitoring URL", placeholder: "https://monitoring.example.com" },
    ],
  },
  {
    type: "slack",
    label: "Slack",
    description: "Notifications & alerts via Slack",
    fields: [
      { key: "webhook_url", label: "Webhook URL", placeholder: "https://hooks.slack.com/..." },
      { key: "channel", label: "Channel", placeholder: "#alerts" },
    ],
  },
  {
    type: "telegram",
    label: "Telegram",
    description: "Notifications via Telegram bot",
    fields: [
      { key: "bot_token", label: "Bot Token", placeholder: "123456:ABC-DEF..." },
      { key: "chat_id", label: "Chat ID", placeholder: "-1001234567890" },
    ],
  },
  {
    type: "elk",
    label: "ELK Stack",
    description: "Log analysis via Elasticsearch",
    fields: [
      { key: "elk_url", label: "ELK URL", placeholder: "https://elk.example.com" },
      { key: "index_path", label: "Index Path", placeholder: "logs-*" },
    ],
  },
];

export default function CreateProjectModal({
  isOpen,
  onClose,
  onCreated,
}: CreateProjectModalProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1: Repo info
  const [name, setName] = useState("");
  const [link, setLink] = useState("");
  const [description, setDescription] = useState("");
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [mainBranch, setMainBranch] = useState("main");
  const [qaBranch, setQaBranch] = useState("qa");
  const [qaEnvUrl, setQaEnvUrl] = useState("");

  // Step 2: Files
  const [files, setFiles] = useState<File[]>([]);
  const [projectId, setProjectId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 3: API Key
  const [apiKeys, setApiKeys] = useState<APIKeyItem[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState("");
  const [showNewKey, setShowNewKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");

  // Step 4: Services
  const [services, setServices] = useState<
    Record<string, { enabled: boolean; config: Record<string, string> }>
  >({});

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setError("");
      setName("");
      setLink("");
      setDescription("");
      setSelectedOrgId("");
      setMainBranch("main");
      setQaBranch("qa");
      setQaEnvUrl("");
      setFiles([]);
      setProjectId("");
      setSelectedKeyId("");
      setShowNewKey(false);
      setNewKeyName("");
      setNewKeyValue("");
      setServices({});
      api.listOrganizations().then((res) => {
        if (res.success && res.data) setOrganizations(res.data);
      });
    }
  }, [isOpen]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files);
    setFiles((prev) => [...prev, ...dropped]);
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Step 1 → Create project
  const handleStep1 = async () => {
    if (!name.trim() || !link.trim()) {
      setError("Name and GitHub URL are required");
      return;
    }
    setError("");
    setLoading(true);
    const res = await api.createProject({
      name,
      description,
      link,
      organization_id: selectedOrgId || undefined,
      main_branch: mainBranch || undefined,
      qa_branch: qaBranch || undefined,
      qa_env_url: qaEnvUrl || undefined,
    });
    setLoading(false);
    if (res.success && res.data) {
      setProjectId(res.data.id);
      setStep(2);
    } else {
      setError(res.error || "Failed to create project");
    }
  };

  // Step 2 → Upload files
  const handleStep2 = async () => {
    setError("");
    if (files.length > 0) {
      setLoading(true);
      for (const file of files) {
        const res = await api.uploadProjectFile(projectId, file);
        if (!res.success) {
          setError(`Failed to upload ${file.name}: ${res.error}`);
          setLoading(false);
          return;
        }
      }
      setLoading(false);
    }
    // Fetch API keys for step 3
    const keysRes = await api.getAPIKeys();
    if (keysRes.success && keysRes.data) {
      setApiKeys(keysRes.data);
    }
    setStep(3);
  };

  // Step 3 → Assign API key
  const handleStep3 = async () => {
    setError("");
    setLoading(true);

    let keyId = selectedKeyId;

    // Create new key if user filled the new key form
    if (showNewKey && newKeyName && newKeyValue) {
      const res = await api.createAPIKey({
        name: newKeyName,
        api_key: newKeyValue,
      });
      if (res.success && res.data) {
        keyId = res.data.id;
      } else {
        setError(res.error || "Failed to create API key");
        setLoading(false);
        return;
      }
    }

    // Assign key to project
    if (keyId) {
      await api.setProjectAPIKey(projectId, keyId);
    }

    setLoading(false);
    setStep(4);
  };

  // Step 4 → Save services and finish
  const handleFinish = async () => {
    setError("");
    setLoading(true);

    const serviceConfigs: ServiceConfig[] = Object.entries(services)
      .filter(([, v]) => v.enabled)
      .map(([type, v]) => ({
        service_type: type,
        is_enabled: true,
        config: v.config,
      }));

    if (serviceConfigs.length > 0) {
      await api.saveServiceConfig(projectId, serviceConfigs);
    }

    setLoading(false);
    onCreated();
    onClose();
  };

  const toggleService = (type: string) => {
    setServices((prev) => ({
      ...prev,
      [type]: {
        enabled: !prev[type]?.enabled,
        config: prev[type]?.config || {},
      },
    }));
  };

  const updateServiceConfig = (type: string, key: string, value: string) => {
    setServices((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        config: { ...prev[type]?.config, [key]: value },
      },
    }));
  };

  const stepTitles = [
    "Repository Info",
    "Context Files",
    "API Gateway Key",
    "Services",
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Project" size="xl">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {stepTitles.map((title, i) => (
          <div key={title} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step > i + 1
                  ? "bg-purple-600 text-white"
                  : step === i + 1
                  ? "bg-purple-500/20 text-purple-400 ring-2 ring-purple-500/40"
                  : "bg-white/[0.05] text-slate-500"
              }`}
            >
              {step > i + 1 ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span
              className={`text-xs hidden sm:inline ${
                step === i + 1 ? "text-white" : "text-slate-500"
              }`}
            >
              {title}
            </span>
            {i < 3 && (
              <div className="w-8 h-px bg-white/[0.08] hidden sm:block" />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Repo Info */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Project Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Project"
              className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              GitHub Repository URL *
            </label>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://github.com/org/repo"
              className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the project..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Organization
            </label>
            <select
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            >
              <option value="" className="bg-[#111]">No organization</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id} className="bg-[#111]">
                  {org.name} {org.has_token ? "(token configured)" : "(no token)"}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Main Branch
              </label>
              <input
                type="text"
                value={mainBranch}
                onChange={(e) => setMainBranch(e.target.value)}
                placeholder="main"
                className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                QA Branch
              </label>
              <input
                type="text"
                value={qaBranch}
                onChange={(e) => setQaBranch(e.target.value)}
                placeholder="qa"
                className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              QA Environment URL
            </label>
            <input
              type="url"
              value={qaEnvUrl}
              onChange={(e) => setQaEnvUrl(e.target.value)}
              placeholder="https://qa-api.example.com"
              className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            />
            <p className="text-xs text-slate-500 mt-1">
              Required for chat. Will be verified via health check.
            </p>
          </div>
          <div className="flex justify-end pt-2">
            <button
              onClick={handleStep1}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Next <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Context Files */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Upload architecture docs, endpoint specs, workflow files, or any
            context documents for MARS to understand your project.
          </p>

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-white/[0.1] hover:border-purple-500/30 rounded-xl p-8 text-center cursor-pointer transition-colors"
          >
            <Upload className="w-8 h-8 text-slate-500 mx-auto mb-3" />
            <p className="text-sm text-slate-400">
              Drop files here or click to browse
            </p>
            <p className="text-xs text-slate-500 mt-1">
              .md, .txt, .json, .yaml, .xml supported
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept=".md,.txt,.json,.yaml,.yml,.xml,.csv"
              onChange={(e) => {
                if (e.target.files) {
                  setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                }
              }}
            />
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((file, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]"
                >
                  <FileText className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <span className="text-sm text-white flex-1 truncate">
                    {file.name}
                  </span>
                  <span className="text-xs text-slate-500">
                    {(file.size / 1024).toFixed(1)}KB
                  </span>
                  <button
                    onClick={() => removeFile(i)}
                    className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-2 px-4 py-2.5 text-slate-400 hover:text-white text-sm transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setFiles([]);
                  api.getAPIKeys().then((r) => {
                    if (r.success && r.data) setApiKeys(r.data);
                  });
                  setStep(3);
                }}
                className="px-4 py-2.5 text-slate-400 hover:text-white text-sm transition-colors"
              >
                Skip
              </button>
              <button
                onClick={handleStep2}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Upload & Next <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: API Gateway Key */}
      {step === 3 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Assign an API Gateway key to this project. Keys can be shared across
            multiple projects.
          </p>

          {/* Existing keys */}
          {apiKeys.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Select existing key
              </label>
              {apiKeys.map((k) => (
                <button
                  key={k.id}
                  onClick={() => {
                    setSelectedKeyId(k.id);
                    setShowNewKey(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors ${
                    selectedKeyId === k.id
                      ? "border-purple-500/40 bg-purple-500/10"
                      : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]"
                  }`}
                >
                  <Key className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm text-white">{k.name}</div>
                    <div className="text-xs text-slate-500">{k.masked_key}</div>
                  </div>
                  {selectedKeyId === k.id && (
                    <Check className="w-4 h-4 text-purple-400" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Add new key */}
          <button
            onClick={() => {
              setShowNewKey(!showNewKey);
              setSelectedKeyId("");
            }}
            className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {showNewKey ? "Cancel" : "Add new key"}
          </button>

          {showNewKey && (
            <div className="space-y-3 pl-6 border-l-2 border-purple-500/20">
              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Key Name
                </label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="Production Key"
                  className="w-full px-4 py-2.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  value={newKeyValue}
                  onChange={(e) => setNewKeyValue(e.target.value)}
                  placeholder="Enter your API gateway key"
                  className="w-full px-4 py-2.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                />
              </div>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-2 px-4 py-2.5 text-slate-400 hover:text-white text-sm transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setStep(4)}
                className="px-4 py-2.5 text-slate-400 hover:text-white text-sm transition-colors"
              >
                Skip
              </button>
              <button
                onClick={handleStep3}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Next <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Services */}
      {step === 4 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Configure which services to enable for this project. GitHub URL is
            already set. All services are optional.
          </p>

          <div className="space-y-3">
            {SERVICE_TYPES.map((svc) => (
              <div
                key={svc.type}
                className="rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden"
              >
                <button
                  onClick={() => toggleService(svc.type)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
                >
                  <div
                    className={`w-9 h-5 rounded-full transition-colors relative ${
                      services[svc.type]?.enabled
                        ? "bg-purple-600"
                        : "bg-white/[0.1]"
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        services[svc.type]?.enabled
                          ? "translate-x-4"
                          : "translate-x-0.5"
                      }`}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white">
                      {svc.label}
                    </div>
                    <div className="text-xs text-slate-500">
                      {svc.description}
                    </div>
                  </div>
                  {svc.fields.length > 0 && services[svc.type]?.enabled && (
                    <Settings2 className="w-4 h-4 text-slate-500" />
                  )}
                </button>

                {/* Config fields */}
                {services[svc.type]?.enabled && svc.fields.length > 0 && (
                  <div className="px-4 pb-3 pt-1 space-y-2 border-t border-white/[0.04]">
                    {svc.fields.map((field) => (
                      <div key={field.key}>
                        <label className="block text-xs text-slate-400 mb-1">
                          {field.label}
                        </label>
                        <input
                          type="text"
                          value={services[svc.type]?.config?.[field.key] || ""}
                          onChange={(e) =>
                            updateServiceConfig(
                              svc.type,
                              field.key,
                              e.target.value
                            )
                          }
                          placeholder={field.placeholder}
                          className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep(3)}
              className="flex items-center gap-2 px-4 py-2.5 text-slate-400 hover:text-white text-sm transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={handleFinish}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-all shadow-lg shadow-purple-500/20"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" /> Create Project
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
