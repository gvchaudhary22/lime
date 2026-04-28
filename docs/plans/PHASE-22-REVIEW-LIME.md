# Phase 22 Review — TypeScript axis (lime)

> Reviewer: reviewer (TypeScript). Branch: `feat/22-discover-error-hardening` @ `5209654`.
> Reviewed: 2026-04-28
> Files in scope: `src/lib/aiplatformkb-api.ts`, `src/components/pr-sync/RepoSyncButton.tsx`,
> `src/__tests__/pr-feed-row-sync.test.tsx`

## Verdict

**SHIP-CLEAR** — implementation matches PHASE-22-PLAN §3.3 + §5 Wave 3 intent. No CRITICAL or HIGH findings.
The new structured-error path is type-safe, the legacy fallback is preserved with op-specific labels,
and the vitest pair exercises the full `mockFetch → jsonRequest → _formatGitHubErrorDetail → throw →
RepoSyncButton catch → 2-row render` pipeline.

`npx vitest run src/__tests__/pr-feed-row-sync.test.tsx` → **8 / 8 passed** (2 new + 6 prior).
`npx tsc --noEmit` → 0 errors in Phase-22 files.

## Summary table

| Severity | Count |
|----------|------:|
| CRITICAL |     0 |
| HIGH     |     0 |
| MEDIUM   |     2 |
| LOW      |     5 |

Both MEDIUMs are **tracked** as residuals (not regressions, not blocking ship). LOWs are style-/UX-only.

## Findings

### CRITICAL — none

### HIGH — none

### MEDIUM

**M1 — `previewClassify` / `previewPopulate` / `cancelPrSync` are NOT wrapped.**

The wrapper covers `discoverPrs`, `triggerClassify`, `triggerPopulate` — exactly the three callsites
PHASE-22-PLAN §3.3 names. But the four sibling endpoints in the same file —
`previewClassify` (line 483), `previewPopulate` (line 498) via `getJson`, `cancelPrSync` (line 517)
via `jsonRequest` — call the same `/admin/pr-sync/...` family and *can* surface a `GitHubAPIError`
on the backend (preview re-fetches PR file lists; cancel touches state but doesn't hit GitHub).

Behaviour today:
- `previewClassify` / `previewPopulate` → `getJson` (no structured-detail parser, no op label;
  a 422 with the new detail body falls through to the legacy `String(payload.detail)` branch which
  produces `"[object Object]"` because `detail` is now an object, not a string).
- `cancelPrSync` → `jsonRequest` → gets the GitHub-prefixed message via `_formatGitHubErrorDetail`,
  but a non-GitHub failure produces `"Request failed: <status>"` instead of `"cancel failed (<status>)"`.

PHASE-22-PLAN §9 OQ-1 ("Should `/admin/pr-sync/preview` ALSO be wrapped?") explicitly defers this
to Wave-2A backend recon. If Wave-2A confirmed preview hits the GitHub-fetch path, the FE has a gap:
the preview button in `PerRowSyncImpactsButton.tsx` (line 124) and `RunPopulateButton.tsx` (line 113)
will render `[object Object]` instead of the structured GitHub message.

**Track**, don't fix in this branch:
- Move `_formatGitHubErrorDetail` into `getJson` too (one-line lift) once Wave-2A recon resolves OQ-1.
- Decide whether `previewClassify` / `previewPopulate` deserve `_runWithOpLabel("preview-classify")` /
  `_runWithOpLabel("preview-populate")`.
- Open a follow-up issue: `lime#TBD — wrap preview/cancel clients with structured GitHub error parsing`.

**M2 — `_formatGitHubErrorDetail` accepts `kind` as `unknown string` — no allow-list check.**

```ts
type GitHubErrorDetail = { kind?: string; ... };
if (!d.kind || !d.github_message) return null;
```

The backend contract (PHASE-22-PLAN §3.1) restricts `kind` to `"http" | "network" | "decode"`. The
parser only checks truthiness — a backend bug or rogue payload with `kind: "javascript:alert(1)"`
or `kind: "..."` would still pass the guard and the literal value is *not* placed in user-visible
output (only `github_status` and `github_message` are rendered), so there is **no XSS risk**.

But the type drift is real: the parser is loose where the contract is strict. Recommend either a
`kind: "http" | "network" | "decode"` literal type + check, or a Zod schema parse for clean
contract enforcement. Track as `lime#TBD — GitHubErrorDetail Zod schema` (Phase 23+).

### LOW

**L1 — `_runWithOpLabel` could collide with non-GitHub `AiplatformkbApiError`s whose message happens
to start with `"GitHub "`.**

```ts
if (err.message.startsWith("GitHub ")) throw err;
```

If the backend ever returns an admin error like `{"detail": "GitHub user setting not found"}` from
a non-pr-sync endpoint, the wrapper would skip the op-specific label even though the message isn't
a `_formatGitHubErrorDetail` output. Realistically only `_formatGitHubErrorDetail` produces strings
starting with `GitHub ` today (the parser short-circuits non-detail bodies), so this is theoretical.

A more defensive variant would attach a sentinel to `AiplatformkbApiError` (e.g. `kind: "github"`)
in `jsonRequest` and check that here. **LOW**, not worth churning.

**L2 — IIFE in JSX is uncommon in lime.**

```tsx
{error && (error.startsWith("GitHub ")
  ? (() => { ... return (...); })()
  : (<span ... />))}
```

`grep -rn "(() =>" src/components/` in lime returns ~0 prior usages — this is the first IIFE in the
component tree. A small `<GitHubErrorBlock error={error} />` helper component (or even a plain
`function renderGitHubError(error: string)` defined in the same file above the return) would read
cleaner and parallel the existing pattern in lime where ad-hoc render logic lives in named helpers.
The IIFE *works* and is a 12-line block, not a 50-line one — call this a style preference. Don't
refactor mid-review; track for Phase 23 `RepoSyncButton.tsx` polish if/when this block grows.

**L3 — `max-w-md` may be too narrow on mobile.**

The hint string `"Repo cannot be searched. Either it doesn't exist OR the configured GITHUB_TOKEN
can't see it..."` is ~115 chars. At `text-xs` (~12px) and `max-w-md` (28rem ≈ 448px), the hint
wraps onto 4-5 visual lines on desktop and ~7 on a 360px-wide phone — readable but visually heavy.
The header `<button>` row is `flex items-center gap-2`, so a 5-line block bumps the button header
height vertically. Acceptable for an error state (rare path), and the slate-400 muted styling
visually de-emphasises it. **Track** as UX polish (would need a "Show details" toggle to keep the
header tight). Not a regression — pre-Phase-22 the message was just `"Internal Server Error"`,
much worse.

**L4 — No `aria-live` / `role="alert"` on the new error block.**

The pre-Phase-22 `<span className="text-xs text-rose-400">{error}</span>` had no aria semantics
either, so this perpetuates the existing a11y gap (call out: Phase-22 *adds visual structure* but
keeps the same accessibility surface). Screen-reader users won't be announced when the error
appears. Tracked as `lime#TBD — pr-sync error blocks need aria-live="polite" + role="alert"`
for a Phase 23+ a11y sweep covering all pr-sync buttons (`RepoSyncButton`,
`PerRowSyncImpactsButton`, `RunPopulateButton`).

**L5 — Test mock of `errNonJson(500)` resolves with `ok: false, status: 500` but the `json()` rejection
swallows the error with no `Content-Type` header.**

Real legacy 500s typically come back with `Content-Type: text/plain` and a body like
`"Internal Server Error"`. The mock (`async json: () => { throw new Error("invalid json"); }`)
exercises the `try/catch` around `res.json()` correctly, but a more realistic stub would also
populate `headers.get("content-type")` so a future refactor that branches on content-type before
parsing JSON wouldn't silently bypass the test. Cosmetic — the current parser doesn't read
headers, so the test is sufficient for what's shipped today. **No action.**

## Inline fixes applied

**None.** The implementation is correct and matches the plan; nothing is small enough to fix
in-line that would survive code review without a tracked rationale. All findings are either
deferred (M1, M2, L4 — explicitly out-of-scope per PHASE-22-PLAN §10) or stylistic (L1, L2, L3, L5).

## Tracked residuals

| ID | Severity | What | Where | Track-as |
|----|----------|------|-------|----------|
| M1 | MEDIUM | preview/cancel clients don't get structured GitHub parsing | `aiplatformkb-api.ts:483/498/517` | `lime#TBD — wrap preview/cancel clients` (Phase 23 — depends on backend OQ-1 resolution) |
| M2 | MEDIUM | `kind` field accepted as any truthy string instead of `"http"|"network"|"decode"` | `aiplatformkb-api.ts:192-208` | `lime#TBD — GitHubErrorDetail Zod schema` |
| L4 | LOW | new error block lacks `aria-live` / `role="alert"` | `RepoSyncButton.tsx:67` | `lime#TBD — pr-sync a11y sweep` |
| L3 | LOW | `max-w-md` may be tall on mobile for long hints | `RepoSyncButton.tsx:67` | folded into a11y sweep above |

## Waived

| ID | Severity | Why waived |
|----|----------|------------|
| L1 | LOW | "AiplatformkbApiError with `message.startsWith('GitHub ')` from non-GitHub source" requires the backend to violate the contract — defensive sentinel adds API surface, not blocking. |
| L2 | LOW | IIFE is a 12-line localized block, refactoring to a helper component is style preference, not correctness. Code reads fine on review. |
| L5 | LOW | Test stub correctly exercises the parser's actual branches; richer mock buys nothing today. |

## Cross-axis notes

- **Type safety (axis 1)**: `_formatGitHubErrorDetail` does proper `unknown` → narrow casts before
  field access; no `any`. `payload as { detail?: unknown }` and `detailRaw as GitHubErrorDetail` are
  reasonable type assertions given the runtime guards (`typeof === "object"`, `&& d.kind &&
  d.github_message`). **Pass.**
- **Error fallthrough (axis 2)**: traced manually for (a) non-JSON 500 body — `payload === null`,
  `_formatGitHubErrorDetail` returns null, hits legacy fallback, `_runWithOpLabel` rewrites to
  `"discover failed (500)"` — **correct, test 2 covers it**; (b) 503 with empty body — same path;
  (c) 4xx with HTML body — `res.json()` rejects, payload null, same fallback path. **Pass.**
- **Centralization (axis 3)**: `_runWithOpLabel` is the right factoring. Three call sites with
  identical try/catch would duplicate the `startsWith("GitHub ")` rule and risk drift.
  Op-specific labels preserved (`discover failed (500)` vs `classify failed (500)` vs
  `populate failed (500)`). **Not** wrapping `createTool` / `archiveTool` is correct — those
  endpoints don't hit GitHub. **Pass.**
- **JSX readability (axis 4)**: see L2 above. IIFE works, helper component would read cleaner —
  not blocking.
- **Multiline UX (axis 5)**: see L3. Wraps correctly at desktop widths; mobile is acceptable for
  an error state.
- **Test fidelity (axis 6)**: tests exercise the *full* pipeline — `mockFetch` returns a
  fetch-shaped response, the real `jsonRequest` runs, the real `_formatGitHubErrorDetail` runs,
  the real `_runWithOpLabel` runs, the real `RepoSyncButton` catches. A regression in the parser
  (e.g. dropping the `d.kind` guard, or splitting on the wrong separator) WOULD be caught — case 1
  asserts both `"GitHub 422: Validation Failed"` AND `"can't see it"`, case 2 asserts the
  hint-row class is absent. **Pass.**
- **Aborted requests (axis 7)**: `discoverPrs` / `triggerClassify` / `triggerPopulate` do NOT
  thread an `AbortSignal` (only `getJson` does, per Phase-21 Wave-1C). `RepoSyncButton.handle`
  doesn't create an AbortController — confirmed by grep. So an aborted request would surface as
  a `TypeError: fetch failed` from `await fetch(url, init)`, propagate up out of `_runWithOpLabel`
  (it's not an `AiplatformkbApiError`, the `else throw err` branch fires), and `RepoSyncButton`
  would render `e.message` (e.g. `"AbortError: signal aborted"`). No crash, no parser issue.
  **Pass.**
- **i18n / a11y (axis 8)**: see L4. Phase 22 perpetuates the existing pattern; tracked.
- **Code style (axis 9)**: file conventions matched — JSDoc-style block comments above
  `_formatGitHubErrorDetail` and `_runWithOpLabel`, underscore prefix marks them private (matches
  `_release` in backend), placement near the consumers. No drift.

## Verdict (restated)

**SHIP-CLEAR**. Phase 22 Wave-3 lime work is correct, well-tested, and matches the planned
contract. Two MEDIUM residuals tracked for Phase 23 (preview/cancel wrapping pending backend
OQ-1; Zod schema for stricter `kind` typing). LOWs are stylistic. Move to `/tyrion:ship 22`.
