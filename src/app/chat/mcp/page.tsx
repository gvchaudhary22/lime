"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Send, Bot, Loader2, CheckCircle2, XCircle, GitBranch,
  FileCode, Terminal, Search, ArrowLeft, Zap,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import MarkdownRenderer from "@/components/chat/MarkdownRenderer";
import { api } from "@/lib/api";

interface MCPSession {
  id: string;
  title: string;
  status: string;
  routed_repo_id: string;
  routed_repo_path: string;
  routed_confidence: number;
  created_at: string;
}

interface MCPMessage {
  id: string;
  role: string;
  content: string;
  message_type: string;
  tool_name: string;
  tool_input: string;
  tool_output: string;
  approval_status: string;
  created_at: string;
}

interface StreamMsg {
  role: "user" | "assistant" | "system";
  content: string;
  isStreaming?: boolean;
  toolName?: string;
  toolInput?: string;
  toolOutput?: string;
  approvalId?: string;
}

export default function MCPChatPage() {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [sessions, setSessions] = useState<MCPSession[]>([]);
  const [activeSession, setActiveSession] = useState<MCPSession | null>(null);
  const [messages, setMessages] = useState<StreamMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [routingInfo, setRoutingInfo] = useState<{ repo: string; confidence: number } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("mars_token");
    if (!token) { router.push("/"); return; }
    loadSessions();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadSessions = async () => {
    setLoading(true);
    const res = await api.listMCPSessions();
    if (res.success && res.data) {
      setSessions(res.data);
    }
    setLoading(false);
  };

  const createSession = async () => {
    const res = await api.createMCPSession();
    if (res.success && res.data) {
      const newSession: MCPSession = {
        id: res.data.id,
        title: res.data.title,
        status: res.data.status,
        routed_repo_id: "",
        routed_repo_path: "",
        routed_confidence: 0,
        created_at: new Date().toISOString(),
      };
      setSessions(prev => [newSession, ...prev]);
      selectSession(newSession);
    }
  };

  const selectSession = async (session: MCPSession) => {
    setActiveSession(session);
    setMessages([]);
    setRoutingInfo(null);

    if (session.routed_repo_path) {
      setRoutingInfo({ repo: session.routed_repo_path, confidence: session.routed_confidence });
    }

    const res = await api.getMCPMessages(session.id);
    if (res.success && res.data) {
      setMessages(res.data.map(m => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
        toolName: m.tool_name,
        toolInput: m.tool_input,
        toolOutput: m.tool_output,
        approvalId: m.approval_status === "pending" ? m.id : undefined,
      })));
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeSession || streaming) return;

    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setStreaming(true);

    // Add streaming assistant placeholder
    setMessages(prev => [...prev, { role: "assistant", content: "", isStreaming: true }]);

    try {
      const token = localStorage.getItem("mars_token");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}/api/v1/mcp/sessions/${activeSession.id}/send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content: userMsg }),
        }
      );

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === "routing") {
              setRoutingInfo({ repo: event.repo_path || event.repo_id, confidence: event.confidence });
            } else if (event.type === "assistant" && event.text) {
              assistantText += event.text;
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.isStreaming) {
                  updated[updated.length - 1] = { ...last, content: assistantText };
                }
                return updated;
              });
            } else if (event.type === "tool_use") {
              setMessages(prev => [...prev.filter(m => !m.isStreaming), {
                role: "system",
                content: `Using tool: ${event.tool}`,
                toolName: event.tool,
                toolInput: typeof event.input === "string" ? event.input : JSON.stringify(event.input),
              }]);
            } else if (event.type === "tool_result") {
              setMessages(prev => [...prev, {
                role: "system",
                content: event.output || "Tool completed",
                toolOutput: event.output,
              }]);
            } else if (event.type === "approval_required") {
              setMessages(prev => [...prev, {
                role: "system",
                content: `⚠️ Approval required: ${event.tool_name || "code execution"}`,
                approvalId: event.message_id,
              }]);
            }
          } catch { /* ignore parse errors */ }
        }
      }

      // Finalize streaming message
      setMessages(prev => prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m));

    } catch (err) {
      setMessages(prev => [...prev.filter(m => !m.isStreaming), {
        role: "system",
        content: "Error: Failed to get response",
      }]);
    } finally {
      setStreaming(false);
    }
  };

  const handleApprove = async (messageId: string) => {
    if (!activeSession) return;
    await api.approveMCPAction(activeSession.id, messageId);
    setMessages(prev => prev.map(m =>
      m.approvalId === messageId ? { ...m, content: "✅ Approved", approvalId: undefined } : m
    ));
  };

  const handleReject = async (messageId: string) => {
    if (!activeSession) return;
    await api.rejectMCPAction(activeSession.id, messageId);
    setMessages(prev => prev.map(m =>
      m.approvalId === messageId ? { ...m, content: "❌ Rejected", approvalId: undefined } : m
    ));
  };

  return (
    <div className="flex h-screen bg-[#0a0a0f]">
      <Sidebar activePage="mcp-chat" />
      <div className="flex flex-1 overflow-hidden">
        {/* Session List */}
        <div className="w-64 border-r border-white/[0.06] flex flex-col">
          <div className="p-3 border-b border-white/[0.06]">
            <button
              onClick={createSession}
              className="w-full flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition"
            >
              <Plus className="w-4 h-4" />
              New MCP Chat
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && <div className="p-3 text-xs text-zinc-500">Loading sessions...</div>}
            {sessions.map(s => (
              <button
                key={s.id}
                onClick={() => selectSession(s)}
                className={`w-full text-left px-3 py-2.5 text-sm border-b border-white/[0.04] transition ${
                  activeSession?.id === s.id ? "bg-purple-600/10 text-purple-300" : "text-zinc-400 hover:bg-white/[0.02]"
                }`}
              >
                <div className="truncate">{s.title}</div>
                {s.routed_repo_path && (
                  <div className="text-[10px] text-zinc-600 truncate mt-0.5">{s.routed_repo_path}</div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="h-12 border-b border-white/[0.06] flex items-center px-4 gap-3">
            <Bot className="w-5 h-5 text-purple-400" />
            <span className="text-sm font-medium text-white">MCP Chat</span>
            {routingInfo && (
              <div className="flex items-center gap-2 ml-4 px-2 py-1 bg-green-500/10 border border-green-500/20 rounded text-xs text-green-300">
                <GitBranch className="w-3 h-3" />
                {routingInfo.repo} ({Math.round(routingInfo.confidence * 100)}%)
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {!activeSession && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Bot className="w-12 h-12 text-purple-400/30 mb-4" />
                <h2 className="text-xl font-semibold text-white mb-2">MCP Chat</h2>
                <p className="text-sm text-zinc-500 max-w-md">
                  Chat with MARS AI. Describe any task — MARS auto-detects the right repo,
                  reads the codebase and helps you fix bugs, add features, or investigate issues.
                </p>
                <button
                  onClick={createSession}
                  className="mt-6 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition flex items-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  Start MCP Chat
                </button>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                {msg.role !== "user" && (
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    msg.role === "assistant" ? "bg-purple-600/20" : "bg-zinc-800"
                  }`}>
                    {msg.role === "assistant" ? <Bot className="w-4 h-4 text-purple-400" /> : <Terminal className="w-3.5 h-3.5 text-zinc-400" />}
                  </div>
                )}

                <div className={`max-w-[80%] ${msg.role === "user" ? "bg-purple-600/20 border border-purple-500/20" : "bg-zinc-900/60 border border-zinc-800"} rounded-lg p-3`}>
                  {/* Tool use indicator */}
                  {msg.toolName && (
                    <div className="flex items-center gap-2 mb-2 text-xs text-cyan-400">
                      <FileCode className="w-3 h-3" />
                      {msg.toolName}
                    </div>
                  )}

                  {/* Content */}
                  <div className="text-sm text-zinc-200">
                    {msg.isStreaming && !msg.content ? (
                      <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                    ) : (
                      <MarkdownRenderer content={msg.content} />
                    )}
                  </div>

                  {/* Approval buttons */}
                  {msg.approvalId && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleApprove(msg.approvalId!)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs rounded transition"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(msg.approvalId!)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 text-xs rounded transition"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          {activeSession && (
            <div className="border-t border-white/[0.06] p-4">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  placeholder="Describe a task, bug, or question..."
                  className="flex-1 px-4 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                  disabled={streaming}
                />
                <button
                  onClick={sendMessage}
                  disabled={streaming || !input.trim()}
                  className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg transition"
                >
                  {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
