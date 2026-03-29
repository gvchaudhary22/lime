"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Github, Search, Star, Lock, Globe, ArrowRight, CheckCircle, Loader2, Unplug, GitBranch, X, Link2, Zap } from "lucide-react";
import { api } from "@/lib/api";
import ManualOnboardWizard from "./manual/ManualOnboardWizard";
import SimpleOnboardWizard from "./simple/SimpleOnboardWizard";

interface GitHubConnection {
  id: string;
  github_username: string;
  github_email: string;
  github_avatar_url: string;
  status: string;
}

interface GitHubRepo {
  id: number;
  full_name: string;
  name: string;
  owner: string;
  description: string;
  default_branch: string;
  language: string;
  html_url: string;
  private: boolean;
  star_count: number;
  updated_at: string;
}

function OnboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<"oauth" | "manual" | "simple">("oauth");
  const [step, setStep] = useState<"connect" | "select" | "starting">("connect");
  const [connection, setConnection] = useState<GitHubConnection | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [repoLoading, setRepoLoading] = useState(false);
  const [startingRepo, setStartingRepo] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [branch, setBranch] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  // Check for OAuth callback code (guard against React strict mode double-mount)
  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      const usedCode = sessionStorage.getItem("mars_oauth_code_used");
      if (usedCode !== code) {
        sessionStorage.setItem("mars_oauth_code_used", code);
        completeOAuth(code);
      }
    }
  }, [searchParams]);

  // Check existing connection
  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    setLoading(true);
    try {
      const res = await api.getGitHubConnection();
      if (res.success && res.data) {
        setConnection(res.data);
        setStep("select");
        loadRepos(1);
      }
    } catch {
      // Not connected
    }
    setLoading(false);
  };

  const completeOAuth = async (code: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await api.connectGitHub(code);
      if (res.success && res.data) {
        setConnection(res.data);
        setStep("select");
        loadRepos(1);
        // Remove code from URL and clear OAuth guard
        sessionStorage.removeItem("mars_oauth_code_used");
        router.replace("/chat/onboard");
      } else {
        sessionStorage.removeItem("mars_oauth_code_used");
        setError(res.error || "GitHub connection failed. Please try again.");
      }
    } catch (err) {
      sessionStorage.removeItem("mars_oauth_code_used");
      setError("Failed to connect GitHub. Please try again.");
    }
    setLoading(false);
  };

  const connectGitHub = async () => {
    try {
      const res = await api.getGitHubAuthURL();
      if (res.success && res.data) {
        window.location.href = res.data.auth_url;
      }
    } catch {
      setError("Failed to get auth URL");
    }
  };

  const loadRepos = async (p: number) => {
    setRepoLoading(true);
    try {
      const res = await api.getGitHubRepos(p);
      if (res.success && res.data) {
        setRepos(res.data);
        setPage(p);
      }
    } catch {
      setError("Failed to load repositories");
    }
    setRepoLoading(false);
  };

  const handleOnboardClick = (repo: GitHubRepo) => {
    setSelectedRepo(repo);
    setBranch(repo.default_branch || "main");
  };

  const cancelBranchSelect = () => {
    setSelectedRepo(null);
    setBranch("");
  };

  const startOnboarding = async () => {
    if (!selectedRepo) return;
    setStartingRepo(selectedRepo.full_name);
    setError("");
    try {
      const res = await api.startOnboarding({
        github_repo_full_name: selectedRepo.full_name,
        github_repo_id: selectedRepo.id,
        branch: branch || "main",
      });
      if (res.success && res.data) {
        router.push(`/chat/onboard/${res.data.id}`);
      }
    } catch {
      setError("Failed to start onboarding");
      setStartingRepo(null);
    }
  };

  const disconnect = async () => {
    await api.disconnectGitHub();
    setConnection(null);
    setStep("connect");
    setRepos([]);
  };

  const filteredRepos = repos.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.description || "").toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 30) return `${days}d ago`;
    return d.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#060b18]">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4">
        <h1 className="text-xl font-semibold text-white">Auto-Onboard Repository</h1>
        <p className="text-sm text-gray-400 mt-1">
          Connect your GitHub or paste a repo URL to let MARS analyze it with Claude AI
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-1 px-6 py-3 border-b border-white/10">
        <button
          onClick={() => setTab("oauth")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "oauth"
              ? "bg-sky-500/15 text-sky-400 border border-sky-500/30"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Github className="w-4 h-4" />
          GitHub OAuth
        </button>
        <button
          onClick={() => setTab("simple")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "simple"
              ? "bg-sky-500/15 text-sky-400 border border-sky-500/30"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Zap className="w-4 h-4" />
          Simple
        </button>
        <button
          onClick={() => setTab("manual")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "manual"
              ? "bg-sky-500/15 text-sky-400 border border-sky-500/30"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Link2 className="w-4 h-4" />
          Manual URL
        </button>
      </div>

      {tab === "simple" ? (
        <SimpleOnboardWizard />
      ) : tab === "manual" ? (
        <ManualOnboardWizard />
      ) : (
      <>
      {/* Step indicators */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-white/10">
        <StepIndicator num={1} label="Connect GitHub" active={step === "connect"} done={step !== "connect"} />
        <div className="w-8 h-px bg-white/20" />
        <StepIndicator num={2} label="Select Repository" active={step === "select"} done={step === "starting"} />
        <div className="w-8 h-px bg-white/20" />
        <StepIndicator num={3} label="Analyze" active={step === "starting"} done={false} />
      </div>

      {error && (
        <div className="mx-6 mt-4 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {step === "connect" && (
          <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center">
            <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mb-6">
              <Github className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-semibold text-white mb-3">Connect GitHub</h2>
            <p className="text-gray-400 mb-8">
              Link your GitHub account to let MARS access your repositories for AI analysis and context generation.
            </p>
            <button
              onClick={connectGitHub}
              className="flex items-center gap-3 px-8 py-3 bg-white text-black font-medium rounded-xl hover:bg-gray-100 transition-colors"
            >
              <Github className="w-5 h-5" />
              Connect with GitHub
            </button>
          </div>
        )}

        {step === "select" && (
          <div className="max-w-4xl mx-auto">
            {/* Connection info */}
            {connection && (
              <div className="flex items-center justify-between mb-6 p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-3">
                  <img
                    src={connection.github_avatar_url}
                    alt={connection.github_username}
                    className="w-10 h-10 rounded-full"
                  />
                  <div>
                    <p className="text-white font-medium">{connection.github_username}</p>
                    <p className="text-sm text-gray-400">{connection.github_email}</p>
                  </div>
                  <CheckCircle className="w-5 h-5 text-green-400 ml-2" />
                </div>
                <button
                  onClick={disconnect}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-red-400 transition-colors"
                >
                  <Unplug className="w-4 h-4" />
                  Disconnect
                </button>
              </div>
            )}

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search repositories..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-sky-500/50"
              />
            </div>

            {/* Repo list */}
            {repoLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
              </div>
            ) : (
              <div className="space-y-2">
                {filteredRepos.map((repo) => (
                  <div
                    key={repo.id}
                    className="rounded-xl bg-white/[0.03] border border-white/10 hover:border-sky-500/30 transition-colors"
                  >
                    <div className="flex items-center justify-between p-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-white font-medium truncate">{repo.name}</h3>
                          {repo.private ? (
                            <Lock className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                          ) : (
                            <Globe className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-sm text-gray-400 truncate mt-0.5">
                          {repo.description || "No description"}
                        </p>
                        <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500">
                          {repo.language && <span>{repo.language}</span>}
                          {repo.star_count > 0 && (
                            <span className="flex items-center gap-1">
                              <Star className="w-3 h-3" /> {repo.star_count}
                            </span>
                          )}
                          <span>Updated {formatDate(repo.updated_at)}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleOnboardClick(repo)}
                        disabled={startingRepo !== null}
                        className="flex items-center gap-2 px-4 py-2 ml-4 bg-sky-500/10 text-sky-400 rounded-lg hover:bg-sky-500/20 transition-colors disabled:opacity-50 flex-shrink-0"
                      >
                        {startingRepo === repo.full_name ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            Onboard
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>

                    {/* Branch selection — shown when this repo is selected */}
                    {selectedRepo?.id === repo.id && !startingRepo && (
                      <div className="px-4 pb-4 pt-1 border-t border-white/5">
                        <div className="flex items-center gap-3">
                          <GitBranch className="w-4 h-4 text-sky-400 flex-shrink-0" />
                          <input
                            type="text"
                            placeholder="Branch (e.g. develop, qa, main)"
                            value={branch}
                            onChange={(e) => setBranch(e.target.value)}
                            className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-sky-500/50"
                          />
                          <button
                            onClick={startOnboarding}
                            className="flex items-center gap-1.5 px-4 py-2 bg-sky-500 text-white text-sm rounded-lg hover:bg-sky-600 transition-colors"
                          >
                            Start
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={cancelBranchSelect}
                            className="p-2 text-gray-400 hover:text-white transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2 ml-7">
                          Specify the branch deployed on QA/local server for analysis
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            <div className="flex justify-center gap-4 mt-6">
              {page > 1 && (
                <button
                  onClick={() => loadRepos(page - 1)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Previous
                </button>
              )}
              {repos.length === 30 && (
                <button
                  onClick={() => loadRepos(page + 1)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Next Page
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}

function StepIndicator({ num, label, active, done }: { num: number; label: string; active: boolean; done: boolean }) {
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

export default function OnboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
        </div>
      }
    >
      <OnboardContent />
    </Suspense>
  );
}
