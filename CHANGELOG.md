# Changelog — Lime

All notable changes to the Lime frontend (Shiprocket internal operator UI) are documented here.

Format: [Semantic Versioning](https://semver.org/) — `v{milestone}.{phase}` aligning with the cross-repo `BFRS-2/aiplatformkb` phase numbering.

---

## [Unreleased] — feat/23-async-discover-job (Phase 23)

### Feature — Async-job state machine on `RepoSyncButton` + polling hook + UX touch-ups (Phase 23)

**Branch**: `gvchaudhary22/lime` → `feat/23-async-discover-job` (cut from main; aiplatformkb backend ships in lockstep at `BFRS-2/aiplatformkb feat/23-async-discover-job`)
**Phase**: M1-P23 — frontend half of the sync→async cut. Backend now returns `202` immediately and exposes a status endpoint; lime polls for terminal state.
**Tests**: 11 vitest pass on `pr-feed-row-sync.test.tsx` (8 Phase-22 + 3 Phase-23). 18 pass on the broader `pr-feed-row-sync + pr-sync-client` surface. `tsc --noEmit` clean for Phase-23 files.

#### Why

Backend Phase 23 (cross-repo `BFRS-2/aiplatformkb#39`) cuts `POST /admin/pr-sync/discover` from synchronous (5–30s blocking on GitHub fetch) to fire-and-forget job (202 + background worker + status polling endpoint). Without this lime change the new contract is unusable from the UI.

Live UAT measurement: `bfrs/MultiChannel_API` discover takes ~44 seconds for 207 PRs / 8,747 changed files. Pre-Phase-23 the operator's browser blocked for the entire 44s. Post-Phase-23 the response returns in <1 second and the FE shows a "Discovering…" spinner that resolves to a count when the background worker finalizes the row.

#### What shipped

**Types** (`src/types/pr-sync.ts`).
- `DiscoverJobAccepted = {sync_run_id, status: "running", scope}` — 202 response shape.
- `DiscoverJobStatus = {sync_run_id, org, repo, status: "running"|"done"|"failed", started_at, finished_at, error_message, error_detail, discovered_count, discovered_pr_ids}` — GET /status response.
- `GitHubErrorDetail` shared with Phase 22 — kind / github_status / github_message / github_errors[] / url / hint.
- `PrSyncDiscoverResponse` retained as deprecated alias for one PR cycle.

**Client** (`src/lib/aiplatformkb-api.ts`).
- `discoverPrs()` return-type changed to `Promise<DiscoverJobAccepted>`. Body unchanged — `_runWithOpLabel` wrapper still applies; the 202 hits the success path so the Phase-22 GitHub-error parser doesn't fire on the POST.
- New `getDiscoverJobStatus(syncRunId)` — uses the existing `adminUrl` + `getJson` helpers.

**Polling hook** (`src/hooks/useDiscoverJobStatus.ts` — NEW, mirrors Phase-13 `useSyncRowStatus`).
- Recursive `setTimeout` poll loop (serializes ticks; no overlap on slow ticks).
- Alive-guard ref + cancellation flag covering both effect re-run and unmount.
- Terminal set: `done | failed`. Hook stops polling on terminal; `setActiveJobId(null)` from the parent fully unmounts.
- Transient errors tolerated (continues polling on a single failed fetch — locked by V3 vitest case).

**Button state machine** (`src/components/pr-sync/RepoSyncButton.tsx`).
- States: idle → submitting (POST in flight) → running (polling) → done | failed → idle.
- "Discovering…" label while polling. `disabled = !org || !repo || submitting || isRunning`.
- The Phase-22 2-row error block JSX is **REUSED unchanged** — `_formatJobErrorDetail(detail)` produces the same `"GitHub <status>: <msg> — <hint>"` string the Phase-22 throw path emitted, so the existing IIFE renderer keeps working bit-for-bit.
- 3 new vitest cases: V1 click→202→polls→done with count fires `onDiscovered`; V2 polled `failed` renders 2-row block; V3 unmount-mid-poll alive-guard contract.

**Mid-ship UX hardening** (commit f334165, bundled into Phase-23 PR per user request during ship session).
- **Horizontal scroll on PR Feed list + detail tables** — the rounded `overflow-hidden` card was clipping the 10-column `PrTable` / `ImpactsTable` on narrow viewports. Wrap each table in `<div className="overflow-x-auto">` so the table scrolls horizontally inside the rounded card while Pagination stays put. Two-line change in each of `pr-feed/page.tsx` + `pr-feed/[prId]/page.tsx`.
- **Title column truncation tooltip** — shrink `PrTable` title cell from `max-w-md` (32rem) to `max-w-[20rem]` (320px) AND add `title={pr.pr_title}` for the native browser tooltip on hover. No new dependency.

#### Cross-repo dependency

Backend half: `BFRS-2/aiplatformkb#39`. Either repo can merge first — the FE's `_formatJobErrorDetail` falls through cleanly when `error_detail` is null, so worst case the FE renders `error_message` text on legacy backends.

#### Tracked residuals (Phase 24)

- **TS-MED-1** — `RepoSyncButton`'s terminal-handler `useEffect([jobStatus, onDiscovered])` can theoretically double-fire `onDiscovered` if the parent passes a fresh callback ref (inline arrow). Empirically not reproducible; practical impact = idempotent duplicate refetch. Stable callback ref OR `lastReportedRef.current === sync_run_id` guard.
- **TS-MED-2** — `GitHubErrorDetail.kind` typed as `string` instead of `"http" | "network" | "decode"` literal union (Phase-22 carry-over).
- **TS-LOW-1** — Dedupe `_formatJobErrorDetail` (RepoSyncButton) and `_formatGitHubErrorDetail` (api-client).
- **TS-LOW-3** — `aria-live` / `role="alert"` / `aria-busy` on the error block + polling-state surface (Phase-22 a11y carry-over).
- **TS-LOW-4** — `AbortSignal` threading on the polling hook (Phase-21 AbortController pattern).

---

## [Unreleased] — feat/22-discover-error-hardening (Phase 22)

### Hardening — Parse structured GitHub-error detail in `RepoSyncButton` (Phase 22 — lime side)

**Branch**: `gvchaudhary22/lime` → `feat/22-discover-error-hardening` (cut from main; rebases on aiplatformkb Phase 22 merge)
**aiplatformkb cross-link**: `BFRS-2/aiplatformkb` → `feat/22-discover-error-hardening`
**Phase**: M1-P22 — single Wave (3) on the Lime side; backend half is the load-bearing change.
**Tests**: 8 pass on `pr-feed-row-sync.test.tsx` (was 6; +2 cases). Surface across api-tools+pr-feed: 59 pass (was 57; +2 net). `tsc --noEmit` clean for Phase-22 files.

#### Why

Backend Phase 22 turns GitHub API failures into structured `4xx` responses with body shape `{detail: {kind, github_status, github_message, github_errors, url, hint}}`. Without this Lime change, `discoverPrs()` would still throw a generic `"discover failed"` and `RepoSyncButton` would render that — wasting the actionable hint the backend now provides.

#### What shipped

- **`src/lib/aiplatformkb-api.ts`** — centralized `_formatGitHubErrorDetail` parser inside the existing `jsonRequest` helper + `_runWithOpLabel(op, fn)` wrapper across `discoverPrs` / `triggerClassify` / `triggerPopulate`. Smart deviation from plan §3.3: shared helper instead of three duplicated `!res.ok` blocks. Public-API endpoints unchanged.
- **`src/components/pr-sync/RepoSyncButton.tsx`** — IIFE block renders the error in 2 rows when `error.startsWith("GitHub ")`: row 1 the GitHub status + message in rose, row 2 the hint in slate-400. Non-prefixed errors fall through to the existing single-row rendering — back-compat preserved.
- **2 new vitest cases** lock the contract: structured 422 with hint renders both rows; back-compat 500 with non-JSON body renders `discover failed (500)` single-row.

#### Cross-repo dependency

This commit lands on a branch that pairs with `BFRS-2/aiplatformkb#37` (the backend GitHubAPIError + handler mapping). Either repo can merge first — Lime's parser falls through cleanly to the legacy `discover failed (<status>)` shape when the backend hasn't yet shipped the structured detail.

#### Tracked residuals (Phase 23)

- **TS-MED-1** — `previewClassify` / `previewPopulate` / `cancelPrSync` not yet wrapped by `_runWithOpLabel`; gated on backend OQ-1 audit (those endpoints don't currently call GitHub in-process).
- **TS-MED-2** — `GitHubErrorDetail.kind` typed as `string` instead of `"http" | "network" | "decode"` literal union. No XSS risk; recommend Zod schema.
- **TS-LOW-4** — New error block lacks `aria-live` / `role="alert"` (perpetuates a pre-existing gap across all `pr-sync` buttons).

---

## [Unreleased] — feat/21-hardening-sweep (Phase 21)

### Hardening — AbortController sweep on Reclassify page (Phase 21 — lime side)

**Branch**: `gvchaudhary22/lime` → `feat/21-hardening-sweep` (cut from `feat/20-db-first-catalog`; rebases to main on PR merge — Phase 20 already merged)
**aiplatformkb cross-link**: `BFRS-2/aiplatformkb` → `feat/21-hardening-sweep`
**Phase**: M1-P21 — single Wave (1C) on the Lime side; remaining Phase-21 items are backend-only.
**Tests**: 44 pass on the api-tools surface (was 37; +2 new race-condition cases + +5 from re-run of admin-proxy/drawer/tabs after the helper extraction).

#### Why

Phase 19 + 20 reviews surfaced TS20-M1: rapid platform-toggle on the Reclassify page could let a stale `listAdminAgents` resolution overwrite a fresher one, leaving the agent dropdown out of sync with the platform. Same vector on Use-suggestion when it fires while a platform-onChange fetch is still in flight.

#### What shipped

- **`src/lib/aiplatformkb-api.ts`** — `getJson<T>` extended with optional `{ signal?: AbortSignal }`; `listAdminAgents(platform?, signal?)` threads it through. Existing call sites unchanged (signal defaults to undefined → no behavior change for callers that don't opt in).
- **`src/app/chat/api-tools/reclassify/[id]/page.tsx`** — new `agentsFetchAbort: useRef<AbortController | null>` + `refetchAgentsFor(platform, suggestedAgentToPreserve?)` helper. Both inline `.then(setAgents)` call sites (platform-onChange + Use-suggestion) replaced with the helper. Each call aborts the prior controller; only the latest fetch's resolution can call `setAgents`. Unmount cleanup aborts any in-flight fetch.
- **2 new vitest cases** lock the contract: rapid platform-toggle (A → B → A) asserts each prior `signal.aborted === true` and final dropdown matches A; Use-suggestion-mid-platform-fetch confirms the in-flight fetch's signal flips to aborted.

#### Cross-repo dependency

This commit lands on a branch that also carries the aiplatformkb backend work (admin_curate.py split, validator alignment, real-MySQL CI, migration runbook). The Lime PR is independent — no shared diff, no shared CHANGELOG header — but ships in the same review cycle. See `BFRS-2/aiplatformkb#TBD` for the backend half.

#### Out of scope (deferred Phase 22+)

GitHub-error structured response parsing (Phase 22 — already planned) · Token rotation UI · Per-row aborts in the ApisTab list (only Reclassify page covered in P21).

---

## [Unreleased] — feat/20-db-first-catalog (Phase 20)

### Feature — AI suggest panel adds Platform row + ApisTab dynamic platform filter (Phase 20)

**Branch**: `gvchaudhary22/lime` → `feat/20-db-first-catalog` (cut from `feat/19-curator-override`; rebases to main when Phase 19 amendment merges)
**aiplatformkb cross-link**: `BFRS-2/aiplatformkb` → `feat/20-db-first-catalog`
**Phase**: M1-P20 (consume the new platforms/agents tables on the Lime side)
**Tests**: 37 vitest pass on api-tools surface (10 reclassify + 12 drawer + 15 tabs); was 33 pre-Phase-20.

#### What shipped

**Reclassify page AI panel adds Platform row** (`src/app/chat/api-tools/reclassify/[id]/page.tsx`):
- Phase-19 amendment hid the persona row from the AI panel (no persona dropdown to fill); Phase 20 ADDS a Platform row because the LLM now picks a 4th enum.
- "Use suggestion" handler extended: fills `platformValue` from the suggestion (when suggested platform is in the allowed `platforms` array); triggers a `listAdminAgents(suggestedPlatform)` re-fetch since the platform-scoped agent list changes; preserves the suggestion's agent across the re-fetch.
- AI-recommended agent + platform now merged into the dropdown options at suggest-resolve so the curator can pick them directly without first clicking "Use suggestion".

**ApisTab dynamic platform filter** (`src/app/chat/api-tools/components/ApisTab.tsx`):
- Hardcoded `PLATFORMS` array DROPPED (the source of the `external_panel`-vs-`saral_platform` drift).
- Replaced with mount-time `listAdminPlatforms()` fetch, alive-guarded against component unmount.
- Filter now shows the live truth from the platforms table (14 values incl. `external_panel`, `srf_warehouse_platform`, `standard` which the prior hardcoded list missed).
- When the fetch fails, a fallback `<option>` for the currently-selected platform keeps the page interactive.

**Types** (`src/types/api-tools.ts`):
- `OperationSuggest.platform: string | null` (mirrors backend Wave-1D)
- `OperationSuggestCurrent.platform: string | null` (the row's current platform value in the suggest payload's `current` dict)

#### Auth + posture

All `/admin/*` calls continue to flow through the Lime server-side proxy (`src/app/api/aiplatformkb/admin/[...path]/route.ts`). The Phase-19-amendment auth-less posture (proxy forwards without an Authorization header when `AIPLATFORMKB_ADMIN_TOKEN` env is unset) is preserved.

#### Review residuals (TS axis)

`/tyrion:review 20` returned SHIP-CLEAR. 0 CRITICAL / 0 HIGH / 1 MED / 2 LOW.

- **TS20-M1** Use-suggestion `listAdminAgents` re-fetch lacks alive-guard → tracked Phase-21 (mirrors a pre-existing Phase-19 platform-onChange handler with the same pattern; sweep both with an AbortController).
- 2 LOWs WAIVED inline (sort spread mutation contained; `OperationSuggestCurrent.platform` schema parity).

Full disposition in `BFRS-2/aiplatformkb` `docs/plans/PHASE-20-REVIEW.md`.

#### Out of scope (deferred Phase 21)

- UI for managing platforms/agents tables (CRUD frontend) — backend endpoints exist; UI is Phase 21
- Bulk-multi-select reclassify
- Audit history for catalog changes

---

## [Unreleased] — feat/19-curator-override AMENDMENT (Phase 19 amendment)

### Amendment — Persona→Platform dropdown swap + dynamic agent dropdown + 🔒 platform lock badge

**Branch**: `gvchaudhary22/lime` → `feat/19-curator-override` @ `97605c9` (amendment HEAD)
**aiplatformkb cross-link**: `BFRS-2/aiplatformkb` → `feat/19-curator-override` @ `b1a1f5e`
**Phase**: M1-P19-amend — bundled into open PR #9 alongside the original Phase 19 commits

#### What the amendment added on top of original Phase 19

- **Reclassify page**: Persona dropdown REMOVED; **Platform dropdown** ADDED (sourced from `listAdminPlatforms()`); **Agent input → dropdown** sourced from `listAdminAgents(platform)` — re-fetches when platform changes and resets if the previous agent isn't in the new platform's list.
- **🔒 4th lock badge** in the See Details drawer for `platform_curated`.
- **Lime admin proxy** drops the 503 fail-closed when `AIPLATFORMKB_ADMIN_TOKEN` env is unset — auth-less by design (Phase 6 §2.5 posture).
- **Save body diff logic** tracks `platformChanged` instead of `personaChanged`. Use-suggestion path doesn't touch platform (suggest endpoint didn't return platform yet — Phase 20 fixes that).
- **Use-suggestion gracefully extends `agents` state** when the AI's suggested agent isn't already in the dropdown.

#### Tests: 33 vitest pass on api-tools surface

#### Review residuals (TS axis): SHIP-CLEAR; 1 MED tracked Phase-21 (alive-guard sweep), 2 LOWs WAIVED.

---

## [Unreleased] — feat/19-curator-override (Phase 19)

### Feature — Reclassify page + AI suggestion panel + 🔒 manual-override badges (Phase 19)

**Branch**: `gvchaudhary22/lime` → `feat/19-curator-override`
**aiplatformkb cross-link**: `BFRS-2/aiplatformkb` → `feat/19-curator-override`
**Phase**: M1-P19 — per-row Reclassify button on APIs tab + dedicated Reclassify page with real-time AI suggest + manual-override badges in the See Details drawer
**Tests**: 32 vitest pass on api-tools surface (8 new reclassify-page + 11 drawer including +1 lock-badge + 13 tabs including +1 Reclassify-button)

#### What shipped

**Per-row Reclassify button** (`src/app/chat/api-tools/components/ApisTab.tsx`):

```
[ ⋮⋮ ] POST  /api/v1/shipments/ndr/{id}/action  …  [ Details ] [ Reclassify ▶ ] [ visible ]
```

Wand2 icon, mirrors the Details button's drag-defense triad (`stopPropagation` + `preventDefault` + `onPointerDown`). Navigates via `next/navigation` `router.push` to the dedicated Reclassify page.

**Reclassify page** (`src/app/chat/api-tools/reclassify/[id]/page.tsx`):

```
┌─ AI suggestion ──────────────────────────────────────────┐
│  Module:  NDR                                            │
│  Agent:   ndr_resolver                                   │
│  Persona: seller                                         │
│  Reasoning: Path /api/v1/shipments/ndr/… and controller  │
│  ShipmentController@ndrAction indicate an NDR action.    │
│  [ Use suggestion ]                                      │
└──────────────────────────────────────────────────────────┘

Module:    [ Order             ▼ ]    🔒 manual override
Agent:     [ shipment_ops              ]
Persona:   [ seller            ▼ ]

[ Cancel ]              [ Save → ]
```

- Module dropdown is platform-scoped via Phase-17 `listAdminModules(platform)`
- Agent is free-text `<input maxLength={200}>`
- Persona is the fixed enum `{seller, icrm_agent, external, internal, partner}`
- AI panel renders with a spinner → content-or-fallback. **"Use suggestion"** button fills all 3 dropdowns from the LLM's picks. Hidden when `fallback === true`.
- 🔒 badge appears next to a field LABEL when the loaded `OperationDetails.<col>_curated === true`
- Save sends a **PATCH-style body** containing only the fields that differ from the current row — only those fields' lock flags flip to 1
- On Save success → `router.replace("/chat/api-tools?tab=apis&platform=<p>&module=<newOrCurrent>")`
- On Save failure → red banner with backend `detail` text
- alive-guard pattern (Phase 16 contract) preserved across the page's 3 parallel fetches (`getOperationDetails` + `getOperationSuggest` + `listAdminModules`)

**Drawer 🔒 manual-override badges** (`src/components/api-tools/OperationDetailsDrawer.tsx`):

`KV` extended with optional `badge?: ReactNode` prop. Lock badge renders next to module / agent / persona labels in the drawer's Classification section when the corresponding `*_curated === true`. Tooltip explains: "manual override — kb_populate won't re-classify this field". Lock icon from lucide-react.

**Client + types** (`src/lib/aiplatformkb-api.ts`, `src/types/api-tools.ts`):
- `setOperationClassification(id, body)` — PATCH-style payload `{module?, agent?, persona?}`
- `getOperationSuggest(id)` — returns `{module, agent, persona, current, reasoning, fallback}`
- 3 new fields on `OperationDetails`: `module_curated`, `agent_curated`, `persona_curated`

All `/admin/*` calls continue to flow through the Phase-13 Wave-1C server-side proxy.

#### Review residuals

`/tyrion:review 19` (TypeScript axis): 0 CRITICAL / 0 HIGH / 3 MEDIUM / 3 LOW.

3 MEDIUMs tracked Phase-20:
- TS19-M1: `OperationSuggestCurrent.module: string` over-tight vs backend `current: dict`
- TS19-M2: `cancel-button` testid on header back-link, not bottom Cancel button (both call `router.back()`)
- TS19-M3: `usedSuggestion` branching → WAIVED (double-gated by empty-string check + backend min_length=1)

Full disposition table in `BFRS-2/aiplatformkb` `docs/plans/PHASE-19-REVIEW.md`.

#### Out of scope (deferred)

Bulk multi-select reclassify · Reclassify history view · Undo / restore-LLM-default button · Cross-platform move · Browser-native persona enum dropdown styling.

---

## [Unreleased] — feat/16-api-tools-details (Phase 16)

### Feature — API Tools "See Details" drawer + visibility text + `api_usable` filter (Phase 16)

**Branch**: `gvchaudhary22/lime` → `feat/16-api-tools-details`
**aiplatformkb cross-link**: `BFRS-2/aiplatformkb` → `feat/16-api-tools-details`
**Phase**: M1-P16 (read-only drawer · single-source visibility text · 3-way usability filter)
**Tests**: 22 vitest pass on Phase-16 surface (10 drawer incl. new race case + 12 tabs unchanged); pre-existing 4 failing files (`dryrun`, `aiplatformkb-admin-proxy`, `api`, `build-health`, `components_extended`) confirmed unrelated by stash-and-rerun.

#### Drawer — `OperationDetailsDrawer.tsx`

New slide-from-right read-only drawer triggered by per-row "Details" button on `/chat/api-tools?tab=apis`. Pattern mirrors `ImpactDetailDrawer` (PR Feed):
- `role="dialog"` + `aria-modal` + `aria-labelledby`
- Escape key closes (document keydown listener, scoped to open state)
- Backdrop click closes; internal scroll for long descriptions
- Sibling-of-`SortableList` mount — drag state cannot leak into drawer

Sections rendered (top → bottom): Identity · Description · Classification · Routing & risk · Code provenance · ELK details · Visibility · Metadata. ELK section surfaces `hit_count_7d`, per-day breakdown table, per-index breakdown table, HTTP status breakdown chips, and an amber stale-banner when `refreshed_at` > 24 h ago (with copy-paste runbook command).

#### `api_usable` filter on the APIs tab

New 3-way `<select>` toolbar control labeled `api_usable` (alongside the existing "Show deprecated" checkbox):
- **All** (default) — no filter
- **Visible only** — `ai_platform_eligible_api === true`
- **Hidden only** — `ai_platform_eligible_api === false`

Filter operates on `localOps` at display time only — Save semantics unaffected. Empty-state copy adapts (`No <visible|hidden> operations in <platform/module> — change the api_usable filter to see others`). Drag reconciliation still maps against full `localOps`, so non-visible rows keep their relative positions during reorder.

#### Visibility text — single-source

New `src/lib/api-tools-copy.ts` exports:
- `VISIBILITY_EXPLAINER` — multi-line explanation rendered in the drawer's Visibility section
- `visibilityTooltip(eligible: boolean)` — short tooltip used on the per-row eligibility badge

Both surfaces reference the same constants — guarantees the visibility explanation never drifts between tooltip and drawer.

#### Review residuals (commit `c6cebff`)

`/tyrion:review 16` surfaced 0 CRITICAL / 2 HIGH (TS-H1, TS-H2) / 5 MEDIUM (TS-M1..M5) on TypeScript axis. All inline-fixable items landed:
- **TS-H1** — Refactored Retry handler to bump a `retryNonce` integer participating in the main `useEffect` dep array. Alive-guard teardown now applies equally to retry attempts. Eliminated the duplicate fetch codepath (was 22 LOC of mirrored logic outside the alive-guard, prone to overwriting newer operations' data on rapid Retry-then-switch).
- **TS-H2** — `Section` component prop typing tightened from `[key: string]: unknown` to `ComponentPropsWithoutRef<"section">`; restores compile-time validation of HTML attrs (e.g., `data-testid`).
- **TS-M3** — Added "alive-guard drops stale fetch when operationId changes mid-flight" race vitest. Re-mounts drawer with second id while first promise pending; asserts second op's content wins after first promise resolves.
- **TS-M5** — `Number.isFinite(code) && code >= 400` guard on parsed status code prevents NaN from being mis-classified as "success-color".

Tracked Phase-17 hardening (TS-M1 dead `value !== ""` collapse, TS-M4 `useMemo` wrap for sort, focus-trap, ElkBlock subcomponent extraction) — not blockers per consolidated review.

#### Auth

All `/admin/*` calls continue to flow through the Phase-13 Wave-1C server-side proxy (`src/app/api/aiplatformkb/admin/[...path]/route.ts`). Token never reaches the browser. No new auth surface.

#### Out of scope (deferred)

Edit-from-drawer · ELK refresh button · Mobile responsive · Sparkline rendering · Tool-membership chips · Auto-refresh while open · Source-file deep links · Kibana Discover deep links · i18n.

---

## [Unreleased] — feat/phase-13-pr-sync-trigger (Phase 13)

### Feature — Granular per-PR Sync UI on PR Feed (Phase 13)

**Branch**: `gvchaudhary22/lime` → `feat/phase-13-pr-sync-trigger`
**aiplatformkb cross-link**: `BFRS-2/aiplatformkb` → `feat/phase-13-rebased`
**Phase**: M1-P13 (granular per-PR sync UI · server-side admin proxy · 2s polling)
**Tests**: 71 vitest pass on Phase-12+13 surface (was 53; +18 Phase-13 additions: 7 client/hook + 6 list UI + 5 detail UI)

#### Server-side admin proxy (Wave 1C)
- New catch-all `src/app/api/aiplatformkb/admin/[...path]/route.ts`. Forwards GET/POST/PATCH/DELETE/PUT to upstream aiplatformkb `/admin/*` with `Authorization: Bearer <AIPLATFORMKB_ADMIN_TOKEN>` injected from server env. Token never reaches the browser. Strips client-supplied Authorization + Cookie. 503 fail-closed when env unset; 502 with safe message on upstream errors.
- Client `aiplatformkb-api.ts` routes `/admin/*` through the proxy prefix; public endpoints (`/api/v1/prs*`, `/api/v1/ai-platform/*`) stay direct.

#### Client (Wave 3A)
- `src/types/pr-sync.ts` — full type set (SyncLifecycleStatus enum, 7 request/response shapes).
- `src/lib/aiplatformkb-api.ts` — 7 new client functions: `discoverPrs`, `previewClassify`, `triggerClassify`, `previewPopulate`, `triggerPopulate`, `getPrSyncStatus`, `cancelPrSync`. All routed through Wave-1C proxy.
- `src/hooks/useSyncRowStatus.ts` — 2s polling hook (configurable `intervalMs`). Stops automatically when both classify_status AND populate_status reach terminal (done/failed/cancelled). Strict-mode-safe alive guard.

#### List page UI (Wave 3B)
- `RepoSyncButton` (header on `/chat/pr-feed`) — disabled until org+repo filter set. Triggers `discoverPrs`; refetches list on success.
- `PerRowSyncImpactsButton` (new "Sync" column in PrTable) — preview → confirm → polling. Cached_hit short-circuits straight into status badge.
- `SyncProgressInlineSummary` — terminal-state badges with $-formatted cost.
- Page integration: `refetchTick` state added to PR list `useEffect` deps; new column added to PrTable.

#### Detail page UI (Wave 3C)
- `RunPopulateButton` on `/chat/pr-feed/[prId]` — disabled until `classify_status='done'`; tooltip explains why; preview → confirm → trigger.
- `PopulateProgressBanner` — sticky-top while `populate_status='running'`; surfaces cumulative cost; Cancel button calls `cancelPrSync`.
- Page wires `useSyncRowStatus(prIdNum, 2000)` and renders banner + button beside the Phase-6 PR header card.

#### Env config
- `.env.local.example` adds `AIPLATFORMKB_ADMIN_TOKEN` (server-only, NOT NEXT_PUBLIC_) + optional `AIPLATFORMKB_URL` split-deploy override. Token mismatch with aiplatformkb upstream → all `/admin/*` calls return 401 (proxied through Lime).

#### Test infra
- 18 new vitest cases across 3 files. Pre-existing 4 failing test files (`dryrun`, `api`, `build-health`, `components_extended`) unchanged — out of scope per Phase-6 STATE.md.

#### Out of scope (deferred to v2)
- WebSocket / SSE replacement for 2s poll (sufficient at <5 active curators)
- "Sync All" batch button
- Cron-driven auto-sync from frontend

---

## [Unreleased] — feat/phase-12-api-tools (Phase 12)

### Feature — "API Tools" curation page (Phase 12)

**Branch**: `gvchaudhary22/lime` → `feat/phase-12-api-tools`
**aiplatformkb cross-link**: `BFRS-2/aiplatformkb` → `feat/phase-12-curation-admin` (Phase-6 governance pattern; PR cross-linked)
**Phase**: M1-P12 (curation admin frontend)
**Head commit**: `9134bc6`
**Tests**: 45 Phase-12 vitest cases pass (16 client + 4 page + 4 primitive + 9 tabs + 7 PR-Feed preserved + 5 cross-tests). Pre-existing Lime tech debt (4 failing files: `dryrun`, `api`, `build-health`, `components_extended`) unchanged — out of scope per Phase-6 STATE.md.
**TS errors in Phase-12 files**: 0 (overall 83 pre-existing TS errors in `admin/enforcement`, `simple-onboarding`, `lib/api.ts` remain — Lime main tech debt, out of scope).

#### Sidebar entry

- New main-nav item: `Wrench` icon · "API Tools" · `/chat/api-tools`. Inserted between PR Feed and Mappings.

#### Page — `/chat/api-tools` (Suspense-wrapped client component, app router)

- Header: Wrench icon + title + blurb explaining the page curates `/docs/ai-platform`.
- Tab strip: **Modules · APIs · Tools** (URL-synced via `?tab=modules|apis|tools`, default modules). `router.replace` (not push) so back/forward keep state.
- Three tab components (drag-and-drop + write-back + optimistic UI):
  - **ModulesTab** — drag rows to reorder; Save → POST `/admin/modules/reorder`; saves only when `dirty`.
  - **ApisTab** — platform + module selectors; drag rows to reorder; Save → POST `/admin/operations/reorder`; per-row eligibility toggle + per-row deprecated badge (when filter on); inline counts panel (extreme-left).
  - **ToolsTab** — split layout: status-filtered tools list (left) + selected-tool members (right). Drag-reorder members; "+ New tool" inline form; soft-archive button per row; per-member remove button. M:N supported — same api_id may belong to multiple tools, each with independent position.

#### Drag library (new dependency)

- `@dnd-kit/core` ^6.3.1, `@dnd-kit/sortable` ^10.0.0, `@dnd-kit/utilities` ^3.2.2 — ~50 KB combined, MIT, headless React-18-native. Replaces SortableJS (per Phase-12 plan v2).
- New primitive `src/components/primitives/SortableList<T>` — generic over any T, callback-based, keyboard-accessible (Tab/Space/Arrows free via `KeyboardSensor` + `sortableKeyboardCoordinates`).

#### API Tools tab — extreme-left counts panel + Show-deprecated filter

- Counts panel (Wave 3-LIME-D enhancement): "Platform N total · M active / K dep" + sibling Module column. Updates on platform change. Powered by new `GET /admin/operations/counts?platform=` endpoint.
- "Show deprecated" checkbox (default OFF). Display-only filter — `localOps` holds the full set; `visibleOps` is the filtered subset rendered to SortableList. Drag onReorder reconciles back into `localOps` so non-displayed (deprecated) rows keep their relative positions.
- Per-row red `DEPRECATED` badge when toggled on (tooltip distinguishes curator-set vs ELK-derived deprecation source). `opacity-60` styling on deprecated rows.

#### Per-row eligibility toggle (visible/hidden on `/docs/ai-platform`)

- Eye / EyeOff badge on right side of each operation row in the APIs tab.
- Click flips `ai_platform_eligible_api`; optimistic UI flips both local + server snapshots so the row reflects state immediately and the Save-order button isn't dirty-marked. Rolls back on error.

#### Auth-less convention preserved

- 2 explicit tests assert no `Authorization` header attached on GET or POST. `jsonRequest` structurally identical to `getJson` so neither path can attach one.
- `jsonRequest` correctly conditionalizes `Content-Type` on `body !== undefined`. DELETE without body sends no Content-Type — spec-correct + matches CORS contract.

#### Type extensions

- `src/types/api-tools.ts` (NEW) — full type set: `AdminModule`, `AdminOperation` (incl. eligibility/deprecation flags), `AdminTool`, `ToolMember`, `ToolStatus`, `OperationCountsResponse`, etc.
- `AdminOperation` shape: `{id, http_method, path, display_order, tool_name, hit_count_7d, ai_platform_eligible_api, read_write_type, risk_level, deprecated, elk_deprecated_api}`.

#### Test infrastructure

- Reuses `FakeConnection` / `FakeCursor` pattern from `aiplatformkb-api.test.ts`.
- `WriteFakeConnection` subclass with `commits` / `rollbacks` counters for write-path correctness verification.
- Explicit `cleanup()` in `afterEach` for tab-component tests (vitest setup doesn't auto-cleanup).

#### Review residuals (all inline-fixed)

TypeScript reviewer pass: 0 CRIT / 2 HIGH / 5 MED / 7 LOW.

- TS H1: ApisTab stale-closure on initial-mount module pick → functional updater `setModuleName((cur) => cur || rows[0]?.module_name || "")`.
- TS H2: ApisTab + ToolsTab async-mount memory-leak risk → `let alive = true` pattern propagated from ModulesTab to all 3 useEffects.
- TS L7: ToolsTab stale-closure on `selected` → `setSelected((cur) => cur ?? rows[0]?.id)`.

Deferred per reviewer: M2-M5 + L1-L6 polish items (window.confirm replacement, URL-persist platform/module/tool, SortableList split-handle API, a11y Announcements, etc.).

---
