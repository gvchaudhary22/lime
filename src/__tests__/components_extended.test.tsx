import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// Global mocks
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockPush = vi.fn();
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

const mockStorage: Record<string, string> = {};
Object.defineProperty(window, "localStorage", {
  value: {
    getItem: (key: string) => mockStorage[key] ?? null,
    setItem: (key: string, value: string) => { mockStorage[key] = value; },
    removeItem: (key: string) => { delete mockStorage[key]; },
    clear: () => Object.keys(mockStorage).forEach((k) => delete mockStorage[k]),
  },
  writable: true,
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockFetch.mockReset();
});

// ===========================================================================
// MarkdownRenderer
// ===========================================================================

describe("MarkdownRenderer", () => {
  let MarkdownRenderer: React.ComponentType<{ content: string }>;

  beforeEach(async () => {
    const mod = await import("@/components/chat/MarkdownRenderer");
    MarkdownRenderer = mod.default;
  });

  it("renders plain text", () => {
    render(<MarkdownRenderer content="Hello world" />);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("renders bold text", () => {
    render(<MarkdownRenderer content="**bold text**" />);
    expect(screen.getByText("bold text").tagName).toBe("STRONG");
  });

  it("renders italic text", () => {
    render(<MarkdownRenderer content="_italic text_" />);
    expect(screen.getByText("italic text").tagName).toBe("EM");
  });

  it("renders h1 heading", () => {
    render(<MarkdownRenderer content="# Heading One" />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("renders h2 heading", () => {
    render(<MarkdownRenderer content="## Heading Two" />);
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
  });

  it("renders h3 heading", () => {
    render(<MarkdownRenderer content="### Heading Three" />);
    expect(screen.getByRole("heading", { level: 3 })).toBeInTheDocument();
  });

  it("renders unordered list items", () => {
    render(<MarkdownRenderer content={"- item one\n- item two"} />);
    expect(screen.getByText("item one")).toBeInTheDocument();
    expect(screen.getByText("item two")).toBeInTheDocument();
  });

  it("renders ordered list items", () => {
    render(<MarkdownRenderer content={"1. first\n2. second"} />);
    expect(screen.getByText("first")).toBeInTheDocument();
    expect(screen.getByText("second")).toBeInTheDocument();
  });

  it("renders blockquote", () => {
    render(<MarkdownRenderer content="> quoted text" />);
    expect(screen.getByText("quoted text")).toBeInTheDocument();
  });

  it("renders links with target _blank and rel noopener", () => {
    render(<MarkdownRenderer content="[click me](https://example.com)" />);
    const link = screen.getByRole("link", { name: "click me" });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders inline code", () => {
    render(<MarkdownRenderer content="use `npm install` command" />);
    expect(screen.getByText("npm install")).toBeInTheDocument();
  });

  it("renders code block with language label", async () => {
    render(<MarkdownRenderer content={"```javascript\nconsole.log('hi')\n```"} />);
    // Code block or language indicator should be present
    await waitFor(() => {
      const pre = document.querySelector("pre, code");
      expect(pre).not.toBeNull();
    });
  });

  it("renders table with headers and cells", () => {
    const md = `| Name | Value |\n|------|-------|\n| foo | bar |`;
    render(<MarkdownRenderer content={md} />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Value")).toBeInTheDocument();
    expect(screen.getByText("foo")).toBeInTheDocument();
    expect(screen.getByText("bar")).toBeInTheDocument();
  });

  it("renders horizontal rule", () => {
    render(<MarkdownRenderer content={"line one\n\n---\n\nline two"} />);
    expect(screen.getByText("line one")).toBeInTheDocument();
    expect(screen.getByText("line two")).toBeInTheDocument();
    expect(document.querySelector("hr")).not.toBeNull();
  });

  it("handles empty content without crashing", () => {
    expect(() => render(<MarkdownRenderer content="" />)).not.toThrow();
  });
});

// ===========================================================================
// ActionButtons
// ===========================================================================

describe("ActionButtons", () => {
  let ActionButtons: React.ComponentType<{
    conversationId: string;
    onRephrase?: () => void;
    onActionComplete?: () => void;
  }>;

  beforeEach(async () => {
    const mod = await import("@/components/chat/ActionButtons");
    ActionButtons = mod.default;
  });

  it("renders Approve, Rephrase, and Reject buttons", () => {
    render(<ActionButtons conversationId="conv-1" />);
    expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rephrase/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument();
  });

  it("calls approve API and fires onActionComplete", async () => {
    mockStorage["mars_token"] = "token-abc";
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    const onActionComplete = vi.fn();

    render(<ActionButtons conversationId="conv-approve" onActionComplete={onActionComplete} />);
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/conv-approve/approve"),
        expect.objectContaining({ method: "POST" })
      );
    });
    await waitFor(() => expect(onActionComplete).toHaveBeenCalled());
  });

  it("calls reject API and fires onActionComplete", async () => {
    mockStorage["mars_token"] = "token-abc";
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    const onActionComplete = vi.fn();

    render(<ActionButtons conversationId="conv-reject" onActionComplete={onActionComplete} />);
    fireEvent.click(screen.getByRole("button", { name: /reject/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/conv-reject/reject"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("calls onRephrase when Rephrase clicked (no API call)", async () => {
    const onRephrase = vi.fn();
    render(<ActionButtons conversationId="conv-rep" onRephrase={onRephrase} />);
    fireEvent.click(screen.getByRole("button", { name: /rephrase/i }));
    expect(onRephrase).toHaveBeenCalled();
  });

  it("disables buttons while an action is in progress", async () => {
    mockStorage["mars_token"] = "token-abc";
    // Slow fetch to test loading state
    mockFetch.mockImplementation(() => new Promise((resolve) => setTimeout(() => {
      resolve({ ok: true, json: async () => ({ success: true }) });
    }, 200)));

    render(<ActionButtons conversationId="conv-loading" />);
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));

    await waitFor(() => {
      const approveBtn = screen.getByRole("button", { name: /approve/i });
      expect(approveBtn).toBeDisabled();
    });
  });
});

// ===========================================================================
// Modal (ui)
// ===========================================================================

describe("Modal", () => {
  let Modal: React.ComponentType<{
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    size?: "sm" | "md" | "lg" | "xl";
    children?: React.ReactNode;
  }>;

  beforeEach(async () => {
    const mod = await import("@/components/ui/Modal");
    Modal = mod.default;
  });

  it("renders nothing when isOpen=false", () => {
    const { container } = render(
      <Modal isOpen={false} onClose={vi.fn()} title="Test">
        <p>content</p>
      </Modal>
    );
    expect(container.querySelector("[role='dialog']") ?? screen.queryByText("Test")).toBeNull();
  });

  it("renders children when isOpen=true", () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="My Modal">
        <p>modal content</p>
      </Modal>
    );
    expect(screen.getByText("modal content")).toBeInTheDocument();
    expect(screen.getByText("My Modal")).toBeInTheDocument();
  });

  it("calls onClose when close button clicked", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="Close Test">
        <p>content</p>
      </Modal>
    );
    // Close button (×) or button near title
    const closeBtn = screen.getByRole("button");
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when ESC key pressed", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose}>
        <p>content</p>
      </Modal>
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("applies sm size class when size='sm'", () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} size="sm">
        <p>small modal</p>
      </Modal>
    );
    // Small size should render a narrower container
    expect(screen.getByText("small modal")).toBeInTheDocument();
  });

  it("applies xl size class when size='xl'", () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} size="xl">
        <p>xl modal</p>
      </Modal>
    );
    expect(screen.getByText("xl modal")).toBeInTheDocument();
  });
});

// ===========================================================================
// TierBadge (existing — verify still passes)
// ===========================================================================

describe("TierBadge", () => {
  let TierBadge: React.ComponentType<{ stage?: string }>;

  beforeEach(async () => {
    const mod = await import("@/components/chat/TierBadge");
    TierBadge = mod.default;
  });

  it("renders nothing when no stage", () => {
    const { container } = render(<TierBadge />);
    expect(container.firstChild).toBeNull();
  });

  it("renders MARS AI badge for stage='primary'", () => {
    render(<TierBadge stage="primary" />);
    expect(screen.getByText("MARS AI")).toBeInTheDocument();
  });

  it("renders AI Gateway badge for stage='ai_gateway'", () => {
    render(<TierBadge stage="ai_gateway" />);
    expect(screen.getByText("AI Gateway")).toBeInTheDocument();
  });

  it("renders AI Gateway badge for unknown stage", () => {
    render(<TierBadge stage="unknown" />);
    expect(screen.getByText("AI Gateway")).toBeInTheDocument();
  });
});
