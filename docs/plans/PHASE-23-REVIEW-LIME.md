# Phase 23 Review — TypeScript axis (lime)

> Reviewer: reviewer (TypeScript). Branch: `feat/23-async-discover-job` @ `1f0508c` (2 commits ahead of `8db2279`).
> Reviewed: 2026-04-28
> Files in scope:
> - `src/types/pr-sync.ts` (+54)
> - `src/lib/aiplatformkb-api.ts` (+37)
> - `src/hooks/useDiscoverJobStatus.ts` (NEW, +87)
> - `src/components/pr-sync/RepoSyncButton.tsx` (+71)
> - `src/__tests__/pr-feed-row-sync.test.tsx` (+221)
> - `src/__tests__/pr-sync-client.test.ts` (+11)

## Verdict

**SHIP-CLEAR** — implementation matches PHASE-23-PLAN §3.5 + §5 Wave 3 intent. No CRITICAL or HIGH findings. The async state machine is correct, the polling hook mirrors the proven `useSyncRowStatus` pattern (with the small upgrade from `setInterval` to recursive `setTimeout`), and the 2-row error block is reused unchanged from Phase 22 — confirmed by V2 vitest. Phase-22 risk R7 closes cleanly.

`npx vitest run src/__tests__/pr-feed-row-sync.test.tsx` → **11 / 11 passed** (8 carry-over + 3 new).
`npx tsc --noEmit` (filtered to Phase-23 files) → 0 errors.

## Summary table

| Severity | Count |
|----------|------:|
| CRITICAL |     0 |
| HIGH     |     0 |
| MEDIUM   |     2 |
| LOW      |     4 |

Both MEDIUMs are tracked (one is a real correctness concern under benign-but-realistic re-render timing; one is a Phase-22 carry-over the user already deferred). LOWs are stylistic / a11y carry-overs.

## Findings

### CRITICAL — none

### HIGH — none

### MEDIUM

**M1 — `useEffect([jobStatus, onDiscovered])` can re-fire `onDiscovered` if the parent passes a fresh callback reference between the "done" tick and the hook's reset.**

Trace (real call site at `src/app/chat/pr-feed/page.tsx:190-196`):

```tsx
<RepoSyncButton
  org={...}
  repo={...}
  onDiscovered={(count) => { if (count > 0) refetch(); }}
/>
```

`onDiscovered` is an inline arrow → new reference every parent render.

The terminal-handler effect:

```tsx
useEffect(() => {
  if (!jobStatus) return;
  if (jobStatus.status === "done") {
    onDiscovered?.(jobStatus.discovered_count ?? 0, jobStatus.discovered_pr_ids ?? []);
    setActiveJobId(null);
  } else if (jobStatus.status === "failed") { ... }
}, [jobStatus, onDiscovered]);                                                     // ← onDiscovered in deps
```

Fire-1 sequence:
1. Hook returns `jobStatus = {status: "done", count: 5}`
2. Effect commits → `onDiscovered(5, ids)` runs → parent calls `refetch()` → parent re-renders → new `onDiscovered` ref propagates to RepoSyncButton.
3. `setActiveJobId(null)` is queued.

Fire-2 sequence:
4. RepoSyncButton re-renders. `activeJobId` is now null (state from step 3) BUT the hook's `setStatus(null)` only runs INSIDE the hook's `useEffect` body (next commit). React commits the new render with `activeJobId = null` but `jobStatus` may still be the old `"done"` value (the hook's `setStatus(null)` hasn't been dispatched yet — its effect runs AFTER the commit).
5. Inside this in-between render, the terminal-handler effect's deps both changed (`onDiscovered` is new + jobStatus is the same OBJECT identity until the hook flushes). React fires the effect with `jobStatus.status === "done"` again → `onDiscovered` fires a second time.

In practice the hook's effect cleanup runs BEFORE the next commit, so `setStatus(null)` lands in the same render cycle and `jobStatus` flips to null before the terminal-handler effect re-evaluates. Empirically the V1 vitest case asserts `onDiscovered` was called with the right args — but `toHaveBeenCalledWith` doesn't assert call count, so a duplicate call would pass the test. We did NOT reproduce the duplicate fire in vitest (the hook's cleanup ordering happens to land first), but the contract is fragile and depends on React's effect scheduling order between two unrelated effects.

**Practical impact**: a duplicate `refetch()` (one extra PR-list GET). Not data corruption, not flickering UI. But the failure mode changes if the parent ever does something non-idempotent in `onDiscovered` (toast, mutation, analytics event).

Two safe fixes (pick one):

(a) Stable callback ref (cheap, robust):
```tsx
const onDiscoveredRef = useRef(onDiscovered);
useEffect(() => { onDiscoveredRef.current = onDiscovered; });
useEffect(() => {
  if (!jobStatus) return;
  if (jobStatus.status === "done") {
    onDiscoveredRef.current?.(...);
    setActiveJobId(null);
  } ...
}, [jobStatus]);                                                                   // ← drop onDiscovered from deps
```

(b) Self-debounce by sync_run_id (more explicit):
```tsx
const lastReportedRef = useRef<number | null>(null);
useEffect(() => {
  if (!jobStatus || lastReportedRef.current === jobStatus.sync_run_id) return;
  if (jobStatus.status === "done") {
    lastReportedRef.current = jobStatus.sync_run_id;
    onDiscovered?.(...);
    setActiveJobId(null);
  } ...
}, [jobStatus, onDiscovered]);
```

**Track**, don't fix in this branch — the test currently passes, the duplicate-fire is empirical-not-observed, and the parent's `onDiscovered` is idempotent (`refetch()` dedupes naturally). Open a follow-up: `lime#TBD — RepoSyncButton terminal-handler stable-callback-ref hardening`. Pair with M1 from Phase-22 review (preview/cancel wrapping) for a single Phase 23+ touch.

**M2 — `kind` field still typed as `string` instead of `"http" | "network" | "decode"` literal union (Phase-22 M2 carry-over).**

The Phase-22 review opened M2 against `_formatGitHubErrorDetail`'s loose `kind` type. Phase 23 promotes `GitHubErrorDetail` from `aiplatformkb-api.ts` into `@/types/pr-sync` (good move — single source of truth) but **does not tighten `kind`**:

```ts
// src/types/pr-sync.ts:25-32 — Phase-23 promoted shape
export interface GitHubErrorDetail {
  kind?: string;                                                                   // ← still loose
  github_status?: number;
  github_message?: string;
  github_errors?: unknown[];
  url?: string;
  hint?: string;
}
```

Backend contract (PHASE-22-PLAN §3.1, locked Phase-22) restricts `kind` to a 3-value union. The promotion was an opportunity to add `kind?: "http" | "network" | "decode"`. No XSS risk (the value is never rendered — only `github_status` and `github_message` are), and `_formatJobErrorDetail` doesn't read `kind` at all, so no functional gap. But the type/contract drift is real and now lives in the canonical types file (more visible than the previous private alias).

**Track**, don't fix — same disposition as Phase-22. Roll into the existing `lime#TBD — GitHubErrorDetail Zod schema` ticket. One-line type tightening when the Zod parser lands.

### LOW

**L1 — `_formatJobErrorDetail` and `_formatGitHubErrorDetail` are near-duplicate format strings in two files.**

```ts
// aiplatformkb-api.ts:199-208 — Phase-22 (parses the THROWN error path)
function _formatGitHubErrorDetail(payload: unknown): string | null {
  ...
  const head = `GitHub ${d.github_status ?? "error"}: ${d.github_message}`;
  const tail = d.hint ? ` — ${d.hint}` : "";
  return head + tail;
}

// RepoSyncButton.tsx:30-34 — Phase-23 (formats the POLLED error_detail object)
function _formatJobErrorDetail(d: GitHubErrorDetail): string {
  const head = `GitHub ${d.github_status ?? "error"}: ${d.github_message ?? "(no message)"}`;
  const tail = d.hint ? ` — ${d.hint}` : "";
  return head + tail;
}
```

The strings are intentionally identical so the 2-row split JSX in `RepoSyncButton` works for both sources — that's the design. But the duplication is now structural: a future change to the format (e.g., emoji prefix, different separator) must update both.

Two small differences worth noting:
- `_formatGitHubErrorDetail` returns `null` if `kind` or `github_message` is missing (it's a guard for "is this a structured detail at all"); `_formatJobErrorDetail` returns a string always (defaulting message to `"(no message)"`). Reasonable — by the time we're inside the failed-job branch, the backend has guaranteed `error_detail` is structured.
- The throw-path version uses `d.github_message` (no fallback) since the parser's null-return short-circuits when missing; the polled version uses `d.github_message ?? "(no message)"` — defensive, fine.

**Recommendation**: lift a shared `formatGitHubErrorDetail(detail: GitHubErrorDetail): string` helper into `@/lib/format` or co-located with the type. Both call sites become one-liners. **Low priority** — code reads fine, both helpers are 4 lines. Track as a chore.

**L2 — IIFE in JSX is still here (Phase-22 L2 carry-over).**

The 2-row error block in `RepoSyncButton.tsx:107-127` is the same IIFE the Phase-22 review flagged as the first IIFE in lime's component tree. Phase 23 copies it unchanged (correct — minimum-diff principle). Same disposition: stylistic, the block is 12 lines, refactoring to a `<GitHubErrorBlock error={error} />` helper would be cleaner but isn't blocking. Track as polish.

**L3 — No `aria-live` / `role="alert"` on the error block (Phase-22 L4 carry-over).**

Phase 23 reuses the same error JSX, so the a11y gap persists exactly as flagged in Phase-22 L4. The `aria-busy` attribute is also missing from the button while polling (the spinner is purely visual; screen-reader users won't know the button is in a "polling" state — they'll just see "Discovering…" textually, which is acceptable but not ideal). Tracked under the existing `lime#TBD — pr-sync a11y sweep`. Phase 23 changes the failure mode from "button looks broken" to "button keeps spinning" — same UX rough edge, broader surface. Worth bundling the polling-loop a11y into the same sweep.

**L4 — Polling hook never aborts in-flight fetches.**

`useDiscoverJobStatus` doesn't create an `AbortController` — when the component unmounts mid-poll, the in-flight `getDiscoverJobStatus(syncRunId)` fetch keeps running to completion (`getJson` accepts a `signal?: AbortSignal` from Phase-21, but the hook never threads one through). The alive-guard ref correctly suppresses the late `setStatus`, so there's **no memory leak** and no stale-write issue — the fetch result just gets discarded.

Phase 21 Wave-1C added `AbortSignal` plumbing on the Reclassify page's `listAdminAgents` call to cancel stale fetches when the curator toggles platforms rapidly. The async-discover hook has a different shape (one fetch in flight at a time, not racing fetches), so the abort isn't load-bearing for correctness — but it would be cleaner to free the network slot on unmount.

**Recommendation** (track for Phase 24+):
```ts
const ac = new AbortController();
const s = await getDiscoverJobStatus(syncRunId!, { signal: ac.signal });
// in cleanup:
ac.abort();
```

Requires extending `getDiscoverJobStatus` to accept the optional signal (1-line change). Not blocking — same pattern Phase-13 `useSyncRowStatus` already lacks. Phase-22 review documented this as Pass; Phase 23 inherits.

## Inline fixes applied

**None.** The implementation is correct and matches the plan; nothing is small enough to fix in-line that would survive code review without a tracked rationale. M1 is the only finding worth a follow-up issue (real timing concern); M2/L1/L2/L3/L4 are documented carry-overs of Phase-22 dispositions.

## Tracked residuals

| ID | Severity | What | Where | Track-as |
|----|----------|------|-------|----------|
| M1 | MEDIUM | Terminal-handler effect can double-fire `onDiscovered` if parent's callback ref changes between hook tick and hook reset | `RepoSyncButton.tsx:65-81` | `lime#TBD — RepoSyncButton terminal-handler stable-callback-ref hardening` |
| M2 | MEDIUM | `GitHubErrorDetail.kind` still typed as `string` not literal union (Phase-22 M2 carry-over) | `types/pr-sync.ts:25-32` | rolls into existing `lime#TBD — GitHubErrorDetail Zod schema` |
| L1 | LOW | `_formatJobErrorDetail` (RepoSyncButton) and `_formatGitHubErrorDetail` (api-client) duplicate format string | two files | `lime#TBD — extract shared formatGitHubErrorDetail helper` |
| L2 | LOW | IIFE in JSX (Phase-22 L2 carry-over) | `RepoSyncButton.tsx:107-127` | folded into a11y sweep below |
| L3 | LOW | No `aria-live` / `role="alert"` / `aria-busy` (Phase-22 L4 carry-over + new polling-state surface) | `RepoSyncButton.tsx:86-131` | existing `lime#TBD — pr-sync a11y sweep` |
| L4 | LOW | Hook doesn't abort in-flight fetch on unmount (alive-guard suppresses the late setState — no leak) | `useDiscoverJobStatus.ts:37-84` | `lime#TBD — useDiscoverJobStatus AbortSignal plumbing` |

## Waived

| ID | Severity | Why waived |
|----|----------|------------|
| — | — | Transient-error polls-forever (e.g. proxy 502 forever): documented Phase-13 carry-over from `useSyncRowStatus`. The hook continues polling on fetch error by design (transient errors shouldn't permanently stop the loop). PHASE-23-PLAN §6 R5 separately covers the SERVER-SIDE stuck-running case via the lazy reaper. Client-side polls-forever-on-network-error is acceptable: the curator sees the spinner stay on indefinitely and can navigate away. Not a regression. |
| — | — | Dual-guard `cancelled` + `aliveRef.current` in the hook: `cancelled` covers effect-re-run (syncRunId change mid-flight), `aliveRef.current` covers unmount. Both are necessary; the redundancy is the standard pattern from `useSyncRowStatus`. |

## Cross-axis notes

### Axis 1 — State machine correctness in `RepoSyncButton`

- States `idle → submitting → running → done | failed → idle` — traced by hand:
  - `idle`: `activeJobId === null`, `submitting === false`, `error === null` → button enabled (if org+repo set).
  - `submitting`: in `handle()` after `setSubmitting(true)`, before POST resolves. `disabled` is true → no rapid-click race possible.
  - `running`: post-POST, `activeJobId !== null`, `submitting === false`. Button still disabled (`isRunning`). Hook polls.
  - `done`: hook returns `jobStatus.status === "done"` → effect calls `onDiscovered` + `setActiveJobId(null)` → `isRunning` flips false → button re-enabled.
  - `failed`: hook returns `jobStatus.status === "failed"` → effect calls `setError(...)` + `setActiveJobId(null)` → button re-enabled, error block renders.
- Rapid-click race: **PASS** — `disabled = !org || !repo || submitting || isRunning` blocks the second click at the DOM level. Even if the first click somehow leaks past, the click handler's first line `if (!org || !repo) return;` is a no-op for the empty case.
- Subsequent click after error: `setError(null)` runs at the top of `handle()` → previous error cleared. **PASS.**
- Single edge: M1 (above) — the terminal handler's `onDiscovered` dep can theoretically refire. Track.

### Axis 2 — Polling hook `useDiscoverJobStatus`

- Recursive `setTimeout` is the right upgrade over `setInterval`: serializes ticks (a slow tick can never overlap with the next), and the `clearTimeout` in cleanup is a single deterministic cancellation point. **PASS.**
- Dual-guard (`cancelled` local + `aliveRef.current` ref): `cancelled` catches effect-re-run mid-tick (syncRunId changed); `aliveRef` catches unmount mid-tick. Both checked at every yield (3 sites: before fetch, after fetch in success, after fetch in catch, before scheduling next). **PASS.**
- Transient errors continue polling: documented in code comment ("Continue polling — transient errors shouldn't permanently stop the loop"). Same disposition as Phase-13. **WAIVE.**
- `setIsPolling(true)` on entry, `setIsPolling(false)` on terminal — `isPolling` stays `true` during a transient-error window. No consumer reads `isPolling` for the error-vs-polling distinction (the component reads `error` separately). **PASS** — semantic of `isPolling` is "active polling loop is alive", not "last tick was successful".
- See L4 above on AbortSignal plumbing.

### Axis 3 — Type safety

- `DiscoverJobStatus.error_detail: GitHubErrorDetail | null` — strict shape, the consumer correctly null-guards with `if (jobStatus.error_detail)`. The fallback to `error_message` for the no-detail branch covers the asymmetric server response (failed jobs MAY have only `error_message` set when the failure isn't a GitHub fetch — e.g., a DB write error inside the worker). **PASS.**
- `discovered_pr_ids: number[] | null` — backend serializes the JSON column as a JSON array of ints. Spot-checked PHASE-23-UAT.md UAT-1 ("207 PRs serialized cleanly; UAT-1 inspected the JSON column at ~3KB"). String IDs would fail at the runtime boundary; not a TS-side concern. **PASS.**
- `_formatJobErrorDetail` accepts `GitHubErrorDetail`, reads `github_status`, `github_message`, `hint`. Does NOT surface `kind`, `url`, `github_errors[]`. Same as Phase-22's `_formatGitHubErrorDetail` — the design surfaces only the curator-actionable fields. `github_errors[]` is captured server-side in DB for forensics; not user-facing. **PASS.**
- See M2 above on `kind` literal-union tightening.

### Axis 4 — Test fidelity

- V1 (done with count): real timers, polls every 2000ms, `waitFor(timeout: 5000)` lets the second poll land. Asserts `onDiscovered.toHaveBeenCalledWith(5, [101..105])` AND button re-enabled. **PASS** — exercises the full async pipeline. (Caveat: doesn't assert call count; see M1.)
- V2 (failed renders 2-row block): asserts BOTH rows render — `screen.getByText(/GitHub 422: Validation Failed/i)` (rose-400 row 1) AND `screen.getByText(/can't see it/i)` (slate-400 row 2). Exercises `error_detail` → `_formatJobErrorDetail` → `" — "` split → 2-row JSX. **PASS** — closes Phase-22 R7 risk.
- V3 (unmount mid-poll): hangs the status fetch, unmounts, releases the promise, asserts no setState-after-unmount warnings via `console.error` spy. **PASS** — exercises the alive-guard contract (and the `cancelled` flag) for real.
- Carry-over Phase-13 test (`calls discoverPrs and onDiscovered on click`): correctly **rewritten** for the new contract — POST returns 202, status poll returns "done" with discovered_count + ids, `onDiscovered` asserted with the new (count, ids) signature. NOT skipped. **PASS.**
- `pr-sync-client.test.ts` Phase-23 tweak (`discoverPrs POSTs through admin proxy with body`): mock returns the new 202 shape, asserts `r.sync_run_id === 42` and `r.status === "running"`. **PASS** — contract test now matches the new return type.

### Axis 5 — Cross-axis trace (full pipeline)

Traced manually:
1. Click → `handle()` → `setSubmitting(true)`, `setError(null)`.
2. `await discoverPrs({org, repo})` → fetch POST `/api/aiplatformkb/admin/pr-sync/discover` → server returns 202 with `{sync_run_id, status:"running", scope}`.
3. `setActiveJobId(r.sync_run_id)` → `setSubmitting(false)` (in finally).
4. Re-render: `activeJobId = 42`, hook's useEffect deps changed → cleanup (no-op, first run), new run: `aliveRef.current = true`, `setIsPolling(true)`, `setStatus(null)`, `setError(null)`, `void tick()`.
5. `tick()` → `await getDiscoverJobStatus(42)` → fetch GET `/api/aiplatformkb/admin/pr-sync/discover/42/status` → returns "running".
6. Hook's `setStatus(s)` → component re-renders. Terminal-handler effect runs: `jobStatus.status === "running"` → no branch matches → no-op.
7. `setTimeout(tick, 2000)` schedules next poll.
8. Tick again → returns "done" with `discovered_count: 5, discovered_pr_ids: [...]`. Hook's `setStatus(s)` → `setIsPolling(false)`, returns (no setTimeout queued).
9. Component re-renders. Terminal-handler effect: `jobStatus.status === "done"` → `onDiscovered(5, [...])` → `setActiveJobId(null)`.
10. Re-render: hook's useEffect cleanup (cancelled=true, aliveRef=false, clearTimeout no-op), new run: syncRunId is null → `setStatus(null)`, return.
11. Re-render: `activeJobId=null`, `jobStatus=null`, button enabled. Idle.

Order of events 2.→3.: the POST is `await`ed, so `setActiveJobId(r.sync_run_id)` runs strictly AFTER the POST resolves. `setSubmitting(false)` runs in `finally` after `setActiveJobId` (same microtask). React batches both into one re-render — no "first poll arrives BEFORE setActiveJobId triggers the hook" concern.

End-to-end pipeline test: V1 covers the success path; V2 covers the failure path; V3 covers the unmount path. **PASS — three exit modes all tested.**

### Axis 6 — a11y / UX

- `aria-live` / `role="alert"`: missing — see L3.
- `aria-busy`: missing on the button while polling. Loader2 + "Discovering…" textual label do communicate the state, but `aria-busy="true"` would be the canonical attribute. Track in same sweep.
- Disabled state: `disabled = !org || !repo || submitting || isRunning` — correct. The button is disabled exactly when a click would be a no-op (no scope) OR a click would create a duplicate request (in flight or polling).
- Button label: "Discovering…" while polling, "Sync new PRs" otherwise. The ellipsis is unicode `…` (single code-point), good for screen-reader pronunciation. Spinner uses `animate-spin` Tailwind utility — purely visual.
- See L2 on the IIFE block.

### Axis 7 — Code style

- File conventions match: `"use client"` directive at top, JSDoc-style block comment above `_formatJobErrorDetail`, underscore prefix marks private helper (matches `_formatGitHubErrorDetail` in api-client). **PASS.**
- `_runWithOpLabel` from Phase 22 still applies to `discoverPrs`: the 202 path is `success` (`fetch.ok === true`), so the parser doesn't fire. Verified by reading `jsonRequest` (lines 226-249): the `_formatGitHubErrorDetail` / op-label branch is only entered when `!res.ok`. A 202 hits the success path, returns `payload as DiscoverJobAccepted`. **PASS.**
- The TS-public surface of `aiplatformkbApi` namespace registers `discoverPrs` and `getDiscoverJobStatus` with a Phase-23 marker comment. Clean.

### Axis 8 — Aborted requests on the polling hook

- The hook never plugs into AbortController — see L4. The alive-guard ref is the SOLE mechanism preventing late setStates. Empirically validated by V3.
- Phase 21 added AbortController on Reclassify page for racing-fetch-stale-write; that pattern doesn't apply here (one fetch in flight at a time per poll cycle). The polling hook's gap is "free the network slot earlier on unmount", not "stop a stale-write race". Track for Phase 24+ as a small hygiene fix.

## Verdict (restated)

**SHIP-CLEAR**. Phase 23 lime work is correct, well-tested, and matches PHASE-23-PLAN §3.5 + §5 Wave 3 to the byte. The new polling hook is a clean Phase-13-mirror with the right `setTimeout`-recursion upgrade. The 2-row error block reuse is the cleanest possible Phase-22→23 evolution — V2 vitest closes risk R7. Two MEDIUM residuals tracked for follow-up (M1 timing-window double-fire — fix when an idiomatic fix is cheap; M2 Zod schema — bundle with Phase-22 carry-over). LOWs are stylistic / a11y carry-overs.

Move to `/tyrion:ship 23`.
