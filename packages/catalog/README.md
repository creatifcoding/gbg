# @gbg/catalog

Biomedical research catalog. Dump a picture, dossier, artifact, or note and file it as a card in one screen.

Empty catalog is valid. The app does not invent citations or papers.

## Why this name

`packages/catalog` / `@gbg/catalog` was free. Nothing else in the workspace owns that name. Kept it.

## Product invariant

Intake is one screen, no wizard. Filing produces a card with:

- type: `picture` | `dossier` | `artifact` | `note`
- status: starts `raw` (`filed` | `working` | `dead` later)
- one-line claim
- 3 or more tags
- organism/system, or `unknown`
- open questions (may be empty)

Deeper notes exist only after the card exists.

## Run

From the repo root, after `bun install`:

```bash
nx run catalog:dev
# or
nx run catalog:serve
nx run catalog:typecheck
nx run catalog:test
nx run catalog:build
```

App: http://127.0.0.1:3007

If Nx cannot load the workspace graph (other packages' Vite configs failing to resolve), run the same scripts from this package:

```bash
cd packages/catalog
bun run dev
bun run typecheck
bun run test:run
bun run build
bun run start   # production server, http://127.0.0.1:3000
```

No cloud secrets. Auth is deferred.

## Persistence

Local JSON at `packages/catalog/.data/catalog.json`. Blobs go in `.data/blobs/`. Override with `CATALOG_DATA_DIR`.

The card schema does not mention Notion. A Notion adapter can sit later without changing intake.

## Packages adopted

| Piece | How it is used |
| --- | --- |
| TanStack Start (`@tanstack/react-start`, `@tanstack/react-router`) | The app. File routes, server functions, Vite plugin. |
| Radix UI | `@radix-ui/react-label`, `select`, `separator`. Accessible primitives only. |
| Tailwind CSS v4 + `@tailwindcss/vite` | Layout and type. Same CSS runtime as the Start example, not a second one. |
| Effect Schema | Domain types and intake validation. Already in the monorepo. |
| nanoid | Attachment ids. |

React is the only UI framework. Motion is CSS from Transitions.dev. No Framer Motion, GSAP, or anime.js in this package.

## Beautiful UI

[beautifului.dev](https://www.beautifului.dev/) is copy-paste source, not an npm package. There is no public registry. This app does not vendor the ice-cream marketing demos. It uses three patterns from that set, rewritten for catalog cards:

- Filter chips (`src/ui/filter-chips.tsx`) from Filter Table
- Card rows (`src/ui/context-card.tsx`) from Context Cards
- Intake drop + composer (`src/ui/intake-drop.tsx`) from Prompt Bar

## Transitions.dev

[transitions.dev](https://transitions.dev/) is also copy-paste. The `transitions-pro` CLI can pull snippets, but the CSS is not a runtime you import. Vendored into `src/styles/transitions.css` from the public skill files:

- `_root.css` motion tokens (subset)
- card resize
- modal open/close
- panel reveal
- error-state shake
- tabs sliding
- tooltip

Each recipe keeps its `prefers-reduced-motion` guard.

## Layout

```
packages/catalog/
  src/lib/catalog/           schema, intake, file store, registry, server functions
  src/components/portal/     VANTA tokens + VantaCard (cloned from tmnl portal)
  src/components/primitives/ token-driven Badge
  src/components/testbed/    VantaCardTestbed at /testbed/vanta
  src/ui/                    catalog screens
  src/routes/                Start file routes
  src/styles/                VANTA CSS variables + transitions.dev recipes
  .claude/skills/            catalog-scoped skills mined from tmnl
```

`src/index.ts` re-exports schema, intake, portal tokens, VantaCard, and screens.

## Visual system

Catalog uses TMNL's Vanta Black tokens. There is no second palette.

Canonical source: `packages/tmnl/src/components/portal/tokens.ts`. `@gbg/tmnl` barrels the whole app, so catalog copies the token constants into `src/components/portal/tokens.ts` and clones `VantaCard`. It does not import tmnl shells, tauri, elixir, renode, or iiot.

Surfaces are void/base (`#000000` / `#030303`). Accents stay cyan, emerald, amber, rose, violet. Labels use Share Tech Mono, headings Space Grotesk, body Geo. Radii are 2 to 4px.

Index cards are `VantaCard` compounds. Status maps through `src/lib/catalog/registry.ts`.

Radix, Beautiful UI patterns, and Transitions.dev sit on these tokens. Transitions.dev tab/tooltip colors are remapped to VANTA surfaces. The motion recipes are unchanged.

Testbed: http://127.0.0.1:3007/testbed/vanta

## Skills

Package-local skills live in `.claude/skills/`. Registry: `.claude/skills/SKILL_REGISTRY.md`. They rewrite tmnl color, token, tier, type, file, testbed, registry, compound-component, and grounded-research skills for catalog, plus `catalog-intake`.

## Example cards

The catalog boots empty. The index has a button that loads three cards tagged `example`. They are labeled as synthetic UI fixtures. They are not papers.
