import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TierBadge from "@/components/chat/TierBadge";

describe("TierBadge", () => {
  it("renders nothing when no stage is provided", () => {
    const { container } = render(<TierBadge />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing for undefined stage", () => {
    const { container } = render(<TierBadge stage={undefined} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders Claude badge for claude stage", () => {
    render(<TierBadge stage="claude" />);
    expect(screen.getByText("Claude")).toBeInTheDocument();
  });

  it("renders AI Gateway badge for ai_gateway stage", () => {
    render(<TierBadge stage="ai_gateway" />);
    expect(screen.getByText("AI Gateway")).toBeInTheDocument();
  });

  it("renders AI Gateway badge for unknown stage", () => {
    render(<TierBadge stage="something_else" />);
    expect(screen.getByText("AI Gateway")).toBeInTheDocument();
  });

  it("applies orange styling for Claude", () => {
    render(<TierBadge stage="claude" />);
    const badge = screen.getByText("Claude");
    expect(badge.className).toContain("orange");
  });

  it("applies blue styling for AI Gateway", () => {
    render(<TierBadge stage="ai_gateway" />);
    const badge = screen.getByText("AI Gateway");
    expect(badge.className).toContain("blue");
  });
});
