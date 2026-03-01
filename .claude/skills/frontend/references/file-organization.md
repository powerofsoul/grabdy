# File Organization

## Folder Structure

```
feature/
  index.ts              # barrel export (only public components/hooks)
  FeatureMain.tsx        # main orchestrator component
  types.ts              # shared types for this feature
  styles.ts             # shared styles for this feature
  components/            # subcomponents
    SubComponentA.tsx
    SubComponentB.tsx
    sub-feature/         # complex sub-component gets its own folder
      index.ts
      SubFeature.tsx
      constants.ts
      helpers.ts
  hooks/                 # hooks used across multiple components
    useSharedHookA.ts
    useSharedHookB.ts
```

## Rules

- One React component per file. No exceptions.
- Constants, helpers, types go in their own files, never inline in a component file.
- One hook per file.
- Group related components in folders with an `index.ts` barrel export.
- Co-locate hooks, utils, types next to the components that use them. Never create top-level `hooks/`, `utils/`, or `types/` directories.
- `index.ts` exports only the public API.

## Component Subfolder Rule

When a component has its own constants, helpers, or types, it MUST live in its own subfolder:

```
components/
  simple-component/          # has constants -> gets a folder
    index.ts
    SimpleComponent.tsx
    constants.ts
  PlainComponent.tsx          # no constants -> stays flat
```

## Naming Conventions

- **Folders**: kebab-case (`source-chips/`, `sticky-note/`)
- **Component files**: PascalCase (`SourceChips.tsx`, `StickyNoteComponent.tsx`)
- **Non-component files**: kebab-case (`constants.ts`, `helpers.ts`, `types.ts`)
- **Hook files**: camelCase with `use` prefix (`useChatStream.ts`, `useCanvasState.ts`)

## localStorage

All keys MUST be defined in `apps/web/src/lib/storage-keys.ts`. Never hardcode key strings.
