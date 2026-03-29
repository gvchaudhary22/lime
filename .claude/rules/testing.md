# Lime Testing Rules

## Build Verification (Required)
- `npm run build` must pass with zero errors before any PR
- Check page count in build output matches expected (currently 13 pages)
- All static pages must generate successfully
- No TypeScript compilation errors

## Completion Gate
1. `npm run build` → ALL PAGES GENERATED
2. No TypeScript errors (strict mode)
3. New pages appear in build output
4. Sidebar link added for new pages
5. API types match backend response shapes

## Test Patterns
- Test files: `src/__tests__/` directory
- API mock: mock `fetch` at the `api.ts` level
- Component: verify render output and user interactions
