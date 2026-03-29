---
name: review-pr
description: Review a frontend pull request
user_invocable: true
---

# Frontend PR Review

## Checklist

1. **Build**: `npm run build` passes
2. **Directive**: All pages have `"use client"`
3. **API client**: No raw `fetch()`, all through `api.ts`
4. **Types**: Response interfaces exported and correct
5. **Auth**: Token check present in new pages
6. **Design**: Follows dark theme design system
7. **Icons**: Using Lucide React, correct sizes
8. **Loading**: Spinner shown during async operations
9. **Errors**: Error states handled (no blank screens)
10. **Sidebar**: Link added for new pages
11. **Cleanup**: No console.log left in production code
12. **Accessibility**: Buttons have labels, images have alt text
