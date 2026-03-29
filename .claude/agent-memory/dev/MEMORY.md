# Frontend Dev Memory

## Key File Locations

| Task | File |
|------|------|
| API client + types | `src/lib/api.ts` |
| SSE streaming | `src/lib/stream.ts` |
| Sidebar navigation | `src/components/layout/Sidebar.tsx` |
| Auth layout | `src/components/auth/AuthLayout.tsx` |
| Root layout | `src/app/layout.tsx` |
| Global styles | `src/app/globals.css` |

## Pages (13 total)

| Page | Path | Description |
|------|------|-------------|
| Sign In | `/` | Login form |
| Set Password | `/set-password` | Registration |
| Chat List | `/chat` | Conversation list |
| Chat Detail | `/chat/[id]` | SSE streaming chat |
| Projects | `/chat/projects` | Project management |
| Project Detail | `/chat/projects/[id]` | Project config + governance |
| Auto-Onboard | `/chat/onboard` | GitHub OAuth + Manual URL onboarding |
| Onboard Progress | `/chat/onboard/[pipelineId]` | Pipeline progress |
| Tickets | `/chat/tickets` | Ticket list |
| Ticket Detail | `/chat/tickets/[id]` | Ticket phases, analysis, Q&A |
| Jira | `/chat/jira` | Jira dashboard |
| Learning | `/chat/learning` | Learning records, patterns, proposals |
| Mappings | `/chat/mappings` | Project-Jira mappings |
| Infra | `/chat/infra` | Infrastructure propagation |

## Confirmed Patterns
- All pages are client components (`"use client"`)
- API base URL from env: `NEXT_PUBLIC_API_URL` (default: `http://localhost:8080`)
- Auth token stored in `localStorage` key `mars_token`
- Build command: `npm run build` (requires Node.js 20+, use `nvm use 20`)
