---
name: add-page
description: Scaffold a new Next.js App Router page
user_invocable: true
---

# Add Page

Scaffold a new page in the Lime frontend.

## Steps

1. **Create page file**: `src/app/chat/{name}/page.tsx`
2. **Add `"use client"` directive** as first line
3. **Import standard dependencies**: React hooks, useRouter, Lucide icons, Sidebar, api
4. **Add auth guard** in useEffect (check mars_token, redirect to `/`)
5. **Follow page template** from component-patterns rule
6. **Add API types** to `src/lib/api.ts` if new endpoints needed
7. **Add API methods** to `src/lib/api.ts`
8. **Add sidebar link** in `src/components/layout/Sidebar.tsx`:
   - Import icon from lucide-react
   - Add to `mainNav` array
9. **Run `npm run build`** — must pass
10. **Verify** page appears in build output
