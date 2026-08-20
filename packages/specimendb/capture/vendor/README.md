Vendored for Cloudflare Drop. Loaded from this folder only.

| File | Source | License |
| --- | --- | --- |
| `exiftool.js` | `@uswriting/exiftool@1.0.9` (ExifTool 13.42) | Apache-2.0 |
| `zeroperl.js` | `@6over3/zeroperl-ts@1.0.10` | Apache-2.0 |
| `zeroperl.wasm` | same | Apache-2.0 |

The npm import `@6over3/zeroperl-ts` was rewritten to `./zeroperl.js`. `writeMetadata` is called with a fetch hook that only loads `./zeroperl.wasm` from this origin.

Refresh with `bun run capture:vendor` from `packages/specimendb`.
