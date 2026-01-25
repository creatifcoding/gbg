## 1. What the Entity Manipulation Kernel (EMK) is

Single sentence:

> The EMK is a statechart-driven control surface over ECS entities that computes **time-indexed, lensable snapshots** and applies **polymorphic transformations** to those snapshots, with explicit lifecycle and provenance.

In other words:

* It does not “own” entities → ECS still owns the canonical entity storage.
* It opens **sessions** on entities (or sets of entities).
* For each session, it:

  * Computes a **snapshot** (frozen projection at t, version v).
  * Lets you attach **lenses** / **views** (table row → THS point → waveform → CEW-specific view).
  * Applies **manipulations** (transform, merge, diff, what-if).
  * Emits **actions** back to ECS (patches, commands, or events).

Good mental analogy: “git worktree for entities, orchestrated by a statechart.”

---

## 2. Place in the ECS for CEW

At the ECS level:

* **Entities:** EW assets, tracks, emitters, effects, etc.
* **Components:** kinematics, RF signature, threat assessment, UI annotation, etc.
* **Systems:** simulation, sensing, fusion, UI projection, CEW-specific logic.

The EMK should be:

* An **ECS system or service** with:

  * Pure data API: `getSnapshot(entityId)`, `applyPatch(entityId, patch)`.
  * Control-plane orchestrated by XState: `EntitySessionMachine`.

* For CEW:

  * The kernel is where the op/alyst inspects “what is this entity right now?” and “what if I morph its RF profile / behavior / label?” without immediately touching the world-state.
  * Fits your “typed heterogeneous signal” story: snapshot = canonical THS instance; views are projections.

---

## 3. Core abstractions (domain types, independent of XState)

Minimal types (conceptual, not final):

```ts
type EntityId = string;
type SnapshotId = string;

interface ComponentSnapshot {
  type: string;            // e.g., "rfSignature", "kinematics"
  version: number;
  payload: unknown;        // strongly typed per component type in practice
}

interface EntitySnapshot {
  snapshotId: SnapshotId;
  entityId: EntityId;
  components: Record<string, ComponentSnapshot>;
  timestamp: number;
  revision: number;        // ECS revision
  provenance: {
    source: 'live' | 'simulated' | 'what-if';
    author?: string;
  };
}

type ViewKind =
  | 'table-row'
  | 'ths-point'
  | 'waveform'
  | 'graph-node'
  | 'cew-timeline'
  | 'custom';

interface ViewLensDescriptor {
  id: string;
  kind: ViewKind;
  params: Record<string, unknown>;
}

interface ViewInstance {
  lens: ViewLensDescriptor;
  inputSnapshotId: SnapshotId;
  data: unknown; // view-space data (e.g., 2D point, waveform samples, etc.)
}

type ManipulationKind =
  | 'component-patch'
  | 'schema-morph'
  | 'lens-param-update'
  | 'composite-transform';

interface Manipulation {
  id: string;
  kind: ManipulationKind;
  description?: string;
  payload: unknown; // transform specification
}

interface DiffResult {
  fromSnapshotId: SnapshotId;
  toSnapshotId: SnapshotId;
  changedComponents: string[];
  summary: Record<string, unknown>;
}
```

API boundary for the kernel:

```ts
interface EntityStorePort {
  getEntitySnapshot(entityId: EntityId): Promise<EntitySnapshot>;
  applyPatch(entityId: EntityId, patch: unknown): Promise<EntitySnapshot>;
}

interface LensRegistryPort {
  materializeView(
    snapshot: EntitySnapshot,
    lens: ViewLensDescriptor
  ): Promise<ViewInstance>;
}

interface DiffEnginePort {
  diffSnapshots(a: EntitySnapshot, b: EntitySnapshot): DiffResult;
}
```

The kernel itself is then orchestrated by XState via “sessions”.

---

## 4. XState modeling: sessions as statecharts

You can treat the **EMK session** as the main XState machine unit:

* One machine per:

  * entity session, or
  * multi-entity selection (composition later).

### 4.1 State topology (high level)

For a single-entity session:

* `idle`
  No entity bound yet.

* `loadingSnapshot`
  Fetching canonical snapshot from ECS.

* `ready` (parallel or nested)

  * `inspect`

    * compute / attach lenses
    * materialize views
  * `edit`

    * apply manipulations to a **working snapshot**
    * maintain diff `live ↔ working`
  * `polymorph`

    * schema morph / THS representation changes
      (You can do this as substates of `ready` or parallel regions if you want concurrency.)

* `applying`

  * `validating`
  * `committing`

* `error`

  * display + allow retry or rollback.

* `closed`
  Session done.

### 4.2 Events

Sketch of event vocabulary:

```ts
type EmkEvent =
  | { type: 'OPEN_SESSION'; entityId: EntityId }
  | { type: 'REFRESH' }
  | { type: 'ATTACH_LENS'; lens: ViewLensDescriptor }
  | { type: 'DETACH_LENS'; lensId: string }
  | { type: 'APPLY_MANIPULATION'; manipulation: Manipulation }
  | { type: 'PREVIEW_DIFF' }
  | { type: 'COMMIT_CHANGES' }
  | { type: 'DISCARD_CHANGES' }
  | { type: 'CLOSE_SESSION' };
```

### 4.3 Context

```ts
interface EmkContext {
  entityId?: EntityId;
  liveSnapshot?: EntitySnapshot;
  workingSnapshot?: EntitySnapshot;
  lenses: ViewLensDescriptor[];
  views: Record<string, ViewInstance>; // keyed by lens id
  pendingManipulations: Manipulation[];
  lastDiff?: DiffResult;
  lastError?: unknown;
}
```

---

## 5. Concrete XState machine skeleton (TypeScript)

Below is a usable skeleton with XState v5 style API (easily adapted to v4):

```ts
import { createMachine, fromPromise } from 'xstate';

export const createEmkSessionMachine = (ports: {
  entityStore: EntityStorePort;
  lenses: LensRegistryPort;
  diff: DiffEnginePort;
}) =>
  createMachine(
    {
      id: 'emkSession',
      types: {} as {
        context: EmkContext;
        events: EmkEvent;
      },
      initial: 'idle',
      context: {
        entityId: undefined,
        liveSnapshot: undefined,
        workingSnapshot: undefined,
        lenses: [],
        views: {},
        pendingManipulations: [],
        lastDiff: undefined,
        lastError: undefined,
      },
      states: {
        idle: {
          on: {
            OPEN_SESSION: {
              target: 'loadingSnapshot',
              actions: 'assignEntityId',
            },
          },
        },

        loadingSnapshot: {
          invoke: {
            src: 'loadSnapshot',
            input: ({ context }) => context.entityId!,
            onDone: {
              target: 'ready.inspecting',
              actions: 'assignInitialSnapshots',
            },
            onError: {
              target: 'error',
              actions: 'assignError',
            },
          },
        },

        ready: {
          initial: 'inspecting',
          states: {
            inspecting: {
              on: {
                ATTACH_LENS: {
                  target: 'materializingView',
                },
                APPLY_MANIPULATION: {
                  target: '#emkSession.ready.editing.applyingManipulation',
                },
                PREVIEW_DIFF: {
                  target: 'computingDiff',
                },
                COMMIT_CHANGES: {
                  target: '#emkSession.applying',
                },
                REFRESH: {
                  target: '#emkSession.loadingSnapshot',
                },
              },
            },

            materializingView: {
              invoke: {
                src: 'materializeView',
                input: ({ context, event }) => ({
                  snapshot: context.workingSnapshot ?? context.liveSnapshot!,
                  lens:
                    event.type === 'ATTACH_LENS'
                      ? event.lens
                      : undefined,
                }),
                onDone: {
                  target: 'inspecting',
                  actions: ['registerLens', 'registerView'],
                },
                onError: {
                  target: '#emkSession.error',
                  actions: 'assignError',
                },
              },
            },

            computingDiff: {
              invoke: {
                src: 'computeDiff',
                input: ({ context }) => ({
                  from: context.liveSnapshot!,
                  to: context.workingSnapshot ?? context.liveSnapshot!,
                }),
                onDone: {
                  target: 'inspecting',
                  actions: 'assignDiff',
                },
                onError: {
                  target: '#emkSession.error',
                  actions: 'assignError',
                },
              },
            },

            editing: {
              initial: 'idle',
              states: {
                idle: {},
                applyingManipulation: {
                  entry: 'stashManipulation',
                  invoke: {
                    src: 'applyManipulation',
                    input: ({ context, event }) => ({
                      snapshot: context.workingSnapshot ?? context.liveSnapshot!,
                      manipulation:
                        event.type === 'APPLY_MANIPULATION'
                          ? event.manipulation
                          : undefined,
                    }),
                    onDone: {
                      target: 'idle',
                      actions: 'updateWorkingSnapshot',
                    },
                    onError: {
                      target: '#emkSession.error',
                      actions: 'assignError',
                    },
                  },
                },
              },
            },
          },
        },

        applying: {
          invoke: {
            src: 'commitChanges',
            input: ({ context }) => ({
              entityId: context.entityId!,
              workingSnapshot: context.workingSnapshot!,
            }),
            onDone: {
              target: 'ready.inspecting',
              actions: 'syncAfterCommit',
            },
            onError: {
              target: 'error',
              actions: 'assignError',
            },
          },
        },

        error: {
          on: {
            REFRESH: {
              target: 'loadingSnapshot',
              actions: 'clearError',
            },
            CLOSE_SESSION: 'closed',
          },
        },

        closed: {
          type: 'final',
        },
      },
      on: {
        CLOSE_SESSION: 'closed',
      },
    },
    {
      actions: {
        assignEntityId: ({ context, event }) => {
          if (event.type !== 'OPEN_SESSION') return;
          context.entityId = event.entityId;
        },
        assignInitialSnapshots: ({ context, event }) => {
          const snapshot = event.output as EntitySnapshot;
          context.liveSnapshot = snapshot;
          context.workingSnapshot = snapshot;
        },
        assignError: ({ context, event }) => {
          context.lastError = event.error ?? event.data;
        },
        clearError: ({ context }) => {
          context.lastError = undefined;
        },
        registerLens: ({ context, event }) => {
          if (event.type !== 'xstate.done.actor.materializeView') return;
          const view = event.output as ViewInstance;
          context.lenses.push(view.lens);
        },
        registerView: ({ context, event }) => {
          if (event.type !== 'xstate.done.actor.materializeView') return;
          const view = event.output as ViewInstance;
          context.views[view.lens.id] = view;
        },
        assignDiff: ({ context, event }) => {
          context.lastDiff = event.output as DiffResult;
        },
        stashManipulation: () => {
          // optional: track manipulations history
        },
        updateWorkingSnapshot: ({ context, event }) => {
          context.workingSnapshot = event.output as EntitySnapshot;
        },
        syncAfterCommit: ({ context, event }) => {
          const committed = event.output as EntitySnapshot;
          context.liveSnapshot = committed;
          context.workingSnapshot = committed;
          context.pendingManipulations = [];
          context.lastDiff = undefined;
        },
      },
      actors: {
        loadSnapshot: fromPromise(
          async ({ input: entityId }: { input: EntityId }, { system }) => {
            const { entityStore } = (system as any).ports;
            return entityStore.getEntitySnapshot(entityId);
          },
        ),
        materializeView: fromPromise(
          async (
            {
              input,
            }: {
              input: { snapshot: EntitySnapshot; lens: ViewLensDescriptor };
            },
            { system },
          ) => {
            const { lenses } = (system as any).ports;
            return lenses.materializeView(input.snapshot, input.lens);
          },
        ),
        computeDiff: fromPromise(
          async (
            {
              input,
            }: { input: { from: EntitySnapshot; to: EntitySnapshot } },
            { system },
          ) => {
            const { diff } = (system as any).ports;
            return diff.diffSnapshots(input.from, input.to);
          },
        ),
        applyManipulation: fromPromise(
          async (
            {
              input,
            }: {
              input: { snapshot: EntitySnapshot; manipulation: Manipulation };
            },
          ) => {
            // pure transformation, local to the kernel
            return applyManipulationPure(input.snapshot, input.manipulation);
          },
        ),
        commitChanges: fromPromise(
          async (
            {
              input,
            }: {
              input: { entityId: EntityId; workingSnapshot: EntitySnapshot };
            },
            { system },
          ) => {
            const { entityStore } = (system as any).ports;
            // convert workingSnapshot → patch or full replace
            const patch = buildPatchFromSnapshots(
              input.workingSnapshot,
              input.workingSnapshot, // or live snapshot if you keep it here
            );
            return entityStore.applyPatch(input.entityId, patch);
          },
        ),
      },
    },
  );

function applyManipulationPure(
  snapshot: EntitySnapshot,
  manipulation: Manipulation,
): EntitySnapshot {
  // TODO: your polymorphism logic (THS, schema morphs, etc.)
  return snapshot;
}

function buildPatchFromSnapshots(
  // you will probably want both live & working
  working: EntitySnapshot,
  reference: EntitySnapshot,
): unknown {
  // TODO: diff → patch encoding for ECS
  return {};
}
```

You can strip this down or re-organize, but this gives you:

* A **session-scoped EMK machine**.
* Clear **entry points** for:

  * ECS store,
  * Lens registry,
  * Diff engine,
  * Manipulation logic.
* A place to encode your **data polymorphism** rules cleanly (`applyManipulationPure` + lens registry).

---

If you want next, I can:

* Specialize this for **THS-first** modeling (snapshots as THS objects, views as THS → shape functors), or
* Add **parallel regions** for “UI focus vs. simulation focus” or “live vs. what-if scenario” inside the same EMK session.
