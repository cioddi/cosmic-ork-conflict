# Vite migration

Cosmic Ork Conflict uses Vite 8 for development and production builds, Vitest 4
for unit tests, and ESLint's flat configuration. Create React App and
`react-scripts` are no longer part of the project.

## Runtime and commands

- Node.js 22.13 or newer is required.
- `npm ci` installs the exact dependency tree from `package-lock.json`.
- `npm run dev` starts Vite's development server.
- `npm run test` starts Vitest in watch mode.
- `npm run verify` runs linting, type-checking, unit tests, and a production
  build.
- `npm run build` writes the static deployment to `docs/`.
- `npm run preview` serves the production build locally.

The project intentionally uses npm as its only package manager. The obsolete
Yarn lockfile was removed so there is one authoritative dependency graph.

## Application entry and deployment

Vite's root `index.html` loads `src/index.tsx` directly during development. The
build has a relative base path so the generated site continues to work from a
GitHub Pages project subdirectory. Static files in `public/` are copied into the
root of `docs/`.

The army workshop is the initial view. MapLibre, its stylesheet, Material UI,
and the battle rendering tree are loaded through the lazy `BattleView` boundary
only after a game is deployed. This keeps the builder's initial JavaScript much
smaller without changing the simulation lifecycle.

## Test and lint migration

The existing Jest-style tests run on Vitest's jsdom environment. Shared DOM
matchers are registered in `src/setupTests.ts`, and Jest mocks were converted to
Vitest's `vi` API. TypeScript includes `vite/client` and `vitest/globals` types.

ESLint now uses `eslint.config.js` with TypeScript, React Hooks, and React Fast
Refresh rules. Generated deployment files and static public assets are excluded
from source linting.

## Dependency cleanup

The migration updates the actively used stack to React 19, Material UI 9,
MapLibre GL JS 5, Turf 7, TypeScript 6, ESLint 10, Vite 8, and Vitest 4. Related
API changes are handled in source rather than hidden behind compatibility
packages.

Unused packages and their unreachable source adapters were removed, including
Create React App, Deck.gl, MapComponents React, Zustand, UUID, Web Vitals, the
duplicate legacy Turf package, and obsolete standalone type packages. Debug
layers that existed only to support the unused Deck.gl adapters were also
removed. The renderer-independent game world, navigation model, and active
MapLibre game layers remain unchanged in responsibility.

TypeScript 6 is deliberate: the current `typescript-eslint` release supports
TypeScript versions below 6.1. Node types target the supported Node 22 runtime
instead of an unrelated newer Node major.

## Safe maintenance

When updating dependencies:

1. Keep Vite, its React plugin, and Vitest on mutually compatible Node versions.
2. Check the supported TypeScript range published by `typescript-eslint` before
   changing the compiler major.
3. Run `npm run verify` after regenerating `package-lock.json`.
4. Smoke-test both the initial army workshop and a deployed battle; the lazy
   boundary means either path can fail independently.
5. Commit the rebuilt `docs/` output with source changes when publishing the
   GitHub Pages site.
