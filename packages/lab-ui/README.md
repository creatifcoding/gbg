# `@gbg/lab-ui`

Lab design system. Import tokens and a few primitives. Evolve the look here.

```tsx
import { chrome, Label, Pill, Socket } from '@gbg/lab-ui';

<div style={{ width: chrome.space.railWidth, background: chrome.color.void }}>
  <Label>status</Label>
  <Pill />
  <Socket />
</div>
```

`Pill` defaults to `empty`. `Socket` defaults to an empty box. Do not fill specimen data to make a demo look alive.

This cut does not import VANTA. It does not change Workbench 97 or procurement.

See `EXTRACT.md` for where the first tokens came from.
