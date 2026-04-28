// Phase 17 Wave 2A — RepoSyncButton branch input + discoverPrs payload tests.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import RepoSyncButton from "@/components/pr-sync/RepoSyncButton";

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function okJson(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

// Phase 23 — discoverPrs returns 202 with {sync_run_id, status:"running",
// scope}. Polling drives terminal status; these tests only care about
// payload shape on the FIRST POST, so we resolve the POST 202 and stub
// the subsequent GET /status with a never-resolving promise to keep the
// polling loop quiet during the assertion window.
const DISCOVER_ACCEPTED = okJson({
  sync_run_id: 1,
  status: "running",
  scope: "shiprocket/MultiChannel_API",
});

function discoverPostThenHangingStatus() {
  // First call (POST /discover) → 202 accepted.
  mockFetch.mockResolvedValueOnce(DISCOVER_ACCEPTED);
  // Subsequent calls (GET /status from useDiscoverJobStatus) → never resolve.
  // Keeps the test in the running state until the timing window expires.
  mockFetch.mockImplementation(() => new Promise(() => {}));
}

function getDiscoverPostBody(): Record<string, unknown> {
  // The first call is the POST /discover; subsequent are GET /status.
  const [, init] = mockFetch.mock.calls[0];
  return JSON.parse((init as RequestInit).body as string);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

function getBranchInput() {
  return screen.getByLabelText(/base branch/i) as HTMLInputElement;
}

describe("RepoSyncButton — branch input", () => {
  it("renders branch input that is disabled until org and repo are set", () => {
    const { rerender } = render(
      <RepoSyncButton org={null} repo={null} onDiscovered={vi.fn()} />
    );
    const input = getBranchInput();
    expect(input).toBeInTheDocument();
    expect(input).toBeDisabled();

    rerender(
      <RepoSyncButton
        org="shiprocket"
        repo="MultiChannel_API"
        onDiscovered={vi.fn()}
      />
    );
    expect(getBranchInput()).not.toBeDisabled();
  });

  it("passes base_branch in payload when input has a value", async () => {
    discoverPostThenHangingStatus();
    render(
      <RepoSyncButton
        org="shiprocket"
        repo="MultiChannel_API"
        onDiscovered={vi.fn()}
      />
    );
    fireEvent.change(getBranchInput(), { target: { value: "main" } });
    fireEvent.click(screen.getByRole("button", { name: /sync new prs/i }));

    // Wait until at least the POST has fired (subsequent GET /status calls
    // hang per discoverPostThenHangingStatus()).
    await waitFor(() =>
      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(1)
    );
    expect(getDiscoverPostBody()).toEqual({
      org: "shiprocket",
      repo: "MultiChannel_API",
      base_branch: "main",
    });
  });

  it("omits base_branch when input is empty (back-compat)", async () => {
    discoverPostThenHangingStatus();
    render(
      <RepoSyncButton
        org="shiprocket"
        repo="MultiChannel_API"
        onDiscovered={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /sync new prs/i }));

    await waitFor(() =>
      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(1)
    );
    const body = getDiscoverPostBody();
    expect(body).toEqual({ org: "shiprocket", repo: "MultiChannel_API" });
    expect(body).not.toHaveProperty("base_branch");
  });

  it("treats whitespace-only input as empty (paranoia)", async () => {
    discoverPostThenHangingStatus();
    render(
      <RepoSyncButton
        org="shiprocket"
        repo="MultiChannel_API"
        onDiscovered={vi.fn()}
      />
    );
    fireEvent.change(getBranchInput(), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: /sync new prs/i }));

    await waitFor(() =>
      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(1)
    );
    const body = getDiscoverPostBody();
    expect(body).toEqual({ org: "shiprocket", repo: "MultiChannel_API" });
    expect(body).not.toHaveProperty("base_branch");
  });

  it("trims surrounding whitespace from non-empty input", async () => {
    discoverPostThenHangingStatus();
    render(
      <RepoSyncButton
        org="shiprocket"
        repo="MultiChannel_API"
        onDiscovered={vi.fn()}
      />
    );
    fireEvent.change(getBranchInput(), { target: { value: "  develop  " } });
    fireEvent.click(screen.getByRole("button", { name: /sync new prs/i }));

    await waitFor(() =>
      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(1)
    );
    expect(getDiscoverPostBody()).toEqual({
      org: "shiprocket",
      repo: "MultiChannel_API",
      base_branch: "develop",
    });
  });

  it("renders a datalist with master and main as branch suggestions", () => {
    render(
      <RepoSyncButton
        org="shiprocket"
        repo="MultiChannel_API"
        onDiscovered={vi.fn()}
      />
    );
    // Input wires `list` to the datalist id.
    const input = getBranchInput();
    expect(input.getAttribute("list")).toBe("repo-sync-branch-suggestions");
    // Datalist exists with both canonical defaults.
    const datalist = document.getElementById(
      "repo-sync-branch-suggestions"
    ) as HTMLDataListElement | null;
    expect(datalist).not.toBeNull();
    const optionValues = Array.from(datalist!.querySelectorAll("option")).map(
      (o) => (o as HTMLOptionElement).value
    );
    expect(optionValues).toEqual(["master", "main"]);
  });
});
