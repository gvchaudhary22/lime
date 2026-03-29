"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface CustomArtifact {
  id: string;
  name: string;
  slug: string;
  artifact_type: string;
  description: string;
  content: string;
  target_path: string;
  based_on: string;
  tags: string;
  guardrails: string;
  model_hint: string;
  version: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface EligibleRepo {
  id: string;
  name: string;
  owner: string;
  tech_stack: string;
  domain: string;
  tier: string;
  framework: string;
  context_score: number;
}

interface ArtifactDeployment {
  id: string;
  name: string;
  description: string;
  status: string;
  artifact_ids: string;
  target_repo_ids: string;
  target_platforms: string;
  total_repos: number;
  completed_repos: number;
  failed_repos: number;
  created_by: string;
  approved_by: string;
  approved_at: string;
  completed_at: string;
  created_at: string;
  updated_at: string;
}

interface DeploymentStatusResponse {
  deployment: ArtifactDeployment;
  repos: Array<{
    id: string;
    deployment_id: string;
    repository_id: string;
    plan_id: string;
    status: string;
    error_message: string;
  }>;
}

const ARTIFACT_TYPES = ["agent", "skill", "rule", "hook", "command"];

const TYPE_COLORS: Record<string, string> = {
  agent: "bg-purple-900/30 text-purple-300 border-purple-700/50",
  skill: "bg-blue-900/30 text-blue-300 border-blue-700/50",
  rule: "bg-amber-900/30 text-amber-300 border-amber-700/50",
  hook: "bg-emerald-900/30 text-emerald-300 border-emerald-700/50",
  command: "bg-cyan-900/30 text-cyan-300 border-cyan-700/50",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-700/50 text-slate-300",
  planning: "bg-blue-900/30 text-blue-300",
  pending_approval: "bg-yellow-900/30 text-yellow-300",
  approved: "bg-green-900/30 text-green-300",
  executing: "bg-indigo-900/30 text-indigo-300",
  completed: "bg-green-900/30 text-green-300",
  failed: "bg-red-900/30 text-red-300",
};

export default function AgentBuilderPage() {
  const [tab, setTab] = useState<"library" | "deploy" | "history">("library");

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-2xl font-bold text-white mb-1">Workflow Enforcement</h1>
      <p className="text-sm text-slate-400 mb-6">
        Create custom artifacts and deploy them to onboarded repos
      </p>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-700/50">
        {(["library", "deploy", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              tab === t
                ? "bg-slate-800 text-white border-b-2 border-purple-500"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {t === "library" ? "Artifact Library" : t === "deploy" ? "Deploy" : "History"}
          </button>
        ))}
      </div>

      {tab === "library" && <ArtifactLibraryTab />}
      {tab === "deploy" && <DeployTab />}
      {tab === "history" && <HistoryTab />}
    </div>
  );
}

/* ─────────────────────── Tab 1: Artifact Library ─────────────────────── */

function ArtifactLibraryTab() {
  const [artifacts, setArtifacts] = useState<CustomArtifact[]>([]);
  const [deployedArtifactIds, setDeployedArtifactIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    artifact_type: "agent",
    description: "",
    content: "",
    target_path: "",
    model_hint: "",
  });

  const loadArtifacts = async () => {
    setLoading(true);
    const [aRes, dRes] = await Promise.all([
      api.listCustomArtifacts(typeFilter),
      api.listDeployments(),
    ]);
    if (aRes.success && aRes.data) setArtifacts(aRes.data);
    if (dRes.success && dRes.data) {
      const deployed = new Set<string>();
      (dRes.data as ArtifactDeployment[])
        .filter((d) => ["completed", "executing", "approved", "pending_approval"].includes(d.status))
        .forEach((d) => {
          try {
            const ids: string[] = JSON.parse(d.artifact_ids);
            ids.forEach((id) => deployed.add(id));
          } catch {
            d.artifact_ids.split(",").map((s) => s.trim()).filter(Boolean).forEach((id) => deployed.add(id));
          }
        });
      setDeployedArtifactIds(deployed);
    }
    setLoading(false);
  };

  useEffect(() => { loadArtifacts(); }, [typeFilter]);

  const visibleArtifacts = artifacts.filter((a) => !deployedArtifactIds.has(a.id));

  const resetForm = () => {
    setForm({ name: "", artifact_type: "agent", description: "", content: "", target_path: "", model_hint: "" });
    setEditId(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (editId) {
      await api.updateCustomArtifact(editId, form);
    } else {
      await api.createCustomArtifact(form);
    }
    resetForm();
    loadArtifacts();
  };

  const handleEdit = (a: CustomArtifact) => {
    setForm({
      name: a.name,
      artifact_type: a.artifact_type,
      description: a.description || "",
      content: a.content,
      target_path: a.target_path,
      model_hint: a.model_hint || "",
    });
    setEditId(a.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this artifact?")) return;
    await api.deleteCustomArtifact(id);
    loadArtifacts();
  };

  // --- Template Picker ---
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templates, setTemplates] = useState<Array<{ name: string; artifact_type: string; min_tier: string }>>([]);
  const [templateTypeFilter, setTemplateTypeFilter] = useState("");
  const [templateSearch, setTemplateSearch] = useState("");
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [forkingTemplate, setForkingTemplate] = useState<string | null>(null);

  const openTemplatePicker = async () => {
    setShowTemplatePicker(true);
    if (templates.length === 0) {
      setLoadingTemplates(true);
      const res = await api.listECCTemplates();
      if (res.success && res.data) setTemplates(res.data);
      setLoadingTemplates(false);
    }
  };

  const handleForkTemplate = async (tmpl: { name: string; artifact_type: string }) => {
    setForkingTemplate(tmpl.name);
    const res = await api.forkFromTemplate({ template_name: tmpl.name, artifact_type: tmpl.artifact_type });
    if (res.success && res.data) {
      setShowTemplatePicker(false);
      handleEdit(res.data as CustomArtifact);
    }
    setForkingTemplate(null);
    loadArtifacts();
  };

  const filteredTemplates = templates.filter((t) => {
    if (templateTypeFilter && t.artifact_type !== templateTypeFilter) return false;
    if (templateSearch && !t.name.toLowerCase().includes(templateSearch.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-white"
        >
          <option value="">All Types</option>
          {ARTIFACT_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <div className="flex-1" />
        <button onClick={openTemplatePicker} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-sm text-white rounded transition-colors">
          Fork Template
        </button>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-sm text-white rounded transition-colors">
          + New Artifact
        </button>
      </div>

      {/* Template Picker Panel */}
      {showTemplatePicker && (
        <div className="bg-slate-800/80 border border-slate-600 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-medium">ECC Templates — Select to Fork</h3>
            <button onClick={() => setShowTemplatePicker(false)} className="text-slate-400 hover:text-white text-sm">
              Close
            </button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 mb-3">
            <input
              placeholder="Search templates..."
              value={templateSearch}
              onChange={(e) => setTemplateSearch(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-white"
            />
            <select
              value={templateTypeFilter}
              onChange={(e) => setTemplateTypeFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-white"
            >
              <option value="">All Types</option>
              <option value="agent">Agents</option>
              <option value="skill">Skills</option>
              <option value="command">Commands</option>
            </select>
          </div>

          {loadingTemplates ? (
            <p className="text-slate-400 text-sm">Loading templates...</p>
          ) : filteredTemplates.length === 0 ? (
            <p className="text-slate-500 text-sm">No templates match your filter.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto">
              {filteredTemplates.map((t) => (
                <button
                  key={`${t.artifact_type}-${t.name}`}
                  onClick={() => handleForkTemplate(t)}
                  disabled={forkingTemplate === t.name}
                  className="flex items-center gap-2 bg-slate-900/60 border border-slate-700 hover:border-purple-500/50 rounded-lg p-3 text-left transition-colors disabled:opacity-50"
                >
                  <span className={`text-xs px-1.5 py-0.5 rounded border shrink-0 ${TYPE_COLORS[t.artifact_type] || "bg-slate-700 text-slate-300"}`}>
                    {t.artifact_type}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm text-white block truncate">{t.name}</span>
                    <span className="text-xs text-slate-500">{t.min_tier}+</span>
                  </div>
                  {forkingTemplate === t.name && <span className="text-xs text-purple-400 animate-pulse">Forking...</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Form */}
      {showForm && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-4">
          <h3 className="text-white font-medium mb-3">{editId ? "Edit Artifact" : "New Artifact"}</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white"
            />
            <select
              value={form.artifact_type}
              onChange={(e) => setForm({ ...form, artifact_type: e.target.value })}
              className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white"
            >
              {ARTIFACT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input
              placeholder="Target Path (auto-generated if empty)"
              value={form.target_path}
              onChange={(e) => setForm({ ...form, target_path: e.target.value })}
              className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white"
            />
            <select
              value={form.model_hint}
              onChange={(e) => setForm({ ...form, model_hint: e.target.value })}
              className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white"
            >
              <option value="">Any Model</option>
              <option value="opus">Opus</option>
              <option value="sonnet">Sonnet</option>
              <option value="haiku">Haiku</option>
            </select>
          </div>
          <input
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white mb-3"
          />
          <textarea
            placeholder="Content (markdown)"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            rows={12}
            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white font-mono mb-3"
          />

          <div className="flex gap-2">
            <button onClick={handleSave} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-sm text-white rounded transition-colors">
              {editId ? "Update" : "Create"}
            </button>
            <button onClick={resetForm} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-sm text-white rounded transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Artifact List */}
      {loading ? (
        <p className="text-slate-400 text-sm">Loading artifacts...</p>
      ) : visibleArtifacts.length === 0 ? (
        <p className="text-slate-500 text-sm">{artifacts.length > 0 ? "All artifacts have been deployed." : "No artifacts yet. Create one or fork from a template."}</p>
      ) : (
        <div className="space-y-2">
          {visibleArtifacts.map((a) => (
            <div key={a.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-medium">{a.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded border ${TYPE_COLORS[a.artifact_type] || "bg-slate-700 text-slate-300"}`}>
                    {a.artifact_type}
                  </span>
                  <span className="text-xs text-slate-500">v{a.version}</span>
                  {a.based_on && <span className="text-xs text-slate-500">forked from {a.based_on}</span>}
                </div>
                <p className="text-sm text-slate-400 truncate">{a.description || a.target_path}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => handleEdit(a)} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-xs text-white rounded transition-colors">
                  Edit
                </button>
                <button onClick={() => handleDelete(a.id)} className="px-3 py-1 bg-red-900/30 hover:bg-red-900/50 text-xs text-red-300 rounded transition-colors">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────── Tab 2: Deploy ─────────────────────── */

function DeployTab() {
  const [step, setStep] = useState(1);
  const [artifacts, setArtifacts] = useState<CustomArtifact[]>([]);
  const [deployedArtifactIds, setDeployedArtifactIds] = useState<Set<string>>(new Set());
  const [repos, setRepos] = useState<EligibleRepo[]>([]);
  const [selectedArtifacts, setSelectedArtifacts] = useState<string[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<string[]>([]);
  const [deployName, setDeployName] = useState("");
  const [deployDesc, setDeployDesc] = useState("");
  const [deployment, setDeployment] = useState<ArtifactDeployment | null>(null);
  const [executing, setExecuting] = useState(false);
  const [progress, setProgress] = useState<Array<{ repo_id: string; repo_name: string; status: string; error?: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [aRes, rRes, dRes] = await Promise.all([
        api.listCustomArtifacts(),
        api.listEligibleRepos(),
        api.listDeployments(),
      ]);
      if (aRes.success && aRes.data) setArtifacts(aRes.data);
      if (rRes.success && rRes.data) setRepos(rRes.data);

      // Restore active deployment if one exists
      if (dRes.success && dRes.data) {
        const allDeployments = dRes.data as ArtifactDeployment[];
        const active = allDeployments.find((d) =>
          ["pending_approval", "approved", "executing", "planning"].includes(d.status)
        );
        if (active) {
          setDeployment(active);
          if (active.status === "executing") setStep(5);
          else if (active.status === "approved") setStep(5);
          else if (active.status === "pending_approval") setStep(4);
          else if (active.status === "planning") setStep(4);
        }

        // Track deployed artifact IDs
        const deployed = new Set<string>();
        allDeployments
          .filter((d) => ["completed", "executing", "approved", "pending_approval"].includes(d.status))
          .forEach((d) => {
            try {
              const ids: string[] = JSON.parse(d.artifact_ids);
              ids.forEach((id) => deployed.add(id));
            } catch {
              d.artifact_ids.split(",").map((s) => s.trim()).filter(Boolean).forEach((id) => deployed.add(id));
            }
          });
        setDeployedArtifactIds(deployed);
      }

      setLoading(false);
    })();
  }, []);

  const availableArtifacts = artifacts.filter((a) => !deployedArtifactIds.has(a.id));

  const toggleArtifact = (id: string) => {
    setSelectedArtifacts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleRepo = (id: string) => {
    setSelectedRepos((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAllRepos = () => {
    setSelectedRepos(repos.map((r) => r.id));
  };

  const handleCreateDeployment = async () => {
    const res = await api.createDeployment({
      name: deployName || `Deploy ${selectedArtifacts.length} artifacts to ${selectedRepos.length} repos`,
      description: deployDesc,
      artifact_ids: selectedArtifacts,
      target_repo_ids: selectedRepos,
      target_platforms: ["claude"],
    });
    if (res.success && res.data) {
      setDeployment(res.data);
      // Auto-plan
      await api.planDeployment(res.data.id);
      setStep(4);
    }
  };

  const handleApprove = async () => {
    if (!deployment) return;
    await api.approveDeployment(deployment.id);
    setStep(5);
  };

  const handleExecute = async () => {
    if (!deployment) return;
    setExecuting(true);
    setProgress([]);

    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
    const token = typeof window !== "undefined" ? localStorage.getItem("mars_token") : "";
    const evtSource = new EventSource(`${apiBase}/api/v1/admin/deployments/${deployment.id}/execute?token=${token}`);

    evtSource.addEventListener("progress", (e) => {
      const data = JSON.parse(e.data);
      setProgress((prev) => {
        const existing = prev.findIndex((p) => p.repo_id === data.repo_id);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = data;
          return updated;
        }
        return [...prev, data];
      });
    });

    evtSource.addEventListener("error", (e) => {
      // SSE error event from server or connection drop
      evtSource.close();
      setExecuting(false);
    });

    evtSource.addEventListener("done", () => {
      evtSource.close();
      setExecuting(false);
    });
  };

  if (loading) return <p className="text-slate-400 text-sm">Loading...</p>;

  return (
    <div>
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3, 4, 5].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              step === s ? "bg-purple-600 text-white" : step > s ? "bg-green-700 text-white" : "bg-slate-700 text-slate-400"
            }`}>
              {step > s ? "✓" : s}
            </div>
            {s < 5 && <div className={`w-8 h-0.5 ${step > s ? "bg-green-700" : "bg-slate-700"}`} />}
          </div>
        ))}
        <span className="text-xs text-slate-500 ml-2">
          {["Select Artifacts", "Select Repos", "Review", "Approve", "Execute"][step - 1]}
        </span>
      </div>

      {/* Step 1: Select Artifacts */}
      {step === 1 && (
        <div>
          <h3 className="text-white font-medium mb-3">Select Artifacts to Deploy</h3>
          {availableArtifacts.length === 0 ? (
            <p className="text-slate-500 text-sm">{artifacts.length > 0 ? "All artifacts have already been deployed." : "No artifacts available. Create some in the Library tab first."}</p>
          ) : (
            <div className="space-y-2 mb-4">
              {availableArtifacts.map((a) => (
                <label key={a.id} className="flex items-center gap-3 bg-slate-800/50 border border-slate-700 rounded-lg p-3 cursor-pointer hover:border-slate-600">
                  <input
                    type="checkbox"
                    checked={selectedArtifacts.includes(a.id)}
                    onChange={() => toggleArtifact(a.id)}
                    className="accent-purple-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm font-medium">{a.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded border ${TYPE_COLORS[a.artifact_type] || ""}`}>
                        {a.artifact_type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{a.description || a.target_path}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
          <button
            onClick={() => setStep(2)}
            disabled={selectedArtifacts.length === 0}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-sm text-white rounded transition-colors"
          >
            Next: Select Repos →
          </button>
        </div>
      )}

      {/* Step 2: Select Repos */}
      {step === 2 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-white font-medium">Select Target Repos</h3>
            <button onClick={selectAllRepos} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-xs text-white rounded transition-colors">
              Select All
            </button>
            <button onClick={() => setSelectedRepos([])} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-xs text-white rounded transition-colors">
              Clear
            </button>
          </div>
          <div className="space-y-2 mb-4">
            {repos.map((r) => (
              <label key={r.id} className="flex items-center gap-3 bg-slate-800/50 border border-slate-700 rounded-lg p-3 cursor-pointer hover:border-slate-600">
                <input
                  type="checkbox"
                  checked={selectedRepos.includes(r.id)}
                  onChange={() => toggleRepo(r.id)}
                  className="accent-purple-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm font-medium">{r.owner}/{r.name}</span>
                    {r.tier && <span className="text-xs px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded">{r.tier}</span>}
                  </div>
                  <p className="text-xs text-slate-400">
                    {r.domain || "—"} · Score: {r.context_score || 0}
                  </p>
                </div>
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-sm text-white rounded transition-colors">
              ← Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={selectedRepos.length === 0}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-sm text-white rounded transition-colors"
            >
              Next: Review →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review & Create */}
      {step === 3 && (
        <div>
          <h3 className="text-white font-medium mb-3">Review Deployment</h3>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div>
                <span className="text-slate-400">Artifacts:</span>
                <span className="text-white ml-2">{selectedArtifacts.length}</span>
              </div>
              <div>
                <span className="text-slate-400">Repos:</span>
                <span className="text-white ml-2">{selectedRepos.length}</span>
              </div>
            </div>
            <input
              placeholder="Deployment name (optional)"
              value={deployName}
              onChange={(e) => setDeployName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white mb-2"
            />
            <input
              placeholder="Description (optional)"
              value={deployDesc}
              onChange={(e) => setDeployDesc(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep(2)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-sm text-white rounded transition-colors">
              ← Back
            </button>
            <button onClick={handleCreateDeployment} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-sm text-white rounded transition-colors">
              Create & Plan Deployment
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Approve */}
      {step === 4 && deployment && (
        <div>
          <h3 className="text-white font-medium mb-3">Approve Deployment</h3>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-4">
            <p className="text-sm text-slate-300 mb-2">
              Deployment <span className="text-white font-mono">{deployment.id.slice(0, 8)}</span> planned for {deployment.total_repos} repos.
            </p>
            <p className="text-xs text-slate-400">Status: {deployment.status}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleApprove} className="px-4 py-2 bg-green-700 hover:bg-green-600 text-sm text-white rounded transition-colors">
              Approve & Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Execute */}
      {step === 5 && deployment && (
        <div>
          <h3 className="text-white font-medium mb-3">Execute Deployment</h3>
          {!executing && progress.length === 0 && (
            <button onClick={handleExecute} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-sm text-white rounded transition-colors mb-4">
              Execute Deployment (Async)
            </button>
          )}
          {(executing || progress.length > 0) && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 transition-all"
                    style={{ width: `${deployment.total_repos > 0 ? (progress.filter((p) => p.status === "completed" || p.status === "failed").length / deployment.total_repos) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-xs text-slate-400">
                  {progress.filter((p) => p.status === "completed" || p.status === "failed").length}/{deployment.total_repos}
                </span>
                {executing && <span className="text-xs text-indigo-400 animate-pulse">Running...</span>}
              </div>
              {progress.map((p) => (
                <div key={p.repo_id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    p.status === "completed" ? "bg-green-900/30 text-green-300" :
                    p.status === "failed" ? "bg-red-900/30 text-red-300" :
                    "bg-yellow-900/30 text-yellow-300"
                  }`}>
                    {p.status}
                  </span>
                  <span className="text-sm text-white">{p.repo_name || p.repo_id.slice(0, 8)}</span>
                  {p.error && <span className="text-xs text-red-400 ml-auto">{p.error}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────── Tab 3: History ─────────────────────── */

function HistoryTab() {
  const [deployments, setDeployments] = useState<ArtifactDeployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<DeploymentStatusResponse | null>(null);

  const loadDeployments = async () => {
    setLoading(true);
    const res = await api.listDeployments();
    if (res.success && res.data) setDeployments(res.data);
    setLoading(false);
  };

  useEffect(() => { loadDeployments(); }, []);

  // Auto-refresh while any deployment is executing
  useEffect(() => {
    const hasExecuting = deployments.some((d) => d.status === "executing");
    if (!hasExecuting) return;
    const interval = setInterval(loadDeployments, 5000);
    return () => clearInterval(interval);
  }, [deployments]);

  const handleExpand = async (id: string) => {
    if (expanded === id) {
      setExpanded(null);
      setDetail(null);
      return;
    }
    setExpanded(id);
    const res = await api.getDeployment(id);
    if (res.success && res.data) setDetail(res.data);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-medium">Deployment History</h3>
        <button onClick={loadDeployments} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-xs text-white rounded transition-colors">
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Loading...</p>
      ) : deployments.length === 0 ? (
        <p className="text-slate-500 text-sm">No deployments yet.</p>
      ) : (
        <div className="space-y-2">
          {deployments.map((d) => (
            <div key={d.id}>
              <div
                onClick={() => handleExpand(d.id)}
                className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 cursor-pointer hover:border-slate-600 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[d.status] || "bg-slate-700 text-slate-300"}`}>
                    {d.status}
                  </span>
                  <span className="text-white text-sm font-medium flex-1 truncate">{d.name}</span>
                  <span className="text-xs text-slate-400">
                    {d.completed_repos}/{d.total_repos} repos
                    {d.failed_repos > 0 && <span className="text-red-400 ml-1">({d.failed_repos} failed)</span>}
                  </span>
                  <span className="text-xs text-slate-500">{new Date(d.created_at).toLocaleString()}</span>
                </div>
              </div>

              {/* Expanded detail */}
              {expanded === d.id && detail && (
                <div className="bg-slate-900/50 border border-slate-700 border-t-0 rounded-b-lg p-4 space-y-2">
                  {detail.repos?.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 text-sm">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        r.status === "completed" ? "bg-green-900/30 text-green-300" :
                        r.status === "failed" ? "bg-red-900/30 text-red-300" :
                        "bg-slate-700 text-slate-300"
                      }`}>
                        {r.status}
                      </span>
                      <span className="text-slate-300">{r.repository_id.slice(0, 8)}</span>
                      {r.plan_id && <span className="text-xs text-slate-500">plan: {r.plan_id.slice(0, 8)}</span>}
                      {r.error_message && <span className="text-xs text-red-400 ml-auto">{r.error_message}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
