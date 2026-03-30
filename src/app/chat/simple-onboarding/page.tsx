"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Search, ChevronLeft, GitBranch, CheckCircle2, Clock, Package, Loader2,
  ChevronDown, ChevronUp, ChevronRight, Trash2, Users, MessageCircle, Sparkles,
  ArrowUp, Paperclip, Mic, MicOff, User, Bot, Terminal, Eye, EyeOff, Square, BookOpen,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import SimpleOnboardWizard from "@/app/chat/onboard/simple/SimpleOnboardWizard";
import { api, Repository, InterviewStatus } from "@/lib/api";
import { streamFreeFormChat, StreamChunk } from "@/lib/stream";
import MarkdownRenderer from "@/components/chat/MarkdownRenderer";
import SuggestionChips from "./components/SuggestionChips";
import RepoConfigEditor from "./components/RepoConfigEditor";
import { ContextScoreRing, StageProgress, timeAgo } from "./components/UIHelpers";
import AgentGenerationPanel from "../projects/[id]/components/AgentGenerationPanel";
import ELKIndexManager from "./components/ELKIndexManager";

// ───────── Types ─────────
interface TeamMemberRow { name: string; email: string; role: string; modules: string[]; reportsTo: string }
interface ModuleTreeItem {
  path: string; name: string; score: number; enriched: boolean;
  submodules?: { path: string; name: string; score: number; enriched: boolean }[];
}
interface ToolStep { tool: string; input?: unknown; output?: string }
interface ChatMsg { role: "user" | "assistant"; content: string; isStreaming?: boolean; toolSteps?: ToolStep[] }

export default function SimpleOnboardingPage() {
  const router = useRouter();

  // ───── Repo list ─────
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [interviewStatus, setInterviewStatus] = useState<InterviewStatus | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  // ───── Team setup ─────
  const [teamMembers, setTeamMembers] = useState<TeamMemberRow[]>([]);
  const [showTeamSetup, setShowTeamSetup] = useState(false);
  const [teamSetupDone, setTeamSetupDone] = useState(false);

  // ───── Modules ─────
  const [moduleTree, setModuleTree] = useState<ModuleTreeItem[]>([]);
  const [showModuleSection, setShowModuleSection] = useState(false);
  const [newModuleName, setNewModuleName] = useState("");
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [newSubmoduleName, setNewSubmoduleName] = useState("");
  const [selectedModuleDetail, setSelectedModuleDetail] = useState<ModuleTreeItem | null>(null);

  // ───── Chat ─────
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatSessionId, setChatSessionId] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatStreaming, setChatStreaming] = useState(false);
  const [detailedView, setDetailedView] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  // ───── Build Context ─────
  const [buildContextRunning, setBuildContextRunning] = useState(false);
  const [buildContextProgress, setBuildContextProgress] = useState<{step: string; message: string; index: number; total: number; modulesCompleted: string[]}>(
    {step: "", message: "", index: 0, total: 0, modulesCompleted: []}
  );
  const [buildContextDone, setBuildContextDone] = useState(false);
  const [buildContextResult, setBuildContextResult] = useState<{modules_scanned: number; files_generated: number} | null>(null);

  // ───── Constants ─────
  const ONBOARDING_STAGES = [
    { key: "cloned", label: "Cloned" }, { key: "analyzed", label: "Analyzed" },
    { key: "templates", label: "Templates" }, { key: "elk", label: "ELK Config" },
    { key: "deployed", label: "Deployed" }, { key: "enriched", label: "Enriched" },
  ];

  function getOnboardingStage(repo: Repository): number {
    if (repo.context_score >= 50) return 6;
    if (repo.backend_health_status === "healthy" || repo.backend_health_status === "up") return 5;
    if (repo.onboarding_status === "completed" || repo.onboarding_status === "complete") return 4;
    if (repo.clone_path) return 3;
    if (repo.onboarding_status === "analyzing") return 2;
    return 1;
  }

  const getGreeting = () => { const h = new Date().getHours(); return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening"; };
  const userName = (() => { try { const u = localStorage.getItem("mars_user"); return u ? JSON.parse(u).name?.split(" ")[0] : "there"; } catch { return "there"; } })();

  useEffect(() => { const t = localStorage.getItem("mars_token"); if (!t) { router.push("/"); return; } fetchRepos(); }, [router]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  // ───── Repo ops ─────
  const fetchRepos = async () => {
    const res = await api.listRepositories();
    if (res.success && res.data) setRepos(res.data.filter(r => r.clone_path || r.onboarding_status === "completed" || r.onboarding_status === "complete"));
    setLoading(false);
  };

  const selectRepo = async (repo: Repository) => {
    setSelectedRepo(repo); setShowPanel(true); setInterviewStatus(null);
    setChatMessages([]); setChatSessionId(""); setChatInput("");
    setTeamSetupDone(false); setShowTeamSetup(false); setShowModuleSection(false);
    setSelectedModuleDetail(null); setExpandedModule(null); setExpandedSteps({});

    const [statusRes] = await Promise.all([api.getInterviewStatus(repo.id)]);
    loadModuleTree(repo.id);
    if (statusRes.success && statusRes.data) setInterviewStatus(statusRes.data);

    try {
      let teamId = "";
      const myTeams = await api.getMyTeams();
      if (myTeams.success && myTeams.data?.length) teamId = myTeams.data[0].team_id;
      if (!teamId) { const all = await api.listTeams(); if (all.success && all.data?.length) teamId = all.data[0].id; }
      if (teamId) {
        const detail = await api.getTeam(teamId);
        if (detail.success && detail.data) {
          const raw = detail.data as unknown as { members?: { email?: string; user_id: string; role: string; manager_id?: string }[] };
          const members = (raw.members || []).map(m => ({ name: m.email?.split("@")[0] || m.user_id, email: m.email || "", role: m.role, modules: [] as string[], reportsTo: m.manager_id || "" }));
          if (members.length) { setTeamMembers([...members, { name: "", email: "", role: "developer", modules: [], reportsTo: "" }]); setTeamSetupDone(true); }
        }
      }
    } catch { /* non-fatal */ }
  };

  // ───── Module ops ─────
  const loadModuleTree = async (repoId: string) => { const res = await api.listOnboardingModules(repoId); if (res.success && res.data) setModuleTree(res.data); };
  const handleAddModule = async () => { if (!selectedRepo || !newModuleName.trim()) return; const res = await api.addOnboardingModule({ repository_id: selectedRepo.id, name: newModuleName.trim() }); if (res.success) { setNewModuleName(""); await loadModuleTree(selectedRepo.id); await api.confirmOnboardingModules({ repository_id: selectedRepo.id }); const s = await api.getInterviewStatus(selectedRepo.id); if (s.success && s.data) setInterviewStatus(s.data); } };
  const handleAddSubmodule = async (parentPath: string) => { if (!selectedRepo || !newSubmoduleName.trim()) return; const res = await api.addOnboardingModule({ repository_id: selectedRepo.id, name: newSubmoduleName.trim(), parent_path: parentPath }); if (res.success) { setNewSubmoduleName(""); loadModuleTree(selectedRepo.id); } };
  const handleRemoveModule = async (modulePath: string) => { if (!selectedRepo) return; await api.removeOnboardingModule({ repository_id: selectedRepo.id, module_path: modulePath }); loadModuleTree(selectedRepo.id); };
  const handleConfirmModules = async () => { if (!selectedRepo) return; await api.confirmOnboardingModules({ repository_id: selectedRepo.id }); const s = await api.getInterviewStatus(selectedRepo.id); if (s.success && s.data) setInterviewStatus(s.data); };

  // ───── Build Context (one-click) ─────
  const handleBuildContext = async () => {
    if (!selectedRepo || buildContextRunning) return;
    setBuildContextRunning(true);
    setBuildContextDone(false);
    setBuildContextResult(null);
    setBuildContextProgress({step: "", message: "Starting...", index: 0, total: 0, modulesCompleted: []});

    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
      const token = typeof window !== "undefined" ? localStorage.getItem("mars_token") : null;
      const headers: Record<string, string> = {"Content-Type": "application/json"};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/api/v1/onboarding/simple/build-context/stream`, {
        method: "POST",
        headers,
        body: JSON.stringify({repository_id: selectedRepo.id}),
      });

      if (!res.ok || !res.body) throw new Error("Failed to start build context");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        buf += decoder.decode(value, {stream: true});

        const lines = buf.split("\n");
        buf = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const evt = JSON.parse(line.slice(6));
              if (evt.type === "module_done") {
                setBuildContextProgress(prev => ({
                  ...prev, step: evt.step, message: evt.message, index: evt.index, total: evt.total,
                  modulesCompleted: [...prev.modulesCompleted, evt.module],
                }));
              } else if (evt.type === "step_start" || evt.type === "step_done") {
                setBuildContextProgress(prev => ({...prev, step: evt.step, message: evt.message, total: evt.total || prev.total}));
              } else if (evt.type === "complete") {
                setBuildContextResult({modules_scanned: evt.modules_scanned, files_generated: evt.files_generated});
                setBuildContextDone(true);
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }
    } catch (err) {
      setBuildContextProgress(prev => ({...prev, message: `Error: ${err}`}));
    } finally {
      setBuildContextRunning(false);
      // Refresh repo data
      if (selectedRepo) {
        loadModuleTree(selectedRepo.id);
        api.getInterviewStatus(selectedRepo.id).then(r => { if (r.success && r.data) setInterviewStatus(r.data); });
        // Refresh repo list to get updated context_score
        api.getRepositories().then(r => {
          if (r.success && r.data) {
            setRepos(r.data);
            const updated = r.data.find((rr: Repository) => rr.id === selectedRepo.id);
            if (updated) setSelectedRepo(updated);
          }
        });
      }
    }
  };

  // ───── Team ops ─────
  const updateTeamMember = (i: number, field: keyof TeamMemberRow, value: string | string[]) => setTeamMembers(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m));
  const addTeamMemberRow = () => setTeamMembers(prev => [...prev, { name: "", email: "", role: "developer", modules: [], reportsTo: "" }]);
  const removeTeamMemberRow = (i: number) => setTeamMembers(prev => prev.filter((_, idx) => idx !== i));

  // ───── Chat ops (with tool_use/tool_result visibility like /chat/[id]) ─────
  const sendChatMessage = async (message: string) => {
    if (!selectedRepo || !message.trim() || chatStreaming) return;
    abortRef.current = false;
    const userMsg: ChatMsg = { role: "user", content: message };
    const assistantMsg: ChatMsg = { role: "assistant", content: "", isStreaming: true, toolSteps: [] };
    setChatMessages(prev => [...prev, userMsg, assistantMsg]);
    setChatInput("");
    setChatStreaming(true);

    try {
      await streamFreeFormChat(
        { repository_id: selectedRepo.id, message, session_id: chatSessionId },
        (chunk: StreamChunk) => {
          if (abortRef.current) return;
          setChatMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role !== "assistant") return updated;

            if (chunk.type === "assistant" && chunk.text) {
              updated[updated.length - 1] = { ...last, content: last.content + chunk.text };
            } else if (chunk.type === "tool_use") {
              const steps = last.toolSteps || [];
              updated[updated.length - 1] = { ...last, toolSteps: [...steps, { tool: chunk.tool || "unknown", input: chunk.input }] };
            } else if (chunk.type === "tool_result") {
              const steps = [...(last.toolSteps || [])];
              if (steps.length) steps[steps.length - 1] = { ...steps[steps.length - 1], output: chunk.output };
              updated[updated.length - 1] = { ...last, toolSteps: steps };
            } else if (chunk.type === "result") {
              try {
                const r = chunk.output ? JSON.parse(chunk.output) : (chunk.text ? JSON.parse(chunk.text) : null);
                if (r?.session_id) setChatSessionId(r.session_id);
                if (r?.context_score) {
                  setSelectedRepo(prev => prev ? { ...prev, context_score: r.context_score } : prev);
                  setRepos(prev => prev.map(rr => rr.id === selectedRepo.id ? { ...rr, context_score: r.context_score } : rr));
                }
              } catch { if (chunk.text && !last.content) updated[updated.length - 1] = { ...last, content: chunk.text }; }
            }
            if (chunk.session_id) setChatSessionId(chunk.session_id);
            return updated;
          });
        }
      );
      // Finalize streaming
      setChatMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last.role === "assistant") updated[updated.length - 1] = { ...last, isStreaming: false };
        return updated;
      });
    } catch (err) {
      setChatMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: `Error: ${err instanceof Error ? err.message : "Failed"}`, isStreaming: false };
        return updated;
      });
    }
    setChatStreaming(false);
  };

  const handleStop = () => { abortRef.current = true; setChatStreaming(false); setChatMessages(prev => { const u = [...prev]; const l = u[u.length-1]; if (l.role === "assistant" && l.isStreaming) u[u.length-1] = { ...l, isStreaming: false }; return u; }); };

  const toggleStep = (key: string) => setExpandedSteps(prev => ({ ...prev, [key]: !prev[key] }));

  const toggleRecording = () => {
    if (isRecording) { recognitionRef.current?.stop(); setIsRecording(false); return; }
    const SR = (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    if (!SR) { alert("Speech recognition not supported"); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new (SR as any)(); recognition.lang = "en-US"; recognition.interimResults = true; recognition.continuous = true;
    recognitionRef.current = recognition;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => { let t = ""; for (let i = e.resultIndex; i < e.results.length; i++) { if (e.results[i].isFinal) t += e.results[i][0].transcript + " "; } if (t) setChatInput(prev => prev + t); };
    recognition.onend = () => setIsRecording(false); recognition.start(); setIsRecording(true);
  };

  const filtered = repos.filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || r.git_url?.toLowerCase().includes(search.toLowerCase()));

  // ───── Tool steps renderer (same as /chat/[id]) ─────
  const renderToolSteps = (msg: ChatMsg, msgIdx: number) => {
    if (!msg.toolSteps?.length) return null;
    const allSteps = msg.toolSteps;
    const visibleSteps = detailedView ? allSteps : allSteps.slice(-5);
    const hiddenCount = allSteps.length - visibleSteps.length;

    return (
      <div className="my-3 space-y-1.5">
        {hiddenCount > 0 && <div className="text-[10px] text-slate-600 px-3 py-1">+{hiddenCount} more step{hiddenCount > 1 ? "s" : ""} hidden</div>}
        {visibleSteps.map((step, i) => {
          const actualIndex = detailedView ? i : allSteps.length - visibleSteps.length + i;
          const key = `msg-${msgIdx}-step-${actualIndex}`;
          const isExpanded = detailedView ? expandedSteps[key] !== false : expandedSteps[key] === true;
          return (
            <div key={key} className="rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              <button onClick={() => toggleStep(key)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-slate-300 transition-colors">
                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                <Terminal className="w-3 h-3 text-purple-400" />
                <span className="font-medium text-purple-300">{step.tool}</span>
                {step.output && !isExpanded && <span className="ml-auto text-emerald-400/60 text-[10px]">completed</span>}
                {!step.output && msg.isStreaming && <span className="ml-auto text-amber-400/60 text-[10px] animate-pulse">running...</span>}
              </button>
              {isExpanded && (
                <div className="px-3 pb-2 space-y-1.5">
                  {step.input != null && <pre className="text-[11px] text-slate-500 bg-black/30 rounded px-2 py-1.5 overflow-x-auto max-h-32">{typeof step.input === "string" ? step.input : JSON.stringify(step.input, null, 2)}</pre>}
                  {step.output && <pre className="text-[11px] text-slate-400 bg-black/30 rounded px-2 py-1.5 overflow-x-auto max-h-48">{step.output}</pre>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ───── Message renderer (same as /chat/[id] with avatars + markdown) ─────
  const renderMessage = (msg: ChatMsg, i: number) => (
    <div key={i} className="flex gap-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${msg.role === "user" ? "bg-purple-600" : "bg-gradient-to-br from-orange-400 to-amber-600"}`}>
        {msg.role === "user" ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-slate-500 mb-1.5 font-medium">{msg.role === "user" ? "You" : "MARS AI"}</div>
        {msg.role === "assistant" ? (
          <div>
            {renderToolSteps(msg, i)}
            {msg.content && !msg.isStreaming ? (
              <MarkdownRenderer content={msg.content} />
            ) : (
              <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                {msg.content}
                {msg.isStreaming && !msg.content && !msg.toolSteps?.length && (
                  <span className="inline-flex gap-1 ml-1">
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  </span>
                )}
                {msg.isStreaming && msg.content && <span className="inline-block w-2 h-4 bg-purple-400 ml-0.5 animate-pulse" />}
                {msg.isStreaming && msg.toolSteps?.length && !msg.content && <span className="text-xs text-slate-500 animate-pulse">AI is working...</span>}
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{msg.content}</div>
        )}
      </div>
    </div>
  );

  // ───── Chat input bar (same as /chat page) ─────
  const renderChatInput = (placeholder: string) => (
    <div className="p-4 border-t border-white/[0.06]">
      <div className="flex items-center bg-white/[0.05] border border-white/[0.08] rounded-2xl px-5 py-3 focus-within:ring-2 focus-within:ring-purple-500/30 focus-within:border-purple-500/30 transition-all">
        <Sparkles className="w-4 h-4 text-purple-400 mr-3 flex-shrink-0" />
        <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !chatStreaming) { e.preventDefault(); sendChatMessage(chatInput); } }}
          placeholder={placeholder} disabled={chatStreaming}
          className="flex-1 bg-transparent text-white placeholder-slate-500 text-sm focus:outline-none" />
        <button onClick={() => fileInputRef.current?.click()} className="ml-2 text-slate-400 hover:text-purple-300"><Paperclip className="w-4 h-4" /></button>
        <button onClick={toggleRecording} className={`ml-2 ${isRecording ? "text-red-400" : "text-slate-400 hover:text-purple-300"}`}>
          {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>
        {chatStreaming ? (
          <button onClick={handleStop} className="ml-3 w-7 h-7 rounded-lg bg-red-600 hover:bg-red-500 text-white flex items-center justify-center transition-colors">
            <Square className="w-3 h-3" />
          </button>
        ) : (
          <button onClick={() => sendChatMessage(chatInput)} disabled={!chatInput.trim()}
            className="ml-3 w-7 h-7 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-white/[0.05] disabled:text-slate-600 text-white flex items-center justify-center transition-colors">
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <input type="file" ref={fileInputRef} className="hidden" accept=".png,.jpg,.csv,.txt,.md,.pdf" multiple />
    </div>
  );

  // ───── Suggestion cards (same style as /chat page) ─────
  const renderSuggestionCards = (cards: { title: string; desc: string }[], contextName: string) => (
    <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto mb-6">
      {cards.map(s => (
        <button key={s.title} onClick={() => sendChatMessage(`${s.title} for ${contextName}`)}
          className="text-left p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-purple-500/20 transition-all group">
          <div className="text-sm font-medium text-white group-hover:text-purple-300">{s.title}</div>
          <div className="text-xs text-slate-500 mt-1">{s.desc}</div>
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex h-screen bg-[#0c0515]">
      <Sidebar activePage="simple-onboarding" />
      <div className="flex-1 flex overflow-hidden">

        {/* ═══════ LEFT: Repo List ═══════ */}
        <div className={`flex-1 flex flex-col overflow-hidden transition-all ${showPanel ? "hidden" : ""}`}>
          <div className="px-8 pt-8 pb-4">
            <div className="flex items-center justify-between mb-6">
              <div><h1 className="text-2xl font-bold text-white">Simple Onboarding</h1><p className="text-sm text-slate-400 mt-1">Repositories onboarded via the simple flow</p></div>
              <button onClick={() => { setShowWizard(!showWizard); setShowPanel(false); setSelectedRepo(null); }}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${showWizard ? "bg-white/[0.08] text-slate-300" : "bg-purple-600 hover:bg-purple-700 text-white"}`}>
                <Plus className="w-4 h-4" />{showWizard ? "Back to List" : "New Onboarding"}
              </button>
            </div>
            {!showWizard && (
              <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search repositories..."
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30" />
              </div>
            )}
          </div>
          {showWizard ? (
            <div className="flex-1 overflow-y-auto px-8 pb-8"><div className="mt-4 max-w-3xl mx-auto"><SimpleOnboardWizard onComplete={() => { setShowWizard(false); fetchRepos(); }} /></div></div>
          ) : (
            <div className="flex-1 overflow-y-auto px-8 pb-8">
              {loading ? <div className="space-y-3 mt-4">{[1,2,3].map(i => <div key={i} className="h-28 rounded-xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />)}</div>
              : filtered.length === 0 ? <div className="flex flex-col items-center justify-center py-20 text-slate-400"><Package className="w-12 h-12 mb-4 text-slate-500" /><p className="text-lg">No onboarded repositories</p></div>
              : <ul className="space-y-3 mt-4 list-none p-0 m-0">{filtered.map(repo => {
                  const stage = getOnboardingStage(repo);
                  return (<li key={repo.id}><button type="button" onClick={() => selectRepo(repo)}
                    className={`w-full text-left rounded-xl border transition-all cursor-pointer p-5 ${selectedRepo?.id === repo.id ? "border-purple-500/40 bg-purple-500/[0.06]" : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2"><span className="text-sm font-semibold text-white truncate">{repo.name}</span>
                          {repo.onboarding_status === "completed" || repo.onboarding_status === "complete" ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Clock className="w-3.5 h-3.5 text-yellow-500" />}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">{repo.default_branch && <span className="flex items-center gap-1"><GitBranch className="w-3 h-3" />{repo.default_branch}</span>}<span>{timeAgo(repo.updated_at)}</span></div>
                      </div>
                      <ContextScoreRing score={repo.context_score} />
                    </div>
                    <div className="mt-2"><span className="text-[11px] text-slate-400 uppercase tracking-wider">Stage {stage}/{ONBOARDING_STAGES.length}: {ONBOARDING_STAGES[Math.min(stage, ONBOARDING_STAGES.length) - 1]?.label}</span><StageProgress currentStage={stage} /></div>
                  </button></li>);
                })}</ul>}
            </div>
          )}
        </div>

        {/* ═══════ RIGHT: Detail Panel ═══════ */}
        {showPanel && selectedRepo && (
          <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0412]">
            {/* Header */}
            <div className="border-b border-white/[0.06] px-5 py-4 flex items-center gap-4 shrink-0">
              <button onClick={() => { if (selectedModuleDetail) setSelectedModuleDetail(null); else { setShowPanel(false); setSelectedRepo(null); } }} className="p-1.5 rounded-lg hover:bg-white/[0.05] text-slate-400 hover:text-white"><ChevronLeft className="w-5 h-5" /></button>
              <div className="flex-1 min-w-0">
                <h1 className="text-white font-medium truncate">{selectedModuleDetail ? selectedModuleDetail.name : selectedRepo.name}</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  {selectedModuleDetail ? (
                    <><span className="text-xs text-slate-400">{selectedRepo.name}</span><span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${selectedModuleDetail.enriched ? "bg-green-500/10 text-green-400" : "bg-slate-500/10 text-slate-400"}`}>{selectedModuleDetail.score}/100</span></>
                  ) : (
                    <><span className="text-xs text-slate-400">{selectedRepo.onboarding_method} onboarding</span>
                    {interviewStatus?.repo_profile?.detected_framework && <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 font-medium">{interviewStatus.repo_profile.detected_framework}</span>}
                    {interviewStatus?.repo_profile?.size_tier && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-medium">{interviewStatus.repo_profile.size_tier}</span>}</>
                  )}
                </div>
              </div>
              {/* Create Knowledge Base — visible after onboarding complete */}
              {(selectedRepo.onboarding_status === "completed" || selectedRepo.onboarding_status === "complete") && !selectedModuleDetail && (
                <button
                  onClick={async () => {
                    const confirmed = window.confirm(
                      `Create Knowledge Base for ${selectedRepo.name}?\n\nThis will:\n• Generate Pillar 1 (Schema) YAML files\n• Generate Pillar 3 (API/Tools) YAML files\n• Generate Pillar 4 (Page/Role) YAML files\n• Trigger COSMOS training pipeline\n\nContinue?`
                    );
                    if (!confirmed) return;
                    try {
                      const token = localStorage.getItem("mars_token");
                      // Single call: MARS creates KB + triggers COSMOS pipeline + updates repo status
                      const res = await fetch(`${process.env.NEXT_PUBLIC_MARS_URL || "http://localhost:8080"}/api/v1/admin/kb-updates/create`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                        body: JSON.stringify({ repo_id: selectedRepo.name }),
                      });
                      const data = await res.json();
                      alert(`Knowledge Base creation started for ${selectedRepo.name}!\n\nEvent ID: ${data?.data?.event_id || "created"}\nStatus: ${data?.data?.status || "processing"}\n\nGo to Admin → AI Training to monitor progress.`);
                    } catch (err) {
                      alert(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-gradient-to-r from-sky-500 to-blue-600 text-white hover:from-sky-400 hover:to-blue-500 transition-all"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Create KB
                </button>
              )}
              {/* Detailed view toggle */}
              <button onClick={() => setDetailedView(!detailedView)} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${detailedView ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" : "text-slate-500 hover:text-slate-400 bg-white/[0.03] border border-white/[0.06]"}`}>
                {detailedView ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                {detailedView ? "Detailed" : "Simple"}
              </button>
              <ContextScoreRing score={selectedModuleDetail ? selectedModuleDetail.score : selectedRepo.context_score} size={42} />
            </div>

            {/* ═══ MODULE DETAIL VIEW ═══ */}
            {selectedModuleDetail ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Team mapping for module */}
                <div className="px-5 py-3 border-b border-white/[0.06] shrink-0">
                  <h4 className="text-xs text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2"><Users className="w-3 h-3" /> Team for {selectedModuleDetail.name}</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {teamMembers.filter(m => m.email).map((m, i) => {
                      const assigned = m.modules.includes(selectedModuleDetail!.path);
                      return (<button key={i} onClick={() => { const upd = assigned ? m.modules.filter(p => p !== selectedModuleDetail!.path) : [...m.modules, selectedModuleDetail!.path]; updateTeamMember(teamMembers.indexOf(m), "modules", upd); }}
                        className={`px-2 py-1 rounded text-[10px] transition-colors ${assigned ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" : "bg-white/[0.03] text-slate-400 border border-white/[0.06] hover:text-white"}`}>
                        {m.name || m.email.split("@")[0]} {assigned && <CheckCircle2 className="w-2.5 h-2.5 inline ml-1" />}
                      </button>);
                    })}
                    {teamMembers.filter(m => m.email).length === 0 && <span className="text-[10px] text-slate-500 italic">No team members. Set up team first.</span>}
                  </div>
                </div>
                {/* Submodules */}
                {(selectedModuleDetail.submodules || []).length > 0 && (
                  <div className="px-5 py-3 border-b border-white/[0.06] shrink-0">
                    <h4 className="text-xs text-slate-400 uppercase tracking-wider mb-2">Submodules</h4>
                    <div className="space-y-1">{selectedModuleDetail.submodules!.map(sub => (<div key={sub.path} className="flex items-center justify-between px-2 py-1.5 rounded bg-white/[0.02] border border-white/[0.06]"><span className="text-xs text-slate-300">├── {sub.name} <span className="text-slate-500">{sub.score}/100</span></span></div>))}</div>
                  </div>
                )}
                {/* Chat */}
                <div className="flex-1 overflow-y-auto px-6 py-6">
                  <div className="max-w-3xl mx-auto space-y-6">
                    {chatMessages.length === 0 && (
                      <div className="text-center mb-12 pt-8">
                        <h2 className="text-2xl font-bold text-white mb-2">Good {getGreeting()}, <span className="bg-gradient-to-r from-purple-300 to-violet-400 bg-clip-text text-transparent">{userName}</span></h2>
                        <p className="text-sm text-slate-400 mb-6">Tell me about <span className="text-purple-300">{selectedModuleDetail.name}</span> module</p>
                        {renderSuggestionCards([
                          { title: "Scan this module", desc: "Understand structure, patterns, and key files" },
                          { title: "Generate module docs", desc: "Create documentation for this module" },
                          { title: "Map dependencies", desc: "Find external services and integrations" },
                          { title: "Review test coverage", desc: "Check what tests exist and what's missing" },
                        ], `${selectedModuleDetail.name} module at path ${selectedModuleDetail.path}`)}
                      </div>
                    )}
                    {chatMessages.map((msg, i) => renderMessage(msg, i))}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
                {renderChatInput(`Ask about ${selectedModuleDetail.name}...`)}
              </div>
            ) : (
              /* ═══ REPO OVERVIEW ═══ */
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Agent Generation Panel — visible when score >= 40 */}
                {selectedRepo && (
                  <div className="px-5 py-3 border-b border-white/[0.06] shrink-0">
                    <AgentGenerationPanel
                      repoId={selectedRepo.id}
                      onAgentsGenerated={() => {
                        api.getInterviewStatus(selectedRepo.id).then(r => {
                          if (r.success && r.data) setInterviewStatus(r.data);
                        });
                      }}
                    />
                  </div>
                )}
                {/* Scrollable config area */}
                <div className="overflow-y-auto shrink-0 max-h-[40vh]">
                  <RepoConfigEditor repo={selectedRepo} onSave={(updated) => { setSelectedRepo(updated); setRepos(prev => prev.map(r => r.id === updated.id ? updated : r)); }} />
                  {/* Team Setup */}
                  <div className="border-b border-white/[0.06]">
                    <button onClick={() => setShowTeamSetup(!showTeamSetup)} className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/[0.02]">
                      <div className="flex items-center gap-2"><Users className="w-3.5 h-3.5 text-slate-400" /><span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Team Setup</span>{teamSetupDone && <CheckCircle2 className="w-3 h-3 text-green-400" />}<span className="text-[10px] text-slate-500">({teamMembers.filter(m => m.email).length})</span></div>
                      {showTeamSetup ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>
                    {showTeamSetup && (<div className="px-5 pb-4 space-y-2">
                      {teamMembers.map((member, i) => (<div key={i} className="flex items-center gap-2">
                        <input type="text" value={member.name} onChange={e => updateTeamMember(i, "name", e.target.value)} placeholder="Name" className="flex-1 bg-white/[0.05] border border-white/[0.1] rounded px-2 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500/30" />
                        <input type="email" value={member.email} onChange={e => updateTeamMember(i, "email", e.target.value)} placeholder="Email" className="flex-1 bg-white/[0.05] border border-white/[0.1] rounded px-2 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500/30" />
                        <select value={member.role} onChange={e => updateTeamMember(i, "role", e.target.value)} className="bg-white/[0.05] border border-white/[0.1] rounded px-2 py-1.5 text-xs text-white focus:outline-none"><option value="developer">Developer</option><option value="lead">Lead</option><option value="manager">Manager</option><option value="qa">QA</option><option value="devops">DevOps</option></select>
                        <button onClick={() => removeTeamMemberRow(i)} className="p-1 text-slate-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>))}
                      <button onClick={addTeamMemberRow} className="text-xs text-purple-400 hover:text-purple-300">+ Add member</button>
                    </div>)}
                  </div>
                  {/* Modules */}
                  <div className="border-b border-white/[0.06]">
                    <button onClick={() => setShowModuleSection(!showModuleSection)} className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/[0.02]">
                      <div className="flex items-center gap-2"><Package className="w-3.5 h-3.5 text-slate-400" /><span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Modules</span><span className="text-[10px] text-slate-500">({moduleTree.length})</span></div>
                      {showModuleSection ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>
                    {showModuleSection && (<div className="px-5 pb-4 space-y-1.5">
                      {moduleTree.map(mod => (<div key={mod.path}>
                        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-purple-500/20 transition-colors">
                          <button onClick={() => setExpandedModule(expandedModule === mod.path ? null : mod.path)} className="flex items-center gap-2 flex-1 text-left">
                            <ChevronRight className={`w-3 h-3 text-slate-500 transition-transform ${expandedModule === mod.path ? "rotate-90" : ""}`} />
                            <span className={`w-2 h-2 rounded-full ${mod.enriched ? "bg-green-400" : "bg-slate-500"}`} />
                            <span className="text-xs text-slate-300">{mod.name}</span><span className="text-[10px] text-slate-500">{mod.score}/100</span>
                          </button>
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setChatMessages([]); setChatSessionId(""); setSelectedModuleDetail(mod); }} className="text-[10px] text-purple-400 hover:text-purple-300 px-1.5 py-0.5 rounded hover:bg-purple-500/10" title="Open module chat"><MessageCircle className="w-3 h-3" /></button>
                            <button onClick={() => handleRemoveModule(mod.path)} className="text-slate-500 hover:text-red-400 p-0.5"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </div>
                        {expandedModule === mod.path && (<div className="ml-6 mt-1 space-y-1">
                          {(mod.submodules || []).map(sub => (<div key={sub.path} className="flex items-center justify-between px-2 py-1.5 rounded bg-white/[0.01] border border-white/[0.04]"><span className="text-[11px] text-slate-400">├── {sub.name} <span className="text-slate-500">{sub.score}/100</span></span><button onClick={() => handleRemoveModule(sub.path)} className="text-slate-600 hover:text-red-400"><Trash2 className="w-2.5 h-2.5" /></button></div>))}
                          <div className="flex items-center gap-2"><input type="text" value={newSubmoduleName} onChange={e => setNewSubmoduleName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddSubmodule(mod.path)} placeholder="Add submodule..." className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded px-2 py-1 text-[11px] text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500/30" /><button onClick={() => handleAddSubmodule(mod.path)} disabled={!newSubmoduleName.trim()} className="text-[10px] text-purple-400 disabled:opacity-50">+ Add</button></div>
                        </div>)}
                      </div>))}
                      <div className="flex items-center gap-2 mt-2"><input type="text" value={newModuleName} onChange={e => setNewModuleName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddModule()} placeholder="Add module..." className="flex-1 bg-white/[0.05] border border-white/[0.1] rounded px-2 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500/30" /><button onClick={handleAddModule} disabled={!newModuleName.trim()} className="text-xs text-purple-400 disabled:opacity-50">+ Add</button></div>
                    </div>)}
                  </div>
                  {/* ═══ BUILD CONTEXT — One-Click ═══ */}
                  <div className="border-b border-white/[0.06] px-5 py-3">
                    {(buildContextDone && buildContextResult) || selectedRepo.context_readiness === "ready" ? (
                      <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                          <span className="text-xs font-medium text-green-300">✓ Context Built</span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {buildContextResult
                            ? `${buildContextResult.modules_scanned} modules scanned, ${buildContextResult.files_generated} files generated`
                            : "Context has been built for this repository"}
                        </p>
                        <button onClick={handleBuildContext} className="mt-2 text-[10px] text-slate-500 hover:text-purple-300">Rebuild Context</button>
                      </div>
                    ) : buildContextRunning ? (
                      <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                          <span className="text-xs font-medium text-purple-300">Building Context...</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mb-2">{buildContextProgress.message}</p>
                        {buildContextProgress.total > 0 && (
                          <div className="space-y-1">
                            <div className="w-full bg-white/[0.05] rounded-full h-1.5">
                              <div className="bg-gradient-to-r from-purple-500 to-violet-500 h-1.5 rounded-full transition-all duration-500" style={{width: `${(buildContextProgress.index / buildContextProgress.total) * 100}%`}} />
                            </div>
                            <p className="text-[10px] text-slate-500">{buildContextProgress.index}/{buildContextProgress.total} modules</p>
                          </div>
                        )}
                        {buildContextProgress.modulesCompleted.length > 0 && (
                          <div className="mt-2 max-h-20 overflow-y-auto">
                            {buildContextProgress.modulesCompleted.slice(-5).map((m, i) => (
                              <div key={i} className="flex items-center gap-1 text-[10px] text-slate-500">
                                <CheckCircle2 className="w-2.5 h-2.5 text-green-400" />{m}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={handleBuildContext}
                        className="w-full px-4 py-3 bg-gradient-to-r from-purple-600/30 to-violet-600/30 hover:from-purple-600/40 hover:to-violet-600/40 border border-purple-500/30 rounded-lg text-sm font-medium text-white transition-all flex items-center justify-center gap-2"
                      >
                        <Sparkles className="w-4 h-4 text-purple-300" />
                        Build Context
                        <span className="text-[10px] text-slate-400 ml-1">— scan modules, generate docs, push to QA</span>
                      </button>
                    )}
                  </div>
                  {/* ELK Indexes */}
                  <ELKIndexManager repoId={selectedRepo.id} />
                </div>

                {/* Chat — same rendering as /chat/[id] */}
                <div className="flex-1 overflow-y-auto px-6 py-6">
                  <div className="max-w-3xl mx-auto space-y-6">
                    {chatMessages.length === 0 && (
                      <div className="text-center mb-12 pt-8">
                        <h2 className="text-2xl font-bold text-white mb-2">Good {getGreeting()}, <span className="bg-gradient-to-r from-purple-300 to-violet-400 bg-clip-text text-transparent">{userName}</span></h2>
                        <p className="text-sm text-slate-400 mb-6">How can I help with <span className="text-purple-300">{selectedRepo.name}</span>?</p>
                        {renderSuggestionCards([
                          { title: "Scan the codebase", desc: "Understand tech stack, modules, and patterns" },
                          { title: "Generate docs", desc: "Create comprehensive project documentation" },
                          { title: "Setup workflow files", desc: "Generate safety rules, code patterns, test strategy" },
                          { title: "Map API endpoints", desc: "Discover and document all HTTP routes" },
                        ], selectedRepo.name)}
                        <SuggestionChips repositoryId={selectedRepo.id} onSendMessage={msg => sendChatMessage(msg)}
                          onDocsGenerated={files => { api.getInterviewStatus(selectedRepo.id).then(r => { if (r.success && r.data) setInterviewStatus(r.data); }); }} />
                      </div>
                    )}
                    {chatMessages.map((msg, i) => renderMessage(msg, i))}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
                {renderChatInput(`Ask about ${selectedRepo.name}...`)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
