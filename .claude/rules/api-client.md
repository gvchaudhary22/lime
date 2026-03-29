# Lime API Client Rules

## Single Source of Truth
All API calls MUST go through `src/lib/api.ts`. Never use raw `fetch()`.

## Adding a New API Method

1. Define the response interface (export it):
```tsx
export interface NewTypeResponse {
  id: string;
  name: string;
  // ... fields matching backend JSON
}
```

2. Add method to the `api` object:
```tsx
getNewThing: (id: string) =>
  request<NewTypeResponse>(`/api/v1/things/${id}`),

createNewThing: (data: { name: string }) =>
  request<NewTypeResponse>("/api/v1/things", {
    method: "POST",
    body: JSON.stringify(data),
  }),
```

## Response Envelope
Backend always returns:
```json
{ "success": true, "data": { ... } }
// or
{ "success": false, "error": "message" }
```

The `request<T>()` function handles this envelope. Callers check:
```tsx
const res = await api.method();
if (res.success && res.data) {
  // use res.data (typed as T)
}
```

## Auth Token
Automatically injected from `localStorage.getItem("mars_token")` by `request()`.
No manual header management needed.

## Base URL
Configurable via `NEXT_PUBLIC_API_URL` env var. Defaults to `http://localhost:8080`.
