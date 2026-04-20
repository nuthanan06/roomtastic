# Frontend Architecture

## Layers

1. **Route layer** (`frontend/app/*`): page composition and navigation only.
2. **Feature layer** (`frontend/components/features/*`): feature orchestration and state.
3. **Hook layer** (`frontend/hooks/*`): query wrappers and feature hook glue.
4. **Service layer** (`frontend/services/*`): endpoint/domain service functions.
5. **Provider layer** (`frontend/app/query-provider.tsx`): app-level provider wiring (React Query).
6. **Core/util layer** (`frontend/lib/*`, `frontend/utils/*`, `frontend/types/*`): clients, helpers, shared types.

## Current Folder Map

```text
frontend/
  app/
    page.tsx
    login/page.tsx
    register/page.tsx
    rooms/page.tsx
    rooms/[roomId]/page.tsx
    rooms/[roomId]/edit/page.tsx
    query-provider.tsx
  components/
    features/home/LandingHome.tsx
    features/room-editor/*
  hooks/
    useRoomQueries.ts
  services/
    auth.ts
    rooms.ts
  lib/
    apiClient.ts
    auth.ts
    utils.ts
  types/
    api.ts
    *.d.ts
  utils/
    errors.ts
    ...
```

## Data Flow

```text
app route
  -> hooks/* query wrapper
  -> services/* domain call
  -> lib/apiClient.ts (apiFetch)
  -> backend /api endpoints
```

## Room Editor Domain

Room editor is a cohesive feature under `frontend/components/features/room-editor/`.

Key modules:

- `RoomEditorClient.tsx`: state orchestration + sidebars + save flow.
- `EditorScene.tsx`: Three.js scene graph and interactions.
- `collision.ts`: placement, collision, support-surface, and transform guards.
- `grouping.ts`: parent/child grouping and cycle checks.
- `placement.ts`: backend furniture <-> in-editor placement adapters.

## Query Guidelines

- Use entity-scoped query keys (`rooms`, `room`, `room-furniture`, `inventory`).
- Use `enabled` flags for auth-gated queries.
- Keep optimistic updates minimal until backend ownership/auth rules settle.

## Boundaries

- `app/*` should not own deep business logic.
- Prefer moving cross-page fetch/state logic into `hooks/*` and `services/*`.
- Keep room-editor math/collision/grouping in dedicated `.ts` modules, not page files.
