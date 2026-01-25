/**
 * MorphCard CardState Service
 *
 * Effect service + atom hierarchy for Dynamic Island-style card state.
 * Owns sizeKey, position, reticle, bounds, and bounded history.
 *
 * @module morph-card/card-state
 */

import { Atom } from '@effect-atom/atom';
import { Context, Effect, Layer, Schema, Clock, Stream, Duration } from 'effect';
import type { CardId } from './schemas/card-state';
import { ReticleVariant } from './schemas/animation-config';
import { DEFAULT_TRANSITION, TransitionGrammar } from './schemas/transition-grammar';

// =============================================================================
// Schemas
// =============================================================================

export const SizeKey = Schema.String.pipe(Schema.brand('SizeKey'));
export type SizeKey = Schema.Schema.Type<typeof SizeKey>;

export const Position = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
});
export type Position = Schema.Schema.Type<typeof Position>;

export const Bounds = Schema.Struct({
  left: Schema.optional(Schema.Number),
  top: Schema.optional(Schema.Number),
  right: Schema.optional(Schema.Number),
  bottom: Schema.optional(Schema.Number),
});
export type Bounds = Schema.Schema.Type<typeof Bounds>;

export const MeasuredSize = Schema.Struct({
  width: Schema.Number,
  height: Schema.Number,
});
export type MeasuredSize = Schema.Schema.Type<typeof MeasuredSize>;

export const TransitionComplexity = Schema.Literal('simple', 'complex');
export type TransitionComplexity = Schema.Schema.Type<typeof TransitionComplexity>;

export const DragState = Schema.Struct({
  isDragging: Schema.Boolean,
  isResizing: Schema.Boolean,
  shiftKey: Schema.Boolean,
  pointerStart: Schema.optional(Position),
  startPosition: Schema.optional(Position),
  lastPosition: Schema.optional(Position),
});
export type DragState = Schema.Schema.Type<typeof DragState>;

export const CardBehavior = Schema.Struct({
  dynamicSize: Schema.Boolean,
  scrollable: Schema.Boolean,
});
export type CardBehavior = Schema.Schema.Type<typeof CardBehavior>;

export const CardStateSnapshot = Schema.Struct({
  sizeKey: SizeKey,
  previousSizeKey: SizeKey,
  basePosition: Position,
  position: Position,
  reticle: ReticleVariant,
  transition: TransitionGrammar,
  complexity: TransitionComplexity,
  bounds: Bounds,
  drag: DragState,
});
export type CardStateSnapshot = Schema.Schema.Type<typeof CardStateSnapshot>;

export const HistoryEntry = Schema.Struct({
  timestamp: Schema.Number,
  snapshot: CardStateSnapshot,
});
export type HistoryEntry = Schema.Schema.Type<typeof HistoryEntry>;

export const HistoryState = Schema.Struct({
  entries: Schema.Array(HistoryEntry),
  cursor: Schema.Number,
  maxSize: Schema.Number,
});
export type HistoryState = Schema.Schema.Type<typeof HistoryState>;

// =============================================================================
// Defaults
// =============================================================================

export const DEFAULT_POSITION: Position = { x: 0, y: 0 };
export const DEFAULT_BOUNDS: Bounds = {};
export const DEFAULT_DRAG_STATE: DragState = {
  isDragging: false,
  isResizing: false,
  shiftKey: false,
  pointerStart: undefined,
  startPosition: undefined,
  lastPosition: undefined,
};
export const DEFAULT_COMPLEXITY: TransitionComplexity = 'simple';
export const DEFAULT_SIZE_KEY: SizeKey = 'default' as SizeKey;
export const DEFAULT_HISTORY_SIZE = 50;
export const DEFAULT_CARD_BEHAVIOR: CardBehavior = {
  dynamicSize: false,
  scrollable: false,
};

export const DEFAULT_CARD_SNAPSHOT: CardStateSnapshot = {
  sizeKey: DEFAULT_SIZE_KEY,
  previousSizeKey: DEFAULT_SIZE_KEY,
  basePosition: DEFAULT_POSITION,
  position: DEFAULT_POSITION,
  reticle: 'corners',
  transition: DEFAULT_TRANSITION,
  complexity: DEFAULT_COMPLEXITY,
  bounds: DEFAULT_BOUNDS,
  drag: DEFAULT_DRAG_STATE,
};

export const DEFAULT_HISTORY_STATE: HistoryState = {
  entries: [],
  cursor: -1,
  maxSize: DEFAULT_HISTORY_SIZE,
};

// =============================================================================
// Atom Families (Nested Hierarchy)
// =============================================================================

export const sizeKeyAtomFamily = Atom.family(
  (_cardId: CardId) => Atom.make<SizeKey>(DEFAULT_SIZE_KEY)
);

export const previousSizeKeyAtomFamily = Atom.family(
  (_cardId: CardId) => Atom.make<SizeKey>(DEFAULT_SIZE_KEY)
);

export const basePositionAtomFamily = Atom.family(
  (_cardId: CardId) => Atom.make<Position>(DEFAULT_POSITION)
);

export const positionAtomFamily = Atom.family(
  (_cardId: CardId) => Atom.make<Position>(DEFAULT_POSITION)
);

export const reticleAtomFamily = Atom.family(
  (_cardId: CardId) => Atom.make<Schema.Schema.Type<typeof ReticleVariant>>('corners')
);

export const transitionAtomFamily = Atom.family(
  (_cardId: CardId) => Atom.make<TransitionGrammar>(DEFAULT_TRANSITION)
);

export const complexityAtomFamily = Atom.family(
  (_cardId: CardId) => Atom.make<TransitionComplexity>(DEFAULT_COMPLEXITY)
);

export const boundsAtomFamily = Atom.family(
  (_cardId: CardId) => Atom.make<Bounds>(DEFAULT_BOUNDS)
);

export const dragStateAtomFamily = Atom.family(
  (_cardId: CardId) => Atom.make<DragState>(DEFAULT_DRAG_STATE)
);

export const measuredSizeAtomFamily = Atom.family(
  (_cardId: CardId) => Atom.make<MeasuredSize | null>(null)
);

export const measuredSizeDebouncedAtomFamily = Atom.family((cardId: CardId) =>
  Atom.make(
    (get) =>
      get
        .stream(measuredSizeAtomFamily(cardId), { withoutInitialValue: true })
        .pipe(Stream.debounce(Duration.millis(16)))
  )
);

export const dragStateDebouncedAtomFamily = Atom.family((cardId: CardId) =>
  Atom.make(
    (get) =>
      get
        .stream(dragStateAtomFamily(cardId), { withoutInitialValue: true })
        .pipe(Stream.debounce(Duration.millis(16)))
  )
);

export const behaviorAtomFamily = Atom.family(
  (_cardId: CardId) => Atom.make<CardBehavior>(DEFAULT_CARD_BEHAVIOR)
);

export const historyAtomFamily = Atom.family(
  (_cardId: CardId) => Atom.make<HistoryState>(DEFAULT_HISTORY_STATE)
);

export const snapshotAtomFamily = Atom.family((cardId: CardId) =>
  Atom.make((get) => ({
    sizeKey: get(sizeKeyAtomFamily(cardId)),
    previousSizeKey: get(previousSizeKeyAtomFamily(cardId)),
    basePosition: get(basePositionAtomFamily(cardId)),
    position: get(positionAtomFamily(cardId)),
    reticle: get(reticleAtomFamily(cardId)),
    transition: get(transitionAtomFamily(cardId)),
    complexity: get(complexityAtomFamily(cardId)),
    bounds: get(boundsAtomFamily(cardId)),
    drag: get(dragStateAtomFamily(cardId)),
  }))
);

export const cardStateFamily = {
  sizeKey: sizeKeyAtomFamily,
  previousSizeKey: previousSizeKeyAtomFamily,
  basePosition: basePositionAtomFamily,
  position: positionAtomFamily,
  reticle: reticleAtomFamily,
  transition: transitionAtomFamily,
  complexity: complexityAtomFamily,
  bounds: boundsAtomFamily,
  drag: dragStateAtomFamily,
  measuredSize: measuredSizeAtomFamily,
  measuredSizeDebounced: measuredSizeDebouncedAtomFamily,
  dragDebounced: dragStateDebouncedAtomFamily,
  behavior: behaviorAtomFamily,
  history: historyAtomFamily,
  snapshot: snapshotAtomFamily,
};

export interface CardStateAtoms {
  readonly sizeKey: ReturnType<typeof sizeKeyAtomFamily>;
  readonly previousSizeKey: ReturnType<typeof previousSizeKeyAtomFamily>;
  readonly basePosition: ReturnType<typeof basePositionAtomFamily>;
  readonly position: ReturnType<typeof positionAtomFamily>;
  readonly reticle: ReturnType<typeof reticleAtomFamily>;
  readonly transition: ReturnType<typeof transitionAtomFamily>;
  readonly complexity: ReturnType<typeof complexityAtomFamily>;
  readonly bounds: ReturnType<typeof boundsAtomFamily>;
  readonly drag: ReturnType<typeof dragStateAtomFamily>;
  readonly measuredSize: ReturnType<typeof measuredSizeAtomFamily>;
  readonly measuredSizeDebounced: ReturnType<typeof measuredSizeDebouncedAtomFamily>;
  readonly dragDebounced: ReturnType<typeof dragStateDebouncedAtomFamily>;
  readonly behavior: ReturnType<typeof behaviorAtomFamily>;
  readonly history: ReturnType<typeof historyAtomFamily>;
  readonly snapshot: ReturnType<typeof snapshotAtomFamily>;
}

export function getCardStateAtoms(cardId: CardId): CardStateAtoms {
  return {
    sizeKey: sizeKeyAtomFamily(cardId),
    previousSizeKey: previousSizeKeyAtomFamily(cardId),
    basePosition: basePositionAtomFamily(cardId),
    position: positionAtomFamily(cardId),
    reticle: reticleAtomFamily(cardId),
    transition: transitionAtomFamily(cardId),
    complexity: complexityAtomFamily(cardId),
    bounds: boundsAtomFamily(cardId),
    drag: dragStateAtomFamily(cardId),
    measuredSize: measuredSizeAtomFamily(cardId),
    measuredSizeDebounced: measuredSizeDebouncedAtomFamily(cardId),
    dragDebounced: dragStateDebouncedAtomFamily(cardId),
    behavior: behaviorAtomFamily(cardId),
    history: historyAtomFamily(cardId),
    snapshot: snapshotAtomFamily(cardId),
  };
}

// =============================================================================
// Errors
// =============================================================================

export class CardStateError extends Schema.TaggedError<CardStateError>()(
  'CardStateError',
  {
    operation: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

// =============================================================================
// Service Interface
// =============================================================================

export interface CardStateServiceShape {
  readonly get: (cardId: CardId) => Effect.Effect<CardStateSnapshot, CardStateError>;
  readonly set: (
    cardId: CardId,
    patch: Partial<CardStateSnapshot>,
    options?: { recordHistory?: boolean; persist?: boolean }
  ) => Effect.Effect<void, CardStateError>;
  readonly reset: (cardId: CardId) => Effect.Effect<void, CardStateError>;
  readonly undo: (cardId: CardId) => Effect.Effect<void, CardStateError>;
  readonly redo: (cardId: CardId) => Effect.Effect<void, CardStateError>;
  readonly subscribe: (
    cardId: CardId,
    onUpdate: (snapshot: CardStateSnapshot) => void
  ) => Effect.Effect<() => void, CardStateError>;
}

export class CardStateService extends Context.Tag(
  'tmnl/morph-card/CardStateService'
)<CardStateService, CardStateServiceShape>() {}

// =============================================================================
// Local Storage Persistence (Debounced)
// =============================================================================

const STORAGE_PREFIX = 'morph-card-state:';
const PERSIST_DEBOUNCE_MS = 250;
const persistTimers = new Map<string, ReturnType<typeof setTimeout>>();

function schedulePersist(cardId: string, snapshot: CardStateSnapshot): void {
  const key = `${STORAGE_PREFIX}${cardId}`;
  const existing = persistTimers.get(key);
  if (existing) clearTimeout(existing);
  const handle = setTimeout(() => {
    persistTimers.delete(key);
    try {
      localStorage.setItem(key, JSON.stringify(snapshot));
    } catch {
      // ignore persistence failures
    }
  }, PERSIST_DEBOUNCE_MS);
  persistTimers.set(key, handle);
}

function loadPersisted(cardId: string): CardStateSnapshot | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${cardId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const decoded = Schema.decodeUnknownEither(CardStateSnapshot)(parsed);
    if (decoded._tag === 'Left') return null;
    return decoded.right;
  } catch {
    return null;
  }
}

// =============================================================================
// History Helpers
// =============================================================================

function pushHistory(state: HistoryState, entry: HistoryEntry): HistoryState {
  const trimmed = state.entries.slice(0, state.cursor + 1);
  trimmed.push(entry);
  if (trimmed.length > state.maxSize) {
    trimmed.shift();
  }
  return {
    ...state,
    entries: trimmed,
    cursor: trimmed.length - 1,
  };
}

function canUndo(state: HistoryState): boolean {
  return state.cursor > 0 && state.entries.length > 0;
}

function canRedo(state: HistoryState): boolean {
  return state.cursor >= 0 && state.cursor < state.entries.length - 1;
}

// =============================================================================
// Registry Interface
// =============================================================================

export interface AtomRegistry {
  get: <T>(atom: ReturnType<typeof Atom.make<T>>) => T;
  set: <T>(atom: ReturnType<typeof Atom.make<T>>, value: T) => void;
  subscribe: <T>(
    atom: ReturnType<typeof Atom.make<T>>,
    onUpdate: (value: T) => void
  ) => () => void;
}

// =============================================================================
// Service Implementation
// =============================================================================

function snapshotFromRegistry(registry: AtomRegistry, cardId: CardId): CardStateSnapshot {
  const atoms = getCardStateAtoms(cardId);
  return {
    sizeKey: registry.get(atoms.sizeKey),
    previousSizeKey: registry.get(atoms.previousSizeKey),
    basePosition: registry.get(atoms.basePosition),
    position: registry.get(atoms.position),
    reticle: registry.get(atoms.reticle),
    transition: registry.get(atoms.transition),
    complexity: registry.get(atoms.complexity),
    bounds: registry.get(atoms.bounds),
    drag: registry.get(atoms.drag),
  };
}

function applySnapshot(
  registry: AtomRegistry,
  cardId: CardId,
  snapshot: CardStateSnapshot
): void {
  const atoms = getCardStateAtoms(cardId);
  registry.set(atoms.sizeKey, snapshot.sizeKey);
  registry.set(atoms.previousSizeKey, snapshot.previousSizeKey);
  registry.set(atoms.basePosition, snapshot.basePosition);
  registry.set(atoms.position, snapshot.position);
  registry.set(atoms.reticle, snapshot.reticle);
  registry.set(atoms.transition, snapshot.transition);
  registry.set(atoms.complexity, snapshot.complexity);
  registry.set(atoms.bounds, snapshot.bounds);
  registry.set(atoms.drag, snapshot.drag);
}

export function createCardStateService(registry: AtomRegistry): CardStateServiceShape {
  return {
    get: (cardId) =>
      Effect.sync(() => {
        const persisted = loadPersisted(String(cardId));
        if (persisted) {
          applySnapshot(registry, cardId, persisted);
          return persisted;
        }
        return snapshotFromRegistry(registry, cardId);
      }).pipe(
        Effect.catchAll((cause) =>
          Effect.fail(
            new CardStateError({
              operation: 'get',
              message: 'Failed to read card state',
              cause,
            })
          )
        )
      ),

    set: (cardId, patch, options) =>
      Effect.gen(function* () {
        const current = snapshotFromRegistry(registry, cardId);
        const next: CardStateSnapshot = {
          ...current,
          ...patch,
        };
        applySnapshot(registry, cardId, next);

        const recordHistory = options?.recordHistory ?? true;
        if (recordHistory) {
          const historyAtom = historyAtomFamily(cardId);
          const history = registry.get(historyAtom);
          const now = yield* Clock.currentTimeMillis;
          const entry: HistoryEntry = { timestamp: now, snapshot: next };
          registry.set(historyAtom, pushHistory(history, entry));
        }

        const shouldPersist = options?.persist ?? true;
        if (shouldPersist) {
          schedulePersist(String(cardId), next);
        }
      }).pipe(
        Effect.catchAll((cause) =>
          Effect.fail(
            new CardStateError({
              operation: 'set',
              message: 'Failed to set card state',
              cause,
            })
          )
        )
      ),

    reset: (cardId) =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;
        applySnapshot(registry, cardId, DEFAULT_CARD_SNAPSHOT);
        registry.set(historyAtomFamily(cardId), {
          ...DEFAULT_HISTORY_STATE,
          entries: [{ timestamp: now, snapshot: DEFAULT_CARD_SNAPSHOT }],
          cursor: 0,
        });
        schedulePersist(String(cardId), DEFAULT_CARD_SNAPSHOT);
      }).pipe(
        Effect.catchAll((cause) =>
          Effect.fail(
            new CardStateError({
              operation: 'reset',
              message: 'Failed to reset card state',
              cause,
            })
          )
        )
      ),

    undo: (cardId) =>
      Effect.sync(() => {
        const historyAtom = historyAtomFamily(cardId);
        const history = registry.get(historyAtom);
        if (!canUndo(history)) return;
        const nextCursor = history.cursor - 1;
        const entry = history.entries[nextCursor];
        if (!entry) return;
        applySnapshot(registry, cardId, entry.snapshot);
        registry.set(historyAtom, { ...history, cursor: nextCursor });
        schedulePersist(String(cardId), entry.snapshot);
      }).pipe(
        Effect.catchAll((cause) =>
          Effect.fail(
            new CardStateError({
              operation: 'undo',
              message: 'Failed to undo card state',
              cause,
            })
          )
        )
      ),

    redo: (cardId) =>
      Effect.sync(() => {
        const historyAtom = historyAtomFamily(cardId);
        const history = registry.get(historyAtom);
        if (!canRedo(history)) return;
        const nextCursor = history.cursor + 1;
        const entry = history.entries[nextCursor];
        if (!entry) return;
        applySnapshot(registry, cardId, entry.snapshot);
        registry.set(historyAtom, { ...history, cursor: nextCursor });
        schedulePersist(String(cardId), entry.snapshot);
      }).pipe(
        Effect.catchAll((cause) =>
          Effect.fail(
            new CardStateError({
              operation: 'redo',
              message: 'Failed to redo card state',
              cause,
            })
          )
        )
      ),

    subscribe: (cardId, onUpdate) =>
      Effect.sync(() => {
        const atoms = getCardStateAtoms(cardId);
        const unsubscribe = registry.subscribe(atoms.snapshot, (snapshot) => {
          onUpdate(snapshot);
        });
        return unsubscribe;
      }).pipe(
        Effect.catchAll((cause) =>
          Effect.fail(
            new CardStateError({
              operation: 'subscribe',
              message: 'Failed to subscribe to card state',
              cause,
            })
          )
        )
      ),
  };
}

export const CardStateServiceLive = (
  registry: AtomRegistry
): Layer.Layer<CardStateService> => Layer.succeed(CardStateService, createCardStateService(registry));
