# Lime Coding Conventions

## File & Folder Naming
- Files/folders: `kebab-case` (e.g., `chat-stream.tsx`, `auth-layout.tsx`)
- Exception: `page.tsx`, `layout.tsx` (Next.js conventions)

## TypeScript
- Components: `PascalCase` (e.g., `ChatStreamHandler`, `Sidebar`)
- Hooks: `camelCase` with `use` prefix (e.g., `useRouter`)
- API methods: `camelCase` (e.g., `api.getInfraStatus()`)
- Interfaces: `PascalCase` (e.g., `InfraUpdateResponse`)
- Export interfaces from `api.ts` for reuse

## React Patterns
- All pages: `"use client"` directive (first line)
- State: `useState` + `useEffect` (no external state libraries)
- Auth guard in every page's `useEffect`:
  ```tsx
  useEffect(() => {
    const token = localStorage.getItem("mars_token");
    if (!token) { router.push("/"); return; }
    // fetch data...
  }, [router]);
  ```

## API Client
- All HTTP calls through `src/lib/api.ts` — NEVER use raw `fetch()`
- Response shape: `ApiResponse<T>` with `success`, `data`, `error` fields
- Pattern: `const res = await api.method(); if (res.success && res.data) { ... }`

## localStorage Keys
- `mars_token` — auth session token
- `mars_user` — serialized user object
- `mars_active_project` — current project ID

## Imports
- Use `@/` path alias (e.g., `@/lib/api`, `@/components/layout/Sidebar`)
- Group: React → Next.js → Lucide icons → Components → API/lib
