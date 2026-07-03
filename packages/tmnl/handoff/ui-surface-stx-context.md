# UiSurfaceDefinition + SurfaceActor via `@tmnl/stx`

## Recommendation
Model this as a **split contract/runtime system**:

- `UiSurfaceDefinition`: serializable Schema entity (ledger/API boundary).
- `SurfaceRuntimeState`: plain mutable projection for React/STX.
- `SurfaceActor`: one `stxMachine()` instance per active surface/variant.
- `surfaceStateFamily`: optional `stxFamily()` registry when many surfaces are tracked concurrently.

Do **not** use the legacy `src/lib/stx` shim in new work; use `@tmnl/stx` only.

## Grounding
- `@tmnl/stx` public exports include `stx`, `stxFamily`, `stxMachine`, hooks, and `Atom/AtomRegistry` re-exports (`../stx/src/index.ts:15-87`).
- Package reality is `effect-v4` alias + `xstate` (`../stx/package.json:62-64`).
- RFC says the public integration contract is `@tmnl/stx`, and explicitly warns against mixing `@/lib/stx` with the package (`docs/architecture/tmnl-react-native-migration-rfc.md:1111-1154`).
- RFC defines `UiSurfaceDefinition` as serializable and `SurfaceActor` as runtime behavior; canonical lifecycle/events are listed in `10.15.3` (`docs/architecture/tmnl-react-native-migration-rfc.md:1054-1154`).

## Concrete shape
### Serializable definition
```ts
import { Schema } from 'effect-v4'

export class UiSurfaceDefinition extends Schema.TaggedClass<UiSurfaceDefinition>()('UiSurfaceDefinition', {
  surfaceId: Schema.String,
  generationId: Schema.String,
  renderer: Schema.Literals(['native-rn', 'skia', 'lottie', 'genifer', 'remote-preview', 'web-fallback']),
  requiredCapabilities: Schema.Array(Schema.String),
  inputSchemaId: Schema.String,
  outputSchemaId: Schema.String,
  machineId: Schema.String,
  defaultState: Schema.String,
  platformVariants: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
}) {}
```

### Runtime projection
```ts
type SurfaceRuntimeState = {
  readonly surfaceId: string
  readonly generationId: string
  readonly lifecycle: 'draft' | 'validating' | 'previewing' | 'promoted' | 'degraded' | 'rolledBack'
  readonly selectedVariant: string
  readonly accessDecisionId: string | null
  readonly approvalRequestId: string | null
  readonly fallbackReason: string | null
  readonly ledgerCursor: string | null
}
```

### `stxMachine` sketch
```ts
import { Effect, Schema } from 'effect-v4'
import { assign, setup } from 'xstate'
import { stxMachine, stxFamily, type StxMachineInstance } from '@tmnl/stx'

const surfaceMachine = setup({
  types: {
    context: {} as {
      selectedVariant: string
      accessDecisionId: string | null
      approvalRequestId: string | null
      fallbackReason: string | null
      ledgerCursor: string | null
    },
    events: {} as
      | { type: 'VALIDATE' }
      | { type: 'PREVIEW'; variant: string; accessDecisionId: string }
      | { type: 'PROMOTE'; ledgerCursor: string }
      | { type: 'ROLLBACK'; ledgerCursor: string; reason: string }
      | { type: 'CAPABILITY_DENIED'; reason: string; accessDecisionId: string }
      | { type: 'REQUIRES_APPROVAL'; approvalRequestId: string; accessDecisionId: string }
      | { type: 'HOST_UNAVAILABLE'; reason: string }
      | { type: 'RENDER_FAULT'; reason: string }
      | { type: 'SCRIPT_FAULT'; reason: string }
  },
}).createMachine({
  id: 'tmnl.surfaceActor',
  initial: 'draft',
  context: {
    selectedVariant: 'unresolved',
    accessDecisionId: null,
    approvalRequestId: null,
    fallbackReason: null,
    ledgerCursor: null,
  },
  states: {
    draft: { on: { VALIDATE: 'validating' } },
    validating: {
      on: {
        PREVIEW: {
          target: 'previewing',
          actions: assign({
            selectedVariant: ({ event }) => event.variant,
            accessDecisionId: ({ event }) => event.accessDecisionId,
            fallbackReason: () => null,
          }),
        },
        CAPABILITY_DENIED: 'degraded',
        SCRIPT_FAULT: 'rolledBack',
      },
    },
    previewing: {
      on: {
        PROMOTE: { target: 'promoted', actions: assign({ ledgerCursor: ({ event }) => event.ledgerCursor }) },
        REQUIRES_APPROVAL: 'approval',
        HOST_UNAVAILABLE: 'degraded',
        RENDER_FAULT: 'degraded',
        SCRIPT_FAULT: 'rolledBack',
      },
    },
    approval: { on: { PREVIEW: 'previewing', CAPABILITY_DENIED: 'degraded' } },
    promoted: { on: { RENDER_FAULT: 'degraded', HOST_UNAVAILABLE: 'degraded', ROLLBACK: 'rolledBack' } },
    degraded: { on: { PREVIEW: 'previewing', ROLLBACK: 'rolledBack' } },
    rolledBack: { on: { VALIDATE: 'validating' } },
  },
})

const surfaceActor = stxMachine(surfaceMachine, {
  surfaceId: 'ui.commandDeck.open',
  generationId: 'builtin',
  lifecycle: 'draft',
  selectedVariant: 'unresolved',
  accessDecisionId: null,
  approvalRequestId: null,
  fallbackReason: null,
  ledgerCursor: null,
} satisfies SurfaceRuntimeState, {
  contextToState: (ctx, snapshot) => ({
    lifecycle: String(snapshot.value) as SurfaceRuntimeState['lifecycle'],
    selectedVariant: ctx.selectedVariant,
    accessDecisionId: ctx.accessDecisionId,
    approvalRequestId: ctx.approvalRequestId,
    fallbackReason: ctx.fallbackReason,
    ledgerCursor: ctx.ledgerCursor,
  }),
}) satisfies StxMachineInstance<SurfaceRuntimeState, typeof surfaceMachine>

const surfaceStateFamily = stxFamily<string, SurfaceRuntimeState>((surfaceId) => ({
  surfaceId,
  generationId: 'unresolved',
  lifecycle: 'draft',
  selectedVariant: 'unresolved',
  accessDecisionId: null,
  approvalRequestId: null,
  fallbackReason: null,
  ledgerCursor: null,
}))
```

## Cautions
- `stxMachine()` sync is **shallow**: `contextToState` merges into current state, so keep runtime state plain data unless you update class instances explicitly via `setAt`/constructor-aware mutations (`../stx/src/machine.ts:169-240`, RFC `1150-1154`).
- Avoid state→event feedback loops; `stateToEvent` only when a meaningful field diff exists (`../stx/src/machine.ts:248-260`).
- `useAtomValue` is registry-bound; prefer explicit registry plumbing and avoid hidden global/context reliance (`../stx/src/hooks.ts:4-68`).
- Package exports are root + `./hooks` only; do not deep-import internals or assume unexported helpers exist (`../stx/package.json:15-23`).
- Current package is compiled against `effect-v4`, not `effect`; keep that alias in examples until the shared-core migration collapses it (`docs/architecture/tmnl-react-native-migration-rfc.md:1115-1121`).

## Practical recommendation
- Put **definition registry** in `stxFamily<string, UiSurfaceDefinition>` if you need lookup/filtering across many surfaces.
- Put **runtime actor state** in `stxMachine()` (one actor per mounted/active surface).
- Use `useStxMachine()`, `useStxSend()`, and `useStxSnapshot()` from `@tmnl/stx` for React reads/dispatch.
- Keep capability resolution outside the actor; send only resolved lifecycle/variant events into the machine.
