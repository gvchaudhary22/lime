# Verification Before Completion — Lime

Run this 30-60 second checklist before marking any Lime task done. Catches missing
types, broken builds, and auth regressions before Goal Manager review.

## Build gate (MANDATORY — blocks done)

```
[ ] npm run build → zero errors
[ ] All expected pages appear in build output
[ ] Zero TypeScript errors (strict mode)
```

## API contract (MANDATORY for api.ts changes)

```
[ ] New interface exported from api.ts
[ ] Response shape matches actual backend JSON (check the Go handler)
[ ] Method added to `api` object — not a standalone exported function
[ ] All `res.success && res.data` checks handle null/undefined data gracefully
```

## Page structure (MANDATORY for new pages)

```
[ ] "use client" at top of file
[ ] Auth guard in useEffect: checks mars_token, redirects to "/" if missing
[ ] Loading state: Loader2 spinner shown while fetching
[ ] Error state: user-readable message displayed on failure
[ ] Sidebar component imported and rendered in layout
[ ] Page added to CLAUDE.md page list with correct path and purpose
```

## State and storage

```
[ ] No new localStorage keys introduced outside: mars_token, mars_user,
    mars_active_project, mars_sso_context
[ ] State uses useState only — no external state libraries
[ ] SSE streams go through src/lib/stream.ts, never raw EventSource
[ ] All API calls go through src/lib/api.ts, never raw fetch()
```

## Anti-rationalization guard

Stop and complete the checklist if you find yourself thinking:
- "npm run build will probably pass" → run it
- "The type looks right from context" → check the actual backend handler response
- "It's a small component, auth guard isn't needed" → every page needs it
- "I'll update CLAUDE.md after" → update it now, the agent will catch it otherwise

## Difference from the completion gate

Rule 6 (completion gate) is enforced by the Goal Manager **after** you say done.
This checklist is self-enforced **before** you say done.
Running this means the Goal Manager almost never sends work back.
