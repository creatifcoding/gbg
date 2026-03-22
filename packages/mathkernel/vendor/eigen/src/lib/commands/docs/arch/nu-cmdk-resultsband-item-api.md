# NuCmdk ResultsBand Item API (D19)

**Status:** Active  
**Date:** 2026-02-15

---

## Purpose

Define provider-consumed API for `ResultsBand` item rendering.

D19 policy:

- provider authors are primary consumers,
- provider sends typed item payloads,
- shell keeps layout/typography/interaction guardrails,
- provider may override typed slots in constrained envelopes.

---

## Contract surfaces

### State and operations

Provider context contract is split intentionally:

- `atoms` for state surfaces (`items`, `sections`, `selectedItemId`)
- `effects` for operation surfaces (`query`, `execute`, `preview`, `trackImpression`)

See:

- `src/lib/commands/shell/item-contract.ts`

---

## Item payload families

`NuCmdkItemModel` includes:

- semantic core
- action intents
- display tokens
- layout hints
- telemetry metadata
- namespaced `extensions`

Unknown payload ingestion supports:

- `strict` decode mode (fail fast)
- `drop-invalid` decode mode (drop + violation callback)

---

## ResultsBand provider API

`ResultsBand` accepts:

- `items?: NuCmdkItemModel[]`
- `rawItems?: unknown[]` (decoded via contract)
- `rows?: NuCmdkShellRow[]` (legacy compatibility)
- `itemSlots?: { icon, content, meta, actions }`
- `resolveItemSlots?: (ctx) => Partial<itemSlots>`
- `onActionIntent?: (item, action) => Effect<...>`
- `onItemDecodeViolation?: (violation) => void`

---

## Compound item primitives

Exposed compounds for deep composition:

- `ResultsBand.ItemRoot`
- `ResultsBand.ItemLeft`
- `ResultsBand.ItemRight`
- `ResultsBand.ItemIconSlot`
- `ResultsBand.ItemContentSlot`
- `ResultsBand.ItemMetaSlot`
- `ResultsBand.ItemActionsSlot`
- `ResultsBand.ItemActionGroup`
- `ResultsBand.ItemActionButton`

Guardrail: slot outputs render inside shell-owned envelopes; envelope geometry and typography constraints are not delegated.

---

## Usage recipe

```tsx
<ResultsBand
  items={providerItems}
  onSelectItem={(item) => void Effect.runPromise(provider.effects.execute(item.semantic.itemId))}
  onActionIntent={(item, action) => provider.effects.preview(item.semantic.itemId)}
  itemSlots={{
    icon: (ctx) => <ProviderIcon token={ctx.display.iconToken} />,
    meta: (ctx) => <ProviderMeta telemetry={ctx.telemetry} />,
  }}
  resolveItemSlots={(ctx) =>
    ctx.semantic.kind === 'entity'
      ? { actions: (c) => <EntityActionBar context={c} /> }
      : undefined
  }
/>
```

---

## Validation evidence

- Contract decode tests:
  - `src/lib/commands/shell/__tests__/item-contract.test.ts`
- Slot/fallback/guardrail tests:
  - `src/lib/commands/shell/__tests__/ResultsBand.test.tsx`
