# SciChart Series Type Modules

Each chart kind has its own module directory:

- `line/`
- `area/`
- `scatter/`

Dispatcher: `index.ts` (`createRenderableSeriesForKind`).

This keeps per-kind rendering rules isolated for future deep dives and extension.
