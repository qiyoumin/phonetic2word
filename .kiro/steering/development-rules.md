---
inclusion: always
---

# Development Rules

## Tech Stack

- React 18 with TypeScript (strict mode), Vite 6 bundler
- CSS Modules (`*.module.css`) with `camelCaseOnly` convention
- State management via `useReducer` + React Context (`src/state/`)
- Web Workers for search operations (`src/workers/`)
- IndexedDB caching layer (`src/services/cacheService.ts`)
- Path alias: `@/*` maps to `src/*`

## Project Architecture

```
src/
  components/   — React UI components (each with co-located .module.css)
  data/         — Static phonetic symbol data (IPA, KK, Webster JSON)
  services/     — Business logic (dictionary, cache, history, phonetic mapping)
  state/        — AppContext provider, reducer, and action types
  types/        — Shared TypeScript interfaces and type definitions
  workers/      — Web Worker modules (search, shard loading, edit distance)
  test/         — Test setup files
public/
  index-shards/ — Pre-built phonetic index shard JSON files
scripts/        — Build-time scripts (index generation)
```

## Code Conventions

- Language: UI text and code comments are in Chinese (中文); identifiers and API names are in English
- Commit messages must be written in English
- Use functional React components with hooks; no class components
- Define shared types in `src/types/index.ts`
- Export named functions from services; avoid default exports except for the root `App` component
- Use `useCallback` for event handlers passed as props
- Phonetic data uses ARPAbet as the internal interchange format; convert to display symbols (IPA/KK/Webster) at the UI boundary via `phoneticMapper`

## Testing

- Framework: Vitest with jsdom environment; property-based tests use `fast-check`
- Test files are co-located with source: `*.test.ts` / `*.test.tsx` for unit tests, `*.property.test.ts` for property-based tests
- Every new feature or bug fix must include corresponding tests
- Any code modification (refactor, new feature, bug fix) must update or add related test cases before considering the task complete
- Run type check and tests before committing: `npx tsc -b && npx vitest run`
- Property tests should document which requirement they validate using a comment block with the property number and requirement reference
- Use `@testing-library/react` and `@testing-library/jest-dom` for component tests
