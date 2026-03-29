const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface StreamChunk {
  // Mars internal events
  type: "tier" | "done" | "error" |
    // Events from shiprocket-channels Claude API
    "system" | "assistant" | "tool_use" | "tool_result" | "result" |
    // Keep-alive during long Claude tasks
    "heartbeat";

  // Mars fields
  message_id?: string;
  tier?: string;
  stage?: string;
  session_id?: string;

  // Channels StreamEvent fields
  text?: string;       // assistant text content, system messages, result text
  tool?: string;       // tool name (for tool_use events)
  input?: unknown;     // tool input (for tool_use events)
  output?: string;     // tool output (for tool_result events), result JSON (for result events)

  // Legacy / error
  content?: string;
  error?: string;
}

/**
 * Streams a chat message to the backend and calls onChunk for each SSE event.
 * Uses fetch() with POST (EventSource is GET-only and can't send a body).
 */
export async function streamChat(
  conversationId: string,
  content: string,
  onChunk: (chunk: StreamChunk) => void,
  mode?: string,
  platform?: string,
  agentRole?: string,
  attachments?: File[]
): Promise<void> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("mars_token") : null;

  const headers: Record<string, string> = {
    Accept: "text/event-stream",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let body: FormData | string;

  if (attachments && attachments.length > 0) {
    // Multipart form data with file attachments
    const formData = new FormData();
    formData.append("content", content);
    if (mode) formData.append("mode", mode);
    if (platform) formData.append("platform", platform);
    if (agentRole) formData.append("agent_role", agentRole);
    for (const file of attachments) {
      formData.append("attachments", file);
    }
    body = formData;
  } else {
    // JSON (default, no attachments)
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({ content, ...(mode ? { mode } : {}), ...(platform ? { platform } : {}), ...(agentRole ? { agent_role: agentRole } : {}) });
  }

  const res = await fetch(
    `${API_BASE_URL}/api/v1/chat/conversations/${conversationId}/stream`,
    {
      method: "POST",
      headers,
      body,
    }
  );

  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("mars_token");
      localStorage.removeItem("mars_user");
      localStorage.removeItem("mars_active_project");
      window.location.href = "/";
    }
    const errorText = await res.text();
    throw new Error(`Stream request failed: ${res.status} ${errorText}`);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("No readable stream available");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process complete SSE lines
    const lines = buffer.split("\n");
    buffer = lines.pop() || ""; // Keep incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;

      const data = trimmed.slice(6); // Remove "data: " prefix
      if (!data) continue;

      try {
        const chunk: StreamChunk = JSON.parse(data);
        onChunk(chunk);
      } catch {
        // Skip malformed JSON
      }
    }
  }

  // Process any remaining buffer
  if (buffer.trim().startsWith("data: ")) {
    const data = buffer.trim().slice(6);
    try {
      const chunk: StreamChunk = JSON.parse(data);
      onChunk(chunk);
    } catch {
      // Skip malformed JSON
    }
  }
}

export interface OnboardingProgressEvent {
  type: "progress" | "complete" | "error";
  step?: string;
  step_number?: number;
  total_steps?: number;
  status?: string;
  cost_usd?: number;
  score?: number;
  files_count?: number;
  error?: string;
}

/**
 * Streams onboarding progress events via SSE.
 */
export async function streamOnboardingProgress(
  pipelineId: string,
  onEvent: (event: OnboardingProgressEvent) => void
): Promise<void> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("mars_token") : null;

  const headers: Record<string, string> = {
    Accept: "text/event-stream",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(
    `${API_BASE_URL}/api/v1/onboarding/${pipelineId}/progress`,
    { method: "GET", headers }
  );

  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("mars_token");
      localStorage.removeItem("mars_user");
      localStorage.removeItem("mars_active_project");
      window.location.href = "/";
    }
    throw new Error(`Progress stream failed: ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No readable stream");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;
      const data = trimmed.slice(6);
      if (!data) continue;
      try {
        const event: OnboardingProgressEvent = JSON.parse(data);
        onEvent(event);
      } catch {
        // Skip malformed JSON
      }
    }
  }
}

/**
 * Streams answer submission for module onboarding.
 * Used for Phase 2+ where guide/correct answers trigger Claude rescans.
 */
export async function streamAnswerSubmit(
  data: { repository_id: string; round: number; answers: string; session_id?: string; module_path?: string },
  onChunk: (chunk: StreamChunk) => void
): Promise<void> {
  const token = typeof window !== "undefined" ? localStorage.getItem("mars_token") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(
    `${API_BASE_URL}/api/v1/onboarding/simple/chat/answers/stream`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    }
  );

  if (!res.ok) {
    throw new Error(`Stream answer failed: ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No readable stream");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data: ")) {
        const jsonStr = trimmed.slice(6);
        if (!jsonStr || jsonStr === "{}") continue;
        try {
          const chunk: StreamChunk = JSON.parse(jsonStr);
          onChunk(chunk);
        } catch {
          onChunk({ type: "assistant", text: jsonStr });
        }
      }
    }
  }
}

/**
 * Streams module onboarding chat via SSE.
 * Uses POST to /api/v1/onboarding/simple/chat/stream with module_path.
 * Calls onChunk for each SSE event — assistant text streams token by token.
 */
export async function streamModuleChat(
  data: { repository_id: string; round: number; module_path?: string },
  onChunk: (chunk: StreamChunk) => void
): Promise<void> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("mars_token") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(
    `${API_BASE_URL}/api/v1/onboarding/simple/chat/stream`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    }
  );

  if (!res.ok) {
    throw new Error(`Stream request failed: ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No readable stream");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      // Handle both "data: " and "event: " formats
      if (trimmed.startsWith("data: ")) {
        const data = trimmed.slice(6);
        if (!data || data === "{}") continue;
        try {
          const chunk: StreamChunk = JSON.parse(data);
          onChunk(chunk);
        } catch {
          // Raw text (not JSON) — treat as assistant text
          onChunk({ type: "assistant", text: data });
        }
      }
    }
  }
}

/**
 * Streams module auto-scan progress via SSE.
 * Shows live dimension-by-dimension scanning progress.
 */
export interface AutoScanEvent {
  type: "progress" | "dimension_start" | "dimension_done" | "scoring" | "complete" | "error";
  dimension?: string;
  index?: number;
  total?: number;
  files_found?: number;
  message?: string;
  score?: number;
  // Complete event includes full result
  status?: string;
  ai_score?: number;
  needs_review?: string[];
  generated_files?: string[];
}

/**
 * Streams free-form chat via SSE.
 * Uses POST to /api/v1/onboarding/simple/chat/free/stream.
 * User sends instructions, Claude processes against repo codebase.
 */
export async function streamFreeFormChat(
  data: { repository_id: string; message: string; session_id?: string },
  onChunk: (chunk: StreamChunk) => void
): Promise<void> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("mars_token") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(
    `${API_BASE_URL}/api/v1/onboarding/simple/chat/free/stream`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    }
  );

  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("mars_token");
      localStorage.removeItem("mars_user");
      localStorage.removeItem("mars_active_project");
      window.location.href = "/";
    }
    throw new Error(`Free-form stream failed: ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No readable stream");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data: ")) {
        const jsonStr = trimmed.slice(6);
        if (!jsonStr || jsonStr === "{}") continue;
        try {
          const chunk: StreamChunk = JSON.parse(jsonStr);
          onChunk(chunk);
        } catch {
          // Raw text — treat as assistant text
          onChunk({ type: "assistant", text: jsonStr });
        }
      }
    }
  }
}

export async function streamAutoScanModule(
  data: { repository_id: string; module_path: string },
  onEvent: (event: AutoScanEvent) => void
): Promise<void> {
  const token = typeof window !== "undefined" ? localStorage.getItem("mars_token") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(
    `${API_BASE_URL}/api/v1/onboarding/simple/auto-scan/module/stream`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    }
  );

  if (!res.ok) {
    throw new Error(`Auto-scan stream failed: ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No readable stream");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data: ")) {
        const jsonStr = trimmed.slice(6);
        if (!jsonStr || jsonStr === "{}") continue;
        try {
          const event: AutoScanEvent = JSON.parse(jsonStr);
          onEvent(event);
        } catch {
          // Skip malformed
        }
      }
    }
  }
}
