"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { ArrowUp, Sparkles, Square, User, Bot, Terminal, ChevronDown, ChevronRight, Eye, EyeOff, Wand2, Check, X, Edit3, FolderOpen, Paperclip, FileText, Image as ImageIcon, FileSpreadsheet } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import { api, Message, Project } from "@/lib/api";
import { streamChat, StreamChunk } from "@/lib/stream";
import MarkdownRenderer from "@/components/chat/MarkdownRenderer";
import TierBadge from "@/components/chat/TierBadge";
import ActionButtons from "@/components/chat/ActionButtons";

interface ToolStep {
  tool: string;
  input?: unknown;
  output?: string;
}

interface DisplayMessage {
  id: string;
  role: string;
  content: string;
  stage?: string;
  sessionId?: string;
  isStreaming?: boolean;
  actionTaken?: string;
  toolSteps?: ToolStep[];
}

export default function ConversationPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const conversationId = params.id as string;

  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [title, setTitle] = useState("New conversation");
  const [mode, setMode] = useState("");
  const [platform, setPlatform] = useState("");
  const [agentRole, setAgentRole] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);
  const hasSentInitialRef = useRef(false);
  const projectDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [chatAttachments, setChatAttachments] = useState<File[]>([]);

  const CHAT_ACCEPTED_FILES = ".png,.jpg,.jpeg,.gif,.webp,.csv,.xlsx,.xls,.doc,.docx,.pdf,.txt,.md,.json,.yaml,.yml";
  const CHAT_MAX_FILES = 5;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newFiles = Array.from(files).slice(0, CHAT_MAX_FILES - chatAttachments.length);
    setChatAttachments((prev) => [...prev, ...newFiles].slice(0, CHAT_MAX_FILES));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (idx: number) => {
    setChatAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const getAttachmentIcon = (file: File) => {
    if (file.type.startsWith("image/")) return <ImageIcon className="w-3 h-3" />;
    if (file.name.match(/\.(csv|xlsx|xls)$/i)) return <FileSpreadsheet className="w-3 h-3" />;
    return <FileText className="w-3 h-3" />;
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load existing conversation or handle initial message
  useEffect(() => {
    const token = localStorage.getItem("mars_token");
    if (!token) {
      router.push("/");
      return;
    }

    const loadConversation = async () => {
      const [convRes, projRes] = await Promise.all([
        api.getConversation(conversationId),
        api.getProjects(),
      ]);

      if (convRes.success && convRes.data) {
        setTitle(convRes.data.conversation.title);
        if (convRes.data.messages.length > 0) {
          setMessages(
            convRes.data.messages.map((m: Message) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              stage: m.stage,
            }))
          );
        }

        // Set projects and identify current conversation's project
        if (projRes.success && projRes.data) {
          setProjects(projRes.data);
          const convProject = projRes.data.find(
            (p) => p.id === convRes.data!.conversation.project_id
          );
          if (convProject) {
            setCurrentProject(convProject);
            localStorage.setItem("mars_active_project", convProject.id);
          }
        }
      }
    };

    loadConversation().then(() => {
      // Check for initial message from query param (guard against React strict mode double-fire)
      const initialMsg = searchParams.get("msg");
      const initialMode = searchParams.get("mode");
      const initialPlatform = searchParams.get("platform");
      const initialAgent = searchParams.get("agent");
      if (initialMode) setMode(initialMode);
      if (initialPlatform) setPlatform(initialPlatform);
      if (initialAgent) setAgentRole(initialAgent);
      if (initialMsg && !hasSentInitialRef.current) {
        hasSentInitialRef.current = true;
        handleSendMessage(initialMsg);
        // Clean up URL
        window.history.replaceState({}, "", `/chat/${conversationId}`);
      }
    });
  }, [conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close project dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        projectDropdownRef.current &&
        !projectDropdownRef.current.contains(e.target as Node)
      ) {
        setShowProjectDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectProject = (project: Project) => {
    localStorage.setItem("mars_active_project", project.id);
    setShowProjectDropdown(false);
    // Navigate to chat home to start a new conversation with the selected project
    router.push("/chat");
  };

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return;

      setIsStreaming(true);
      abortRef.current = false;

      // Add user message optimistically
      const userMsg: DisplayMessage = {
        id: `temp-user-${Date.now()}`,
        role: "user",
        content: content.trim(),
      };

      // Add empty assistant message placeholder
      const assistantMsg: DisplayMessage = {
        id: `temp-assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      const filesToSend = chatAttachments.length > 0 ? [...chatAttachments] : undefined;
      setInput("");
      setChatAttachments([]);

      try {
        await streamChat(conversationId, content.trim(), (chunk: StreamChunk) => {
          if (abortRef.current) return;

          if (chunk.type === "tier") {
            // Set the tier/stage on the streaming assistant message
            setMessages((prev) => {
              const updated = [...prev];
              const lastMsg = updated[updated.length - 1];
              if (lastMsg.role === "assistant" && lastMsg.isStreaming) {
                updated[updated.length - 1] = {
                  ...lastMsg,
                  stage: chunk.tier,
                };
              }
              return updated;
            });
          } else if (chunk.type === "assistant" && chunk.text) {
            // Claude assistant text content
            setMessages((prev) => {
              const updated = [...prev];
              const lastMsg = updated[updated.length - 1];
              if (lastMsg.role === "assistant") {
                updated[updated.length - 1] = {
                  ...lastMsg,
                  content: lastMsg.content + chunk.text,
                };
              }
              return updated;
            });
          } else if (chunk.type === "tool_use") {
            // Claude is using a tool — add to tool steps
            setMessages((prev) => {
              const updated = [...prev];
              const lastMsg = updated[updated.length - 1];
              if (lastMsg.role === "assistant") {
                const steps = lastMsg.toolSteps || [];
                updated[updated.length - 1] = {
                  ...lastMsg,
                  toolSteps: [...steps, { tool: chunk.tool || "unknown", input: chunk.input }],
                };
              }
              return updated;
            });
          } else if (chunk.type === "tool_result") {
            // Tool result — update the last tool step with output
            setMessages((prev) => {
              const updated = [...prev];
              const lastMsg = updated[updated.length - 1];
              if (lastMsg.role === "assistant" && lastMsg.toolSteps?.length) {
                const steps = [...lastMsg.toolSteps];
                steps[steps.length - 1] = { ...steps[steps.length - 1], output: chunk.output };
                updated[updated.length - 1] = { ...lastMsg, toolSteps: steps };
              }
              return updated;
            });
          } else if (chunk.type === "result") {
            // Final result event from channels — marks stream completion
            setMessages((prev) => {
              const updated = [...prev];
              const lastMsg = updated[updated.length - 1];
              if (lastMsg.role === "assistant") {
                updated[updated.length - 1] = {
                  ...lastMsg,
                  content: lastMsg.content || chunk.text || "",
                };
              }
              return updated;
            });
          } else if (chunk.type === "done") {
            setMessages((prev) => {
              const updated = [...prev];
              const lastMsg = updated[updated.length - 1];
              if (lastMsg.role === "assistant") {
                updated[updated.length - 1] = {
                  ...lastMsg,
                  id: chunk.message_id || lastMsg.id,
                  stage: chunk.stage || lastMsg.stage,
                  sessionId: chunk.session_id,
                  isStreaming: false,
                };
              }
              return updated;
            });
          } else if (chunk.type === "error") {
            setMessages((prev) => {
              const updated = [...prev];
              const lastMsg = updated[updated.length - 1];
              if (lastMsg.role === "assistant") {
                updated[updated.length - 1] = {
                  ...lastMsg,
                  content: chunk.error || chunk.content || "An error occurred. Please try again.",
                  isStreaming: false,
                };
              }
              return updated;
            });
          }
        }, mode || undefined, platform || undefined, agentRole || undefined, filesToSend);
      } catch (err) {
        console.error("Stream error:", err);
        setMessages((prev) => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg.role === "assistant") {
            updated[updated.length - 1] = {
              ...lastMsg,
              content: "Failed to get response. Please try again.",
              isStreaming: false,
            };
          }
          return updated;
        });
      } finally {
        setIsStreaming(false);
      }
    },
    [conversationId, isStreaming]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    if (refineEnabled) {
      // Intercept: call refinement API first
      setIsRefining(true);
      try {
        const res = await api.refinePrompt(conversationId, input.trim(), mode || undefined);
        if (res.success && res.data) {
          setRefinement(res.data);
          setEditedPrompt(res.data.refined_prompt);
        } else {
          // Refinement failed — fall back to direct send
          handleSendMessage(input);
        }
      } catch {
        handleSendMessage(input);
      } finally {
        setIsRefining(false);
      }
    } else {
      handleSendMessage(input);
    }
  };

  const handleApproveRefinement = async () => {
    if (!refinement) return;
    const promptToSend = refinement.refined_prompt;
    await api.approveRefinement(conversationId, refinement.id, "approve");
    setRefinement(null);
    setInput("");
    handleSendMessage(promptToSend);
  };

  const handleModifyRefinement = async () => {
    if (!refinement) return;
    await api.approveRefinement(conversationId, refinement.id, "modify", editedPrompt);
    const promptToSend = editedPrompt;
    setRefinement(null);
    setEditingRefinement(false);
    setInput("");
    handleSendMessage(promptToSend);
  };

  const handleSkipRefinement = () => {
    if (!refinement) return;
    const originalPrompt = refinement.original_prompt;
    setRefinement(null);
    setEditingRefinement(false);
    handleSendMessage(originalPrompt);
  };

  const handleStop = () => {
    abortRef.current = true;
    setIsStreaming(false);
    setMessages((prev) => {
      const updated = [...prev];
      const lastMsg = updated[updated.length - 1];
      if (lastMsg.role === "assistant" && lastMsg.isStreaming) {
        updated[updated.length - 1] = { ...lastMsg, isStreaming: false };
      }
      return updated;
    });
  };

  const handleRephrase = () => {
    inputRef.current?.focus();
  };

  const handleActionComplete = (action: string) => {
    // Update the last Claude message to show the action taken
    setMessages((prev) => {
      const updated = [...prev];
      for (let i = updated.length - 1; i >= 0; i--) {
        if (updated[i].role === "assistant" && updated[i].stage === "claude" && !updated[i].actionTaken) {
          updated[i] = { ...updated[i], actionTaken: action };
          break;
        }
      }
      return updated;
    });
  };

  // Prompt refinement state
  const [refineEnabled, setRefineEnabled] = useState(false);
  const [refinement, setRefinement] = useState<{
    id: string;
    original_prompt: string;
    refined_prompt: string;
    status: string;
  } | null>(null);
  const [isRefining, setIsRefining] = useState(false);
  const [editingRefinement, setEditingRefinement] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState("");

  // Branch name input for feature/refactor modes
  const [branchName, setBranchName] = useState("");

  // Detailed view toggle: checked = all steps expanded, unchecked = last 5 steps collapsed
  const [detailedView, setDetailedView] = useState(false);

  // Track which tool steps are expanded
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});

  const toggleStep = (key: string) => {
    setExpandedSteps((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderToolSteps = (msg: DisplayMessage) => {
    if (!msg.toolSteps?.length) return null;

    const allSteps = msg.toolSteps;

    // Simple mode: only show last 5 steps, all collapsed
    // Detailed mode: show all steps, all expanded (unless manually toggled)
    const visibleSteps = detailedView ? allSteps : allSteps.slice(-5);
    const hiddenCount = allSteps.length - visibleSteps.length;

    return (
      <div className="my-3 space-y-1.5">
        {/* Show hidden count indicator in simple mode */}
        {hiddenCount > 0 && (
          <div className="text-[10px] text-slate-600 px-3 py-1">
            +{hiddenCount} more step{hiddenCount > 1 ? "s" : ""} hidden
          </div>
        )}
        {visibleSteps.map((step, i) => {
          const actualIndex = detailedView ? i : allSteps.length - visibleSteps.length + i;
          const key = `${msg.id}-step-${actualIndex}`;
          // In detailed mode, default to expanded. In simple mode, default to collapsed.
          const isExpanded = detailedView
            ? expandedSteps[key] !== false  // expanded by default, toggle to collapse
            : expandedSteps[key] === true;  // collapsed by default, toggle to expand
          return (
            <div key={key} className="rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              <button
                onClick={() => toggleStep(key)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-slate-300 transition-colors"
              >
                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                <Terminal className="w-3 h-3 text-purple-400" />
                <span className="font-medium text-purple-300">{step.tool}</span>
                {step.output && !isExpanded && (
                  <span className="ml-auto text-emerald-400/60 text-[10px]">completed</span>
                )}
                {!step.output && msg.isStreaming && (
                  <span className="ml-auto text-amber-400/60 text-[10px] animate-pulse">running...</span>
                )}
              </button>
              {isExpanded && (
                <div className="px-3 pb-2 space-y-1.5">
                  {step.input != null && (
                    <pre className="text-[11px] text-slate-500 bg-black/30 rounded px-2 py-1.5 overflow-x-auto max-h-32">
                      {typeof step.input === "string" ? step.input : JSON.stringify(step.input, null, 2)}
                    </pre>
                  )}
                  {step.output && (
                    <pre className="text-[11px] text-slate-400 bg-black/30 rounded px-2 py-1.5 overflow-x-auto max-h-48">
                      {step.output}
                    </pre>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderMessageContent = (msg: DisplayMessage) => {
    // Use markdown rendering for assistant messages (especially Claude tier)
    if (msg.role === "assistant" && msg.content && !msg.isStreaming) {
      return (
        <>
          {renderToolSteps(msg)}
          <MarkdownRenderer content={msg.content} />
        </>
      );
    }

    // For streaming messages, show tool steps + text with cursor
    return (
      <div>
        {renderToolSteps(msg)}
        <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
          {msg.content}
          {msg.isStreaming && !msg.content && !msg.toolSteps?.length && (
            <span className="inline-flex gap-1 ml-1">
              <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </span>
          )}
          {msg.isStreaming && (msg.content || msg.toolSteps?.length) && !msg.content && (
            <span className="text-xs text-slate-500 animate-pulse">Claude is working...</span>
          )}
          {msg.isStreaming && msg.content && (
            <span className="inline-block w-2 h-4 bg-purple-400 ml-0.5 animate-pulse" />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-[#0c0515]">
      <Sidebar activePage="chats" />

      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-white/[0.06] px-6 py-4 flex items-center gap-4">
          <h1 className="text-white font-medium truncate flex-1">{title}</h1>

          {/* Project selector */}
          <div className="relative" ref={projectDropdownRef}>
            <button
              onClick={() => setShowProjectDropdown(!showProjectDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs font-medium hover:bg-purple-500/15 transition-all"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              {currentProject ? currentProject.name : "Project"}
              <ChevronDown
                className={`w-3 h-3 transition-transform ${
                  showProjectDropdown ? "rotate-180" : ""
                }`}
              />
            </button>

            {showProjectDropdown && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-[#1a0e2e] border border-white/[0.08] rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
                <div className="px-3 py-2 border-b border-white/[0.06]">
                  <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                    Switch Project
                  </span>
                </div>
                <div className="max-h-60 overflow-y-auto py-1">
                  {projects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => handleSelectProject(project)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/[0.05] transition-colors ${
                        currentProject?.id === project.id
                          ? "bg-purple-500/10"
                          : ""
                      }`}
                    >
                      <FolderOpen
                        className={`w-3.5 h-3.5 flex-shrink-0 ${
                          currentProject?.id === project.id
                            ? "text-purple-400"
                            : "text-slate-500"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-xs truncate ${
                            currentProject?.id === project.id
                              ? "text-purple-300 font-medium"
                              : "text-white"
                          }`}
                        >
                          {project.name}
                        </div>
                      </div>
                      {currentProject?.id === project.id && (
                        <Check className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {mode && (
            <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase">
              {mode}
            </span>
          )}
        </div>

        {/* Mode selector */}
        <div className="px-6 py-2 border-b border-white/[0.04] flex items-center gap-2">
          <span className="text-xs text-slate-500 mr-1">Mode:</span>
          {[
            { value: "", label: "Auto" },
            { value: "debug", label: "Debug" },
            { value: "feature", label: "Feature" },
            { value: "rca", label: "RCA" },
            { value: "refactor", label: "Refactor" },
            { value: "docs", label: "Docs" },
          ].map((m) => (
            <button
              key={m.value}
              onClick={() => setMode(m.value)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                mode === m.value
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                  : "text-slate-500 hover:text-slate-400 hover:bg-white/[0.03]"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className="flex gap-4">
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    msg.role === "user"
                      ? "bg-purple-600"
                      : msg.stage === "claude"
                      ? "bg-gradient-to-br from-orange-400 to-amber-600"
                      : "bg-gradient-to-br from-purple-400 to-violet-600"
                  }`}
                >
                  {msg.role === "user" ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <Bot className="w-4 h-4 text-white" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-500 mb-1.5 font-medium flex items-center">
                    {msg.role === "user" ? "You" : "MARS"}
                    {msg.role === "assistant" && <TierBadge stage={msg.stage} />}
                  </div>

                  {renderMessageContent(msg)}

                  {/* Action buttons hidden — direct chat mode, no approval needed */}

                  {/* Action taken indicator — hidden in direct chat mode */}
                  {false && msg.actionTaken && (
                    <div
                      className={`mt-2 text-xs font-medium ${
                        msg.actionTaken === "approved"
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}
                    >
                      {msg.actionTaken === "approved"
                        ? "Solution approved"
                        : "Solution rejected"}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Refinement Preview Panel */}
        {false && refinement && (
          <div className="border-t border-purple-500/20 bg-purple-500/[0.04] px-6 py-4">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center gap-2 mb-3">
                <Wand2 className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-medium text-purple-300">Prompt Refinement</span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Original */}
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Original</div>
                  <p className="text-sm text-slate-400 leading-relaxed">{refinement?.original_prompt}</p>
                </div>

                {/* Refined */}
                <div className="rounded-lg bg-purple-500/[0.06] border border-purple-500/20 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-purple-400 mb-2">Refined</div>
                  {editingRefinement ? (
                    <textarea
                      value={editedPrompt}
                      onChange={(e) => setEditedPrompt(e.target.value)}
                      className="w-full bg-transparent text-sm text-slate-200 leading-relaxed resize-none focus:outline-none min-h-[80px]"
                    />
                  ) : (
                    <p className="text-sm text-slate-200 leading-relaxed">{refinement?.refined_prompt}</p>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                {editingRefinement ? (
                  <>
                    <button
                      onClick={handleModifyRefinement}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white transition-colors"
                    >
                      <Check className="w-3 h-3" />
                      Send Modified
                    </button>
                    <button
                      onClick={() => {
                        setEditingRefinement(false);
                        setEditedPrompt(refinement?.refined_prompt ?? '');
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.05] hover:bg-white/[0.08] text-slate-400 transition-colors"
                    >
                      <X className="w-3 h-3" />
                      Cancel Edit
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleApproveRefinement}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                    >
                      <Check className="w-3 h-3" />
                      Approve & Execute
                    </button>
                    <button
                      onClick={() => setEditingRefinement(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.05] hover:bg-white/[0.08] text-slate-400 transition-colors"
                    >
                      <Edit3 className="w-3 h-3" />
                      Modify
                    </button>
                    <button
                      onClick={handleSkipRefinement}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.05] hover:bg-white/[0.08] text-slate-400 transition-colors"
                    >
                      <X className="w-3 h-3" />
                      Skip — Send Original
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Loading refinement indicator */}
        {isRefining && (
          <div className="border-t border-purple-500/20 bg-purple-500/[0.04] px-6 py-3">
            <div className="max-w-3xl mx-auto flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-purple-400 animate-pulse" />
              <span className="text-sm text-purple-300 animate-pulse">Refining prompt with project context...</span>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t border-white/[0.06] px-6 py-4">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
            {/* Attachment preview */}
            {chatAttachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {chatAttachments.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 group">
                    <span className="text-slate-400">{getAttachmentIcon(file)}</span>
                    <span className="text-xs text-slate-300 truncate max-w-[100px]">{file.name}</span>
                    <span className="text-[10px] text-slate-500">{file.size > 1024 ? `${(file.size / 1024).toFixed(0)}KB` : `${file.size}B`}</span>
                    <button type="button" onClick={() => removeAttachment(idx)} className="ml-0.5 p-0.5 rounded hover:bg-white/[0.08] text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center bg-white/[0.05] border border-white/[0.08] rounded-2xl px-5 py-4 focus-within:ring-2 focus-within:ring-purple-500/30 focus-within:border-purple-500/30 transition-all">
              <Sparkles className="w-5 h-5 text-purple-400 mr-3 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                disabled={isStreaming}
                className="flex-1 bg-transparent text-white placeholder-slate-500 text-sm focus:outline-none disabled:cursor-not-allowed"
              />
              <input ref={fileInputRef} type="file" accept={CHAT_ACCEPTED_FILES} multiple onChange={handleFileSelect} className="hidden" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isStreaming || chatAttachments.length >= CHAT_MAX_FILES}
                className="ml-2 w-8 h-8 rounded-lg hover:bg-white/[0.08] text-slate-400 hover:text-white disabled:opacity-30 flex items-center justify-center transition-colors flex-shrink-0"
                title="Attach files (images, CSV, Excel, Word, PDF)"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              {isStreaming ? (
                <button
                  type="button"
                  onClick={handleStop}
                  className="ml-1 w-8 h-8 rounded-lg bg-red-600 hover:bg-red-500 text-white flex items-center justify-center transition-colors flex-shrink-0"
                >
                  <Square className="w-3 h-3 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim() && chatAttachments.length === 0}
                  className="ml-1 w-8 h-8 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-white/[0.05] disabled:text-slate-600 text-white flex items-center justify-center transition-colors flex-shrink-0"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
              )}
            </div>
            {/* Branch name input for feature/refactor modes */}
            {(mode === "feature" || mode === "refactor") && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[11px] text-slate-500 whitespace-nowrap">Branch:</span>
                <div className="flex items-center flex-1 bg-white/[0.03] border border-white/[0.06] rounded-lg overflow-hidden">
                  <input
                    type="text"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    placeholder="my-feature-branch"
                    className="flex-1 bg-transparent text-xs text-slate-300 placeholder-slate-600 px-2.5 py-1.5 focus:outline-none"
                  />
                  <span className="text-[11px] text-slate-600 px-2 py-1.5 bg-white/[0.02] border-l border-white/[0.06]">
                    -E-MARS
                  </span>
                </div>
              </div>
            )}
            {/* Toggles row */}
            <div className="flex items-center justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => setRefineEnabled((prev) => !prev)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                  refineEnabled
                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                    : "bg-white/[0.03] text-slate-500 border border-white/[0.06] hover:text-slate-400"
                }`}
              >
                <Wand2 className="w-3 h-3" />
                {refineEnabled ? "Refine on" : "Refine off"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDetailedView((prev) => !prev);
                  setExpandedSteps({}); // reset manual toggles when switching mode
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                  detailedView
                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                    : "bg-white/[0.03] text-slate-500 border border-white/[0.06] hover:text-slate-400"
                }`}
              >
                {detailedView ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                {detailedView ? "Detailed view" : "Simple view"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
