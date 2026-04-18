# Roomtastic Frontend

Next.js App Router frontend for Roomtastic.

## Stack

- Next.js 16 (App Router)
- React 19 + TypeScript
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
  app/                       # Routes (App Router)
    page.tsx                 # Landing
    lab/                     # Image→depth lab route
    upload/                  # Upload route
    rooms/                   # Room list/detail/edit routes
    api/                     # Next.js route handlers
  components/
    ui/                      # Reusable primitive UI components (shadcn target)
    features/
      home/                  # Home/landing feature components
      lab/                   # Image/depth lab feature components
    room-editor/             # Room editor feature modules
    mock-models-preview/     # Mock preview feature modules
  lib/                       # API clients and shared utilities
  public/                    # Static assets
  types/                     # Global type declarations
```

## Component Organization Rules

1. Put reusable primitives in `components/ui/`.
2. Put feature-specific components in `components/features/<feature-name>/`.
3. Keep route files in `app/` thin:
- Page files should compose feature components.
- Business logic should live in `lib/` or feature hooks.
4. Keep 3D editor modules in `components/room-editor/` unless they are truly reusable across features.

## Shadcn UI Adoption Guide

This repo is prepared for shadcn-style abstraction.

### Recommended Layout

- `components/ui/*`:
  - shadcn base components (Button, Input, Dialog, Sheet, Form, etc.)
- `components/features/*`:
  - compositions of ui primitives + feature logic
- `lib/`:
  - API wrappers, helpers, adapters

### Install (when ready)

```bash
cd frontend
npx shadcn@latest init
```

Recommended answers:

- TypeScript: yes
- Tailwind: yes
- Components path: `components/ui`
- Utils path: `lib/utils.ts`

Then add components as needed, for example:

```bash
npx shadcn@latest add button input form dialog sheet tabs
```

### Usage Pattern

- Use `components/ui` for visual primitives.
- Wrap/compose in feature components instead of importing shadcn directly in every page.
- Keep form schemas and validation near feature boundaries, not inside primitives.

## Forms and Reuse Pattern

Suggested convention:

```text
components/features/auth/
  LoginForm.tsx
  RegisterForm.tsx
  auth.schema.ts
  auth.actions.ts
```

- `*.schema.ts`: zod schemas and types
- `*.actions.ts`: API mutations
- `*Form.tsx`: UI composition using `components/ui`

## API Integration Notes

- Use `lib/api.ts` for HTTP client setup.
- Keep route-specific payload/response types in `lib/roomApiTypes.ts` or feature-local types.
- Avoid hardcoding backend URLs in components; prefer env-driven clients.

## Conventions

- Use absolute imports via `@/`.
- Keep files focused and feature-local.
- Prefer composition over deeply nested prop drilling.
- Add reusable UI only after a second real use case.
