---
name: catalog-typography-discipline
description: Catalog type rules and the 12px floor. Invoke when setting font sizes, labels, chips, or debugging unreadable text.
model_invoked: true
triggers:
  - "font size"
  - "typography"
  - "12px floor"
  - "text-xs"
  - "readability"
  - "small text"
---

# Catalog typography discipline

Nothing in catalog UI goes below 12px. Not labels, not chips, not timestamps.

Catalog is not an ops grid. There is no 8px exemption here.

## The scale

| Token | Size | Use |
| --- | --- | --- |
| `--tmnl-text-xs` | 12px | labels, chips, captions. Floor. |
| `--tmnl-text-sm` | 14px | body, claims on cards |
| `--tmnl-text-base` | 16px | page body, inputs |

Presets live on `VANTA_TYPOGRAPHY.preset`:

- `cardTitle` Space Grotesk, 12px, uppercase
- `label` Share Tech Mono, 12px, uppercase
- `cardBody` Geo, 14px
- `value` Geo, 14px
- `micro` Share Tech Mono, 12px (floor, not 10px)

Canonical definitions: `packages/tmnl/src/components/portal/tokens.ts`, copied at `src/components/portal/tokens.ts`.

## Patterns

### Presets

```typescript
import { VANTA_TYPOGRAPHY, VANTA_COLORS } from '~/components/portal'

<h3 style={{ color: VANTA_COLORS.text.primary, ...VANTA_TYPOGRAPHY.preset.cardTitle }}>
  NOTE
</h3>
```

### CSS classes

`.vanta-label`, `.vanta-title`, `.vanta-heading` in `src/styles/app.css` already use the floor.

### Tailwind

`text-[12px]` is the smallest arbitrary allowed. Prefer `text-[14px]` or a preset. `text-[10px]` is banned.

## When tempted to shrink

If a human cannot read it at arm's length on 1080p, bump it. Density that requires squinting is a failed layout, not a type scale.

## Anti-patterns

```typescript
// BANNED
<span className="text-[8px]">ID</span>
<span style={{ fontSize: '10px' }}>meta</span>

// CORRECT
<span style={{ ...VANTA_TYPOGRAPHY.preset.label }}>ID</span>
```

Do not copy tmnl's AG-Grid ultra tier into catalog.

## Related

- `catalog-design-tokens`
- `catalog-color-system`
