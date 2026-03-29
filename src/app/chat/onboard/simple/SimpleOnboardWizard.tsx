"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, CheckCircle, AlertCircle, ArrowRight, ExternalLink, Plus, Trash2, Building2, Key, Users, FolderOpen } from "lucide-react";
import { api, Organization, Team } from "@/lib/api";

interface SimpleOnboardWizardProps {
  onComplete?: (pipelineId: string, repoId: string) => void;
}

type WizardStep = "form" | "cloning" | "deploy_verify" | "complete" | "error";

export default function SimpleOnboardWizard({ onComplete }: SimpleOnboardWizardProps) {
  const [step, setStep] = useState<WizardStep>("form");
  const [repoUrl, setRepoUrl] = useState("");
  const [mainBranch, setMainBranch] = useState("main");
  const [qaBranch, setQaBranch] = useState("qa");
  const [qaEnvUrl, setQaEnvUrl] = useState("");

  // Organization
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [selectedOrgHasToken, setSelectedOrgHasToken] = useState(false);
  const [orgsLoading, setOrgsLoading] = useState(true);

  // Team assignment (v21.0)
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [discoveredModules, setDiscoveredModules] = useState<{ path: string; name: string; language: string }[]>([]);

  // Manual token (shown when org has no token or clone fails)
  const [githubToken, setGithubToken] = useState("");
  const [showManualToken, setShowManualToken] = useState(false);
  const [tokenRequired, setTokenRequired] = useState(false);

  // Multiple ELK URLs
  const [elkQaUrls, setElkQaUrls] = useState<string[]>([""]);
  const [elkProdUrls, setElkProdUrls] = useState<string[]>([""]);
  const [elkSaved, setElkSaved] = useState(false);
  const [elkSaving, setElkSaving] = useState(false);

  const [pipelineId, setPipelineId] = useState("");
  const [pipelineStatus, setPipelineStatus] = useState("");
  const [repoOwner, setRepoOwner] = useState("");
  const [repoName, setRepoName] = useState("");
  const [detectedLanguage, setDetectedLanguage] = useState("");
  const [detectedFramework, setDetectedFramework] = useState("");
  const [repositoryId, setRepositoryId] = useState("");
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  // Deploy verification
  const [deployStatus, setDeployStatus] = useState<"pending" | "checking" | "healthy" | "unreachable">("pending");
  const [deployInstructions, setDeployInstructions] = useState("");
  const [marsbuilderUrl, setMarsbuilderUrl] = useState("");
  const [verifying, setVerifying] = useState(false);

  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Load organizations on mount
  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    setOrgsLoading(true);
    try {
      const res = await api.listOrganizations();
      if (res.success && res.data) {
        setOrganizations(res.data);
        // Auto-select first org (Shiprocket)
        if (res.data.length > 0) {
          const defaultOrg = res.data[0];
          setSelectedOrgId(defaultOrg.id);
          setSelectedOrgHasToken(defaultOrg.has_token);
          setShowManualToken(!defaultOrg.has_token);
          loadTeams(defaultOrg.id);
        }
      }
    } catch {
      // If no orgs, show manual token by default
      setShowManualToken(true);
    }
    setOrgsLoading(false);
  };

  const handleOrgChange = (orgId: string) => {
    setSelectedOrgId(orgId);
    setSelectedTeamId("");
    if (orgId === "") {
      setSelectedOrgHasToken(false);
      setShowManualToken(true);
      setTeams([]);
      return;
    }
    const org = organizations.find((o) => o.id === orgId);
    if (org) {
      setSelectedOrgHasToken(org.has_token);
      setShowManualToken(!org.has_token);
      loadTeams(orgId);
    }
  };

  const loadTeams = async (orgId: string) => {
    setTeamsLoading(true);
    try {
      const res = await api.listTeams(orgId);
      if (res.success && res.data) {
        setTeams(res.data);
      }
    } catch {
      setTeams([]);
    }
    setTeamsLoading(false);
  };

  // Poll pipeline status while cloning
  useEffect(() => {
    if (step === "cloning" && pipelineId) {
      pollRef.current = setInterval(async () => {
        try {
          const res = await api.getSimpleOnboardingStatus(pipelineId);
          if (res.success && res.data) {
            setPipelineStatus(res.data.status);
            if (res.data.detected_language) setDetectedLanguage(res.data.detected_language);
            if (res.data.detected_framework) setDetectedFramework(res.data.detected_framework);
            if (res.data.repository_id) setRepositoryId(res.data.repository_id);
            if (res.data.discovered_modules) setDiscoveredModules(res.data.discovered_modules);

            if (res.data.status === "phase1_complete") {
              if (pollRef.current) clearInterval(pollRef.current);
              if (elkSaved) {
                // Move to deploy verification instead of complete
                setStep("deploy_verify");
              }
            } else if (res.data.status === "failed") {
              if (pollRef.current) clearInterval(pollRef.current);
              if (res.data.token_required) {
                // Clone failed due to token — go back to form with token fields visible
                setTokenRequired(true);
                setShowManualToken(true);
                setError(res.data.error_message || "Clone failed — please provide a GitHub token.");
                setStep("form");
              } else {
                // Clone failed — stay on cloning step with retry option (don't reset form)
                setError(res.data.error_message || "Cloning failed");
                setPipelineStatus("failed");
              }
            }
          }
        } catch {
          // Ignore polling errors
        }
      }, 3000);
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [step, pipelineId, elkSaved, onComplete]);

  const handleStart = async () => {
    if (!repoUrl || !mainBranch || !qaBranch) {
      setError("Repository URL, main branch, and QA branch are required");
      return;
    }

    // Need either org token or manual token
    if (!selectedOrgHasToken && !githubToken) {
      setError("GitHub token is required when organization has no stored token");
      return;
    }

    setStarting(true);
    setError("");

    try {
      const payload: Record<string, string> = {
        repo_url: repoUrl,
        main_branch: mainBranch,
        qa_branch: qaBranch,
      };

      if (qaEnvUrl.trim()) {
        payload.qa_env_url = qaEnvUrl.trim();
      }
      if (githubToken) {
        payload.github_token = githubToken;
      }
      if (selectedOrgId) {
        payload.organization_id = selectedOrgId;
      }
      if (selectedTeamId) {
        payload.team_id = selectedTeamId;
      }

      const res = await api.startSimpleOnboarding(payload as any);

      if (res.success && res.data) {
        setPipelineId(res.data.id);
        setRepoOwner(res.data.repo_owner);
        setRepoName(res.data.repo_name);
        setPipelineStatus("cloning");
        setStep("cloning");
        setTokenRequired(false);
      } else {
        setError(res.error || "Failed to start onboarding");
      }
    } catch {
      setError("Failed to start onboarding");
    }
    setStarting(false);
  };

  const handleSaveELK = async () => {
    const qaFiltered = elkQaUrls.filter((u) => u.trim() !== "");
    const prodFiltered = elkProdUrls.filter((u) => u.trim() !== "");

    if (qaFiltered.length === 0 && prodFiltered.length === 0) {
      setError("Please provide at least one ELK URL");
      return;
    }

    setElkSaving(true);
    setError("");

    try {
      const res = await api.saveSimpleOnboardingELKConfig(pipelineId, {
        elk_qa_urls: qaFiltered,
        elk_prod_urls: prodFiltered,
      });

      if (res.success && res.data?.saved) {
        setElkSaved(true);
        if (pipelineStatus === "phase1_complete") {
          setStep("deploy_verify");
        }
      } else {
        setError(res.error || "Failed to save ELK config");
      }
    } catch {
      setError("Failed to save ELK config");
    }
    setElkSaving(false);
  };

  const handleSkipELK = () => {
    // Block skipping until cloning is complete
    if (pipelineStatus !== "phase1_complete") {
      return;
    }
    setElkSaved(true);
    setStep("deploy_verify");
  };

  const handleVerifyDeploy = async () => {
    if (!qaEnvUrl.trim()) {
      setError("QA Environment URL is required to verify deployment");
      return;
    }

    setVerifying(true);
    setDeployStatus("checking");
    setError("");

    try {
      const res = await api.verifySimpleOnboardingDeploy(pipelineId, {
        qa_env_url: qaEnvUrl.trim(),
      });

      if (res.success && res.data) {
        if (res.data.status === "healthy") {
          setDeployStatus("healthy");
          setMarsbuilderUrl(res.data.marsbuilder_url || "");
          // Onboarding complete!
          setTimeout(() => {
            setStep("complete");
            onComplete?.(pipelineId, repositoryId);
          }, 1500);
        } else {
          setDeployStatus("unreachable");
          setDeployInstructions(res.data.instructions || "");
        }
      } else {
        setDeployStatus("unreachable");
        setError(res.error || "Verification failed");
      }
    } catch {
      setDeployStatus("unreachable");
      setError("Failed to verify deployment");
    }
    setVerifying(false);
  };

  const handleSkipDeploy = () => {
    // Allow completing onboarding without deploy verification
    // The marsbuilder URL will need to be configured later
    setStep("complete");
    onComplete?.(pipelineId, repositoryId);
  };

  // URL list helpers
  const addQaUrl = () => setElkQaUrls([...elkQaUrls, ""]);
  const removeQaUrl = (idx: number) => setElkQaUrls(elkQaUrls.filter((_, i) => i !== idx));
  const updateQaUrl = (idx: number, val: string) => {
    const updated = [...elkQaUrls];
    updated[idx] = val;
    setElkQaUrls(updated);
  };

  const addProdUrl = () => setElkProdUrls([...elkProdUrls, ""]);
  const removeProdUrl = (idx: number) => setElkProdUrls(elkProdUrls.filter((_, i) => i !== idx));
  const updateProdUrl = (idx: number, val: string) => {
    const updated = [...elkProdUrls];
    updated[idx] = val;
    setElkProdUrls(updated);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Step indicators */}
      <div className="flex items-center gap-3 mb-8 flex-wrap">
        <StepBadge num={1} label="Repository" active={step === "form"} done={step !== "form"} />
        <div className="w-6 h-px bg-white/20" />
        <StepBadge num={2} label="Clone & ELK" active={step === "cloning"} done={step === "deploy_verify" || step === "complete"} />
        <div className="w-6 h-px bg-white/20" />
        <StepBadge num={3} label="Deploy & Verify" active={step === "deploy_verify"} done={step === "complete"} />
        <div className="w-6 h-px bg-white/20" />
        <StepBadge num={4} label="Ready" active={step === "complete"} done={false} />
      </div>

      {error && step !== "error" && (
        <div className="mb-4 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Repository form */}
      {step === "form" && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">Simple Onboarding</h2>
            <p className="text-sm text-gray-400">
              Select your organization and provide repository details. While we clone and set up MARS, you can configure your ELK monitoring links.
            </p>
          </div>

          {/* Organization Selector */}
          <div>
            <label className="block text-sm text-gray-300 mb-1">Organization</label>
            {orgsLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading organizations...
              </div>
            ) : (
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={selectedOrgId}
                  onChange={(e) => handleOrgChange(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-sky-500/50 appearance-none cursor-pointer"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id} className="bg-[#0c1221] text-white">
                      {org.name} {org.has_token ? "(token stored)" : "(no token)"}
                    </option>
                  ))}
                  <option value="" className="bg-[#0c1221] text-white">
                    None — provide token manually
                  </option>
                </select>
              </div>
            )}
            {selectedOrgHasToken && !tokenRequired && (
              <p className="text-xs text-green-400/70 mt-1">
                Using stored GitHub token from this organization
              </p>
            )}
          </div>

          {/* Team Selector (v21.0) */}
          {selectedOrgId && (
            <div>
              <label className="block text-sm text-gray-300 mb-1">Team (optional)</label>
              {teamsLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading teams...
                </div>
              ) : teams.length > 0 ? (
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-sky-500/50 appearance-none cursor-pointer"
                  >
                    <option value="" className="bg-[#0c1221] text-white">No team — assign later</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id} className="bg-[#0c1221] text-white">
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="text-xs text-gray-500 py-1">No teams in this organization yet</p>
              )}
              {selectedTeamId && (
                <p className="text-xs text-sky-400/70 mt-1">
                  Discovered modules will be assigned to this team during onboarding
                </p>
              )}
            </div>
          )}

          {/* Token Required Warning */}
          {tokenRequired && (
            <div className="px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <div className="flex items-center gap-2 text-amber-400 text-sm font-medium mb-1">
                <Key className="w-4 h-4" />
                Token Required
              </div>
              <p className="text-xs text-amber-400/70">
                The organization&apos;s stored token could not access this repository. Please provide a GitHub token with access to clone this repo.
              </p>
            </div>
          )}

          {/* Manual Token Fields — shown when org has no token or clone failed */}
          {showManualToken && (
            <div>
              <label className="block text-sm text-gray-300 mb-1">GitHub Token (PAT)</label>
              <input
                type="password"
                placeholder="ghp_..."
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-sky-500/50"
              />
              <p className="text-xs text-gray-500 mt-1">
                Personal access token with repo read/write access
              </p>
            </div>
          )}

          {/* Show manual token toggle when org has token (in case they want to override) */}
          {selectedOrgHasToken && !showManualToken && !tokenRequired && (
            <button
              onClick={() => setShowManualToken(true)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Use a different token instead?
            </button>
          )}

          <div>
            <label className="block text-sm text-gray-300 mb-1">Repository URL</label>
            <input
              type="text"
              placeholder="https://github.com/org/repo"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-sky-500/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Main Branch</label>
              <input
                type="text"
                value={mainBranch}
                onChange={(e) => setMainBranch(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-sky-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">QA Branch</label>
              <input
                type="text"
                value={qaBranch}
                onChange={(e) => setQaBranch(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-sky-500/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">QA Environment URL</label>
            <input
              type="text"
              placeholder="https://qa-checkout.shiprocket.com"
              value={qaEnvUrl}
              onChange={(e) => setQaEnvUrl(e.target.value)}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-sky-500/50"
            />
            <p className="text-xs text-gray-500 mt-1">
              Base URL where the QA branch is deployed. MARS will register the task API endpoint at this URL for dispatching AI tasks.
            </p>
          </div>

          <button
            onClick={handleStart}
            disabled={starting}
            className="flex items-center gap-2 px-6 py-2.5 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors disabled:opacity-50"
          >
            {starting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Start Onboarding
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      )}

      {/* Step 2: Cloning + ELK Configuration */}
      {step === "cloning" && (
        <div className="space-y-6">
          {/* Clone progress */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
            <div className="flex items-center gap-3 mb-2">
              {pipelineStatus === "phase1_complete" ? (
                <CheckCircle className="w-5 h-5 text-green-400" />
              ) : (
                <Loader2 className="w-5 h-5 animate-spin text-sky-400" />
              )}
              <h3 className="text-white font-medium">
                {pipelineStatus === "phase1_complete"
                  ? "Repository setup complete"
                  : "Cloning & setting up repository..."}
              </h3>
            </div>
            <p className="text-sm text-gray-400 ml-8">
              {repoOwner}/{repoName}
              {detectedLanguage && ` \u2014 ${detectedLanguage}`}
              {detectedFramework && ` (${detectedFramework})`}
            </p>
            {pipelineStatus === "phase1_complete" && (
              <p className="text-xs text-green-400/70 ml-8 mt-1">
                Templates copied, CLAUDE.md generated, pushed to QA branch
              </p>
            )}
          </div>

          {/* Discovered Modules (v21.0) */}
          {discoveredModules.length > 0 && (
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <FolderOpen className="w-4 h-4 text-purple-400" />
                <h3 className="text-white font-medium text-sm">Discovered Modules ({discoveredModules.length})</h3>
                {selectedTeamId && (
                  <span className="ml-auto text-xs text-sky-400/70">Assigned to team</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {discoveredModules.map((mod, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    <span className="text-sm text-white truncate">{mod.name}</span>
                    <span className="text-xs text-gray-500 ml-auto">{mod.language}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Knowledge base seeded for each module. Managers can review and confirm later.
              </p>
            </div>
          )}

          {/* ELK Configuration Form — Multiple URLs */}
          <div className="p-5 rounded-xl bg-sky-500/5 border border-sky-500/20">
            <div className="flex items-center gap-2 mb-3">
              <ExternalLink className="w-4 h-4 text-sky-400" />
              <h3 className="text-white font-medium">ELK Monitoring Links</h3>
              {elkSaved && <CheckCircle className="w-4 h-4 text-green-400 ml-auto" />}
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Add your Kibana/ELK dashboard URLs for QA and Production environments.
              These will be used by MARS to debug Jira tickets and investigate Slack issues.
            </p>

            {!elkSaved ? (
              <div className="space-y-5">
                {/* QA URLs */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-sky-300">QA Environment</label>
                    <button
                      onClick={addQaUrl}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-sky-400 hover:text-sky-300 bg-sky-500/10 rounded-md hover:bg-sky-500/20 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Add URL
                    </button>
                  </div>
                  <div className="space-y-2">
                    {elkQaUrls.map((url, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="https://kibana.qa.example.com/app/discover"
                          value={url}
                          onChange={(e) => updateQaUrl(idx, e.target.value)}
                          className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-sky-500/50"
                        />
                        {elkQaUrls.length > 1 && (
                          <button
                            onClick={() => removeQaUrl(idx)}
                            className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Prod URLs */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-orange-300">Production Environment</label>
                    <button
                      onClick={addProdUrl}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-orange-400 hover:text-orange-300 bg-orange-500/10 rounded-md hover:bg-orange-500/20 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Add URL
                    </button>
                  </div>
                  <div className="space-y-2">
                    {elkProdUrls.map((url, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="https://kibana.prod.example.com/app/discover"
                          value={url}
                          onChange={(e) => updateProdUrl(idx, e.target.value)}
                          className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-sky-500/50"
                        />
                        {elkProdUrls.length > 1 && (
                          <button
                            onClick={() => removeProdUrl(idx)}
                            className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={handleSaveELK}
                    disabled={elkSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white text-sm rounded-lg hover:bg-sky-600 transition-colors disabled:opacity-50"
                  >
                    {elkSaving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      "Save ELK Config"
                    )}
                  </button>
                  <button
                    onClick={handleSkipELK}
                    disabled={pipelineStatus !== "phase1_complete"}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title={pipelineStatus !== "phase1_complete" ? "Wait for cloning to complete" : ""}
                  >
                    {pipelineStatus !== "phase1_complete" ? "Cloning in progress..." : "Skip for now"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-sm">
                <span className="text-green-400">ELK configuration saved</span>
                {elkQaUrls.filter(u => u.trim()).length > 0 && (
                  <div className="mt-2">
                    <span className="text-xs text-sky-300 font-medium">QA:</span>
                    {elkQaUrls.filter(u => u.trim()).map((u, i) => (
                      <span key={i} className="block text-gray-400 text-xs ml-2 mt-0.5">{u}</span>
                    ))}
                  </div>
                )}
                {elkProdUrls.filter(u => u.trim()).length > 0 && (
                  <div className="mt-1">
                    <span className="text-xs text-orange-300 font-medium">Prod:</span>
                    {elkProdUrls.filter(u => u.trim()).map((u, i) => (
                      <span key={i} className="block text-gray-400 text-xs ml-2 mt-0.5">{u}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Clone failed — show retry + editable fields */}
          {pipelineStatus === "failed" && (
            <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 space-y-4">
              <div className="flex items-center gap-2 text-red-400 font-medium">
                <AlertCircle className="w-4 h-4" />
                Cloning failed
              </div>
              {error && <p className="text-sm text-red-400/80">{error}</p>}
              <p className="text-sm text-gray-400">
                You can edit the details below and retry without re-entering everything.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Main Branch</label>
                  <input
                    type="text"
                    value={mainBranch}
                    onChange={(e) => setMainBranch(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">QA Branch</label>
                  <input
                    type="text"
                    value={qaBranch}
                    onChange={(e) => setQaBranch(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">QA Environment URL</label>
                <input
                  type="text"
                  value={qaEnvUrl}
                  onChange={(e) => setQaEnvUrl(e.target.value)}
                  placeholder="https://qa.example.com"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-sky-500/50"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setError("");
                    setPipelineStatus("");
                    handleStart();
                  }}
                  disabled={starting}
                  className="flex items-center gap-2 px-5 py-2 bg-sky-500 text-white text-sm rounded-lg hover:bg-sky-600 transition-colors disabled:opacity-50"
                >
                  {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  Retry Cloning
                </button>
                <button
                  onClick={() => { setStep("form"); setError(""); setPipelineStatus(""); }}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Back to full form
                </button>
              </div>
            </div>
          )}

          {/* Editable config after clone completes */}
          {pipelineStatus === "phase1_complete" && (
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-white font-medium text-sm">Repository Configuration</h3>
                <span className="text-xs text-gray-500">(editable)</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Main Branch</label>
                  <input
                    type="text"
                    value={mainBranch}
                    onChange={(e) => setMainBranch(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">QA Branch</label>
                  <input
                    type="text"
                    value={qaBranch}
                    onChange={(e) => setQaBranch(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">QA Environment URL</label>
                  <input
                    type="text"
                    value={qaEnvUrl}
                    onChange={(e) => setQaEnvUrl(e.target.value)}
                    placeholder="https://qa.example.com"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-sky-500/50"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Waiting message */}
          {elkSaved && pipelineStatus !== "phase1_complete" && pipelineStatus !== "failed" && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
              Waiting for repository setup to complete...
            </div>
          )}
        </div>
      )}

      {/* Step 3: Deploy & Verify */}
      {step === "deploy_verify" && (
        <div className="space-y-6">
          {/* Deploy instruction banner */}
          <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
            <h3 className="text-white font-medium mb-2">Deploy QA Branch</h3>
            <p className="text-sm text-gray-400">
              The task API has been added to the <span className="text-amber-300 font-mono">{qaBranch}</span> branch of{" "}
              <span className="text-white">{repoOwner}/{repoName}</span>.
              Deploy this branch to your QA server, then verify below.
            </p>
          </div>

          {/* QA URL input */}
          {!qaEnvUrl && (
            <div>
              <label className="block text-sm text-gray-300 mb-1">QA Environment URL</label>
              <input
                type="text"
                placeholder="https://qa-checkout.shiprocket.com"
                value={qaEnvUrl}
                onChange={(e) => setQaEnvUrl(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-sky-500/50"
              />
            </div>
          )}

          {qaEnvUrl && (
            <div className="text-sm text-gray-400">
              Health endpoint: <span className="text-sky-300 font-mono">{qaEnvUrl.replace(/\/+$/, "")}/v1/marsbuilder/health</span>
            </div>
          )}

          {/* Verify button */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleVerifyDeploy}
              disabled={verifying || !qaEnvUrl.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors disabled:opacity-50"
            >
              {verifying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : deployStatus === "healthy" ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              {verifying ? "Checking..." : deployStatus === "unreachable" ? "Verify Again" : "Verify Deployment"}
            </button>
            <button
              onClick={handleSkipDeploy}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Skip for now
            </button>
          </div>

          {/* Status indicator */}
          {deployStatus === "healthy" && (
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-2 text-green-400 font-medium">
                <CheckCircle className="w-5 h-5" />
                Marsbuilder is healthy!
              </div>
              <p className="text-sm text-gray-400 mt-1">
                Task API registered at: <span className="text-green-300 font-mono">{marsbuilderUrl}</span>
              </p>
            </div>
          )}

          {/* Instructions when unreachable */}
          {deployStatus === "unreachable" && deployInstructions && (
            <div className="p-5 rounded-xl bg-white/[0.03] border border-white/10 max-h-96 overflow-y-auto">
              <div className="flex items-center gap-2 text-amber-400 font-medium mb-3">
                <AlertCircle className="w-4 h-4" />
                Setup Required
              </div>
              <div className="text-sm text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                {deployInstructions}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 4: Complete */}
      {step === "complete" && (
        <div className="text-center py-8">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Onboarding Complete</h2>
          <p className="text-gray-400 mb-2">
            {repoOwner}/{repoName} has been onboarded to MARS.
            {detectedLanguage && ` Detected: ${detectedLanguage}`}
            {detectedFramework && ` (${detectedFramework})`}
          </p>
          {qaEnvUrl && (
            <p className="text-xs text-sky-400/70 mb-2">
              Task API registered at: <span className="text-sky-300">{qaEnvUrl.replace(/\/+$/, "")}/v1/marsbuilder/task</span>
            </p>
          )}
          {discoveredModules.length > 0 && (
            <p className="text-xs text-purple-400/70 mb-4">
              {discoveredModules.length} modules discovered &amp; KB seeded
              {selectedTeamId && " (assigned to team)"}
            </p>
          )}
          {(elkQaUrls.filter(u => u.trim()).length > 0 || elkProdUrls.filter(u => u.trim()).length > 0) && (
            <div className="inline-block text-left text-sm text-gray-400 bg-white/5 rounded-lg p-4 mt-2">
              {elkQaUrls.filter(u => u.trim()).length > 0 && (
                <div className="mb-2">
                  <span className="text-sky-300 font-medium">ELK QA ({elkQaUrls.filter(u => u.trim()).length}):</span>
                  {elkQaUrls.filter(u => u.trim()).map((u, i) => (
                    <span key={i} className="block ml-2 text-xs mt-0.5">{u}</span>
                  ))}
                </div>
              )}
              {elkProdUrls.filter(u => u.trim()).length > 0 && (
                <div>
                  <span className="text-orange-300 font-medium">ELK Prod ({elkProdUrls.filter(u => u.trim()).length}):</span>
                  {elkProdUrls.filter(u => u.trim()).map((u, i) => (
                    <span key={i} className="block ml-2 text-xs mt-0.5">{u}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Error state */}
      {step === "error" && (
        <div className="text-center py-8">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Onboarding Failed</h2>
          <p className="text-red-400 mb-6">{error}</p>
          <button
            onClick={() => { setStep("form"); setError(""); }}
            className="px-6 py-2.5 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

function StepBadge({ num, label, active, done }: { num: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
          done
            ? "bg-green-500 text-white"
            : active
            ? "bg-sky-500 text-white"
            : "bg-white/10 text-gray-500"
        }`}
      >
        {done ? <CheckCircle className="w-4 h-4" /> : num}
      </div>
      <span className={`text-sm ${active ? "text-white" : "text-gray-500"}`}>{label}</span>
    </div>
  );
}
