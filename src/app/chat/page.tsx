"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  Sparkles,
  ChevronDown,
  FolderOpen,
  Check,
  ArrowRightLeft,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import { api, Project } from "@/lib/api";

interface UserInfo {
  name: string;
  email: string;
  role: string;
}

export default function ChatPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [message, setMessage] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [mode, setMode] = useState("");
  const [platform, setPlatform] = useState("");
  const [agentRole, setAgentRole] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Rewrite mode state
  const [targetProject, setTargetProject] = useState<Project | null>(null);
  const [showTargetDropdown, setShowTargetDropdown] = useState(false);
  const [sourceModule, setSourceModule] = useState("");
  const [targetModule, setTargetModule] = useState("");
  const targetDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("mars_token");
    if (!token) {
      router.push("/");
      return;
    }
    const stored = localStorage.getItem("mars_user");
    if (stored) {
      setUser(JSON.parse(stored));
    }

    const loadProjects = async () => {
      // Try chat-ready projects first, fall back to all projects
      const res = await api.getChatReadyProjects();
      let projectList: Project[] = [];
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        projectList = res.data;
      } else {
        const allRes = await api.getProjects();
        if (allRes.success && Array.isArray(allRes.data)) {
          projectList = allRes.data;
        }
      }
      if (projectList.length === 0) {
        router.replace("/chat/projects");
        return;
      }
      setProjects(projectList);
      const savedProjectId = localStorage.getItem("mars_active_project");
      const saved = projectList.find((p) => p.id === savedProjectId);
      setSelectedProject(saved || projectList[0]);
    };
    loadProjects();
  }, [router]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowProjectDropdown(false);
      }
    };
    const handleTargetClickOutside = (e: MouseEvent) => {
      if (targetDropdownRef.current && !targetDropdownRef.current.contains(e.target as Node)) {
        setShowTargetDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("mousedown", handleTargetClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("mousedown", handleTargetClickOutside);
    };
  }, []);

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project);
    localStorage.setItem("mars_active_project", project.id);
    setShowProjectDropdown(false);
  };

  const [isSending, setIsSending] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !selectedProject || isSending) return;
    if (mode === "rewrite" && !targetProject) return; // Require target for rewrite

    setIsSending(true);

    try {
      // Get user info for the conversation
      const stored = localStorage.getItem("mars_user");
      const userInfo = stored ? JSON.parse(stored) : null;
      const userId = userInfo?.id || "default";

      // Create a new conversation
      const res = await api.createConversation({
        channel: "web",
        user_id: userId,
        project_id: selectedProject.id,
        title: message.trim().slice(0, 100),
      });

      if (res.success && res.data) {
        // Navigate to conversation page with initial message and mode
        const modeParam = mode ? `&mode=${mode}` : "";
        const platformParam = platform ? `&platform=${platform}` : "";
        const agentParam = agentRole ? `&agent=${agentRole}` : "";
        // Rewrite mode: include source/target repo + module
        const rewriteParams = mode === "rewrite" && targetProject
          ? `&source_repo=${selectedProject.repository_id || selectedProject.id}&target_repo=${targetProject.repository_id || targetProject.id}${sourceModule ? `&source_module=${encodeURIComponent(sourceModule)}` : ""}${targetModule ? `&target_module=${encodeURIComponent(targetModule)}` : ""}`
          : "";
        router.push(
          `/chat/${res.data.id}?msg=${encodeURIComponent(message.trim())}${modeParam}${platformParam}${agentParam}${rewriteParams}`
        );
      } else {
        console.error("Create conversation failed:", res.error);
        alert(res.error || "Failed to create conversation");
      }
    } catch (err) {
      console.error("Failed to create conversation:", err);
      alert("Unable to connect to server");
    } finally {
      setIsSending(false);
    }
  };

  const suggestions = [
    {
      title: "Debug an incident",
      description: "Investigate and find root cause of a production issue",
    },
    {
      title: "Explore a codebase",
      description: "Understand how a feature works across repositories",
    },
    {
      title: "Generate a fix",
      description: "Create a PR with code changes to resolve a bug",
    },
    {
      title: "Run an RCA",
      description: "Perform root cause analysis on a recent alert",
    },
  ];

  if (!user) return null;

  return (
    <div className="flex h-screen bg-[#0c0515]">
      <Sidebar activePage="chats" />

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-3xl">
          {/* Greeting */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-white mb-3">
              Good {getGreeting()},{" "}
              <span className="bg-gradient-to-r from-purple-300 to-violet-400 bg-clip-text text-transparent">
                {user.name?.split(" ")[0] || "there"}
              </span>
            </h1>
            <p className="text-lg text-slate-400">
              How can I help you today?
            </p>
          </div>

          {/* Project selector */}
          <div className="mb-4 flex justify-center">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm transition-all ${
                  selectedProject
                    ? "border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/15"
                    : "border-white/[0.08] bg-white/[0.05] text-slate-400 hover:bg-white/[0.08]"
                }`}
              >
                <FolderOpen className="w-4 h-4" />
                {selectedProject ? selectedProject.name : "Select a project"}
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${
                    showProjectDropdown ? "rotate-180" : ""
                  }`}
                />
              </button>

              {showProjectDropdown && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-[#1a0e2e] border border-white/[0.08] rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-white/[0.06]">
                    <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                      Select Project
                    </span>
                  </div>
                  <div className="max-h-60 overflow-y-auto py-1">
                    {projects.map((project) => (
                      <button
                        key={project.id}
                        onClick={() => handleSelectProject(project)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/[0.05] transition-colors ${
                          selectedProject?.id === project.id
                            ? "bg-purple-500/10"
                            : ""
                        }`}
                      >
                        <FolderOpen
                          className={`w-4 h-4 flex-shrink-0 ${
                            selectedProject?.id === project.id
                              ? "text-purple-400"
                              : "text-slate-500"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <div
                            className={`text-sm truncate ${
                              selectedProject?.id === project.id
                                ? "text-purple-300 font-medium"
                                : "text-white"
                            }`}
                          >
                            {project.name}
                          </div>
                          {project.description && (
                            <div className="text-xs text-slate-500 truncate mt-0.5">
                              {project.description}
                            </div>
                          )}
                        </div>
                        {selectedProject?.id === project.id && (
                          <Check className="w-4 h-4 text-purple-400 flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mode selector */}
          {selectedProject && (
            <div className="mb-4 flex justify-center gap-2 flex-wrap">
              {[
                { value: "debug", label: "Debug" },
                { value: "feature", label: "Feature" },
                { value: "rca", label: "RCA" },
                { value: "refactor", label: "Refactor" },
                { value: "docs", label: "Docs" },
                { value: "rewrite", label: "Rewrite" },
              ].map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMode(mode === m.value ? "" : m.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    mode === m.value
                      ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                      : "bg-white/[0.03] text-slate-500 border border-white/[0.06] hover:text-slate-400 hover:bg-white/[0.05]"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}

          {/* Rewrite Mode — Dual Repo Selector */}
          {mode === "rewrite" && selectedProject && (
            <div className="mb-4 mx-auto max-w-xl">
              <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <ArrowRightLeft className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-medium text-purple-300">Rewrite Feature Across Repos</span>
                </div>

                <div className="grid grid-cols-[1fr,auto,1fr] gap-3 items-start">
                  {/* Source */}
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">Source (from)</label>
                    <div className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white">
                      {selectedProject.name}
                    </div>
                    <input
                      type="text"
                      placeholder="Module (e.g., orders)"
                      value={sourceModule}
                      onChange={(e) => setSourceModule(e.target.value)}
                      className="mt-2 w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500/30"
                    />
                  </div>

                  {/* Arrow */}
                  <div className="pt-7">
                    <ArrowRightLeft className="w-5 h-5 text-purple-400/50" />
                  </div>

                  {/* Target */}
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">Target (to)</label>
                    <div className="relative" ref={targetDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setShowTargetDropdown(!showTargetDropdown)}
                        className="w-full flex items-center justify-between bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white hover:bg-white/[0.05] transition"
                      >
                        <span className={targetProject ? "text-white" : "text-slate-500"}>
                          {targetProject?.name || "Select target repo"}
                        </span>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                      {showTargetDropdown && (
                        <div className="absolute z-50 mt-1 w-full bg-[#1a1a2e] border border-white/[0.08] rounded-lg shadow-2xl max-h-48 overflow-y-auto">
                          {projects
                            .filter((p) => p.id !== selectedProject.id)
                            .map((project) => (
                              <button
                                key={project.id}
                                onClick={() => {
                                  setTargetProject(project);
                                  setShowTargetDropdown(false);
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-white/[0.05] transition flex items-center justify-between"
                              >
                                <span>{project.name}</span>
                                {targetProject?.id === project.id && (
                                  <Check className="w-3.5 h-3.5 text-purple-400" />
                                )}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="Target module (optional)"
                      value={targetModule}
                      onChange={(e) => setTargetModule(e.target.value)}
                      className="mt-2 w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500/30"
                    />
                  </div>
                </div>

                {!targetProject && (
                  <p className="text-[10px] text-amber-400/70 mt-2">Select a target repo to enable rewrite</p>
                )}
              </div>
            </div>
          )}

          {/* Platform and Agent selector */}
          {selectedProject && (
            <div className="mb-4 flex justify-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Platform:</span>
                {[
                  { value: "", label: "Default" },
                  { value: "claude", label: "Claude" },
                  { value: "codex", label: "Codex" },
                ].map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPlatform(platform === p.value ? "" : p.value)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      platform === p.value
                        ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                        : "bg-white/[0.03] text-slate-500 border border-white/[0.06] hover:text-slate-400 hover:bg-white/[0.05]"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Agent:</span>
                <input
                  type="text"
                  value={agentRole}
                  onChange={(e) => setAgentRole(e.target.value)}
                  placeholder="optional"
                  className="w-28 px-2.5 py-1 rounded-lg text-xs bg-white/[0.03] text-slate-400 border border-white/[0.06] placeholder-slate-600 focus:outline-none focus:border-purple-500/30"
                />
              </div>
            </div>
          )}

          {/* Chat input */}
          <form onSubmit={handleSend} className="mb-8">
            <div className="relative">
              <div
                className={`flex items-center bg-white/[0.05] border rounded-2xl px-5 py-4 transition-all ${
                  selectedProject
                    ? "border-white/[0.08] focus-within:ring-2 focus-within:ring-purple-500/30 focus-within:border-purple-500/30"
                    : "border-white/[0.06] opacity-60"
                }`}
              >
                <Sparkles className="w-5 h-5 text-purple-400 mr-3 flex-shrink-0" />
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    selectedProject
                      ? `Ask about ${selectedProject.name}...`
                      : "Select a project first..."
                  }
                  disabled={!selectedProject}
                  className="flex-1 bg-transparent text-white placeholder-slate-500 text-sm focus:outline-none disabled:cursor-not-allowed"
                />
                <button
                  type="submit"
                  disabled={!message.trim() || !selectedProject || isSending}
                  className="ml-3 w-8 h-8 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-white/[0.05] disabled:text-slate-600 text-white flex items-center justify-center transition-colors flex-shrink-0"
                >
                  {isSending ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <ArrowUp className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Suggestion cards */}
          <div className="grid grid-cols-2 gap-3">
            {suggestions.map((s) => (
              <button
                key={s.title}
                onClick={() => {
                  if (selectedProject) setMessage(s.title);
                }}
                disabled={!selectedProject}
                className="text-left p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-purple-500/20 transition-all group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white/[0.02] disabled:hover:border-white/[0.06]"
              >
                <div className="text-sm font-medium text-white group-hover:text-purple-300 transition-colors">
                  {s.title}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {s.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
