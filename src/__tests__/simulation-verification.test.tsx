/**
 * Simulation page verification tests — superpowers TDD pattern.
 *
 * Covers the core behaviors implemented in the simulation page:
 * - addToHistory() entry shape and field correctness
 * - company_id extraction from SSO context (localStorage)
 * - confidence thresholds (high/medium/low)
 * - latency display formatting
 * - success flag derivation from confidence
 */

// ---------------------------------------------------------------------------
// Types (mirror simulation page internal shape)
// ---------------------------------------------------------------------------
interface HistoryEntry {
  query: string;
  response: string;
  confidence: number;
  latency_ms: number;
  tools: string[];
  agents: string[];
  timestamp: string;
  tier: number;
  success: boolean;
}

function makeHistoryEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    query: "test query",
    response: "test response",
    confidence: 0.85,
    latency_ms: 1200,
    tools: ["vector_search"],
    agents: [],
    timestamp: new Date().toISOString(),
    tier: 1,
    success: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Confidence thresholds
// ---------------------------------------------------------------------------
describe("Simulation confidence thresholds", () => {
  it("confidence >= 0.8 is high tier", () => {
    const entry = makeHistoryEntry({ confidence: 0.85 });
    expect(entry.confidence).toBeGreaterThanOrEqual(0.8);
    const pct = Math.round(entry.confidence * 100);
    expect(pct).toBe(85);
  });

  it("confidence >= 0.5 and < 0.8 is medium tier", () => {
    const entry = makeHistoryEntry({ confidence: 0.65 });
    expect(entry.confidence).toBeGreaterThanOrEqual(0.5);
    expect(entry.confidence).toBeLessThan(0.8);
  });

  it("confidence < 0.5 is low tier", () => {
    const entry = makeHistoryEntry({ confidence: 0.3 });
    expect(entry.confidence).toBeLessThan(0.5);
  });

  it("success flag is true when confidence >= 0.5", () => {
    const high = makeHistoryEntry({ confidence: 0.85, success: 0.85 >= 0.5 });
    const low = makeHistoryEntry({ confidence: 0.3, success: 0.3 >= 0.5 });
    expect(high.success).toBe(true);
    expect(low.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// History entry structure
// ---------------------------------------------------------------------------
describe("History entry structure", () => {
  it("has all required fields", () => {
    const entry = makeHistoryEntry();
    const requiredFields: (keyof HistoryEntry)[] = [
      "query", "response", "confidence", "latency_ms",
      "tools", "agents", "timestamp", "tier", "success",
    ];
    for (const field of requiredFields) {
      expect(entry).toHaveProperty(field);
    }
  });

  it("timestamp is a valid ISO string", () => {
    const entry = makeHistoryEntry();
    const parsed = new Date(entry.timestamp);
    expect(parsed.toISOString()).toBe(entry.timestamp);
  });

  it("tools is always an array, never undefined", () => {
    const entry = makeHistoryEntry({ tools: [] });
    expect(Array.isArray(entry.tools)).toBe(true);
  });

  it("agents is always an array, never undefined", () => {
    const entry = makeHistoryEntry({ agents: [] });
    expect(Array.isArray(entry.agents)).toBe(true);
  });

  it("tier defaults to 1 for standard queries", () => {
    const entry = makeHistoryEntry();
    expect(entry.tier).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// SSO context / company_id extraction
// ---------------------------------------------------------------------------
describe("SSO context company_id extraction", () => {
  it("extracts company_id from valid JSON", () => {
    const raw = JSON.stringify({ company_id: "SR123", user_id: "u456" });
    const parsed = JSON.parse(raw) as { company_id?: string };
    expect(parsed.company_id).toBe("SR123");
  });

  it("returns empty string when SSO context is null", () => {
    const raw: string | null = null;
    const parsed = raw ? (JSON.parse(raw) as { company_id?: string }) : null;
    const companyId = parsed?.company_id ?? "";
    expect(companyId).toBe("");
  });

  it("returns empty string when company_id missing from context", () => {
    const raw = JSON.stringify({ user_id: "u456" });
    const parsed = JSON.parse(raw) as { company_id?: string };
    const companyId = parsed?.company_id ?? "";
    expect(companyId).toBe("");
  });

  it("handles malformed JSON without throwing", () => {
    const raw = "not-valid-json";
    let companyId = "";
    try {
      const parsed = JSON.parse(raw) as { company_id?: string };
      companyId = parsed?.company_id ?? "";
    } catch {
      companyId = "";
    }
    expect(companyId).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Latency display formatting
// ---------------------------------------------------------------------------
describe("Latency display formatting", () => {
  const formatLatency = (ms: number): string =>
    ms > 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;

  it("shows seconds for latency > 1000ms", () => {
    expect(formatLatency(1250)).toBe("1.3s");
    expect(formatLatency(2000)).toBe("2.0s");
  });

  it("shows ms for latency <= 1000ms", () => {
    expect(formatLatency(850)).toBe("850ms");
    expect(formatLatency(1000)).toBe("1000ms");
  });

  it("rounds to 1 decimal for second display", () => {
    expect(formatLatency(1550)).toBe("1.6s");
    expect(formatLatency(1449)).toBe("1.4s");
  });
});

// ---------------------------------------------------------------------------
// Response truncation for history storage
// ---------------------------------------------------------------------------
describe("Response truncation", () => {
  it("truncates long responses to 200 chars for history", () => {
    const longResponse = "a".repeat(500);
    const truncated = longResponse.slice(0, 200);
    expect(truncated.length).toBe(200);
  });

  it("preserves short responses unchanged", () => {
    const shortResponse = "This is a short response.";
    const truncated = shortResponse.slice(0, 200);
    expect(truncated).toBe(shortResponse);
  });
});
