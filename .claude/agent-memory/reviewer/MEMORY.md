# Frontend Reviewer Memory

## Universal Checklist
1. `npm run build` clean
2. `"use client"` on all pages
3. No raw `fetch()` — use `api.ts`
4. TypeScript strict mode clean
5. Auth guard present
6. Design system adherence
7. Loading/error states

## Blast Radius

| File | Impact |
|------|--------|
| `src/lib/api.ts` | All API calls |
| `src/lib/stream.ts` | All SSE streaming |
| `Sidebar.tsx` | All navigation |
| `layout.tsx` | Root layout |
| `globals.css` | All styles |

## Branch Policy
- PRs target `main` branch
- `npm run build` must pass before merge
