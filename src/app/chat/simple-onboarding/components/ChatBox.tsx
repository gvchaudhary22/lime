"use client";

import { useEffect, useRef, useState } from "react";
import {
  Send,
  Loader2,
  Paperclip,
  Mic,
  MicOff,
  FileText,
  Image,
  FileSpreadsheet,
  X,
} from "lucide-react";
import { streamFreeFormChat, StreamChunk } from "@/lib/stream";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

interface ChatBoxProps {
  repositoryId: string;
  sessionId: string;
  onSessionIdChange: (sessionId: string) => void;
  messages: ChatMessage[];
  onMessagesChange: (messages: ChatMessage[]) => void;
  onContextScoreUpdate?: (score: number) => void;
  suggestionChips?: React.ReactNode;
}

interface ChatAttachment {
  file: File;
  name: string;
  type: string;
  preview?: string;
  textContent?: string;
}

export default function ChatBox({
  repositoryId,
  sessionId,
  onSessionIdChange,
  messages,
  onMessagesChange,
  onContextScoreUpdate,
  suggestionChips,
}: ChatBoxProps) {
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const ACCEPTED_FILE_TYPES =
    ".png,.jpg,.jpeg,.gif,.webp,.csv,.xlsx,.xls,.doc,.docx,.pdf,.txt,.md";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!repositoryId || (!input.trim() && attachments.length === 0) || streaming) return;

    let fullMessage = input.trim();
    if (attachments.length > 0) {
      const attachmentTexts = attachments
        .map((a) => {
          if (a.textContent) return `\n\n--- Attached: ${a.name} ---\n${a.textContent}`;
          return `\n\n[Attached: ${a.name} (${a.type})]`;
        })
        .join("");
      fullMessage += attachmentTexts;
    }

    // Add user message
    const userMsg: ChatMessage = { role: "user", content: fullMessage, timestamp: new Date().toISOString() };
    const updatedMessages = [...messages, userMsg];
    onMessagesChange(updatedMessages);
    setInput("");
    setAttachments([]);
    setStreaming(true);

    // Start streaming response
    let streamedText = "";
    const assistantMessages = [...updatedMessages, { role: "assistant" as const, content: "", timestamp: new Date().toISOString() }];
    onMessagesChange(assistantMessages);

    try {
      await streamFreeFormChat(
        { repository_id: repositoryId, message: fullMessage, session_id: sessionId },
        (chunk: StreamChunk) => {
          if (chunk.type === "assistant" && chunk.text) {
            streamedText += chunk.text;
            const updated = [...updatedMessages, { role: "assistant" as const, content: streamedText, timestamp: new Date().toISOString() }];
            onMessagesChange(updated);
          } else if (chunk.type === "result") {
            // Parse result for session_id and context_score
            try {
              const resultData = chunk.output ? JSON.parse(chunk.output) : (chunk.text ? JSON.parse(chunk.text) : null);
              if (resultData?.session_id) onSessionIdChange(resultData.session_id);
              if (resultData?.context_score && onContextScoreUpdate) onContextScoreUpdate(resultData.context_score);
            } catch {
              // Result might be plain text
              if (chunk.text && !streamedText) {
                streamedText = chunk.text;
              }
            }
          }
          if (chunk.session_id) onSessionIdChange(chunk.session_id);
        }
      );

      // Finalize
      if (streamedText) {
        onMessagesChange([...updatedMessages, { role: "assistant", content: streamedText, timestamp: new Date().toISOString() }]);
      }
    } catch (err) {
      onMessagesChange([
        ...updatedMessages,
        { role: "assistant", content: `Error: ${err instanceof Error ? err.message : "Failed to get response"}`, timestamp: new Date().toISOString() },
      ]);
    }

    setStreaming(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: ChatAttachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const attachment: ChatAttachment = { file, name: file.name, type: file.type };

      if (file.type.startsWith("image/")) {
        attachment.preview = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => resolve("");
          reader.readAsDataURL(file);
        });
      }

      if (file.type === "text/csv" || file.type === "text/plain" || file.type === "text/markdown" ||
          file.name.endsWith(".csv") || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
        attachment.textContent = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => resolve("");
          reader.readAsText(file);
        });
      }

      newAttachments.push(attachment);
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition not supported in this browser.");
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new (SpeechRecognition as any)();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognitionRef.current = recognition;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) text += e.results[i][0].transcript + " ";
      }
      if (text) setInput((prev) => prev + text);
    };
    recognition.onend = () => setIsRecording(false);
    recognition.start();
    setIsRecording(true);
  };

  const getFileIcon = (type: string, name: string) => {
    if (type.startsWith("image/")) return <Image className="w-3.5 h-3.5" />;
    if (type.includes("spreadsheet") || type.includes("excel") || name.endsWith(".csv") || name.endsWith(".xlsx"))
      return <FileSpreadsheet className="w-3.5 h-3.5" />;
    return <FileText className="w-3.5 h-3.5" />;
  };

  // Allow sending a message programmatically (used by suggestion chips)
  const sendMessage = (message: string) => {
    setInput(message);
    // Use setTimeout to allow state to update before sending
    setTimeout(() => {
      const syntheticInput = message;
      if (!repositoryId || !syntheticInput.trim() || streaming) return;

      const userMsg: ChatMessage = { role: "user", content: syntheticInput, timestamp: new Date().toISOString() };
      const updatedMessages = [...messages, userMsg];
      onMessagesChange(updatedMessages);
      setInput("");
      setStreaming(true);

      let streamedText = "";
      onMessagesChange([...updatedMessages, { role: "assistant", content: "", timestamp: new Date().toISOString() }]);

      streamFreeFormChat(
        { repository_id: repositoryId, message: syntheticInput, session_id: sessionId },
        (chunk: StreamChunk) => {
          if (chunk.type === "assistant" && chunk.text) {
            streamedText += chunk.text;
            onMessagesChange([...updatedMessages, { role: "assistant", content: streamedText, timestamp: new Date().toISOString() }]);
          } else if (chunk.type === "result") {
            try {
              const resultData = chunk.output ? JSON.parse(chunk.output) : (chunk.text ? JSON.parse(chunk.text) : null);
              if (resultData?.session_id) onSessionIdChange(resultData.session_id);
              if (resultData?.context_score && onContextScoreUpdate) onContextScoreUpdate(resultData.context_score);
            } catch { /* */ }
          }
          if (chunk.session_id) onSessionIdChange(chunk.session_id);
        }
      ).then(() => {
        if (streamedText) {
          onMessagesChange([...updatedMessages, { role: "assistant", content: streamedText, timestamp: new Date().toISOString() }]);
        }
        setStreaming(false);
      }).catch((err) => {
        onMessagesChange([...updatedMessages, { role: "assistant", content: `Error: ${err.message}`, timestamp: new Date().toISOString() }]);
        setStreaming(false);
      });
    }, 0);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-3">
              <Send className="w-5 h-5 text-purple-400" />
            </div>
            <p className="text-sm text-slate-400">Start a conversation with MARS AI</p>
            <p className="text-xs text-slate-500 mt-1">
              Ask MARS AI to scan your codebase, generate workflow files, or build documentation
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`rounded-xl px-4 py-3 text-sm ${
              msg.role === "assistant"
                ? "bg-white/[0.03] border border-white/[0.06] text-slate-300"
                : "bg-purple-500/10 border border-purple-500/20 text-white ml-12"
            }`}
          >
            <pre className="whitespace-pre-wrap leading-relaxed font-sans text-xs">
              {msg.content || (streaming && i === messages.length - 1 ? "Thinking..." : "")}
            </pre>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion chips */}
      {suggestionChips && messages.length === 0 && (
        <div className="px-5 pb-2">
          {/* Pass sendMessage to chips via a wrapper */}
          <SuggestionChipWrapper sendMessage={sendMessage}>
            {suggestionChips}
          </SuggestionChipWrapper>
        </div>
      )}

      {/* Input area */}
      <div className="p-4 border-t border-white/[0.06]">
        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachments.map((a, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-[10px] text-slate-300">
                {getFileIcon(a.type, a.name)}
                <span className="truncate max-w-[120px]">{a.name}</span>
                <button onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-300 ml-1">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !streaming) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask about your codebase... (Cmd+Enter to send)"
            rows={3}
            disabled={streaming}
            className="flex-1 bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500/30 resize-none disabled:opacity-50"
          />
          <div className="flex flex-col gap-1">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept={ACCEPTED_FILE_TYPES}
              multiple
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-slate-400 hover:text-purple-300 rounded-lg hover:bg-white/[0.05]"
              title="Attach files"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <button
              onClick={toggleRecording}
              className={`p-2 rounded-lg hover:bg-white/[0.05] ${isRecording ? "text-red-400" : "text-slate-400 hover:text-purple-300"}`}
              title="Voice input"
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <button
              onClick={handleSend}
              disabled={streaming || (!input.trim() && attachments.length === 0)}
              className="p-2 text-purple-400 hover:text-purple-300 disabled:opacity-30 rounded-lg hover:bg-white/[0.05]"
              title="Send"
            >
              {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <p className="text-[9px] text-slate-600 mt-1.5">Cmd+Enter to send · Attach files · Mic for voice</p>
      </div>
    </div>
  );
}

// Helper to pass sendMessage function down to suggestion chip children
function SuggestionChipWrapper({ children, sendMessage }: { children: React.ReactNode; sendMessage: (msg: string) => void }) {
  // Make sendMessage available via a data attribute on a hidden element
  // The SuggestionChips component reads this via a callback prop
  return (
    <div data-send-message="true">
      {typeof children === "function" ? (children as (send: (msg: string) => void) => React.ReactNode)(sendMessage) : children}
    </div>
  );
}
