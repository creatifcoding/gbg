# `@gbg/lab-ui`

Lab design system. Import VANTA tokens and a few primitives. Evolve the look here.

```tsx
import { VANTA_COLORS, Grid, Table, chrome, Label, Pill, Socket } from '@gbg/lab-ui';

<div style={{ width: chrome.space.railWidth, background: chrome.color.void }}>
  <Label>status</Label>
  <Pill />
  <Socket />
  <Table />
  <Grid />
</div>
```

`chrome.color` is a VANTA facade. Surfaces are `void` / `base` / `elevated` / `raised` / `border`. Text is `primary` / `secondary` / `tertiary` / `muted`. Accents are cyan, emerald, amber, and rose with `*Muted` and `*Glow`. Callers who want the full objects import `VANTA_COLORS`, `VANTA_TYPOGRAPHY`, `VANTA_BORDERS`, `VANTA_ANIMATION`, and `VANTA_CARD_VARIANTS` from this package, not from `@gbg/tmnl`.

`Pill` defaults to `empty`. `Socket` defaults to an empty box. `Table` is TanStack Table for small registers. `Grid` is AG-Grid through `@tmnl/datagrid` for spreadsheet work. Both use VANTA, not datagrid `COLORS`. Default rows are blank.

Do not fill specimen data to make a demo look alive.

This cut does not change Workbench 97 or procurement.

See `EXTRACT.md` for the extract-and-sum.
