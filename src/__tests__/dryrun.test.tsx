import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/components/layout/Sidebar", () => ({
  default: ({ activePage }: { activePage: string }) => (
    <div data-testid="sidebar" data-active={activePage} />
  ),
}));

const mockStorage: Record<string, string> = {};
Object.defineProperty(window, "localStorage", {
  value: {
    getItem: (key: string) => mockStorage[key] ?? null,
    setItem: (key: string, value: string) => { mockStorage[key] = value; },
    removeItem: (key: string) => { delete mockStorage[key]; },
    clear: () => { Object.keys(mockStorage).forEach((k) => delete mockStorage[k]); },
  },
  writable: true,
});

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const MOCK_RUNS = [
  {
    run_id: "run-1711000000",
    total_tests: 7,
    passed: 6,
    failed: 1,
    total_duration_ms: 4500,
    total_records_created: 12,
    repo_id: "repo-orders",
    trigger_source: "manual",
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    run_id: "run-1711000100",
    total_tests: 7,
    passed: 7,
    failed: 0,
    total_duration_ms: 3200,
    total_records_created: 8,
    repo_id: "",
    trigger_source: "scheduler",
    created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
];

const MOCK_DETAILS: any[] = [
  {
    id: "d1",
    run_id: "run-1711000000",
    test_name: "ticket-flow",
    status: "passed",
    intent: "ticket-flow",
    request_summary: "3 steps",
    response_summary: "3/3 passed",
    duration_ms: 1200,
    records_created: 4,
    error_message: "",
    repo_id: "repo-orders",
    repo_url: "https://github.com/example/orders",
    trigger_source: "manual",
    request_method: "POST",
    request_path: "/api/v1/tickets",
    request_headers: JSON.stringify({
      Authorization: "Bearer abc***xyz",
      "Content-Type": "application/json",
      "X-Real-IP": "127.0.0.1",
    }),
    response_body: '{"success":true,"data":{"id":"t-dry-001"}}',
    response_status_code: 201,
    is_dry_run: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "d2",
    run_id: "run-1711000000",
    test_name: "orbit-pipeline",
    status: "failed",
    intent: "orbit-pipeline",
    request_summary: "4 steps",
    response_summary: "3/4 passed",
    duration_ms: 3300,
    records_created: 8,
    error_message: "wave creation failed: 500 internal server error",
    repo_id: "repo-orders",
    repo_url: "https://github.com/example/orders",
    trigger_source: "manual",
    request_method: "POST",
    request_path: "/api/v1/waves",
    request_headers: JSON.stringify({ Authorization: "Bearer abc***xyz" }),
    response_body: '{"error":"internal server error"}',
    response_status_code: 500,
    is_dry_run: true,
    created_at: new Date().toISOString(),
  },
];

const MOCK_REPOS = [
  { id: "repo-orders", name: "orders-service", git_url: "https://github.com/example/orders" },
  { id: "repo-shipments", name: "shipments-service", git_url: "https://github.com/example/shipments" },
];

// ---------------------------------------------------------------------------
// Helper — setup common fetch mocks
// ---------------------------------------------------------------------------

function setupDefaultMocks() {
  mockStorage["mars_token"] = "test-token-123";

  mockFetch.mockImplementation((url: string) => {
    if (url.includes("/api/v1/repositories")) {
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: MOCK_REPOS }) });
    }
    if (url.includes("/api/v1/admin/modules/pending")) {
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [] }) });
    }
    if (url.includes("/api/v1/admin/dryrun/reports") && !url.includes("/run-")) {
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: MOCK_RUNS }) });
    }
    if (url.includes("/run-1711000000")) {
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: MOCK_DETAILS }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({ success: true, data: null }) });
  });
}

// ---------------------------------------------------------------------------
// Lazy import after mocks are set up
// ---------------------------------------------------------------------------

let DryRunPanel: React.ComponentType;

beforeEach(async () => {
  vi.clearAllMocks();
  localStorage.clear();
  mockPush.mockReset();
  setupDefaultMocks();

  // Dynamic import to pick up fresh mocks
  const mod = await import("@/app/chat/admin/dryrun/page");
  DryRunPanel = mod.default;
});

// ---------------------------------------------------------------------------
// Auth redirect
// ---------------------------------------------------------------------------

describe("DryRunPanel — auth", () => {
  it("redirects to / when no token", async () => {
    localStorage.clear();
    render(<DryRunPanel />);
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/"));
  });

  it("does not redirect when token present", async () => {
    render(<DryRunPanel />);
    await waitFor(() => expect(mockPush).not.toHaveBeenCalled());
  });
});

// ---------------------------------------------------------------------------
// Initial render / data loading
// ---------------------------------------------------------------------------

describe("DryRunPanel — initial load", () => {
  it("renders page heading", async () => {
    render(<DryRunPanel />);
    expect(screen.getByText("Dry Run Testing")).toBeInTheDocument();
  });

  it("renders repo selector dropdown with all repos", async () => {
    render(<DryRunPanel />);
    await waitFor(() => expect(screen.getByText("orders-service")).toBeInTheDocument());
    expect(screen.getByText("shipments-service")).toBeInTheDocument();
    expect(screen.getByText("All repos (full pipeline)")).toBeInTheDocument();
  });

  it("renders single file mode toggle defaulting to ON", async () => {
    render(<DryRunPanel />);
    await waitFor(() => expect(screen.getByText(/ON — 1 file only/)).toBeInTheDocument());
  });

  it("loads and displays run summaries", async () => {
    render(<DryRunPanel />);
    await waitFor(() => expect(screen.getByText("run-1711000000")).toBeInTheDocument());
    expect(screen.getByText("run-1711000100")).toBeInTheDocument();
  });

  it("shows run_id, passed/failed counts, duration, repo badge", async () => {
    render(<DryRunPanel />);
    await waitFor(() => expect(screen.getByText("run-1711000000")).toBeInTheDocument());
    expect(screen.getByText("6 passed")).toBeInTheDocument();
    expect(screen.getByText("1 failed")).toBeInTheDocument();
    expect(screen.getByText("4.5s")).toBeInTheDocument();
    expect(screen.getByText("repo-orders")).toBeInTheDocument();
  });

  it("shows is_dry_run badge on runs", async () => {
    render(<DryRunPanel />);
    await waitFor(() => {
      const badges = screen.getAllByText("dry_run");
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  it("shows trigger source on runs", async () => {
    render(<DryRunPanel />);
    await waitFor(() => expect(screen.getByText("manual")).toBeInTheDocument());
    expect(screen.getByText("scheduler")).toBeInTheDocument();
  });

  it("shows empty state when no runs", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/v1/admin/dryrun/reports") && !url.includes("/run-")) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [] }) });
    });

    render(<DryRunPanel />);
    await waitFor(() => expect(screen.getByText("No dry run reports yet")).toBeInTheDocument());
  });
});

// ---------------------------------------------------------------------------
// Run details expansion
// ---------------------------------------------------------------------------

describe("DryRunPanel — run detail expansion", () => {
  it("expands run details on click", async () => {
    render(<DryRunPanel />);
    await waitFor(() => expect(screen.getByText("run-1711000000")).toBeInTheDocument());

    fireEvent.click(screen.getByText("run-1711000000"));
    await waitFor(() => expect(screen.getByText("ticket-flow")).toBeInTheDocument());
    expect(screen.getByText("orbit-pipeline")).toBeInTheDocument();
  });

  it("shows is_dry_run=1 badge in detail rows", async () => {
    render(<DryRunPanel />);
    await waitFor(() => expect(screen.getByText("run-1711000000")).toBeInTheDocument());
    fireEvent.click(screen.getByText("run-1711000000"));

    await waitFor(() => {
      const badges = screen.getAllByText("is_dry_run=1");
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  it("shows request method and path for each step", async () => {
    render(<DryRunPanel />);
    await waitFor(() => expect(screen.getByText("run-1711000000")).toBeInTheDocument());
    fireEvent.click(screen.getByText("run-1711000000"));

    await waitFor(() => expect(screen.getByText("POST")).toBeInTheDocument());
    expect(screen.getByText("/api/v1/tickets")).toBeInTheDocument();
  });

  it("shows response status code in detail rows", async () => {
    render(<DryRunPanel />);
    await waitFor(() => expect(screen.getByText("run-1711000000")).toBeInTheDocument());
    fireEvent.click(screen.getByText("run-1711000000"));

    await waitFor(() => expect(screen.getByText("201")).toBeInTheDocument());
    expect(screen.getByText("500")).toBeInTheDocument();
  });

  it("shows error message for failed detail", async () => {
    render(<DryRunPanel />);
    await waitFor(() => expect(screen.getByText("run-1711000000")).toBeInTheDocument());
    fireEvent.click(screen.getByText("run-1711000000"));

    await waitFor(() =>
      expect(screen.getByText("wave creation failed: 500 internal server error")).toBeInTheDocument()
    );
  });

  it("can expand request headers and response body", async () => {
    render(<DryRunPanel />);
    await waitFor(() => expect(screen.getByText("run-1711000000")).toBeInTheDocument());
    fireEvent.click(screen.getByText("run-1711000000"));

    await waitFor(() => expect(screen.getAllByText("Details").length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText("Details")[0]);

    await waitFor(() => expect(screen.getByText("Request Headers")).toBeInTheDocument());
    expect(screen.getByText("Response Body")).toBeInTheDocument();
    expect(screen.getByText("Authorization:")).toBeInTheDocument();
  });

  it("collapses expanded run on second click", async () => {
    render(<DryRunPanel />);
    await waitFor(() => expect(screen.getByText("run-1711000000")).toBeInTheDocument());
    fireEvent.click(screen.getByText("run-1711000000"));
    await waitFor(() => expect(screen.getByText("ticket-flow")).toBeInTheDocument());
    // Click again to collapse
    fireEvent.click(screen.getByText("run-1711000000"));
    await waitFor(() => expect(screen.queryByText("ticket-flow")).not.toBeInTheDocument());
  });
});

// ---------------------------------------------------------------------------
// Triggering dry run
// ---------------------------------------------------------------------------

describe("DryRunPanel — trigger dry run", () => {
  it("calls trigger API with selected repo and single_file_mode", async () => {
    const user = userEvent.setup();
    render(<DryRunPanel />);
    await waitFor(() => expect(screen.getByText("orders-service")).toBeInTheDocument());

    // Select a repo
    await user.selectOptions(
      screen.getByRole("combobox"),
      "repo-orders"
    );

    mockFetch.mockImplementation((url: string, opts: any) => {
      if (url.includes("/dryrun/trigger")) {
        const body = JSON.parse(opts.body);
        expect(body.repo_id).toBe("repo-orders");
        expect(body.single_file_mode).toBe(true);
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: { status: "started" } }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: MOCK_RUNS }) });
    });

    fireEvent.click(screen.getByText("Run Now"));
    await waitFor(() => expect(screen.getByText("Running...")).toBeInTheDocument());
  });

  it("sends single_file_mode=false when toggled off", async () => {
    render(<DryRunPanel />);
    await waitFor(() => expect(screen.getByText(/ON — 1 file only/)).toBeInTheDocument());

    // Toggle off
    fireEvent.click(screen.getByText(/ON — 1 file only/));
    expect(screen.getByText(/OFF — full pipeline/)).toBeInTheDocument();

    mockFetch.mockImplementation((url: string, opts: any) => {
      if (url.includes("/dryrun/trigger")) {
        const body = JSON.parse(opts.body);
        expect(body.single_file_mode).toBe(false);
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: null }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: MOCK_RUNS }) });
    });

    fireEvent.click(screen.getByText("Run Now"));
  });

  it("sends Authorization Bearer header in trigger request", async () => {
    render(<DryRunPanel />);
    await waitFor(() => expect(screen.getByText("Run Now")).toBeInTheDocument());

    let capturedHeaders: Record<string, string> = {};
    mockFetch.mockImplementation((url: string, opts: any) => {
      if (url.includes("/dryrun/trigger")) {
        capturedHeaders = opts.headers;
        return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: MOCK_RUNS }) });
    });

    fireEvent.click(screen.getByText("Run Now"));
    await waitFor(() => expect(capturedHeaders["Authorization"]).toBe("Bearer test-token-123"));
  });
});

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

describe("DryRunPanel — cleanup", () => {
  it("calls cleanup API and shows deleted count", async () => {
    vi.spyOn(window, "confirm").mockReturnValueOnce(true);
    vi.spyOn(window, "alert").mockImplementation(() => {});

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/dryrun/cleanup")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: { records_deleted: 42 } }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: MOCK_RUNS }) });
    });

    render(<DryRunPanel />);
    await waitFor(() => expect(screen.getByText(/Cleanup All Dry Data/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Cleanup All Dry Data/));

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Cleaned 42 dry run records."));
  });

  it("does not call cleanup API when user cancels confirm", async () => {
    vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    render(<DryRunPanel />);
    await waitFor(() => expect(screen.getByText(/Cleanup All Dry Data/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Cleanup All Dry Data/));

    expect(mockFetch).not.toHaveBeenCalledWith(expect.stringContaining("/cleanup"), expect.anything());
  });
});

// ---------------------------------------------------------------------------
// Pending approvals
// ---------------------------------------------------------------------------

describe("DryRunPanel — pending module approvals", () => {
  it("renders pending approvals when present", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/admin/modules/pending")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              { repo_id: "r1", module_path: "orders", module_name: "Orders Module", score: 85, submitted_by: "bot" },
            ],
          }),
        });
      }
      if (url.includes("/api/v1/repositories")) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: MOCK_REPOS }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: MOCK_RUNS }) });
    });

    render(<DryRunPanel />);
    await waitFor(() => expect(screen.getByText("Orders Module")).toBeInTheDocument());
    expect(screen.getByText("Score: 85/100")).toBeInTheDocument();
    expect(screen.getByText("by bot")).toBeInTheDocument();
  });

  it("calls approve endpoint when Approve clicked", async () => {
    let approveUrl = "";
    mockFetch.mockImplementation((url: string, opts: any) => {
      if (url.includes("/admin/modules/pending")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [{ repo_id: "r1", module_path: "orders", module_name: "Orders Module", score: 85 }],
          }),
        });
      }
      if (url.includes("/admin/modules/approve")) {
        approveUrl = url;
        return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: MOCK_RUNS }) });
    });

    render(<DryRunPanel />);
    await waitFor(() => expect(screen.getByText("Approve")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Approve"));
    await waitFor(() => expect(approveUrl).toContain("/approve"));
  });
});

// ---------------------------------------------------------------------------
// Refresh button
// ---------------------------------------------------------------------------

describe("DryRunPanel — refresh", () => {
  it("re-fetches reports when Refresh clicked", async () => {
    render(<DryRunPanel />);
    await waitFor(() => expect(screen.getByText("Refresh")).toBeInTheDocument());

    const callsBefore = mockFetch.mock.calls.length;
    fireEvent.click(screen.getByText("Refresh"));
    await waitFor(() => expect(mockFetch.mock.calls.length).toBeGreaterThan(callsBefore));
  });
});
