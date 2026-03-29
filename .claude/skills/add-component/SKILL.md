---
name: add-component
description: Scaffold a new React component
user_invocable: true
---

# Add Component

Create a new reusable React component.

## Steps

1. **Choose location**:
   - Shared: `src/components/{category}/{ComponentName}.tsx`
   - Page-specific: co-locate with page file
2. **Create component file** with TypeScript interface for props
3. **Follow design system** (dark theme colors, Tailwind classes)
4. **Use Lucide React** for icons
5. **Export** as default or named export
6. **Import and use** in target page
7. **Run `npm run build`** — must pass
