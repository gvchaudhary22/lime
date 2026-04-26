# Changelog — Lime

All notable changes to the Lime frontend (Shiprocket internal operator UI) are documented here.

Format: [Semantic Versioning](https://semver.org/) — `v{milestone}.{phase}` aligning with the cross-repo `BFRS-2/aiplatformkb` phase numbering.

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
