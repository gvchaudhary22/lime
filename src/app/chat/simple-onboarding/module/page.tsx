"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  Package,
  MessageCircle,
  FileText,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Send,
  Paperclip,
  Mic,
  MicOff,
  PlayCircle,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import { api, InterviewStatus, ChatRound, RepoFile, TeamMember } from "@/lib/api";
import { streamModuleChat, streamAnswerSubmit, streamAutoScanModule } from "@/lib/stream";

interface ModuleItem {
  path: string; name: string; score: number; enriched: boolean;
  submodules?: { path: string; name: string; score: number; enriched: boolean }[];
}

function ModulePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const repoId = searchParams.get("repo_id") || "";
  const modulePath = searchParams.get("module_path") || "";
  const moduleName = searchParams.get("module_name") || modulePath;

  const [loading, setLoading] = useState(true);
  const [mod, setMod] = useState<ModuleItem | null>(null);
  const [interviewStatus, setInterviewStatus] = useState<InterviewStatus | null>(null);
  const [chatRounds, setChatRounds] = useState<ChatRound[]>([]);
  const [moduleFiles, setModuleFiles] = useState<RepoFile[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Chat state
  const [activePhase, setActivePhase] = useState<number | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSubmitting, setChatSubmitting] = useState(false);
  const [chatQuestions, setChatQuestions] = useState("");
  const [chatAnswer, setChatAnswer] = useState("");
  const [chatSessionId, setChatSessionId] = useState("");
  const [chatResult, setChatResult] = useState("");

  interface ChatMsg { role: "assistant" | "user"; content: string }
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);

  // File attachments
  const fileInputRef = useRef<HTMLInputElement>(null);
  interface Attachment { file: File; name: string; type: string }
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  // Voice
  const [isRecording, setIsRecording] = useState(false);
  // Phase 1: assigned team member emails
  const [assignedEmails, setAssignedEmails] = useState<string[]>([]);
  // View mode: simple (text only) vs detailed (shows processing steps)
  const [viewMode, setViewMode] = useState<"simple" | "detailed">("simple");
  // Guide/Correct mode — changes textarea placeholder and behavior
  const [inputMode, setInputMode] = useState<"answer" | "guide" | "correct">("answer");
  // Module auto-scan
  const [moduleAutoScanning, setModuleAutoScanning] = useState(false);
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null);
  // Team ID for creating DB records when assigning members
  const [currentTeamId, setCurrentTeamId] = useState<string>("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!repoId || !modulePath) return;
    loadData();
  }, [repoId, modulePath]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    setLoading(true);
    const [statusRes, roundsRes, filesRes, modulesRes] = await Promise.all([
      api.getInterviewStatus(repoId),
      api.getChatRounds(),
      api.listRepoFiles(repoId),
      api.listOnboardingModules(repoId),
    ]);

    if (statusRes.success && statusRes.data) setInterviewStatus(statusRes.data);
    if (roundsRes.success && roundsRes.data) setChatRounds(roundsRes.data);
    if (filesRes.success && filesRes.data) {
      setModuleFiles(filesRes.data.filter(f =>
        f.relative_path.endsWith(".md") &&
        (f.relative_path.includes(modulePath) || f.relative_path.includes(`.claude/docs/modules/${moduleName}`))
      ));
    }
    if (modulesRes.success && modulesRes.data) {
      const found = modulesRes.data.find(m => m.path === modulePath);
      if (found) setMod(found);
      else setMod({ path: modulePath, name: moduleName, score: 0, enriched: false });
    }

    // Load team members — find the first valid team
    try {
      const myTeams = await api.getMyTeams();
      if (myTeams.success && myTeams.data && myTeams.data.length > 0) {
        // Find first team with a valid team_id (not "undefined")
        const validTeam = myTeams.data.find(t => t.team_id && t.team_id !== "undefined");
        if (validTeam) {
          setCurrentTeamId(validTeam.team_id);
          const detail = await api.getTeam(validTeam.team_id);
          if (detail.success && detail.data) {
            const raw = detail.data as unknown as { members?: TeamMember[] };
            if (raw.members) setTeamMembers(raw.members);
          }
        }
      }
    } catch { /* non-fatal */ }

    setLoading(false);
  };

  const startPhase = async (round: number) => {
    setActivePhase(round);
    setChatMessages([]);
    setChatResult("");

    // Phase 1: Team + Context — no Claude call, just show UI
    if (round === 1) {
      setChatLoading(false);
      setChatQuestions("");
      return;
    }

    setChatLoading(true);
    setChatQuestions("");

    // Use SSE for module phases — stream directly into chat messages
    if (round >= 2) {
      setChatLoading(false); // hide "analyzing" spinner — show streaming text instead
      let streamedText = "";
      try {
        await streamModuleChat(
          { repository_id: repoId, round, module_path: modulePath },
          (chunk) => {
            if (chunk.type === "assistant" && chunk.text) {
              streamedText += chunk.text;
              // Live update — show token-by-token in chat
              setChatMessages(prev => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (lastIdx >= 0 && updated[lastIdx].content.startsWith("▍")) {
                  updated[lastIdx] = { role: "assistant", content: "▍ " + streamedText };
                } else {
                  updated.push({ role: "assistant", content: "▍ " + streamedText });
                }
                return updated;
              });
            } else if (chunk.type === "result" && chunk.text) {
              streamedText = chunk.text;
            }
            if (chunk.session_id) setChatSessionId(chunk.session_id);
          }
        );
        // Replace streaming indicator with final text
        if (streamedText) {
          setChatMessages(prev => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (lastIdx >= 0 && updated[lastIdx].content.startsWith("▍")) {
              updated[lastIdx] = { role: "assistant", content: streamedText };
            } else {
              updated.push({ role: "assistant", content: streamedText });
            }
            return updated;
          });
        }
      } catch { setChatMessages(prev => [...prev, { role: "assistant", content: "Failed to load. Please try again." }]); }
      return;
    }

    const res = await api.startChatRound({ repository_id: repoId, round, module_path: modulePath });
    if (res.success && res.data) {
      setChatQuestions(res.data.questions);
      setChatSessionId(res.data.session_id || "");
      if (res.data.questions && !res.data.questions.includes("[TEAM_SETUP_FORM]")) {
        setChatMessages(prev => [...prev, { role: "assistant", content: res.data!.questions }]);
      }
    }
    setChatLoading(false);
  };

  const submitAnswer = async () => {
    if (!chatAnswer.trim() && attachments.length === 0) return;
    const msg = chatAnswer.trim();
    const currentInputMode = inputMode;
    setChatAnswer("");
    setInputMode("answer");
    setChatSubmitting(true);
    setChatMessages(prev => [...prev, { role: "user", content: currentInputMode === "guide" ? `🔍 ${msg}` : currentInputMode === "correct" ? `✎ ${msg}` : msg }]);

    // Phase 1: use existing JSON API (no streaming needed)
    if (activePhase === 1) {
      const res = await api.submitChatAnswers({
        repository_id: repoId, round: 1, answers: msg,
        session_id: chatSessionId, module_path: modulePath,
        attachments: attachments.length > 0 ? attachments.map(a => a.file) : undefined,
      });
      setAttachments([]);
      if (res.success && res.data) {
        const aiMsg = res.data.follow_up_questions || "Context saved.";
        setChatMessages(prev => [...prev, { role: "assistant", content: aiMsg }]);
      }
      setChatSubmitting(false);
      return;
    }

    // Phase 2+: use SSE streaming
    setAttachments([]);
    let streamedText = "";
    let resultStatus = "";

    try {
      await streamAnswerSubmit(
        { repository_id: repoId, round: activePhase || 4, answers: msg, session_id: chatSessionId, module_path: modulePath },
        (chunk) => {
          if (chunk.type === "assistant" && chunk.text) {
            streamedText += chunk.text;
            setChatMessages(prev => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (lastIdx >= 0 && updated[lastIdx].content.startsWith("▍")) {
                updated[lastIdx] = { role: "assistant", content: "▍ " + streamedText };
              } else {
                updated.push({ role: "assistant", content: "▍ " + streamedText });
              }
              return updated;
            });
          } else if (chunk.type === "result" && chunk.text) {
            // Parse status from result event
            try {
              const result = JSON.parse(chunk.text);
              resultStatus = result.status || "";
            } catch {
              resultStatus = chunk.text;
            }
          }
          if (chunk.session_id) setChatSessionId(chunk.session_id);
        }
      );

      // Replace streaming indicator with final text
      if (streamedText) {
        setChatMessages(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].content.startsWith("▍")) {
            updated[lastIdx] = { role: "assistant", content: streamedText };
          }
          return updated;
        });
      }

      // Handle result status
      if (resultStatus === "module_onboarding" || resultStatus === "ask_next") {
        // Next dimension — stream the next question
        if (!streamedText) {
          // Confirm/skip returned result without streaming — fetch next question
          let nextText = "";
          try {
            await streamModuleChat(
              { repository_id: repoId, round: activePhase || 4, module_path: modulePath },
              (chunk) => {
                if (chunk.type === "assistant" && chunk.text) {
                  nextText += chunk.text;
                  setChatMessages(prev => {
                    const updated = [...prev];
                    const lastIdx = updated.length - 1;
                    if (lastIdx >= 0 && updated[lastIdx].content.startsWith("▍")) {
                      updated[lastIdx] = { role: "assistant", content: "▍ " + nextText };
                    } else {
                      updated.push({ role: "assistant", content: "▍ " + nextText });
                    }
                    return updated;
                  });
                }
                if (chunk.session_id) setChatSessionId(chunk.session_id);
              }
            );
            if (nextText) {
              setChatMessages(prev => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (lastIdx >= 0 && updated[lastIdx].content.startsWith("▍")) {
                  updated[lastIdx] = { role: "assistant", content: nextText };
                }
                return updated;
              });
            }
          } catch { setChatMessages(prev => [...prev, { role: "assistant", content: "Next scan loading..." }]); }
        }
      } else if (resultStatus === "enriched") {
        await loadData();
        const nextPhase = (activePhase || 1) + 1;
        const maxPhase = chatRounds.length > 0 ? Math.max(...chatRounds.map(r => r.round)) : 5;
        if (nextPhase <= maxPhase) {
          setChatMessages(prev => [...prev, { role: "assistant", content: `Phase complete! Moving to next...` }]);
          setChatResult("");
          setTimeout(() => startPhase(nextPhase), 800);
        } else {
          setChatResult("All phases complete!");
          setActivePhase(null);
        }
      } else if (resultStatus === "module_review") {
        setChatResult("review");
      } else if (resultStatus === "follow_up") {
        // Guide/correct response already streamed above — just show action buttons
      } else if (resultStatus === "pending_admin_approval") {
        setChatResult(`Module submitted for admin approval!`);
        setActivePhase(null);
        loadData();
      }

    } catch (err) {
      setChatMessages(prev => [...prev, { role: "assistant", content: "Failed to process. Try again." }]);
    }

    setChatSubmitting(false);
  };

  const toggleRecording = () => {
    if (isRecording) { recognitionRef.current?.stop(); setIsRecording(false); return; }
    const SR = (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    if (!SR) { alert("Speech recognition not supported"); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new (SR as any)();
    recognition.lang = "en-US"; recognition.interimResults = true; recognition.continuous = true;
    recognitionRef.current = recognition;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) { if (e.results[i].isFinal) text += e.results[i][0].transcript + " "; }
      if (text) setChatAnswer(prev => prev + text);
    };
    recognition.onend = () => setIsRecording(false);
    recognition.start(); setIsRecording(true);
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-[#0c0515]">
        <Sidebar activePage="simple-onboarding" />
        <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 text-purple-400 animate-spin" /></div>
      </div>
    );
  }

  const hasAssignedMembers = assignedEmails.length > 0 || teamMembers.length > 0;

  return (
    <div className="flex h-screen bg-[#0c0515]">
      <Sidebar activePage="simple-onboarding" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-6 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <button onClick={() => router.push("/chat/simple-onboarding")} className="p-1.5 rounded-lg hover:bg-white/[0.05] text-slate-400 hover:text-white transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <Package className="w-6 h-6 text-purple-400" />
              <h1 className="text-xl font-bold text-white">{moduleName}</h1>
              <span className={`text-xs px-2 py-0.5 rounded ${mod?.enriched ? "text-green-400 bg-green-500/10" : "text-slate-400 bg-white/[0.05]"}`}>
                {mod?.score || 0}/100
              </span>
            </div>
            {/* Auto-Scan Module button */}
            <button
              disabled={moduleAutoScanning}
              onClick={async () => {
                setModuleAutoScanning(true);
                setChatMessages(prev => [...prev, { role: "assistant", content: "🤖 **Auto-scanning module...** Reading code, extracting dimensions, scoring with Claude. This takes 2-3 minutes." }]);
                try {
                  const res = await api.autoScanModule({ repository_id: repoId, module_path: modulePath });
                  if (res.success && res.data) {
                    const d = res.data;
                    setChatMessages(prev => [...prev, {
                      role: "assistant",
                      content: `✅ **Auto-scan complete!**\n\nScore: **${d.ai_score}/100**\nFiles generated: ${d.generated_files?.length || 0}\n${
                        d.needs_review?.length ? `\n⚠ Needs review: ${d.needs_review.join(", ")}` : "\nAll dimensions scanned with good confidence."
                      }`
                    }]);
                    await loadData();
                  }
                } catch { setChatMessages(prev => [...prev, { role: "assistant", content: "Auto-scan failed. Try manual onboarding." }]); }
                setModuleAutoScanning(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-all"
            >
              {moduleAutoScanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
              {moduleAutoScanning ? "Scanning..." : "Auto-Scan Module"}
            </button>
          </div>
          <p className="text-sm text-slate-500 ml-11">Module onboarding — assign team, provide context, complete phases, or auto-scan</p>
        </div>

        {/* Content — two columns on large screens */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Module info + phases */}
          <div className="w-80 border-r border-white/[0.06] overflow-y-auto p-5 space-y-6">
            {/* Team Members */}
            <div>
              <h3 className="text-xs text-slate-400 uppercase tracking-wider mb-2">Team ({teamMembers.length})</h3>
              <div className="space-y-1">
                {teamMembers.map(m => (
                  <div key={m.id} className="flex items-center gap-2 text-xs">
                    <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center text-[9px] text-purple-300 font-bold">
                      {(m.email || "U").charAt(0).toUpperCase()}
                    </div>
                    <span className="text-slate-300 truncate">{m.email || m.user_id}</span>
                    <span className={`text-[9px] px-1 rounded ${m.role === "manager" ? "bg-purple-500/20 text-purple-300" : "bg-blue-500/20 text-blue-300"}`}>{m.role}</span>
                  </div>
                ))}
                {teamMembers.length === 0 && <p className="text-xs text-slate-500 italic">No team members loaded</p>}
              </div>
            </div>

            {/* Submodules */}
            <div>
              <h3 className="text-xs text-slate-400 uppercase tracking-wider mb-2">Submodules ({mod?.submodules?.length || 0})</h3>
              <div className="space-y-1">
                {(mod?.submodules || []).map(sub => (
                  <div key={sub.path} className="flex items-center justify-between px-2 py-1.5 rounded bg-white/[0.02] border border-white/[0.06]">
                    <span className="text-xs text-slate-300">{sub.name}</span>
                    <span className="text-[10px] text-slate-500">{sub.score}/100</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Documentation */}
            <div>
              <h3 className="text-xs text-slate-400 uppercase tracking-wider mb-2">Docs ({moduleFiles.length})</h3>
              {moduleFiles.map(f => (
                <div key={f.relative_path} className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-300">
                  <FileText className="w-3 h-3" /><span className="truncate">{f.relative_path}</span>
                </div>
              ))}
              {moduleFiles.length === 0 && <p className="text-xs text-slate-500 italic">No docs yet</p>}
            </div>

            {/* Auto-Onboard Module */}
            <div>
              <h3 className="text-xs text-slate-400 uppercase tracking-wider mb-2">Onboarding Mode</h3>
              {/* Phase 1 must be complete before auto-onboard */}
              {!(interviewStatus?.completed_rounds?.includes(1)) ? (
                <div className="w-full px-3 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] mb-2">
                  <div className="flex items-center gap-2 mb-1.5">
                    <PlayCircle className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="text-xs font-medium text-slate-400">Auto-Onboard Module</span>
                  </div>
                  <p className="text-[9px] text-slate-500 ml-6">Complete <strong className="text-yellow-400">Phase 1 (Team & Context)</strong> first — provide module description, assign team members, then auto-onboard will use your context to scan smarter.</p>
                </div>
              ) : (
              <button
                disabled={moduleAutoScanning}
                onClick={async () => {
                  setModuleAutoScanning(true);
                  setActivePhase(null);
                  setChatMessages([{ role: "assistant", content: "🤖 **Auto-onboarding module...**\n\nUsing your Phase 1 context to guide the scan." }]);
                  try {
                    await streamAutoScanModule(
                      { repository_id: repoId, module_path: modulePath },
                      (event) => {
                        if (event.type === "progress" || event.type === "dimension_start") {
                          setChatMessages(prev => {
                            const updated = [...prev];
                            const lastIdx = updated.length - 1;
                            // Update the last "scanning" message with progress
                            if (lastIdx >= 0 && (updated[lastIdx].content.includes("Auto-onboarding") || updated[lastIdx].content.includes("Scanning") || updated[lastIdx].content.includes("✓"))) {
                              updated[lastIdx] = { role: "assistant", content: `🤖 ${event.message || "Scanning..."}` };
                            } else {
                              updated.push({ role: "assistant", content: `🤖 ${event.message || "Scanning..."}` });
                            }
                            return updated;
                          });
                        } else if (event.type === "dimension_done") {
                          setChatMessages(prev => [...prev, { role: "assistant", content: event.message || `✓ ${event.dimension} done` }]);
                        } else if (event.type === "scoring") {
                          setChatMessages(prev => [...prev, { role: "assistant", content: "🧠 " + (event.message || "Claude is scoring...") }]);
                        } else if (event.type === "complete") {
                          const reviewItems = event.needs_review || [];
                          setChatMessages(prev => [...prev, {
                            role: "assistant",
                            content: `✅ **Auto-onboard complete!**\n\n**Score: ${event.ai_score || 0}/100**\nFiles generated: ${event.generated_files?.length || 0}\n${
                              reviewItems.length > 0
                                ? `\n⚠ **Needs human review (${reviewItems.length}):**\n${reviewItems.map((r: string) => `- ${r}`).join("\n")}\n\nClick manual phases below to improve.`
                                : "\n✅ All dimensions scanned with good confidence."
                            }`
                          }]);
                        } else if (event.type === "error") {
                          setChatMessages(prev => [...prev, { role: "assistant", content: `❌ ${event.message || "Scan failed"}` }]);
                        }
                      }
                    );
                    await loadData();
                  } catch {
                    setChatMessages(prev => [...prev, { role: "assistant", content: "❌ Auto-scan disconnected. Try again." }]);
                  }
                  setModuleAutoScanning(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-gradient-to-r from-purple-600/20 to-violet-600/20 border border-purple-500/30 hover:from-purple-600/30 hover:to-violet-600/30 disabled:opacity-50 transition-all mb-2"
              >
                {moduleAutoScanning ? (
                  <Loader2 className="w-5 h-5 text-purple-400 animate-spin shrink-0" />
                ) : (
                  <PlayCircle className="w-5 h-5 text-purple-400 shrink-0" />
                )}
                <div className="text-left">
                  <span className="text-xs font-medium text-white block">{moduleAutoScanning ? "Auto-scanning..." : "Auto-Onboard Module"}</span>
                  <span className="text-[9px] text-slate-400">AI scans code, extracts all dimensions, scores with Claude</span>
                </div>
              </button>
              )}
              <p className="text-[9px] text-slate-500 text-center mb-3">— or use manual phases below —</p>
            </div>

            {/* Manual Onboarding Phases */}
            <div>
              <h3 className="text-xs text-slate-400 uppercase tracking-wider mb-2">Manual Phases</h3>
              <div className="space-y-1.5">
                {chatRounds.filter(r => r.round >= 1).map(round => {
                  const completed = interviewStatus?.completed_rounds?.includes(round.round);
                  const isActive = activePhase === round.round;
                  const isFirst = !completed && chatRounds.filter(r => r.round >= 1 && r.round < round.round).every(r => interviewStatus?.completed_rounds?.includes(r.round));

                  // Phase 1 special: when active + context provided → show "Move to Next Phase"
                  const isPhase1Ready = round.round === 1 && isActive && assignedEmails.length > 0 && chatMessages.filter(m => m.role === "user").length > 0;

                  return (
                    <button key={round.round}
                      onClick={() => {
                        if (isPhase1Ready) {
                          // Move to Phase 2
                          setChatSubmitting(true);
                          api.submitChatAnswers({
                            repository_id: repoId, round: 1,
                            answers: JSON.stringify({ team: assignedEmails.map(e => ({ email: e })), context_provided: true }),
                            module_path: modulePath,
                          }).then(async () => {
                            setChatSubmitting(false);
                            // Refresh status so Phase 1 shows green
                            const sr = await api.getInterviewStatus(repoId);
                            if (sr.success && sr.data) setInterviewStatus(sr.data);
                            setActivePhase(null);
                            setTimeout(() => startPhase(2), 300);
                          }).catch(() => setChatSubmitting(false));
                        } else {
                          startPhase(round.round);
                        }
                      }}
                      disabled={round.round > 1 && !hasAssignedMembers && !completed}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs transition-colors ${
                        isPhase1Ready ? "bg-green-600 border border-green-500/30 hover:bg-green-700" :
                        isActive ? "bg-purple-500/20 border border-purple-500/30" :
                        completed ? "bg-green-500/[0.05] border border-green-500/20" :
                        (round.round > 1 && !hasAssignedMembers) ? "opacity-40 cursor-not-allowed bg-white/[0.01] border border-white/[0.04]" :
                        isFirst || round.round === 1 ? "bg-purple-500/[0.08] border border-purple-500/20" :
                        "bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04]"
                      }`}>
                      <div className="flex items-center gap-2">
                        {completed ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> :
                         isPhase1Ready ? <PlayCircle className="w-3.5 h-3.5 text-white" /> :
                         <div className="w-3.5 h-3.5 rounded-full border border-slate-500 flex items-center justify-center text-[8px] text-slate-500">{round.round}</div>}
                        <div>
                          <span className={isPhase1Ready ? "text-white font-medium" : completed ? "text-green-400" : "text-white"}>
                            {isPhase1Ready ? "Move to Next Phase →" : round.title}
                          </span>
                          {!isPhase1Ready && <p className="text-[9px] text-slate-500 mt-0.5">{round.focus}</p>}
                        </div>
                      </div>
                      {!isPhase1Ready && isFirst && hasAssignedMembers && <span className="text-[8px] text-purple-400">Next →</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Chat area (full width) */}
          <div className="flex-1 flex flex-col">
            {/* Sticky top bar: view toggle + Move to Next Phase */}
            {activePhase && (
              <div className="px-6 py-2 border-b border-white/[0.06] flex items-center justify-between sticky top-0 bg-[#0c0515] z-10">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">
                    {activePhase === 1 ? "Team & Context" : `Phase ${activePhase}`}
                  </span>
                  {activePhase && activePhase >= 2 && (
                    <span className="text-[10px] text-purple-400/60">
                      Claude Scan — {chatRounds.find(r => r.round === activePhase)?.title || "Module Deep-Dive"}
                    </span>
                  )}
                  <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5">
                    <button onClick={() => setViewMode("simple")}
                      className={`px-3 py-1 rounded text-[10px] font-medium transition-colors ${viewMode === "simple" ? "bg-purple-500/20 text-purple-300" : "text-slate-500 hover:text-white"}`}
                    >Simple</button>
                    <button onClick={() => setViewMode("detailed")}
                      className={`px-3 py-1 rounded text-[10px] font-medium transition-colors ${viewMode === "detailed" ? "bg-purple-500/20 text-purple-300" : "text-slate-500 hover:text-white"}`}
                    >Detailed</button>
                  </div>
                </div>
                {/* Skip Question button — for phases 2+ when a question is showing */}
                {activePhase && activePhase >= 2 && chatMessages.length > 0 && !chatSubmitting && (
                  <button
                    onClick={() => {
                      setChatMessages(prev => [...prev, { role: "user", content: "(skipped)" }, { role: "assistant", content: "Skipped. Fetching next question..." }]);
                      // Submit "skip" answer to advance question index
                      api.submitChatAnswers({ repository_id: repoId, round: activePhase, answers: "Not applicable / skip this question", session_id: chatSessionId, module_path: modulePath })
                        .then(res => {
                          if (res.success && res.data) {
                            if (res.data.status === "enriched") {
                              loadData();
                              const nextPhase = activePhase + 1;
                              const maxPhase = chatRounds.length > 0 ? Math.max(...chatRounds.map(r => r.round)) : 5;
                              if (nextPhase <= maxPhase) {
                                setChatMessages(prev => [...prev, { role: "assistant", content: `Phase ${activePhase} complete! Moving to next...` }]);
                                setTimeout(() => startPhase(nextPhase), 500);
                              } else {
                                setChatResult(`All phases complete! Score: ${res.data.context_score}`);
                                setActivePhase(null);
                              }
                            }
                            // else ask_next — will auto-fetch next question
                          }
                        });
                    }}
                    className="px-3 py-1.5 text-slate-400 hover:text-white text-[10px] rounded-lg hover:bg-white/[0.05] transition-colors"
                  >Skip Q</button>
                )}
                {/* Move to Next Phase button — for ALL active phases with at least 1 user message */}
                {activePhase && chatMessages.filter(m => m.role === "user").length > 0 && (
                  <button disabled={chatSubmitting}
                    onClick={async () => {
                      setChatSubmitting(true);
                      try {
                        const answers = activePhase === 1
                          ? JSON.stringify({ team: assignedEmails.map(e => ({ email: e })), context_provided: true })
                          : JSON.stringify({ context_provided: true, phase: activePhase });
                        await api.submitChatAnswers({
                          repository_id: repoId, round: activePhase,
                          answers,
                          module_path: modulePath,
                        });
                        await loadData();
                      } catch { /* */ }
                      setChatSubmitting(false);
                      const nextPhase = (activePhase || 1) + 1;
                      const maxPhase = chatRounds.length > 0 ? Math.max(...chatRounds.map(r => r.round)) : 5;
                      if (nextPhase <= maxPhase) {
                        setActivePhase(null);
                        setTimeout(() => startPhase(nextPhase), 300);
                      } else {
                        setChatResult("All phases complete!");
                        setActivePhase(null);
                      }
                    }}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors shrink-0"
                  >
                    <PlayCircle className="w-3.5 h-3.5" />
                    {chatSubmitting ? "Processing..." : "Move to Next Phase →"}
                  </button>
                )}
              </div>
            )}

            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {/* Phase 1 — Team Assignment + Context Chat */}
              {activePhase === 1 && !chatLoading && (
                <div className="space-y-4">
                  {/* Step 1: Assign Team Members */}
                  <div className="bg-purple-500/[0.05] border border-purple-500/20 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-purple-300 mb-2">Step 1: Assign Team Members</h3>
                    <p className="text-xs text-slate-400 mb-3">Select team members who work on this module</p>

                    {/* Selected members */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {teamMembers.filter(m => (m as unknown as { _assigned?: boolean })._assigned).length === 0 &&
                        assignedEmails.length === 0 && (
                        <span className="text-xs text-slate-500 italic">No members assigned yet</span>
                      )}
                      {assignedEmails.map(email => {
                        const member = teamMembers.find(m => m.email === email);
                        return (
                          <span key={email} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-[10px] text-purple-300">
                            {email} {member && <span className="opacity-60">({member.role})</span>}
                            <button onClick={() => setAssignedEmails(prev => prev.filter(e => e !== email))} className="text-slate-400 hover:text-red-400 ml-0.5">×</button>
                          </span>
                        );
                      })}
                    </div>

                    {/* Dropdown to assign — creates DB team record + saves to chat context */}
                    <select
                      value=""
                      onChange={async (e) => {
                        const email = e.target.value;
                        if (!email || assignedEmails.includes(email)) return;
                        setAssignedEmails(prev => [...prev, email]);
                        e.target.value = "";
                        try {
                          const member = teamMembers.find(m => m.email === email);
                          // 1. Add team member to DB via team API (if team exists)
                          if (currentTeamId) {
                            try {
                              await api.addTeamMember(currentTeamId, { email, role: member?.role || "developer" });
                              // Link team to repo if not already linked
                              if (assignedEmails.length === 0) {
                                await api.updateRepoConfig(repoId, { team_id: currentTeamId });
                              }
                            } catch { /* member may already exist — non-fatal */ }
                          }
                          // 2. Also save to onboarding chat context for knowledge capture
                          await api.submitChatAnswers({
                            repository_id: repoId,
                            round: 1,
                            answers: JSON.stringify({ action: "assign_member", email, role: member?.role || "developer", module: modulePath }),
                            module_path: modulePath,
                          });
                          setChatMessages(prev => [...prev, { role: "assistant", content: `${email} assigned to ${moduleName} module.` }]);
                        } catch { /* non-fatal */ }
                      }}
                      className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500/30"
                    >
                      <option value="">Select team member to assign...</option>
                      {teamMembers.filter(m => m.email && !assignedEmails.includes(m.email)).map(m => (
                        <option key={m.id} value={m.email}>{m.email} ({m.role})</option>
                      ))}
                    </select>
                  </div>

                  {/* Step 2: Provide Module Context (visible after team assigned) */}
                  {assignedEmails.length > 0 && (
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                      <h3 className="text-sm font-medium text-white mb-2">Step 2: Provide Module Context</h3>
                      <p className="text-xs text-slate-400 mb-3">
                        Upload documents (Postman, Swagger, architecture diagrams), describe how the module works,
                        paste links, or use voice input. All context is saved and used for AI deep analysis.
                      </p>
                    </div>
                  )}

                  {/* Chat messages */}
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`rounded-xl px-4 py-3 text-sm ${
                      msg.role === "assistant" ? "bg-white/[0.03] border border-white/[0.06] text-slate-300" : "bg-purple-500/10 border border-purple-500/20 text-white ml-12"
                    }`}>
                      {msg.role === "assistant" && viewMode === "detailed" && (
                        <div className="text-[9px] text-slate-500 mb-2 pb-2 border-b border-white/[0.04]">
                          <span className="text-purple-400">AI Processing:</span> Read context.md → Analyzed user input → Generated response
                          {msg.content.includes("assigned") && <span> → Updated team assignment</span>}
                        </div>
                      )}
                      <pre className="whitespace-pre-wrap leading-relaxed font-sans">{msg.content}</pre>
                    </div>
                  ))}

                  {chatResult && chatResult !== "review" && (
                    <div className="bg-green-500/[0.05] border border-green-500/20 rounded-xl p-3">
                      <p className="text-xs text-green-300">{chatResult}</p>
                    </div>
                  )}

                  {/* Analyse button moved to header — top right */}
                </div>
              )}

              {!activePhase && (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <MessageCircle className="w-12 h-12 mb-3 text-slate-500" />
                  <p className="text-sm">Select a phase to start</p>
                  <p className="text-xs mt-1">Click an onboarding phase on the left</p>
                </div>
              )}

              {chatLoading && (
                <div className="flex items-center gap-3 py-4 text-slate-300">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Claude is analyzing...</span>
                </div>
              )}

              {chatMessages.map((msg, idx) => (
                <div key={`phase2-msg-${idx}`}>
                  <div className={`rounded-xl px-4 py-3 text-sm ${
                    msg.role === "assistant" ? "bg-white/[0.03] border border-white/[0.06] text-slate-300" : "bg-purple-500/10 border border-purple-500/20 text-white ml-12"
                  }`}>
                    {msg.role === "assistant" && viewMode === "detailed" && (
                      <div className="text-[9px] text-slate-500 mb-2 pb-2 border-b border-white/[0.04]">
                        <span className="text-purple-400">AI Processing:</span> Read .claude/docs/modules/{moduleName}/context.md → Scanned module code → Cross-referenced findings
                      </div>
                    )}
                    <pre className="whitespace-pre-wrap leading-relaxed font-sans">{msg.content}</pre>
                  </div>
                  {/* Quick action buttons after the last assistant message in Phase 2+ */}
                  {msg.role === "assistant" && idx === chatMessages.length - 1 && activePhase && activePhase >= 2 && !chatSubmitting && !chatLoading && chatResult !== "review" && (
                    <div className="flex items-center gap-2 mt-2 ml-1">
                      <button
                        onClick={async () => {
                          setChatMessages(prev => [...prev, { role: "user", content: "\u2713 Confirmed" }]);
                          setChatSubmitting(true);
                          try {
                            const res = await api.submitChatAnswers({
                              repository_id: repoId,
                              round: activePhase || 4,
                              answers: "confirmed",
                              session_id: chatSessionId,
                              module_path: modulePath,
                            });
                            if (res.success && res.data) {
                              if (res.data.status === "module_onboarding" || res.data.status === "ask_next") {
                                let streamedText = "";
                                try {
                                  await streamModuleChat(
                                    { repository_id: repoId, round: activePhase || 4, module_path: modulePath },
                                    (chunk) => {
                                      if (chunk.type === "assistant" && chunk.text) {
                                        streamedText += chunk.text;
                                        setChatMessages(prev => {
                                          const updated = [...prev];
                                          const lastIdx = updated.length - 1;
                                          if (lastIdx >= 0 && updated[lastIdx].content.startsWith("\u25cd")) {
                                            updated[lastIdx] = { role: "assistant", content: "\u25cd " + streamedText };
                                          } else {
                                            updated.push({ role: "assistant", content: "\u25cd " + streamedText });
                                          }
                                          return updated;
                                        });
                                      }
                                      if (chunk.session_id) setChatSessionId(chunk.session_id);
                                    }
                                  );
                                  if (streamedText) {
                                    setChatMessages(prev => {
                                      const updated = [...prev];
                                      const lastIdx = updated.length - 1;
                                      if (lastIdx >= 0 && updated[lastIdx].content.startsWith("\u25cd")) {
                                        updated[lastIdx] = { role: "assistant", content: streamedText };
                                      }
                                      return updated;
                                    });
                                  }
                                } catch { setChatMessages(prev => [...prev, { role: "assistant", content: "Next scan loading..." }]); }
                              } else if (res.data.status === "follow_up" && res.data.follow_up_questions) {
                                setChatMessages(prev => [...prev, { role: "assistant", content: res.data!.follow_up_questions! }]);
                              } else if (res.data.status === "enriched") {
                                await loadData();
                                const nextPhase = (activePhase || 1) + 1;
                                const maxPhase = chatRounds.length > 0 ? Math.max(...chatRounds.map(r => r.round)) : 5;
                                if (nextPhase <= maxPhase) {
                                  setChatMessages(prev => [...prev, { role: "assistant", content: `Phase complete! Moving to next...` }]);
                                  setTimeout(() => startPhase(nextPhase), 800);
                                } else {
                                  setChatResult("All phases complete!");
                                  setActivePhase(null);
                                }
                              }
                            }
                          } catch { /* */ }
                          setChatSubmitting(false);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-green-300 text-[11px] font-medium rounded-lg transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Confirm
                      </button>
                      <button
                        onClick={() => {
                          setInputMode("guide");
                          setChatAnswer("");
                          setChatMessages(prev => [...prev, { role: "assistant", content: "🔍 **Guide mode**: Help AI find better answers — point to files, describe flows, or give hints" }]);
                          setTimeout(() => chatTextareaRef.current?.focus(), 100);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 text-[11px] font-medium rounded-lg transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Guide
                      </button>
                      <button
                        onClick={() => {
                          setInputMode("correct");
                          setChatAnswer("");
                          setChatMessages(prev => [...prev, { role: "assistant", content: "✎ **Correct mode**: Tell me what's wrong. For example:\n- \"the /admin endpoint is deprecated\"\n- \"we use MySQL not PostgreSQL\"\n- \"remove the bulk upload route\"" }]);
                          setTimeout(() => chatTextareaRef.current?.focus(), 100);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600/20 hover:bg-orange-600/30 border border-orange-500/30 text-orange-300 text-[11px] font-medium rounded-lg transition-colors"
                      >
                        <span className="text-sm">✗</span>
                        Correct
                      </button>
                      <button
                        onClick={async () => {
                          setChatMessages(prev => [...prev, { role: "user", content: "(skipped)" }]);
                          setChatSubmitting(true);
                          try {
                            const res = await api.submitChatAnswers({
                              repository_id: repoId,
                              round: activePhase || 4,
                              answers: "skip this question",
                              session_id: chatSessionId,
                              module_path: modulePath,
                            });
                            if (res.success && res.data) {
                              if (res.data.status === "module_onboarding" || res.data.status === "ask_next") {
                                let streamedText = "";
                                try {
                                  await streamModuleChat(
                                    { repository_id: repoId, round: activePhase || 4, module_path: modulePath },
                                    (chunk) => {
                                      if (chunk.type === "assistant" && chunk.text) {
                                        streamedText += chunk.text;
                                        setChatMessages(prev => {
                                          const updated = [...prev];
                                          const lastIdx = updated.length - 1;
                                          if (lastIdx >= 0 && updated[lastIdx].content.startsWith("\u25cd")) {
                                            updated[lastIdx] = { role: "assistant", content: "\u25cd " + streamedText };
                                          } else {
                                            updated.push({ role: "assistant", content: "\u25cd " + streamedText });
                                          }
                                          return updated;
                                        });
                                      }
                                      if (chunk.session_id) setChatSessionId(chunk.session_id);
                                    }
                                  );
                                  if (streamedText) {
                                    setChatMessages(prev => {
                                      const updated = [...prev];
                                      const lastIdx = updated.length - 1;
                                      if (lastIdx >= 0 && updated[lastIdx].content.startsWith("\u25cd")) {
                                        updated[lastIdx] = { role: "assistant", content: streamedText };
                                      }
                                      return updated;
                                    });
                                  }
                                } catch { setChatMessages(prev => [...prev, { role: "assistant", content: "Next scan loading..." }]); }
                              } else if (res.data.status === "follow_up" && res.data.follow_up_questions) {
                                setChatMessages(prev => [...prev, { role: "assistant", content: res.data!.follow_up_questions! }]);
                              } else if (res.data.status === "enriched") {
                                await loadData();
                                const nextPhase = (activePhase || 1) + 1;
                                const maxPhase = chatRounds.length > 0 ? Math.max(...chatRounds.map(r => r.round)) : 5;
                                if (nextPhase <= maxPhase) {
                                  setChatMessages(prev => [...prev, { role: "assistant", content: `Phase complete! Moving to next...` }]);
                                  setTimeout(() => startPhase(nextPhase), 800);
                                } else {
                                  setChatResult("All phases complete!");
                                  setActivePhase(null);
                                }
                              }
                            }
                          } catch { /* */ }
                          setChatSubmitting(false);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] text-slate-400 text-[11px] rounded-lg transition-colors"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                        Skip
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {chatResult && chatResult !== "review" && (
                <div className="bg-green-500/[0.05] border border-green-500/20 rounded-xl p-4">
                  <p className="text-sm text-green-300">{chatResult}</p>
                </div>
              )}

              {chatResult === "review" && (
                <div className="bg-purple-500/[0.05] border border-purple-500/20 rounded-xl p-4 space-y-3">
                  <p className="text-xs text-purple-300 font-medium">Module Review — What would you like to do?</p>
                  <div className="flex gap-2">
                    <button onClick={() => { setChatAnswer("approve"); submitAnswer(); }}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg">Approve & Submit</button>
                    <button onClick={() => { setChatAnswer("add more context"); submitAnswer(); }}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded-lg">Add More Context</button>
                  </div>
                </div>
              )}
            </div>

            {/* Input area */}
            {activePhase && !chatLoading && chatResult !== "review" && (activePhase !== 1 || assignedEmails.length > 0) && (
              <div className="p-4 border-t border-white/[0.06]">
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {attachments.map((a, i) => (
                      <div key={i} className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-[10px] text-slate-300">
                        <FileText className="w-3 h-3" />{a.name}
                        <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400 ml-1">×</button>
                      </div>
                    ))}
                  </div>
                )}
                {/* Input mode indicator */}
                {inputMode !== "answer" && (
                  <div className={`flex items-center justify-between px-3 py-1.5 rounded-t-xl text-[10px] font-medium ${
                    inputMode === "guide" ? "bg-blue-500/10 text-blue-300 border border-blue-500/20 border-b-0" :
                    "bg-orange-500/10 text-orange-300 border border-orange-500/20 border-b-0"
                  }`}>
                    <span>{inputMode === "guide" ? "🔍 Guide: Help AI find better answers" : "✎ Correct: Fix wrong information"}</span>
                    <button onClick={() => setInputMode("answer")} className="text-slate-400 hover:text-white text-[9px]">✕ Cancel</button>
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    ref={chatTextareaRef}
                    value={chatAnswer}
                    onChange={(e) => setChatAnswer(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !chatSubmitting) {
                        e.preventDefault();
                        submitAnswer();
                        setInputMode("answer"); // reset mode after submit
                      }
                    }}
                    placeholder={
                      inputMode === "guide" ? "Guide AI: point to files, describe a flow, or give context..." :
                      inputMode === "correct" ? "What's wrong? (e.g., 'that endpoint is deprecated')" :
                      "Type your answer... (Cmd+Enter to send)"
                    }
                    rows={3}
                    disabled={chatSubmitting}
                    className={`flex-1 border rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 resize-none disabled:opacity-50 ${
                      inputMode === "guide" ? "bg-blue-500/[0.05] border-blue-500/20 focus:ring-blue-500/30" :
                      inputMode === "correct" ? "bg-orange-500/[0.05] border-orange-500/20 focus:ring-orange-500/30" :
                      "bg-white/[0.05] border-white/[0.1] focus:ring-purple-500/30"
                    }`}
                  />
                  <div className="flex flex-col gap-1">
                    <input type="file" ref={fileInputRef} onChange={(e) => {
                      const files = e.target.files;
                      if (!files) return;
                      const newAtt: Attachment[] = [];
                      for (let i = 0; i < files.length; i++) newAtt.push({ file: files[i], name: files[i].name, type: files[i].type });
                      setAttachments(prev => [...prev, ...newAtt]);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }} accept=".png,.jpg,.jpeg,.csv,.xlsx,.doc,.docx,.pdf,.txt,.md,.json,.yaml" multiple className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-purple-300 rounded-lg hover:bg-white/[0.05]">
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <button onClick={toggleRecording} className={`p-2 rounded-lg hover:bg-white/[0.05] ${isRecording ? "text-red-400" : "text-slate-400 hover:text-purple-300"}`}>
                      {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                    <button onClick={submitAnswer} disabled={chatSubmitting || (!chatAnswer.trim() && attachments.length === 0)}
                      className="p-2 text-purple-400 hover:text-purple-300 disabled:opacity-30 rounded-lg hover:bg-white/[0.05]">
                      {chatSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-[9px] text-slate-600">Cmd+Enter to send · Attach files · Mic for voice</p>
                  {activePhase && activePhase >= 2 && !chatSubmitting && (
                    <button
                      onClick={async () => {
                        setChatSubmitting(true);
                        setChatMessages(prev => [...prev, { role: "user", content: "(skipped)" }]);
                        try {
                          const res = await api.submitChatAnswers({
                            repository_id: repoId,
                            round: activePhase,
                            answers: "Not applicable, skip this question",
                            session_id: chatSessionId,
                            module_path: modulePath,
                          });
                          if (res.success && res.data) {
                            if (res.data.status === "ask_next" || res.data.status === "module_onboarding") {
                              // Fetch next question via SSE
                              let streamedText = "";
                              try {
                                await streamModuleChat(
                                  { repository_id: repoId, round: activePhase, module_path: modulePath },
                                  (chunk) => {
                                    if (chunk.type === "assistant" && chunk.text) {
                                      streamedText += chunk.text;
                                      setChatMessages(prev => {
                                        const updated = [...prev];
                                        const lastIdx = updated.length - 1;
                                        if (lastIdx >= 0 && updated[lastIdx].content.startsWith("▍")) {
                                          updated[lastIdx] = { role: "assistant", content: "▍ " + streamedText };
                                        } else {
                                          updated.push({ role: "assistant", content: "▍ " + streamedText });
                                        }
                                        return updated;
                                      });
                                    } else if (chunk.type === "result" && chunk.text) {
                                      streamedText = chunk.text;
                                    }
                                    if (chunk.session_id) setChatSessionId(chunk.session_id);
                                  }
                                );
                                if (streamedText) {
                                  setChatMessages(prev => {
                                    const updated = [...prev];
                                    const lastIdx = updated.length - 1;
                                    if (lastIdx >= 0 && updated[lastIdx].content.startsWith("▍")) {
                                      updated[lastIdx] = { role: "assistant", content: streamedText };
                                    }
                                    return updated;
                                  });
                                }
                              } catch {
                                setChatMessages(prev => [...prev, { role: "assistant", content: "Failed to get next question." }]);
                              }
                            } else if (res.data.status === "enriched") {
                              // Phase complete
                              await loadData();
                              const nextPhase = (activePhase || 1) + 1;
                              const maxPhase = chatRounds.length > 0 ? Math.max(...chatRounds.map(r => r.round)) : 5;
                              if (nextPhase <= maxPhase) {
                                setChatMessages(prev => [...prev, { role: "assistant", content: `Phase ${activePhase} complete! Moving to next...` }]);
                                setTimeout(() => startPhase(nextPhase), 800);
                              } else {
                                setChatResult(`All phases complete! Score: ${res.data.context_score}`);
                                setActivePhase(null);
                              }
                            } else if (res.data.follow_up_questions) {
                              setChatMessages(prev => [...prev, { role: "assistant", content: res.data!.follow_up_questions! }]);
                            }
                          }
                        } catch {
                          setChatMessages(prev => [...prev, { role: "assistant", content: "Failed to skip. Try again." }]);
                        }
                        setChatSubmitting(false);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 text-[10px] text-slate-400 hover:text-yellow-300 rounded-lg hover:bg-yellow-500/[0.08] border border-transparent hover:border-yellow-500/20 transition-colors"
                    >
                      Skip Question <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ModulePage() {
  return (
    <Suspense fallback={<div className="flex h-screen bg-[#0c0515] items-center justify-center"><Loader2 className="w-8 h-8 text-purple-400 animate-spin" /></div>}>
      <ModulePageContent />
    </Suspense>
  );
}
