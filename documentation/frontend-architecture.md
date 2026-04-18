# Frontend Architecture

## Layers

1. **Route layer** (`app/*`): page composition only, minimal logic.
2. **Feature layer** (`components/features/*`): full features with state, API calls, orchestration.
3. **Composite layer** (`components/composite/*`): reusable multi-primitive components (no feature business logic).
4. **UI primitives layer** (`components/ui/*`): shadcn components only.
5. **Service/util layer** (`lib/*`, `services/*`): API clients, hooks, utilities, domain logic.

## Boundaries

- Features import from: `components/composite`, `components/ui`, `lib/*`, `services/*`
- Composite components import from: `components/ui`, `lib/*` (utils only)
- `components/ui` only contains shadcn primitives (nothing else)
- `app/*` should not contain heavy logic or state
- Specialized domains (room-editor) are utilities/services, not component folders

## Abstraction Pattern: shadcn/ui → composite → features

### The Four-Layer Abstraction

1. **Shadcn/ui (external library)**
   - Low-level, pre-styled headless components
   - Examples: `Button`, `Dialog`, `Input`, `Card`, `Tabs`, `Dropdown`, `Slider`
   - No business logic; purely UI behavior and accessibility
   - Imported from `@/components/ui/*`
   - **Import statement:** `import { Button } from "@/components/ui/button"`

2. **components/ui/ folder (Primitives Only)**
   - Contains ONLY shadcn-installed components (as-is)
   - Examples: `button.tsx`, `input.tsx`, `dialog.tsx`, `slider.tsx`
   - No custom wrappers, no composition
   - Pure presentation layer

3. **components/composite/ folder (Reusable Multi-Primitive Components)**
   - Compose multiple shadcn primitives into cohesive UI patterns
   - No feature-specific business logic or state management
   - Examples:
     - `DepthAnalyzer.tsx` — combines `Input` + `Slider` + visualization + labels
     - `FormField.tsx` — combines `Label` + `Input` + `ErrorMessage`
     - `ImagePreview.tsx` — combines `Image` + `DropZone` + metadata display
   - Reusable across multiple features and pages
   - **Import statement:** `import { DepthAnalyzer } from "@/components/composite/depth-analyzer"`

4. **components/features/ folder (Business Logic + Orchestration)**
   - Full feature modules with state, API calls, and workflows
   - Compose composite components and primitives to build complete flows
   - Examples:
     - `components/features/lab/ImageUploader.tsx` — orchestrates file upload + depth analysis + API call
     - `components/features/home/LandingHome.tsx` — authentication state + conditional rendering
     - `components/features/lab/RightSidebar.tsx` — room parameters control panel
   - **Import statement:** `import { ImageUploader } from "@/components/features/lab/image-uploader"`

5. **Services/Utilities (lib/*, services/*, utils/)**
   - Domain-specific logic, hooks, API clients, algorithms
   - Room-editor lives here as `lib/room-editor/` or `services/room-editor/`
   - Examples:
     - `lib/api.ts` — API client
     - `lib/room-editor/scene.ts` — Three.js scene management
     - `lib/room-editor/transforms.ts` — object transformation utilities
     - `hooks/useRoomEditor.ts` — custom hook encapsulating room-editor logic
   - **Import statement:** `import { RoomScene } from "@/lib/room-editor/scene"`

### Data Flow Example

```
app/upload/page.tsx (route)
  ↓
components/features/lab/ImageUploader.tsx (feature with state + API call)
  ↓
components/composite/DepthAnalyzer.tsx (reusable multi-primitive component)
  ↓
components/ui/input.tsx + components/ui/slider.tsx (primitives)
```

### Room-Editor Structure

Room-editor is a **specialized feature** that lives in the features folder:

```
components/features/lab/room-editor/
├── RoomEditor.tsx          (main feature component)
├── RoomScene.tsx           (Three.js scene setup)
├── TransformControls.tsx   (furniture/object manipulation)
├── hooks.ts                (useRoomEditor, useRoomTransform, etc.)
└── utils.ts                (collision detection, math utilities)
```

It's a cohesive domain (3D room editing) with multiple sub-components, so it lives as a feature folder rather than scattered across different layers. If you need room-editor logic elsewhere, import from `components/features/lab/room-editor/`.

### Current State

- **components/ui/:** Empty (awaiting shadcn initialization)
- **components/composite/:** Empty (ready to build)
- **components/features/lab/:** ImageUploader, RightSidebar, LeftSidebar, Scene3D, Viewer3D, Grid3D, Walls, room-editor (specialized feature)
- **components/features/home/:** LandingHome

### Planned Evolution

1. Install shadcn: `npx shadcn-ui@latest init` (populates `components/ui/`)
2. Create composite components in `components/composite/` for reusable multi-primitive patterns
3. Refactor feature modules to use composite components instead of inline Tailwind
4. Keep room-editor as a self-contained feature folder in `components/features/lab/room-editor/`

## Contributing: Where to Put New Code

**Ask yourself:** Is this a shadcn primitive, a reusable combo, a full feature, or a specialized domain?

- **Use shadcn directly** → If you need a single `Button`, `Input`, `Dialog`
  - `import { Button } from "@/components/ui/button"`

- **Create a composite component** → If you're combining multiple shadcn components into a reusable pattern
  - Create `components/composite/my-pattern.tsx`
  - Examples: form field with validation, image preview with metadata, parameter analyzer
  - Use it in multiple features

- **Create a feature component** → If you have state, API calls, or feature-specific orchestration
  - Create `components/features/{feature-name}/{component-name}.tsx`
  - Example: full upload flow, authentication UI, parameter control panel
  - If it's a complex domain (like room-editor), make it a feature folder: `components/features/lab/room-editor/`

- **Create a service/utility** → If you have domain logic that's not UI and not feature-specific
  - Put it in `lib/`, `services/`, or a custom utility folder
  - Examples: API helpers, math utilities, shared authentication logic

**Example workflow:**
1. Need a depth slider? `import { Slider } from "@/components/ui/slider"`
2. Depth slider + label + preview together? Create `components/composite/depth-analyzer.tsx`
3. Depth analyzer + file upload + API call? Create `components/features/lab/image-uploader.tsx`
4. Complex 3D room editing? Create `components/features/lab/room-editor/` (feature folder with multiple sub-components)
