# RVN Chat Architecture (Setup)

This folder follows strict modular conventions:

- **Hierarchy by concern** (frame/msg/composer/status/banner/card/selector/btn/empty)
- **Kebab-style filenames** inside each concern
- **Namespace-first compound APIs** via each concern `index.ts`
- **Root `chat/index.ts` only re-exports concern indexes**

## Concern map

- `shell/` → 4-band shell compounds (header/command/thread/composer band dirs)
- `frame/` → frame-level ornaments and cross-cut frame pieces
- `msg/` → message compounds and role variants
  - `msg/message-shell/` → second-order owner namespace (`RvnChatMessageShell`) for lane composition boundaries
- `composer/` → second-order composer compounding (input/suggestions/toolbar dirs)
- `status/` → status chips, connection badge, telemetry pills
- `banner/` → interruption and inline banner surfaces
- `card/` → artifact/analysis card compounds
- `selector/` → agent selector compound
- `btn/` → command/transport button primitives (`*-btn.tsx` convention)
- `empty/` → empty-state surfaces

## Migration note

Current functional implementations still live in legacy flat files in this folder:

- `RvnChatFrame.tsx`
- `RvnChatMessage.tsx`
- `RvnComposerContentEditable.tsx`
- `RvnStatusChip.tsx`

Concern indexes currently bridge to those implementations where available.
Missing concern components are scaffolded with lightweight placeholders and will be fleshed out in the next extraction pass.
