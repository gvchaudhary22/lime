# Phase 25 Review — TypeScript axis (lime)

> Reviewer: reviewer (TypeScript). Branch: `feat/25-async-classify-populate-jobs` (4 commits ahead of `9090268`).
> Reviewed: 2026-04-28
> Files in scope:
> - `src/types/pr-sync.ts` (+37) — 4 new async-job types
> - `src/types/pr-feed.ts` (+8) — `org? / repo?` on `PrDetailHeader`
> - `src/lib/aiplatformkb-api.ts` (+44 / -8) — return-type pivots + 2 new status getters
> - `src/hooks/useClassifyJobStatus.ts` (NEW, +92)
> - `src/hooks/usePopulateJobStatus.ts` (NEW, +93)
> - `src/components/pr-sync/PerRowSyncImpactsButton.tsx` (+118 / -89) — preview→async-job
> - `src/components/pr-sync/RunPopulateButton.tsx` (+96 / -50) — preview→async-job
> - `src/components/pr-feed/PrHeaderCard.tsx` (+11 / -3) — FE-built GitHub URL
> - `src/components/pr-feed/ImpactsTable.tsx` (+39 / -4) — NEW/EXISTING split
> - `src/__tests__/pr-feed-row-sync.test.tsx` (+207 / -29)
> - `src/__tests__/pr-detail-populate.test.tsx` (+38 / -27)

## Verdict

**SHIP-WITH-FOLLOWUPS** — implementation matches PHASE-25-PLAN §4.5 + §5 Wave 3 + §6 R7. The async-job state machines are correct, polling hooks faithfully mirror Phase-23 `useDiscoverJobStatus` (with the small "cancelled" terminal addition), and V1–V5 vitest closes the contract end-to-end. No CRITICAL findings.

One real **HIGH** is worth surfacing before ship — the per-row "hide button on done" UX silently strands the curator on a stale `impact_counts` cell because `PerRowSyncImpactsButton` is mounted with no `onClassified` callback at the only call site (`PrTable.tsx:110`). The button vanishes; the column it claims to hand off to never updates until the page is reloaded. Two-line fix; described below.

The Phase-23 review's MEDIUMs (M1 stable-callback-ref, M2 GitHubErrorDetail.kind literal-union) carry over to both new components and the new hook surface — re-flagged here for the same Phase-26 sweep.

`npx vitest run src/__tests__/pr-feed-row-sync.test.tsx src/__tests__/pr-detail-populate.test.tsx` → **17 / 17 passed** (13 + 4).

## Summary table

| Severity | Count |
|----------|------:|
| CRITICAL |     0 |
| HIGH     |     1 |
| MEDIUM   |     4 |
| LOW      |     5 |

## Findings

### CRITICAL — none

### HIGH

**H1 — `PerRowSyncImpactsButton` is mounted without `onClassified`; "hide-on-done" hands off to a column that never refreshes.**

Trace (`src/components/pr-feed/PrTable.tsx:110`):

```tsx
<PerRowSyncImpactsButton prId={pr.id} />
```

No `onClassified` prop. The button itself does the right thing — terminal "done" with `impact_count > 0` → `setTerminalImpactCount(...)` → `hideAfterDone === true` → `return null`. But `PerRowSyncImpactsButton.tsx:58-63` justifies the hide with this comment:

```tsx
// Phase-25 UX — once classify lands with impact_count > 0 the per-row
// Impacts column takes over, so the button hides.
```

The "Impacts column" the comment points at is `<ImpactCountBadge counts={pr.impact_counts} />` at `PrTable.tsx:96` — and `pr.impact_counts` is sourced from the parent's `getPrDetail()` payload, which is **not refetched** when the row's classify job lands. The page (`src/app/chat/pr-feed/page.tsx:103-105`) already wires a `refetch()` for `RepoSyncButton.onDiscovered`:

```tsx
const [refetchTick, setRefetchTick] = useState(0);
const refetch = () => setRefetchTick((n) => n + 1);
// ...
<RepoSyncButton ... onDiscovered={(count) => { if (count > 0) refetch(); }} />
```

Net curator UX after the per-row classify completes: the "Sync impacts" button vanishes, but the row's Impacts column still shows `0 impacted, 0 eligible_no_change, 0 deprecated_skipped, 0 new_pending` until the page is manually reloaded or the parent's filter triggers a refetch. The whole point of the v25 "hand-off to the column" UX is broken at the only call site.

**Fix** (1 line at the call site + 1-line wiring at the page boundary):

```tsx
// PrTable.tsx — accept + thread an onClassified prop:
<PerRowSyncImpactsButton prId={pr.id} onClassified={onClassified} />

// page.tsx — pass refetch through:
<PrTable
  items={data.items}
  onRowClick={handleRowClick}
  onClassified={(impactCount) => { if (impactCount > 0) refetch(); }}
/>
```

V1 vitest fires `onClassified` and asserts the button hides — both sides of the contract are tested at the COMPONENT layer. The bug is at the wiring layer; no test currently asserts the page re-fetches after a per-row classify.

**Track-or-fix?** This is a 4-line fix, in scope for Phase-25's "async classify lands cleanly in the FE" goal, and the symptom (stale impact column after classify) is exactly the user-visible regression this phase claimed to solve. **Recommend inline fix** under `fix(25-review-ts): wire onClassified through PrTable to refetch list`. If deferred, file `lime#TBD — PrTable.onClassified hand-off to refetch()` as a HIGH.

**H2 (downgraded to MEDIUM, see M1 below)** — pr_url fallback dropped from PrHeaderCard.

### MEDIUM

**M1 — `PrHeaderCard` drops the `pr.pr_url` fallback; pre-Phase-25 backend rows render no GitHub link at all.**

Diff (`src/components/pr-feed/PrHeaderCard.tsx`):

```diff
-        {pr.pr_url && (
-          <a href={pr.pr_url} ...>
+        const githubUrl =
+          pr.org && pr.repo
+            ? `https://github.com/${pr.org}/${pr.repo}/pull/${pr.pr_number}`
+            : null;
+        {githubUrl && (
+          <a href={githubUrl} ...>
```

The Wave-3D rationale is sound — HTTP-path inserts in aiplatformkb don't always populate `pr_url`, so FE-construction from `{org, repo, pr_number}` is more robust. But the PR also **drops the `pr.pr_url` branch entirely** rather than falling through to it. Two real consequences:

1. **Older sync_runs** (pre-25) where `pr_url` IS populated but `org`/`repo` haven't been added to the response payload yet → link disappears. Phase-25 backend may be the only one populating `org`/`repo`; pre-25 rows from existing DB entries that haven't been re-fetched on the new schema render no link at all.

2. **Future GitLab/Bitbucket support** (mentioned in your axis 4 prompt as Phase-26 multi-host) — when a future schema introduces a non-GitHub upstream, the FE-construction breaks the link entirely; the original `pr.pr_url` branch was the safer "trust the server" path.

**Fix** (5 lines, low-risk):

```tsx
const githubUrl =
  pr.org && pr.repo
    ? `https://github.com/${pr.org}/${pr.repo}/pull/${pr.pr_number}`
    : pr.pr_url; // ← fallback to backend-supplied URL
```

V4 vitest still passes (it sets `pr_url: null` AND supplies `org`/`repo`, so the constructed branch is always taken — the fallback path isn't exercised). Add a V4b case asserting the fallback when `org`/`repo` are absent.

**Recommend inline fix** under `fix(25-review-ts): keep pr.pr_url fallback when org/repo absent`.

**M2 — Terminal-handler `useEffect` deps include `onClassified` / no callback (Phase-23 M1 carry-over, doubled).**

`PerRowSyncImpactsButton.tsx:92-109` and `RunPopulateButton.tsx:92-108` both register the same Phase-23 timing-window M1: the terminal handler depends on the parent's callback ref, which is typically an inline arrow → new ref on every parent render → terminal-handler effect can theoretically re-fire if the parent's render lands between the hook's "done" tick and the hook's status-reset.

The `RunPopulateButton` deps array is **even more brittle** — the effect captures `jobStatus` only:

```tsx
useEffect(() => {
  if (!jobStatus) return;
  if (jobStatus.status === "done") {
    setTerminalDone(true);
    setActiveJobId(null);
  } else if (jobStatus.status === "failed" || jobStatus.status === "cancelled") {
    ...
  }
}, [jobStatus]);                                                                     // ← onTriggered NOT in deps
```

But `RunPopulateButton` only fires `onTriggered?.()` from inside `handle()` (synchronous post-POST), not from the terminal effect, so the M1 vector doesn't apply here. **`PerRowSyncImpactsButton` IS exposed**:

```tsx
useEffect(() => {
  if (!jobStatus) return;
  if (jobStatus.status === "done") {
    setTerminalImpactCount(jobStatus.impact_count);
    onClassified?.(jobStatus.impact_count);                                          // ← parent callback
    setActiveJobId(null);
  } else if (...) { ... }
}, [jobStatus, onClassified]);                                                       // ← M1 timing window
```

Same disposition as Phase-23: **track**, don't block. The H1 fix above adds an inline arrow callback, which IS the M1 trigger pattern. When H1 lands, prefer the stable-callback-ref version from PHASE-23-REVIEW-LIME.md M1 fix (a):

```tsx
const onClassifiedRef = useRef(onClassified);
useEffect(() => { onClassifiedRef.current = onClassified; });
useEffect(() => {
  if (!jobStatus) return;
  if (jobStatus.status === "done") {
    setTerminalImpactCount(jobStatus.impact_count);
    onClassifiedRef.current?.(jobStatus.impact_count);
    setActiveJobId(null);
  } ...
}, [jobStatus]);                                                                     // ← drop onClassified
```

**Track**: roll into `lime#TBD — pr-sync state-machine terminal-handler stable-callback-ref hardening` (open ticket from Phase-23 M1; expand scope to all 3 components).

**M3 — `GitHubErrorDetail.kind` still typed as `string` not `"http" | "network" | "decode"` (Phase-22 M2 / Phase-23 M2 carry-over).**

Phase-25 doesn't touch `GitHubErrorDetail`; the Phase-23 promotion to `@/types/pr-sync` stuck. Same disposition. **Track** under existing `lime#TBD — GitHubErrorDetail Zod schema`.

**M4 — `ClassifyJobStatus.impact_count: number` (no nullable) — locks the backend contract.**

Phase-23's `DiscoverJobStatus.discovered_count: number | null` is nullable because the count is undefined while `status === "running"`. Phase-25 chose `impact_count: number` (always int, never null) for `ClassifyJobStatus` — the backend ALWAYS sets it (initialized to 0 on insert). This is a **stricter** contract than discover and is the right choice IF the backend genuinely guarantees it. Verify in PHASE-25-PLAN §4.5 Wave-3D-be that `pr_sync_runs_pr.impact_count` defaults to 0 on insert (not NULL) and that the status endpoint never returns null.

`PopulateJobStatus.populate_at: string | null` IS nullable (correct — the column is null until completion). Asymmetric with `ClassifyJobStatus.classified_at: string | null` (also nullable). Both fields' contracts look right.

If the backend ever serializes `impact_count` as null mid-run, the runtime parse will succeed (TS doesn't enforce at runtime), but the consumer code would treat it as `0` via JS coercion in a few places — no crash, but silently-wrong displayed counts. **Track**: contract test in aiplatformkb to assert `impact_count` is non-null in all 5 status states.

### LOW

**L1 — `useClassifyJobStatus` and `usePopulateJobStatus` are byte-for-byte copies of `useDiscoverJobStatus` modulo type/getter substitutions.**

3 polling hooks now exist with identical:
- recursive-`setTimeout` body
- alive-guard ref + `cancelled` flag dual-guard
- `setIsPolling(true)` on entry / `setIsPolling(false)` on terminal
- transient-error-keeps-polling semantic
- TERMINAL set membership check (with the small variation: discover hook uses `["done", "failed"]`, classify+populate use `["done", "failed", "cancelled"]` — the cancelled state is reachable for classify/populate via `cancelPrSync` but not for discover, which is correct).

The 3-way duplication is the textbook trigger for a generic factory:

```ts
function makePollingHook<S extends { status: string }>(
  fetcher: (id: number) => Promise<S>,
  terminalStates: ReadonlySet<string>,
) {
  return function usePolledJob(id: number | null, intervalMs = 2000) { ... };
}

export const useDiscoverJobStatus = makePollingHook(getDiscoverJobStatus, new Set(["done", "failed"]));
export const useClassifyJobStatus  = makePollingHook(getClassifyJobStatus, new Set(["done", "failed", "cancelled"]));
export const usePopulateJobStatus  = makePollingHook(getPopulateJobStatus, new Set(["done", "failed", "cancelled"]));
```

Saves ~150 lines of duplicated body across 3 files; future fixes (e.g., the L4 AbortSignal threading from Phase-23) land once instead of three times.

**Track** as `lime#TBD — extract usePolledJob<T> factory` for Phase-26. Not blocking; the duplication is mechanical and well-commented.

**L2 — `_formatJobErrorDetail` duplicated three times across `RepoSyncButton`, `PerRowSyncImpactsButton`, `RunPopulateButton`.**

Phase-23 L1 flagged the duplication between RepoSyncButton's `_formatJobErrorDetail` and aiplatformkb-api.ts's `_formatGitHubErrorDetail`. Phase-25 propagates the SAME 4-line function into TWO MORE components verbatim. Now 4 copies of the format string live in the codebase. Same disposition as Phase-23 L1 — **track** under existing `lime#TBD — extract shared formatGitHubErrorDetail helper`. When the helper lands, all 4 call sites become one-liners.

**L3 — IIFE in JSX duplicated three times (Phase-22 L2 / Phase-23 L2 carry-over, doubled).**

The 2-row error block IIFE now lives in 3 components instead of 1. Same disposition as L2 above — **track** under the same a11y / refactor sweep. A `<GitHubErrorBlock error={error} />` helper resolves L2+L3 simultaneously.

**L4 — No `aria-live` / `role="alert"` / `aria-busy` on either new button (Phase-22 L4 / Phase-23 L3 carry-over).**

Both `PerRowSyncImpactsButton` and `RunPopulateButton` reuse the same a11y-incomplete error-block pattern. The "Classifying…" / "Populating…" labels are textual (good) but `aria-busy="true"` while polling would be the canonical attribute. Track under existing `lime#TBD — pr-sync a11y sweep`. Phase-26 scope.

**L5 — Polling hooks never abort in-flight fetches (Phase-23 L4 carry-over).**

`useClassifyJobStatus` and `usePopulateJobStatus` both inherit Phase-23 L4: no `AbortController` on the in-flight fetch when the component unmounts mid-poll. The alive-guard ref correctly suppresses the late `setStatus` (no leak, no stale-write), but the fetch keeps running until completion. Same disposition. **Track** under expanded `lime#TBD — useDiscoverJobStatus + useClassifyJobStatus + usePopulateJobStatus AbortSignal plumbing` — fix lands once when the L1 factory is extracted.

## Inline fixes applied

**None** — left for the user to decide whether to land H1 + M1 in this branch or in a follow-up. Both are low-risk and small enough to fit `fix(25-review-ts): ...` commits:

- H1: `fix(25-review-ts): wire onClassified through PrTable to refetch list after per-row classify`
- M1: `fix(25-review-ts): keep pr.pr_url fallback when org/repo absent`

If preferred, both can land as a single commit `fix(25-review-ts): close H1 + M1 from review`. M2 / M3 / M4 / L1–L5 are all carry-overs or Phase-26 candidates — track, don't fix.

## Tracked residuals

| ID | Severity | What | Where | Track-as |
|----|----------|------|-------|----------|
| H1 | HIGH | `PerRowSyncImpactsButton` mounted without `onClassified` → row's Impacts column never refreshes after classify lands | `PrTable.tsx:110` + `page.tsx:227` | `lime#TBD — PrTable.onClassified hand-off to refetch()` (or land inline) |
| M1 | MEDIUM | `PrHeaderCard` drops `pr.pr_url` fallback when `org`/`repo` absent | `PrHeaderCard.tsx:26-29` | `lime#TBD — PrHeaderCard pr_url fallback` (or land inline) |
| M2 | MEDIUM | Terminal-handler effect can theoretically re-fire `onClassified` (Phase-23 M1 carry-over, expanded surface) | `PerRowSyncImpactsButton.tsx:92-109` | rolls into existing `lime#TBD — pr-sync state-machine terminal-handler stable-callback-ref hardening` |
| M3 | MEDIUM | `GitHubErrorDetail.kind` typed as `string` not literal union (Phase-22 M2 / Phase-23 M2 carry-over) | `types/pr-sync.ts:26-33` | rolls into existing `lime#TBD — GitHubErrorDetail Zod schema` |
| M4 | MEDIUM | `ClassifyJobStatus.impact_count: number` non-null contract un-asserted | `types/pr-sync.ts:116` + backend | `aiplatformkb#TBD — ClassifyJobStatus.impact_count never-null contract test` |
| L1 | LOW | 3-way polling-hook duplication (discover/classify/populate) | 3 hook files | `lime#TBD — extract usePolledJob<T> factory` |
| L2 | LOW | `_formatJobErrorDetail` duplicated 4× across components + api-client | 4 files | rolls into existing `lime#TBD — extract shared formatGitHubErrorDetail helper` |
| L3 | LOW | IIFE in JSX duplicated 3× (Phase-22 L2 / Phase-23 L2 carry-over) | 3 components | folded into a11y sweep below |
| L4 | LOW | No `aria-live` / `role="alert"` / `aria-busy` on either new button | `PerRowSyncImpactsButton.tsx`, `RunPopulateButton.tsx` | existing `lime#TBD — pr-sync a11y sweep` |
| L5 | LOW | Polling hooks never `AbortController`-cancel in-flight fetch on unmount (Phase-23 L4 carry-over) | both new hooks | expanded `lime#TBD — polling hooks AbortSignal plumbing` |

## Waived

| ID | Severity | Why waived |
|----|----------|------------|
| — | — | "Re-classify UX after hide" (mentioned in your axis 1 prompt): once `terminalImpactCount > 0`, button is gone forever for the lifetime of the component instance; navigating away + back resets the local state, so the curator CAN re-trigger by reload — this is by design per the v25 UX spec ("the column takes over"). Not a regression; H1 fix above resolves the column-staleness root cause that made this UX feel broken. |
| — | — | Multi-host support (GitLab/Bitbucket) for FE-built GitHub URL: hardcoded `github.com` in `PrHeaderCard.tsx:28` will break for non-GitHub upstreams. Phase-26 candidate; covered by M1 fix's fallback to `pr.pr_url` (which a future GitLab backend would populate directly). |
| — | — | Test V1 not asserting call count on `onClassified` (Phase-23 V1 carry-over): `toHaveBeenCalledWith(5)` doesn't assert call count, so the M2 timing-window double-fire would pass undetected. Same disposition as Phase-23 — empirical-not-observed, idempotent parent callback (refetch dedupes naturally if H1 lands). Track in M2 follow-up. |
| — | — | Dual-guard `cancelled` + `aliveRef.current` in both new hooks: same as Phase-23 — `cancelled` covers effect-re-run (prId change mid-flight), `aliveRef.current` covers unmount. Both necessary; standard pattern. |

## Cross-axis notes

### Axis 1 — State machine correctness in `PerRowSyncImpactsButton` + `RunPopulateButton`

**`PerRowSyncImpactsButton`** states `idle → submitting → running → done | failed | cancelled → idle (or hidden)`:

- `idle`: `activeJobId === null`, `submitting === false`, `terminalImpactCount === null` → button enabled.
- `submitting`: `setSubmitting(true)` → `await triggerClassify(prId)` → 202. `disabled = showSpinner` blocks rapid clicks.
- `cached_hit short-circuit`: 202 returns `status === "done"` + `impact_count` → set local terminal, fire callback, **skip polling entirely** (no `setActiveJobId`). Clean. PHASE-25-PLAN §4.5 R7 closed.
- `running`: `setActiveJobId(r.sync_run_pr_id)` → hook ticks every 2000ms → terminal-handler effect fires.
- `done` with `impact_count > 0`: `terminalImpactCount` set → `hideAfterDone === true` → return null. **H1 above**: the column is supposed to take over, but doesn't refresh.
- `done` with `impact_count === 0`: `terminalImpactCount = 0` → `hideAfterDone === false` → button stays visible (curator can re-trigger). Correct.
- `failed` / `cancelled`: synthesizes `_formatJobErrorDetail` string → 2-row block renders. Button re-enabled (`activeJobId = null`).

Rapid-click race: **PASS** — `disabled = showSpinner` blocks at the DOM level.

**`RunPopulateButton`** states `idle (gated) → submitting → running → done (hidden) | failed | cancelled → idle`:

- `disabled` gate: `showSpinner || classifyStatus !== "done" || populateStatus === "running"`. Pre-flight gate on `classifyStatus === "done"` is the right check; V5 vitest locks it.
- `submitting`: `triggerPopulate(prId)` → 202. `onTriggered?.()` fires synchronously (NOT in terminal handler — different from PerRowSyncImpactsButton). M1 timing-window doesn't apply here.
- `running`: hook polls. PopulateProgressBanner (separate component, also mounted on the page) shows the progress at the top while this button shows the post-trigger spinner.
- `done`: `terminalDone = true` → button hides forever. Or `populateStatus === "done"` (from parent's `useSyncRowStatus` poll) hides it for the page-load case where the PR was already populated. Both checks belt-and-braces, correct.
- `failed` / `cancelled`: 2-row error block, button re-enabled.

**Cross-component coordination** (page → `useSyncRowStatus` → `RunPopulateButton.populateStatus` prop): the `useSyncRowStatus` hook polls `/admin/pr-sync/prs/{id}` (the LIST/sync status endpoint), separately from `usePopulateJobStatus` (the per-job status endpoint). Both will flip to "done" eventually; the button hides whichever lands first. Sane.

### Axis 2 — Polling hooks `useClassifyJobStatus` + `usePopulateJobStatus`

Both are line-by-line clones of `useDiscoverJobStatus` modulo the `getXxx` substitution and the TERMINAL set inclusion of `"cancelled"`. The only meaningful behavior delta: `useDiscoverJobStatus.TERMINAL = ["done", "failed"]` because discover doesn't have a per-PR cancel surface, while classify/populate both DO (`cancelPrSync`). Verified backend `/classify/status` and `/populate/status` can return `status === "cancelled"` after a `cancelPrSync` call lands during running — they should, per `CancelResponse.cancelled: ("classify" | "populate")[]`.

The `getJson` proxy auth (Phase-13 Wave-1C) carries through unchanged — `/admin/pr-sync/prs/{id}/classify/status` and `/admin/pr-sync/prs/{id}/populate/status` go through the lime proxy at `/api/aiplatformkb/admin/...`. Confirmed in `aiplatformkb-api.ts:73`.

L1 / L5 above cover the duplication and AbortSignal gaps.

### Axis 3 — Type safety

- `ClassifyJobAccepted.status: "running" | "done"` — narrow union, the consumer correctly switches on `r.status === "done"` for the cached_hit short-circuit. **PASS.**
- `ClassifyJobStatus.status: 5-state union` — same shape as `SyncLifecycleStatus`. The hook's TERMINAL set covers 3 of the 5 (running/pending continue polling). **PASS.**
- `ClassifyJobStatus.impact_count: number` (non-null): see M4. Backend contract assumed; track contract test.
- `PopulateJobAccepted.status: "running"` (single literal): the backend never short-circuits populate (no 24h cache), so this is correct. The button always sets `activeJobId` and starts polling.
- `PopulateJobStatus.populate_at: string | null` — nullable (correct, ISO timestamp set on completion only).
- `GitHubErrorDetail` reused unchanged. M3 carry-over. **PASS** (modulo M3).
- The deprecated `ClassifyResponse` / `PopulateResponse` aliases are NO LONGER exported through `aiplatformkbApi` namespace — they're orphaned in `pr-sync.ts:75-94`. Either remove them in this branch (since no caller uses them anymore — `triggerClassify` / `triggerPopulate` now return the `Accepted` shapes) OR mark them `@deprecated` like `PrSyncDiscoverResponse` was in Phase-23. Currently neither — minor polish gap. **Track-or-waive**: leave for Phase-26 type-cleanup pass.
- `PrDetailHeader.org? / repo?: string | null` (Phase-25 Wave-3D additions): optional + nullable so older backends compile. Defensive, correct. **PASS.**

### Axis 4 — `PrHeaderCard` FE-built URL

- `pr.org && pr.repo` truthiness guard: `null` and `""` both fail, `undefined` fails. **PASS** for the empty-string case (the original `pr.pr_url` check used `pr.pr_url &&` which has the same semantic).
- URL construction: `https://github.com/${pr.org}/${pr.repo}/pull/${pr.pr_number}` — no URL-encoding on `pr.org` / `pr.repo`. If either ever contains a `/` or whitespace (shouldn't, but the type is `string`), the URL is malformed. **Low-priority track** — backend validates org/repo against GitHub's regex, so unsanitary values shouldn't arrive at the FE. Worth a `encodeURIComponent` belt-and-braces.
- **M1 above**: dropped `pr.pr_url` fallback. Real regression for pre-25 backends.

### Axis 5 — `ImpactsTable` NEW vs EXISTING split

- `items.filter((i) => i.api_status === "new")` and `items.filter((i) => i.api_status === "existing")`: at the type level, `ImpactItem.api_status: "new" | "existing"` — NO null option. So a runtime null IS impossible per the type contract. **PASS.**
- If the backend ever serializes a null `api_status` (shouldn't, the column is `NOT NULL` in the schema), both filters return false → the row appears in NEITHER section. **Silent drop** is the failure mode; not a crash. The empty-state guard (`newApis.length === 0 && existingApis.length === 0`) catches the case where ALL rows are nullish, but a MIX of valid + null would silently drop the nulls. **Recommend track-or-waive**: contract-level concern, owned by aiplatformkb's `/api/v1/prs/{id}` schema. Not a TS axis blocker.
- Empty state / only-NEW / only-EXISTING / mixed: all 4 states render correctly per the V3 vitest assertions. The conditional sections (`{newApis.length > 0 && ...}`) collapse the unused half cleanly. **PASS.**
- Section header counts: badges show `{newApis.length}` and `{existingApis.length}` — derived from the filtered arrays, never from a server-supplied count. Correct.

### Axis 6 — Test fidelity

- **V1** (button hides on done with impacts): real timers, polls every 2000ms, `waitFor(timeout: 5000)` lets the second poll land. Asserts `onClassified.toHaveBeenCalledWith(5)` AND `screen.queryByRole("button", { name: /sync impacts|classifying/i })` is `null`. **PASS** — closes the button-hides contract. Caveat: doesn't assert call count (M2 carry-over).
- **V2** (failed renders 2-row block): asserts BOTH rows render (`GitHub 422: Validation Failed` rose-400 + `Repo cannot be searched` slate-400). Same Phase-22/23 pattern. **PASS** — closes Wave-3B error-block contract.
- **V3** (NEW vs EXISTING render): mixed-status fixture (2 new + 1 existing). Asserts both section headers exist, both count pills match, all 3 paths render. **PASS** — closes Wave-3D split contract.
- **V4** (constructed GitHub URL): `pr_url: null`, `org: "bfrs"`, `repo: "MultiChannel_API"`, `pr_number: 100877` → asserts `href === "https://github.com/bfrs/MultiChannel_API/pull/100877"`. **PASS** — closes Wave-3D-be backend → FE wiring. **Gap**: no V4b case for the `pr_url` fallback (M1 above).
- **V5** (populate gated on classify=done): tests both states (disabled with "Classify impacts first" tooltip + enabled). Click → POST → `onTriggered` fires. **PASS** — closes Wave-3C gate contract.
- Phase-13 preview→confirm tests: 2 deleted (`preview surfaces path_count` + `confirm fires triggerPopulate`), replaced by V5. The deleted tests asserted the preview→confirm UX which Phase-25 explicitly removed (Wave-3 deviation note). Genuinely obsolete; correctly deleted. **PASS.**

**End-to-end coverage**: V1 covers full async classify pipeline (click → POST → poll → terminal → callback → button hides). V2 covers failure path. V5 covers populate trigger. Single end-to-end test through the populate state machine to terminal "done" is **NOT present** (V5 stops at `onTriggered` fired and leaves polling resolved-as-running). **Track-or-waive** — the populate state machine is a pure clone of classify; classify's V1 + V2 prove the shape works. Adding a V6 "populate done hides button" test would lock the parallel contract for ~20 lines. **Recommend track** for Phase-26 test sweep.

### Axis 7 — Cross-axis trace (full pipeline)

Manually traced classify path:
1. PrTable row click → `<PerRowSyncImpactsButton prId={pr.id} />` mount.
2. Click `Sync impacts` → `handle()` → `setSubmitting(true)`, `setError(null)`.
3. `await triggerClassify(prId)` → POST `/admin/pr-sync/prs/{id}/classify` (proxied through `/api/aiplatformkb/admin/...`) → 202 with `ClassifyJobAccepted`.
4. Branch: `r.status === "done"` (cached_hit) → `setTerminalImpactCount(r.impact_count)` + `onClassified?.(r.impact_count)` → polling skipped. Button hides if `impact_count > 0`.
5. Branch: `r.status === "running"` → `setActiveJobId(r.sync_run_pr_id)` → `setSubmitting(false)` (finally).
6. Re-render: hook's useEffect deps changed → cleanup → new run: `aliveRef.current = true`, `setIsPolling(true)`, `void tick()`.
7. `tick()` → GET `/admin/pr-sync/prs/{id}/classify/status` → returns running. `setStatus(s)` → re-render. Terminal-handler effect: `running` → no branch.
8. `setTimeout(tick, 2000)` schedules next poll.
9. Tick again → returns "done" with `impact_count: N`. Hook's `setStatus(s)` → `setIsPolling(false)`.
10. Re-render. Terminal-handler effect: `jobStatus.status === "done"` → `setTerminalImpactCount(N)`, `onClassified?.(N)`, `setActiveJobId(null)`.
11. Re-render: `hideAfterDone === true` → return null. Button gone.
12. **H1 above**: parent's row keeps showing stale `pr.impact_counts` because no `onClassified` callback wired at PrTable.

End-to-end is correct at the COMPONENT layer; the PAGE layer breaks it. V1 vitest doesn't catch H1 because it asserts the local component state (callback fired + button hid) without exercising the parent's row-list rerender.

### Axis 8 — Accessibility / UX

- "Sync impacts" / "Classifying…" / "Run kb_populate" / "Populating…" labels: textual, screen-reader-friendly. **PASS** modulo L4 (no `aria-busy`).
- Disabled state on RunPopulateButton: `tooltip` prop dynamically swaps to "Classify impacts first" / "Populate already running" — explicit guidance. **PASS.**
- "Once completed this button will not show" — yes, locked by `if (hideAfterDone) return null;` and `if (terminalDone || populateStatus === "done") return null;`. Curator cannot re-trigger from this surface; that's the design. Reload re-mounts → terminal state resets → button visible again if backend allows it. Acceptable per v25 UX spec.
- L4 carry-over.

### Axis 9 — Code style

- Both new hooks: `"use client"` directive at top, JSDoc-style block comment, identical structure to `useDiscoverJobStatus`. **PASS.**
- Both new components: `"use client"`, JSDoc block comment explaining the state machine, `_formatJobErrorDetail` underscore-prefix matches the convention. **PASS.**
- Lucide icon swap (PerRowSyncImpactsButton: `Sparkles` → `Activity`): cosmetic, justified by the new bigger button styling. RunPopulateButton: `Play` retained. Both fine.
- The comment in `triggerPopulate` (`aiplatformkb-api.ts:537-541`) mentions the 400-on-pre-flight-fail behavior — but the FE's button gate prevents that 400 from ever firing in normal flow. Still worth the comment for the racing case (curator's classify cancellation lands between gate-check and POST). **PASS.**
- Deprecated `ClassifyResponse` / `PopulateResponse` aliases: no `@deprecated` JSDoc attached (Phase-23 added it for `PrSyncDiscoverResponse`). Inconsistent. **Low-priority polish**, see Axis 3.

## Verdict (restated)

**SHIP-WITH-FOLLOWUPS**. The async-job state machines are correct, the polling hooks are clean Phase-23 mirrors, and V1–V5 vitest closes the contract end-to-end (17/17 passing). The work matches PHASE-25-PLAN §4.5 + §5 Wave 3 + §6 R7 to the byte.

Two findings I'd land before ship:

1. **H1**: wire `onClassified` through PrTable to refetch the list. The "hide button, hand off to column" UX is the Phase-25 win; it's broken at the only call site. 4-line fix.
2. **M1**: keep `pr.pr_url` fallback in `PrHeaderCard`. Pre-25 rows lose their GitHub link. 1-line fix.

Both are mechanical, in-scope for Phase-25's stated goals, and have known follow-up issue templates. If shipped without inline fixes, both ride high-priority follow-up tickets.

Everything else is Phase-23 / Phase-22 carry-overs (M2/M3) or Phase-26 polish/refactor candidates (L1–L5, M4). Move to `/tyrion:ship 25` after H1 + M1 land or are explicitly deferred with tracking.
