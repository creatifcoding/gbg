# Conductor Chat RVN L3 Contract (Locked)

Date: 2026-02-10
Owner: Val

## Aligned Model

- **Expansion model**: 3 levels
  - L1: node card
  - L2: inspector-expanded node
  - **L3: full chat mode (node scales to ~4x footprint)**
- **L3 trigger**: combo interaction (node chrome chat button + keyboard path)
- **Composer primitive**: **custom RVN contenteditable composer** (no `<textarea>`)
- **Visual style**: single-column clean message stream (Notion-like calm) but strictly RVN tokens/geometry
- **Inspector in L3**: hidden for focus mode
- **Enter behavior**: Enter send, Shift+Enter newline
- **Suggestions**: adaptive (inline pills when empty, popup palette while typing)

## RVN Hard Constraints

- Typography floor: `var(--tmnl-text-xs, 12px)` minimum
- Zero border radius
- RVN tokenized spacing/color/typography only
- Custom input shell built from RVN primitives/tokens (not generic textarea)

## Immediate Implementation Surfaces

1. `RvnChatComposerContentEditable` (new)
2. `ConductorAgentChat.Level3Surface` container contract
3. Expansion state atom/model (`collapsed | expanded | chat_full`)
4. Adaptive suggestion subsystem (`pill rail` + `popup`)
