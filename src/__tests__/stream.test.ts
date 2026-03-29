import { describe, it, expect, vi, beforeEach } from "vitest";
import { streamChat, StreamChunk } from "@/lib/stream";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockStorage: Record<string, string> = {};
Object.defineProperty(window, "localStorage", {
  value: {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, value: string) => {
      mockStorage[key] = value;
    },
    removeItem: (key: string) => {
      delete mockStorage[key];
    },
  },
});

function createReadableStream(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const data = lines.join("\n") + "\n";
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(data));
      controller.close();
    },
  });
}

describe("streamChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage["mars_token"] = "test-token";
  });

  it("sends correct request headers and body", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: createReadableStream([
        'data: {"type":"done","message_id":"msg-1"}',
      ]),
    });

    await streamChat("conv-123", "hello", () => {});

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/chat/conversations/conv-123/stream"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          Authorization: "Bearer test-token",
        }),
        body: JSON.stringify({ content: "hello" }),
      })
    );
  });

  it("parses assistant text events from channels API", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: createReadableStream([
        'data: {"type":"assistant","text":"Hello "}',
        'data: {"type":"assistant","text":"World"}',
        'data: {"type":"done","message_id":"msg-1"}',
      ]),
    });

    const chunks: StreamChunk[] = [];
    await streamChat("conv-1", "test", (chunk) => {
      chunks.push(chunk);
    });

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toEqual(expect.objectContaining({ type: "assistant", text: "Hello " }));
    expect(chunks[1]).toEqual(expect.objectContaining({ type: "assistant", text: "World" }));
    expect(chunks[2]).toEqual(
      expect.objectContaining({ type: "done", message_id: "msg-1" })
    );
  });

  it("parses tier event correctly", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: createReadableStream([
        'data: {"type":"tier","tier":"claude"}',
        'data: {"type":"assistant","text":"Analysis..."}',
        'data: {"type":"done","message_id":"msg-1","stage":"claude","session_id":"sess-1"}',
      ]),
    });

    const chunks: StreamChunk[] = [];
    await streamChat("conv-1", "test", (chunk) => {
      chunks.push(chunk);
    });

    expect(chunks[0].type).toBe("tier");
    expect(chunks[0].tier).toBe("claude");
    expect(chunks[2].stage).toBe("claude");
    expect(chunks[2].session_id).toBe("sess-1");
  });

  it("parses tool_use and tool_result events", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: createReadableStream([
        'data: {"type":"tool_use","tool":"Bash","input":{"command":"ls"}}',
        'data: {"type":"tool_result","output":"file1.go\\nfile2.go"}',
        'data: {"type":"assistant","text":"Found files."}',
        'data: {"type":"done"}',
      ]),
    });

    const chunks: StreamChunk[] = [];
    await streamChat("conv-1", "test", (chunk) => {
      chunks.push(chunk);
    });

    expect(chunks[0].type).toBe("tool_use");
    expect(chunks[0].tool).toBe("Bash");
    expect(chunks[0].input).toEqual({ command: "ls" });
    expect(chunks[1].type).toBe("tool_result");
    expect(chunks[1].output).toBe("file1.go\nfile2.go");
    expect(chunks[2].type).toBe("assistant");
    expect(chunks[2].text).toBe("Found files.");
  });

  it("throws on non-OK response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    await expect(
      streamChat("conv-1", "test", () => {})
    ).rejects.toThrow("Stream request failed: 500");
  });

  it("throws when no readable stream", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: null,
    });

    await expect(
      streamChat("conv-1", "test", () => {})
    ).rejects.toThrow("No readable stream");
  });

  it("skips malformed JSON lines", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: createReadableStream([
        "data: not-valid-json",
        'data: {"type":"assistant","text":"valid"}',
        'data: {"type":"done"}',
      ]),
    });

    const chunks: StreamChunk[] = [];
    await streamChat("conv-1", "test", (chunk) => {
      chunks.push(chunk);
    });

    // Should skip the malformed line and parse the valid ones
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.find((c) => c.type === "assistant")?.text).toBe("valid");
  });

  it("sends request without auth when no token", async () => {
    delete mockStorage["mars_token"];

    mockFetch.mockResolvedValue({
      ok: true,
      body: createReadableStream(['data: {"type":"done"}']),
    });

    await streamChat("conv-1", "test", () => {});

    const callHeaders = mockFetch.mock.calls[0][1].headers;
    expect(callHeaders["Authorization"]).toBeUndefined();
  });
});

// Additional 401 redirect tests
describe("streamChat 401 handling", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    // Replace window.location with a mutable object
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...originalLocation, href: "" },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: originalLocation,
    });
  });

  it("clears auth data and redirects on 401", async () => {
    mockStorage["mars_token"] = "expired-token";
    mockStorage["mars_user"] = '{"id":"u1"}';
    mockStorage["mars_active_project"] = "proj-1";

    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });

    await expect(
      streamChat("conv-1", "test", () => {})
    ).rejects.toThrow("Stream request failed: 401");

    expect(mockStorage["mars_token"]).toBeUndefined();
    expect(mockStorage["mars_user"]).toBeUndefined();
    expect(mockStorage["mars_active_project"]).toBeUndefined();
    expect(window.location.href).toBe("/");
  });

  it("does not redirect on non-401 errors", async () => {
    mockStorage["mars_token"] = "valid-token";

    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    await expect(
      streamChat("conv-1", "test", () => {})
    ).rejects.toThrow("Stream request failed: 500");

    expect(mockStorage["mars_token"]).toBe("valid-token");
  });
});
