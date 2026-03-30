"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Loader2,
  GitBranch,
  Eye,
  EyeOff,
  AlertTriangle,
  Zap,
  Shield,
  Code2,
  Bug,
  Search as SearchIcon,
  Settings,
  Users,
  FileCode,
  Rocket,
} from "lucide-react";
import { api, ManualOnboardingResponse } from "@/lib/api";
import { XCircle, BarChart3 } from "lucide-react";

const STANDARD_ROLES = [
  { name: "dev", label: "Developer", icon: Code2, description: "Core development, feature implementation" },
  { name: "architect", label: "Architect", icon: Settings, description: "System design, architecture decisions" },
  { name: "qa", label: "QA", icon: SearchIcon, description: "Testing, quality assurance" },
  { name: "security", label: "Security", icon: Shield, description: "Security audits, vulnerability checks" },
  { name: "reviewer", label: "Reviewer", icon: Users, description: "Code review, best practices" },
  { name: "debug", label: "Debug", icon: Bug, description: "Debugging, root cause analysis" },
  { name: "ops", label: "Ops", icon: Zap, description: "DevOps, deployment, monitoring" },
  { name: "support", label: "Support", icon: FileCode, description: "Documentation, support tasks" },
];

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export default function ManualOnboardWizard() {
  const router = useRouter();
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [pipeline, setPipeline] = useState<ManualOnboardingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1 fields
  const [repoUrl, setRepoUrl] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [bearerToken, setBearerToken] = useState("");
  const [qaHostUrl, setQaHostUrl] = useState("");
  const [showGhToken, setShowGhToken] = useState(false);
  const [showBearerToken, setShowBearerToken] = useState(false);

  // Step 2 fields
  const [mainBranch, setMainBranch] = useState("main");
  const [qaBranch, setQaBranch] = useState("qa");
  const [createQaBranch, setCreateQaBranch] = useState(true);

  // Step 4 fields
  const [selectedRoles, setSelectedRoles] = useState<string[]>(
    STANDARD_ROLES.map((r) => r.name)
  );

  // SSE polling ref
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const pollStatus = (id: string, onPhaseReached: string, nextStep: WizardStep) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const res = await api.getManualOnboardingStatus(id);
        if (res.success && res.data) {
          setPipeline(res.data);
          if (res.data.phase === onPhaseReached || res.data.status === "completed") {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setLoading(false);
            setWizardStep(nextStep);
          } else if (res.data.status === "failed") {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setLoading(false);
            setError(res.data.error_message || "Pipeline failed");
          }
        }
      } catch {
        // keep polling
      }
    }, 2000);
  };

  // Step 1: Submit repo URL + tokens
  const handleStep1 = async () => {
    setError("");
    if (!repoUrl.match(/^https:\/\/github\.com\/[^/]+\/[^/]+$/)) {
      setError("Invalid URL. Expected: https://github.com/{owner}/{repo}");
      return;
    }
    if (!githubToken) {
      setError("GitHub Personal Access Token is required");
      return;
    }
    setLoading(true);
    try {
      const res = await api.startManualOnboarding({
        repo_url: repoUrl,
        github_token: githubToken,
        bearer_token: bearerToken || undefined,
        qa_host_url: qaHostUrl || undefined,
      });
      if (res.success && res.data) {
        setPipelineId(res.data.id);
        setPipeline(res.data);
        setWizardStep(2);
      } else {
        setError(res.error || "Failed to start onboarding");
      }
    } catch {
      setError("Failed to start onboarding");
    }
    setLoading(false);
  };

  // Step 2: Configure branches
  const handleStep2 = async () => {
    if (!pipelineId) return;
    setError("");
    setLoading(true);
    try {
      const res = await api.configureBranches(pipelineId, {
        main_branch: mainBranch,
        qa_branch: qaBranch,
        create_qa_branch: createQaBranch,
      });
      if (res.success && res.data) {
        setPipeline(res.data);
        setWizardStep(3);
      } else {
        setError(res.error || "Failed to configure branches");
      }
    } catch {
      setError("Failed to configure branches");
    }
    setLoading(false);
  };

  // Step 3: Start analysis — polls for analysis_review (quality gate) or role_selection (direct pass)
  const handleStep3 = async () => {
    if (!pipelineId) return;
    setError("");
    setLoading(true);
    try {
      const res = await api.runManualAnalysis(pipelineId);
      if (res.success) {
        // Poll for either analysis_review (quality gate) or role_selection (direct pass)
        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = setInterval(async () => {
          try {
            const statusRes = await api.getManualOnboardingStatus(pipelineId);
            if (statusRes.success && statusRes.data) {
              setPipeline(statusRes.data);
              if (statusRes.data.phase === "analysis_review") {
                if (pollingRef.current) clearInterval(pollingRef.current);
                setLoading(false);
                setWizardStep(4); // analysis review step
              } else if (statusRes.data.phase === "role_selection") {
                if (pollingRef.current) clearInterval(pollingRef.current);
                setLoading(false);
                setWizardStep(5); // skip review, go to roles
              } else if (statusRes.data.status === "failed" || statusRes.data.phase === "cancelled") {
                if (pollingRef.current) clearInterval(pollingRef.current);
                setLoading(false);
                setError(statusRes.data.error_message || "Pipeline failed");
              }
            }
          } catch {
            // keep polling
          }
        }, 2000);
      } else {
        setError(res.error || "Failed to start analysis");
        setLoading(false);
      }
    } catch {
      setError("Failed to start analysis");
      setLoading(false);
    }
  };

  // Step 4: Approve analysis (when quality gate routes to analysis_review)
  const handleApproveAnalysis = async () => {
    if (!pipelineId) return;
    setError("");
    setLoading(true);
    try {
      const res = await api.approveAnalysis(pipelineId);
      if (res.success && res.data) {
        setPipeline(res.data);
        setWizardStep(5); // proceed to roles
      } else {
        setError(res.error || "Failed to approve analysis");
      }
    } catch {
      setError("Failed to approve analysis");
    }
    setLoading(false);
  };

  // Cancel pipeline
  const handleCancelPipeline = async () => {
    if (!pipelineId) return;
    setError("");
    setLoading(true);
    try {
      const res = await api.cancelPipeline(pipelineId);
      if (res.success) {
        router.push("/chat/onboard");
      } else {
        setError(res.error || "Failed to cancel pipeline");
      }
    } catch {
      setError("Failed to cancel pipeline");
    }
    setLoading(false);
  };

  // Step 5: Select roles
  const handleStep5 = async () => {
    if (!pipelineId) return;
    setError("");
    setLoading(true);
    try {
      const res = await api.selectRoles(pipelineId, selectedRoles);
      if (res.success && res.data) {
        setPipeline(res.data);
        setWizardStep(6);
      } else {
        setError(res.error || "Failed to save roles");
      }
    } catch {
      setError("Failed to save roles");
    }
    setLoading(false);
  };

  // Step 6: Generate + Push
  const handleStep6 = async () => {
    if (!pipelineId) return;
    setError("");
    setLoading(true);
    try {
      const res = await api.generateAndPush(pipelineId);
      if (res.success) {
        pollStatus(pipelineId, "integrating", 7);
      } else {
        setError(res.error || "Failed to start generation");
        setLoading(false);
      }
    } catch {
      setError("Failed to start generation");
      setLoading(false);
    }
  };

  // Step 7: Finalize
  const handleStep7 = async () => {
    if (!pipelineId) return;
    setError("");
    setLoading(true);
    try {
      const res = await api.finalizeManualOnboarding(pipelineId);
      if (res.success && res.data) {
        setPipeline(res.data);
      } else {
        setError(res.error || "Failed to finalize");
      }
    } catch {
      setError("Failed to finalize");
    }
    setLoading(false);
  };

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const stepLabels = [
    "Repo URL",
    "Branches",
    "Analysis",
    "Review",
    "Roles",
    "Generate",
    "Complete",
  ];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Step indicators */}
      <div className="flex items-center gap-2 px-6 py-4 border-b border-white/10">
        {stepLabels.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            {i > 0 && <div className="w-6 h-px bg-white/20" />}
            <div className="flex items-center gap-1.5">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  i + 1 < wizardStep
                    ? "bg-green-500 text-white"
                    : i + 1 === wizardStep
                    ? "bg-sky-500 text-white"
                    : "bg-white/10 text-gray-500"
                }`}
              >
                {i + 1 < wizardStep ? (
                  <CheckCircle className="w-3.5 h-3.5" />
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`text-xs ${
                  i + 1 === wizardStep ? "text-white" : "text-gray-500"
                }`}
              >
                {label}
              </span>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="mx-6 mt-4 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          {/* STEP 1: Repo URL + Tokens */}
          {wizardStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">Repository URL</h2>
                <p className="text-sm text-gray-400">
                  Paste the GitHub repository URL and provide access tokens
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">GitHub Repository URL *</label>
                  <input
                    type="url"
                    placeholder="https://github.com/org/repo"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-sky-500/50"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">GitHub Personal Access Token *</label>
                  <div className="relative">
                    <input
                      type={showGhToken ? "text" : "password"}
                      placeholder="ghp_xxxxxxxxxxxx"
                      value={githubToken}
                      onChange={(e) => setGithubToken(e.target.value)}
                      className="w-full px-4 py-2.5 pr-10 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-sky-500/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGhToken(!showGhToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      {showGhToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Needs &apos;repo&apos; scope for clone + push access
                  </p>
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">Bearer Token (optional)</label>
                  <div className="relative">
                    <input
                      type={showBearerToken ? "text" : "password"}
                      placeholder="Token for marsbuilder task API auth"
                      value={bearerToken}
                      onChange={(e) => setBearerToken(e.target.value)}
                      className="w-full px-4 py-2.5 pr-10 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-sky-500/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowBearerToken(!showBearerToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      {showBearerToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">QA Host URL (optional)</label>
                  <input
                    type="url"
                    placeholder="https://qa.example.com"
                    value={qaHostUrl}
                    onChange={(e) => setQaHostUrl(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-sky-500/50"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    The server where MARS CLI is installed for runtime task execution
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleStep1}
                  disabled={loading || !repoUrl || !githubToken}
                  className="flex items-center gap-2 px-6 py-2.5 bg-sky-500 text-white rounded-xl hover:bg-sky-600 transition-colors disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Next <ArrowRight className="w-4 h-4" /></>}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Branch Config */}
          {wizardStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">Branch Configuration</h2>
                <p className="text-sm text-gray-400">
                  Specify the main branch and the QA branch where generated files will be pushed
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">
                    <GitBranch className="w-4 h-4 inline mr-1" />
                    Main Branch
                  </label>
                  <input
                    type="text"
                    placeholder="main"
                    value={mainBranch}
                    onChange={(e) => setMainBranch(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-sky-500/50"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Could be main, master, or release — the primary branch of the project
                  </p>
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">
                    <GitBranch className="w-4 h-4 inline mr-1" />
                    QA Branch
                  </label>
                  <input
                    type="text"
                    placeholder="qa"
                    value={qaBranch}
                    onChange={(e) => setQaBranch(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-sky-500/50"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createQaBranch}
                    onChange={(e) => setCreateQaBranch(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-sky-500 focus:ring-sky-500/50"
                  />
                  <span className="text-sm text-gray-300">
                    Create QA branch if it doesn&apos;t exist (from main)
                  </span>
                </label>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setWizardStep(1)}
                  className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  onClick={handleStep2}
                  disabled={loading || !mainBranch || !qaBranch}
                  className="flex items-center gap-2 px-6 py-2.5 bg-sky-500 text-white rounded-xl hover:bg-sky-600 transition-colors disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Next <ArrowRight className="w-4 h-4" /></>}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Analysis */}
          {wizardStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">Code Analysis</h2>
                <p className="text-sm text-gray-400">
                  MARS will clone your repository and analyze it with AI to detect language, framework, and architecture
                </p>
              </div>

              {loading ? (
                <div className="p-8 rounded-xl bg-white/[0.03] border border-white/10 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-sky-400 mx-auto mb-4" />
                  <p className="text-white font-medium">
                    {pipeline?.current_step || "Analyzing..."}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    This may take a few minutes
                  </p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <button
                    onClick={handleStep3}
                    className="flex items-center gap-2 px-6 py-3 bg-sky-500 text-white rounded-xl hover:bg-sky-600 transition-colors mx-auto"
                  >
                    <Zap className="w-5 h-5" />
                    Start Analysis
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Analysis Review (v17.0 — quality gate) */}
          {wizardStep === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">Analysis Review</h2>
                <p className="text-sm text-gray-400">
                  Review the analysis results before proceeding to role selection
                </p>
              </div>

              {/* Confidence score */}
              {pipeline?.analysis_confidence !== undefined && (
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-sky-400" />
                      <span className="text-sm font-medium text-white">Analysis Confidence</span>
                    </div>
                    <span className={`text-lg font-bold ${
                      pipeline.analysis_confidence >= 0.7 ? "text-green-400" :
                      pipeline.analysis_confidence >= 0.4 ? "text-yellow-400" : "text-red-400"
                    }`}>
                      {Math.round(pipeline.analysis_confidence * 100)}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pipeline.analysis_confidence >= 0.7 ? "bg-green-500" :
                        pipeline.analysis_confidence >= 0.4 ? "bg-yellow-500" : "bg-red-500"
                      }`}
                      style={{ width: `${Math.round(pipeline.analysis_confidence * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Detection results */}
              <div className="grid grid-cols-3 gap-4">
                {pipeline?.detected_language && (
                  <div className="p-3 rounded-lg bg-white/5">
                    <p className="text-xs text-gray-400">Language</p>
                    <p className="text-white font-medium mt-0.5">{pipeline.detected_language}</p>
                  </div>
                )}
                {pipeline?.detected_framework && (
                  <div className="p-3 rounded-lg bg-white/5">
                    <p className="text-xs text-gray-400">Framework</p>
                    <p className="text-white font-medium mt-0.5">{pipeline.detected_framework}</p>
                  </div>
                )}
                {pipeline?.detected_architecture && (
                  <div className="p-3 rounded-lg bg-white/5">
                    <p className="text-xs text-gray-400">Architecture</p>
                    <p className="text-white font-medium mt-0.5">{pipeline.detected_architecture}</p>
                  </div>
                )}
              </div>

              {/* Warnings */}
              {pipeline?.analysis_warnings && pipeline.analysis_warnings.length > 0 && (
                <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 space-y-2">
                  <div className="flex items-center gap-2 text-yellow-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm font-medium">Warnings</span>
                  </div>
                  <ul className="space-y-1">
                    {pipeline.analysis_warnings.map((w, i) => (
                      <li key={i} className="text-sm text-yellow-300 flex items-start gap-2">
                        <span className="text-yellow-500 mt-1">-</span> {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Role recommendations */}
              {pipeline?.role_recommendations && pipeline.role_recommendations.length > 0 && (
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
                  <p className="text-sm font-medium text-white">Role Recommendations</p>
                  <div className="space-y-2">
                    {pipeline.role_recommendations.map((rec) => (
                      <div key={rec.role_name} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white">{rec.display_name || rec.role_name}</span>
                          {rec.locked && <Shield className="w-3 h-3 text-gray-400" />}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            rec.status === "required" ? "bg-red-500/20 text-red-400" :
                            rec.status === "recommended" ? "bg-sky-500/20 text-sky-400" :
                            rec.status === "blocked" ? "bg-red-500/20 text-red-400" :
                            "bg-white/10 text-gray-400"
                          }`}>
                            {rec.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between">
                <button
                  onClick={handleCancelPipeline}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" /> Cancel Onboarding
                </button>
                <button
                  onClick={handleApproveAnalysis}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-2.5 bg-sky-500 text-white rounded-xl hover:bg-sky-600 transition-colors disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Approve & Continue <ArrowRight className="w-4 h-4" /></>}
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: Role Selection */}
          {wizardStep === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">Agent Roles</h2>
                <p className="text-sm text-gray-400">
                  Select which AI agent roles to enable. Disabled roles will be commented out and can be re-enabled later.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-gray-300 font-medium">Standard Roles</p>
                <div className="grid grid-cols-2 gap-3">
                  {STANDARD_ROLES.map((role) => {
                    const Icon = role.icon;
                    const isSelected = selectedRoles.includes(role.name);
                    return (
                      <button
                        key={role.name}
                        onClick={() => toggleRole(role.name)}
                        className={`flex items-start gap-3 p-3 rounded-xl border transition-colors text-left ${
                          isSelected
                            ? "bg-sky-500/10 border-sky-500/30"
                            : "bg-white/[0.02] border-white/10 opacity-60"
                        }`}
                      >
                        <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isSelected ? "text-sky-400" : "text-gray-500"}`} />
                        <div>
                          <p className={`text-sm font-medium ${isSelected ? "text-white" : "text-gray-400"}`}>
                            {role.label}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">{role.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {pipeline?.domain_roles && pipeline.domain_roles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-300 font-medium">Auto-detected Domain Roles</p>
                  <div className="grid grid-cols-2 gap-3">
                    {pipeline.domain_roles.map((role) => {
                      const isSelected = selectedRoles.includes(role);
                      return (
                        <button
                          key={role}
                          onClick={() => toggleRole(role)}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                            isSelected
                              ? "bg-purple-500/10 border-purple-500/30"
                              : "bg-white/[0.02] border-white/10 opacity-60"
                          }`}
                        >
                          <Zap className={`w-5 h-5 flex-shrink-0 ${isSelected ? "text-purple-400" : "text-gray-500"}`} />
                          <span className={`text-sm font-medium ${isSelected ? "text-white" : "text-gray-400"}`}>
                            {role}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-between">
                <button
                  onClick={() => setWizardStep(4)}
                  className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  onClick={handleStep5}
                  disabled={loading || selectedRoles.length === 0}
                  className="flex items-center gap-2 px-6 py-2.5 bg-sky-500 text-white rounded-xl hover:bg-sky-600 transition-colors disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Next <ArrowRight className="w-4 h-4" /></>}
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: Generate + Push */}
          {wizardStep === 6 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">Generate &amp; Push</h2>
                <p className="text-sm text-gray-400">
                  MARS will generate the AI infrastructure, marsbuilder task API, and push to the QA branch
                </p>
              </div>

              {loading ? (
                <div className="p-8 rounded-xl bg-white/[0.03] border border-white/10 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-sky-400 mx-auto mb-4" />
                  <p className="text-white font-medium">
                    {pipeline?.current_step || "Generating..."}
                  </p>
                  {pipeline?.files_generated ? (
                    <p className="text-sm text-gray-400 mt-1">
                      {pipeline.files_generated} files generated
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400 mt-1">
                      This may take several minutes
                    </p>
                  )}
                </div>
              ) : pipeline?.phase === "integrating" ? (
                <div className="p-6 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Generation Complete</span>
                  </div>
                  <p className="text-sm text-gray-400">
                    {pipeline.files_generated || 0} files generated and pushed to the QA branch
                  </p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <button
                    onClick={handleStep6}
                    className="flex items-center gap-2 px-6 py-3 bg-sky-500 text-white rounded-xl hover:bg-sky-600 transition-colors mx-auto"
                  >
                    <Rocket className="w-5 h-5" />
                    Generate &amp; Push
                  </button>
                </div>
              )}

              {!loading && pipeline?.phase === "integrating" && (
                <div className="flex justify-end">
                  <button
                    onClick={() => setWizardStep(7)}
                    className="flex items-center gap-2 px-6 py-2.5 bg-sky-500 text-white rounded-xl hover:bg-sky-600 transition-colors"
                  >
                    Finalize <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 7: Complete */}
          {wizardStep === 7 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">Finalize Integration</h2>
                <p className="text-sm text-gray-400">
                  Link this repository to MARS for chat, task dispatch, and ticket integration
                </p>
              </div>

              {pipeline?.status === "completed" ? (
                <div className="p-8 rounded-xl bg-white/[0.03] border border-green-500/20 text-center space-y-4">
                  <CheckCircle className="w-12 h-12 text-green-400 mx-auto" />
                  <h3 className="text-xl font-semibold text-white">Onboarding Complete!</h3>
                  <p className="text-sm text-gray-400">
                    Your repository has been analyzed, configured, and linked to MARS.
                    {pipeline.files_generated ? ` ${pipeline.files_generated} files were generated.` : ""}
                  </p>
                  {pipeline.onboarding_pr_url && (
                    <a
                      href={pipeline.onboarding_pr_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-sky-400 hover:text-sky-300 underline"
                    >
                      View Onboarding PR
                    </a>
                  )}
                  <button
                    onClick={() => router.push("/chat/projects")}
                    className="flex items-center gap-2 px-6 py-3 bg-sky-500 text-white rounded-xl hover:bg-sky-600 transition-colors mx-auto"
                  >
                    Start Chatting
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <button
                    onClick={handleStep7}
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors mx-auto disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Finalize &amp; Link to MARS
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
