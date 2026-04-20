# Roomtastic Frontend

Next.js App Router frontend for Roomtastic.

## Stack

- Next.js 16 (App Router)
- React 19 + TypeScript
- TanStack Query (server-state fetching/caching)
- Tailwind CSS v4
- Three.js + React Three Fiber + Drei

## Run

```bash
cd frontend
npm install
npm run dev
```

Build check:

```bash
npm run build
```

## Frontend Structure

```text
frontend/
  app/                                # Routes (App Router)
    page.tsx                          # Landing
    login/                            # Auth login page
    register/                         # Auth register page
    rooms/                            # Room list/detail/edit routes
    query-provider.tsx                # App-level TanStack Query provider
  components/
    features/
      home/                           # Landing feature components
      room-editor/                    # 3D editor scene + domain modules
  hooks/                              # Query + feature hooks (TanStack Query wrappers)
  services/                           # API domain services (rooms/auth/etc.)
  lib/                                # Core clients/helpers (apiClient, auth, low-level utils)
  types/                              # Shared API/domain TypeScript types
  utils/                              # Generic cross-feature helpers
  public/                             # Static assets
  types/*.d.ts                        # Global type declarations
```

## Component Organization Rules

1. Put feature-specific components in `components/features/<feature-name>/`.
2. Keep route files in `app/` thin.
3. Put request orchestration in `hooks/` and `services/`.
4. Keep low-level clients/auth helpers in `lib/`.
5. Keep shared response/request types in `types/api.ts`.
6. Keep room editor domain modules under `components/features/room-editor/`.

## Data Fetching

- Use TanStack Query for page-level server state (`useQuery`, `useMutation`, `useQueries`).
- Keep `apiFetch` in `lib/apiClient.ts` as the shared HTTP transport.
- Put endpoint wrappers in `services/*` and hook wrappers in `hooks/*`.
- Use query keys scoped by entity, for example: `rooms`, `room`, `room-furniture`.

## API Integration Notes

- Use `lib/apiClient.ts` for HTTP client setup.
- Keep route-specific payload/response types in `types/api.ts`.
- Avoid hardcoding backend URLs in components; prefer env-driven clients.

## Conventions

- Use absolute imports via `@/`.
- Keep files focused and feature-local.
- Prefer composition over deeply nested prop drilling.
- Add reusable UI only after a second real use case.
