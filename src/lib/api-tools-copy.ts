// src/lib/api-tools-copy.ts
//
// Phase 16 — single source of truth for the "visible / hidden" toggle
// explainer text. Used by:
//   1. <OperationDetailsDrawer/> — Visibility section body
//   2. ApisTab's visible/hidden chip — `title=` tooltip
//   3. docs/runbooks/api-tools-page.md — verbatim quote (in aiplatformkb)
//
// If you change the text, grep for VISIBILITY_EXPLAINER and update all
// three surfaces in the same commit so they don't drift.

/**
 * Long-form explainer rendered inside the drawer's Visibility section.
 * Plain text — no markdown / HTML.
 */
export const VISIBILITY_EXPLAINER = `The visible / hidden chip controls api_listing.ai_platform_eligible_api.

When VISIBLE, this row is included in:
  GET /api/v1/ai-platform/openapi.json
  GET /api/v1/ai-platform/tools.json

The runtime AI agent (Claude function-calling, in the seller chatbot)
reads these endpoints and treats every included row as a callable tool.

When HIDDEN, the row stays in api_listing for operator reference but the
two endpoints exclude it. The AI agent does not see it.

Toggling is non-destructive — flip back any time. No effect on populate
runs or ELK refresh; the AI catalog re-resolves within ~60 s.`;

/**
 * Short tooltip variant for the row chip (single line, no body wrap).
 */
export function visibilityTooltip(eligible: boolean): string {
  return eligible
    ? "Visible to the AI agent (included in /api/v1/ai-platform/openapi.json) — click to hide"
    : "Hidden from the AI agent (kept in catalog for operator reference) — click to expose";
}
