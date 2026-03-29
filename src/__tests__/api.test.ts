import { describe, it, expect, vi, beforeEach } from "vitest";
import { api } from "@/lib/api";

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

describe("api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage["mars_token"] = "test-token";
  });

  describe("approveAction", () => {
    it("sends POST to correct endpoint", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, message: "action approved" }),
      });

      const res = await api.approveAction("conv-123");

      expect(res.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "/api/v1/chat/conversations/conv-123/approve"
        ),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("includes auth header", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      await api.approveAction("conv-123");

      const callHeaders = mockFetch.mock.calls[0][1].headers;
      expect(callHeaders["Authorization"]).toBe("Bearer test-token");
    });
  });

  describe("rejectAction", () => {
    it("sends POST to correct endpoint", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, message: "action rejected" }),
      });

      const res = await api.rejectAction("conv-456");

      expect(res.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "/api/v1/chat/conversations/conv-456/reject"
        ),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("getConversation", () => {
    it("fetches conversation detail", async () => {
      const mockData = {
        conversation: {
          id: "conv-1",
          title: "Test Chat",
          status: "active",
        },
        messages: [
          {
            id: "msg-1",
            role: "user",
            content: "Hello",
            stage: "ai_gateway",
          },
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockData }),
      });

      const res = await api.getConversation("conv-1");

      expect(res.success).toBe(true);
      expect(res.data?.conversation.id).toBe("conv-1");
      expect(res.data?.messages).toHaveLength(1);
      expect(res.data?.messages[0].stage).toBe("ai_gateway");
    });
  });

  describe("createConversation", () => {
    it("sends correct payload", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { id: "new-conv" } }),
      });

      await api.createConversation({
        channel: "web",
        user_id: "user-1",
        project_id: "proj-1",
        title: "Test",
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.channel).toBe("web");
      expect(body.user_id).toBe("user-1");
      expect(body.project_id).toBe("proj-1");
    });
  });

  describe("error handling", () => {
    it("returns error on non-OK response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Not found" }),
      });

      const res = await api.getConversation("nonexistent");

      expect(res.success).toBe(false);
      expect(res.error).toBe("Not found");
    });

    it("returns default error message when no error field", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({}),
      });

      const res = await api.getConversation("bad-id");

      expect(res.success).toBe(false);
      expect(res.error).toBe("Something went wrong");
    });
  });

  describe("getProjects", () => {
    it("fetches project list", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: "proj-1", name: "MyProject" }],
        }),
      });

      const res = await api.getProjects();
      expect(res.success).toBe(true);
      expect(res.data).toHaveLength(1);
    });
  });

  describe("repo context APIs", () => {
    it("getRepoContext calls correct endpoint", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { status: "loaded", sections: { architecture: "microservices" }, repo_context_done: false } }),
      });

      const res = await api.getRepoContext("repo-123");
      expect(res.success).toBe(true);
      expect(res.data?.sections?.architecture).toBe("microservices");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/onboarding/simple/repo-context/repo-123"),
        expect.objectContaining({ method: "GET" })
      );
    });

    it("submitRepoContext sends section and answers", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { status: "follow_up", follow_up: "Tell me more about deployment", sections: { architecture: "event-driven" } } }),
      });

      const res = await api.submitRepoContext({
        repository_id: "repo-123",
        answers: "We use Kafka for async messaging",
        section: "architecture",
      });

      expect(res.success).toBe(true);
      expect(res.data?.follow_up).toContain("deployment");
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.section).toBe("architecture");
      expect(body.answers).toContain("Kafka");
    });

    it("saveRepoContext marks context complete", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { status: "complete", repo_context_done: true, sections: { general: "test" } } }),
      });

      const res = await api.saveRepoContext({ repository_id: "repo-123" });
      expect(res.success).toBe(true);
      expect(res.data?.repo_context_done).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/onboarding/simple/repo-context/save"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("401 redirect", () => {
    it("clears auth data and redirects on 401", async () => {
      mockStorage["mars_token"] = "expired-token";
      mockStorage["mars_user"] = '{"id":"u1"}';
      mockStorage["mars_active_project"] = "proj-1";

      // Mock window.location.href
      const locationSpy = vi.spyOn(window, "location", "get").mockReturnValue({
        ...window.location,
        href: "",
      } as Location);
      const hrefSetter = vi.fn();
      Object.defineProperty(window.location, "href", {
        set: hrefSetter,
        configurable: true,
      });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: "token expired" }),
      });

      const res = await api.getConversation("conv-1");

      expect(res.success).toBe(false);
      expect(mockStorage["mars_token"]).toBeUndefined();
      expect(mockStorage["mars_user"]).toBeUndefined();
      expect(mockStorage["mars_active_project"]).toBeUndefined();
      expect(hrefSetter).toHaveBeenCalledWith("/");

      locationSpy.mockRestore();
    });

    it("does not redirect on non-401 errors", async () => {
      mockStorage["mars_token"] = "valid-token";

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: "server error" }),
      });

      const res = await api.getConversation("conv-1");

      expect(res.success).toBe(false);
      expect(mockStorage["mars_token"]).toBe("valid-token");
    });
  });
});
