# LIME — MARS Frontend (Next.js)

## Overview

Lime is the web frontend for MARS (Multi-repo AI Resolution System). It provides a ChatGPT/Claude-like conversational interface for Shiprocket engineers to interact with the AI gateway.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Icons**: Lucide React
- **Backend**: MARS Go API at `http://localhost:8080`

## Project Structure

```
lime/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── layout.tsx          # Root layout
│   │   ├── globals.css         # Global styles + Tailwind
│   │   ├── page.tsx            # Sign In page (/)
│   │   └── set-password/
│   │       └── page.tsx        # Set Password page (/set-password)
│   ├── components/
│   │   └── plan/
│   │       └── CrossPlatformReview.tsx  # v12.0 cross-platform review UI
│   │   └── auth/
│   │       ├── AuthLayout.tsx  # Shared auth page layout (branding + form)
│   │       └── AnimatedBackground.tsx  # Canvas-based animated background
│   └── lib/
│       └── api.ts              # API client for MARS backend
├── CLAUDE.md                   # This file
├── next.config.js              # Next.js config
├── tailwind.config.ts          # Tailwind config (if needed)
├── postcss.config.js           # PostCSS with Tailwind plugin
├── tsconfig.json               # TypeScript config
└── package.json                # Dependencies and scripts
```

## Commands

```bash
npm run dev       # Start dev server (port 3000)
npm run build     # Production build
npm run start     # Start production server
npm run lint      # Run ESLint
```

## Auth Flow

1. User visits `/` → Sign In page
2. If invited user → clicks "Set your password" → `/set-password`
3. Set password page calls `POST /auth/register` with email + password
4. Sign in page calls `POST /auth/login` with email + password
5. Token stored in `localStorage` as `mars_token`
6. Authenticated requests use `Authorization: Bearer <token>`

## Backend API (MARS)

- `POST /auth/check-email` — Check if email is registered or has pending invite
- `POST /auth/login` — Sign in with email + password → returns token
- `POST /auth/register` — Set password for invited user → returns token
- `POST /auth/logout` — Invalidate session

## Environment Variables

Set in `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8080
```

## Design System

- **Theme**: Dark mode (bg: `#060b18`, cards: `#0a0f1e`)
- **Accent**: Sky blue gradient (`sky-400` → `blue-600`)
- **Inputs**: Glassmorphism style with `bg-white/[0.05]` and subtle borders
- **Buttons**: Gradient sky-to-blue with glow shadows
- **Typography**: System fonts, clean spacing

## Pages (v2.0)

| Page | Path | Purpose |
|------|------|---------|
| Sign In | `/` | Login page |
| Set Password | `/set-password` | Invite-based registration |
| Chat Home | `/chat` | New conversation with project + mode selector |
| Chat Session | `/chat/[id]` | Streaming chat with Claude (SSE) |
| Projects List | `/chat/projects` | All projects grid |
| Project Detail | `/chat/projects/[id]` | Settings, files, services, governance tab |
| Onboard | `/chat/onboard` | GitHub repo onboarding pipeline with branch selection |
| GitHub Callback | `/chat/github/callback` | OAuth callback handler |
| Learning | `/chat/learning` | Learning dashboard (records, patterns, proposals) |
| **Tickets** | **`/chat/tickets`** | **Ticket list with status, phase, priority badges** *(NEW in v2.0)* |
| **Ticket Detail** | **`/chat/tickets/[id]`** | **Phase progress, analysis display, approval buttons, cross-platform review** *(v2.0 + v12.0)* |
| **Mappings** | **`/chat/mappings`** | **Project mapping CRUD, dependency graph** *(NEW in v2.0)* |
| **Manual Onboard** | **`/chat/onboard` (Manual URL tab)** | **6-step wizard for repo URL onboarding** *(NEW in v6.0)* |
| **Infra Propagation** | **`/chat/infra`** | **Infrastructure propagation dashboard — version status, per-repo propagation state, trigger updates** *(NEW)* |
| **Organizations** | **`/chat/organizations`** | **Organization management** |
| **Teams** | **`/chat/teams`** | **Team management — list, create, detail (members + modules), RBAC roles** *(NEW in v21.0)* |
| **Knowledge** | **`/chat/knowledge`** | **Knowledge base — repo KB (canonical + materialized), module KB (6 sections), contributions** *(NEW in v21.0)* |
| **Manager** | **`/chat/manager`** | **Manager review panel — pending PR learning reviews, bundle review with approve/reject/edit** *(NEW in v21.0)* |

## v1.1 Features

- **Chat Modes**: Debug, Feature, RCA, Refactor, Docs — mode selector pills on chat pages
- **Governance Tab**: Context readiness badge, backend health validation, capabilities list, budget progress bar
- **Learning Dashboard**: Incident records, pattern detection, improvement proposals with voting
- **SSE Streaming**: `src/lib/stream.ts` — supports `mode` parameter, handles tool_use/heartbeat events

## v3.0 Features

- **Prompt Refinement Toggle**: "Refine on/off" toggle next to detailed view. When enabled, prompts are refined with project context before execution. Shows side-by-side original vs refined with Approve/Modify/Skip actions.
- **Branch Name Input**: For `feature` and `refactor` modes, shows a branch name input with non-editable `-E-MARS` suffix.
- **Multi-Project Dispatch View**: Ticket detail page shows dispatch groups with per-repo status (pending/running/completed/failed), batch ordering, and parallel indicators.


## v12.0 Features

- **Cross-Platform Review UI**: Ticket detail page shows cross-platform review section when a plan exists for the ticket
- **CrossPlatformReview Component**: `src/components/plan/CrossPlatformReview.tsx` — self-contained component for triggering reviews, viewing platform results, consensus summary, and override
- **Consensus Display**: Agreement score bar, common recommendations, conflicts with per-platform positions, risk union with severity
- **Override Modal**: Admin users can override consensus decisions with a reason (recorded in audit trail)
- **Platform Review Cards**: Per-platform status, latency, verdict, confidence, parsed recommendations

## v15.0 Features

- **Chat-Ready Projects**: Chat page uses `getChatReadyProjects()` so only projects with a verified QA env URL appear in the project dropdown
- **QA Env Verification Badge**: Project cards on `/chat/projects` show a green check (verified) or yellow alert (unverified) badge for QA env status
- **QA Environment Settings**: Project detail page (`/chat/projects/[id]`) Settings tab includes a QA Environment URL section with verify & save button
- **Create Project QA URL**: Create project modal Step 1 includes an optional QA env URL input field
- **Project Interface Update**: `Project` type in `api.ts` now includes `qa_env_url`, `qa_env_verified`, `repository_id`

## v17.0 Features

- **Analysis Review Step**: 7-step wizard (was 6) — new "Review" step between Analysis and Roles shows analysis confidence score, detection results, warnings, and role recommendations
- **Confidence Score Display**: Progress bar with color coding (green >= 70%, yellow >= 40%, red < 40%)
- **Analysis Warnings**: Yellow warning panel listing analysis quality issues
- **Role Recommendations**: Policy-driven role suggestions with status badges (required, recommended, optional, blocked) and lock indicators
- **Cancel Pipeline**: Red cancel button on analysis review step — calls `cancelPipeline()` and redirects to onboard page
- **Approve Analysis**: Blue approve button advances from `analysis_review` to `role_selection` phase
- **Onboarding PR URL**: Completion step shows link to the onboarding PR when available
- **New Types**: `RoleRecommendation` interface, extended `ManualOnboardingResponse` with v17 fields

## API Client

All API calls go through `src/lib/api.ts` — never call `fetch` directly in components.

v1.1 additions (14 new methods):
- Health: `validateHealth`, `getReadiness`, `setBackendURL`
- Capabilities: `getCapabilities`, `setCapabilities`
- Decisions: `getDecisions`
- Learning: `getLearningRecords`, `createLearningRecord`, `getPatterns`, `detectPatterns`, `getProposals`, `voteProposal`, `updateProposalStatus`

v2.0 additions (17 new methods):
- Tickets: `getTickets`, `getTicket`, `analyzeTicket`, `getTicketStatus`, `approveTicketPhase`, `getTicketAnalysis`
- Mappings: `getMappings`, `createMapping`, `deleteMapping`, `getDependencies`
- Plans: `getPlan`, `listPlans`, `approvePlan`, `rejectPlan`
- Executions: `getExecution`, `listExecutions`
- Notifications: `getNotifications`

v3.0 additions (3 new methods):
- Prompt Refinement: `refinePrompt`, `approveRefinement`
- Dispatch Groups: `getDispatchGroups`

v6.0 additions (8 new methods):
- Manual Onboarding: `startManualOnboarding`, `configureBranches`, `runManualAnalysis`, `getManualAnalysisResult`, `selectRoles`, `generateAndPush`, `getManualOnboardingStatus`, `finalizeManualOnboarding`

v17.0 additions (2 new methods):
- Hardened Onboarding: `approveAnalysis`, `cancelPipeline`

Infra Propagation additions (6 new methods):
- Infra: `getInfraVersion`, `getPropagationStatus`, `triggerInfraUpdate`, `retryPropagation`, `getRepoPropagationState`, `dismissPropagation`


v12.0 additions (4 new methods):
- Cross-Review: `triggerCrossReview`, `getCrossReview`, `getConsensus`, `overrideConsensus`

v15.0 additions (2 new methods):
- QA Env: `getChatReadyProjects`, `updateQaEnvUrl`
## Key Types (api.ts)

Infra Propagation types:
- `InfraVersionResponse` — current infra version metadata
- `PropagationStatusResponse` — overall propagation status across repos
- `RepoPropagationState` — per-repo propagation state (version, status, last updated)
- `InfraUpdateResponse` — result of triggering an infra update


v12.0 types:
- `PlatformReview` — individual AI platform review record (status, latency, parsed output)
- `ConsensusResult` — merged consensus from multi-platform reviews (score, decision, common/conflicts/risks)
- `CrossReviewResult` — combined response from trigger endpoint (reviews + consensus)
- `PlanRecommendation` — actionable recommendation (area, action, priority, reason)
- `PlanRisk` — identified risk (description, severity, mitigation)
- `ConflictItem` — platform disagreement on same area
- `PlatformOutput` — parsed AI platform output (verdict, recommendations, risks, confidence)

v15.0 types:
- `Project` interface updated — added `qa_env_url`, `qa_env_verified`, `repository_id` fields

v17.0 types:
- `RoleRecommendation` — policy engine role recommendation (role_name, display_name, status, reason, locked)
- `ManualOnboardingResponse` updated — added `analysis_confidence`, `analysis_warnings`, `role_recommendations`, `onboarding_pr_url`

## Architecture Rules

- All pages are client components (use `"use client"` directive)
- API calls go through `src/lib/api.ts` — never call `fetch` directly in components
- SSE streaming goes through `src/lib/stream.ts` — never use raw EventSource
- Auth token management is in `localStorage` (key: `mars_token`)
- User info in `localStorage` (key: `mars_user`)
- Active project in `localStorage` (key: `mars_active_project`)
- Shared layouts go in `src/components/`
- Page-specific components co-locate with the page
- `npm run build` must pass with zero errors before declaring done
- Before marking any task done, run `.claude/rules/verification-before-completion.md` checklist

## v21.0 Features

- **Teams Page** (`/chat/teams`): Full team management — list teams with status badges, create teams with org selector and auto-generated slugs, detail view showing members (color-coded roles: manager/developer/tester/tech_support/fresher), module assignments with ownership icons (primary/secondary/reviewer), add/remove members, delete team
- **Knowledge Page** (`/chat/knowledge`): Three-tab knowledge base — Repo KB tab (canonical content editor with save, materialized summary with regenerate), Modules tab (list with confidence badges, detail showing 6 sections: purpose/entrypoints/apis_events/db_touchpoints/failure_patterns/learnings + routing summary), Contributions tab (filterable by status, approve/reject actions for pending)
- **Manager Panel** (`/chat/manager`): PR learning review workflow — toggle between pending and my reviews, repo selector, click pending review to open PR Learning Bundle grouped by module, approve/reject/edit per contribution, overall feedback textarea, submit review
- **Sidebar Updates**: Added Teams, Knowledge, Manager navigation items with `Users`, `BookOpen`, `ClipboardCheck` icons

v21.0 additions (30+ new methods):
- Teams: `listTeams`, `getTeam`, `createTeam`, `updateTeam`, `deleteTeam`, `addTeamMember`, `removeTeamMember`, `updateTeamMemberRole`, `assignTeamModule`, `unassignTeamModule`, `listTeamModules`, `getMyTeams`, `listTeamsByRepo`
- Repo Knowledge: `getRepoKnowledge`, `updateCanonical`, `getCanonicalHistory`, `regenerateMaterialized`, `getAllRepoSummaries`
- Module Knowledge: `listModuleKnowledge`, `getModuleKnowledge`, `getModuleKnowledgeHistory`
- Contributions: `createContribution`, `listContributions`, `getMyContributions`, `listContributionsByPR`, `reviewContribution`
- Manager: `getPendingReviews`, `getPRLearningBundle`, `submitPRReview`, `getMyReviews`

v21.0 types:
- `Team`, `TeamMember`, `TeamModule`, `TeamDetail` — team hierarchy
- `RepositoryKnowledge`, `RepoKnowledgeSnapshot` — repo-level knowledge
- `ModuleKnowledge`, `KnowledgeContribution` — module-level knowledge + contributions
- `PRLearningReview`, `PRLearningBundle` — manager review workflow
- `Organization` — organization entity

## v18.1 Features

- **Onboarding Status Bar**: Project detail page (`/chat/projects/[id]`) shows real-time onboarding pipeline progress bar with phase, percentage, status badge (running/completed/failed)
- **Checkpoint Timeline**: Visual timeline of each onboarding step (branch_config, analyzing, analysis_review, role_selection, generating, pushing, integrating, completed)
- **Error Display**: Failed pipelines show error message and affected step with force-unlock button
- **Auto-Polling**: Status bar polls every 5 seconds when pipeline is running, stops when completed/failed
- **Files Generated Count**: Shows number of files generated during onboarding

v18.1 additions (2 new methods):
- Pipeline Status: `getOnboardingStatus`, `retryOnboarding`

v18.1 types:
- `OnboardingStatusResponse` — pipeline status with progress %, phase, checkpoints, error messages
- `CheckpointInfo` — individual checkpoint (name, status, started_at, completed_at)
- `Project` interface updated — added `onboarding_pipeline_id` field
