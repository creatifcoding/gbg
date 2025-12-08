import { createMachine, createActor, type Actor, type Observer } from 'xstate';

/** */
/** TODO:  layer lifecycle strings need to be branded enums.
 * Layer lifecycle state machine
 *
 * States:
 * - hidden: Layer is not visible
 * - visible: Layer is visible and interactive
 * - locked: Layer is visible but not interactive
 *
 * Transitions:
 * - SHOW: hidden -> visible
 * - HIDE: visible -> hidden */
/** NOTE: Locked can transition from BOTH visible and hidden.
 * - LOCK: visible -> locked */
/** NOTE: Unlocked can transition from BOTH visible and hidden.
 * - UNLOCK: locked -> visible */
/**
 * - BRING_TO_FRONT: visible -> visible (with side effect)
 * - SEND_TO_BACK: visible -> visible (with side effect)
 */
export const layerMachine = createMachine({
  id: 'layer',
  initial: 'visible',
  states: {
    hidden: {
      on: {
        SHOW: 'visible',
      },
    },
    visible: {
      on: {
        HIDE: 'hidden',
        LOCK: 'locked',
        BRING_TO_FRONT: 'visible',
        SEND_TO_BACK: 'visible',
      },
    },
    locked: {
      on: {
        UNLOCK: 'visible',
        HIDE: 'hidden',
      },
    },
  },
});

/**
 * Create a new layer state machine actor
 *
 * Note: XState 5.x requires defining separate machines for different initial states.
 * We create machine definitions for each possibility.
 */

const hiddenMachine = createMachine({
  id: 'layer',
  initial: 'hidden',
  states: {
    hidden: {
      on: {
        SHOW: 'visible',
      },
    },
    visible: {
      on: {
        HIDE: 'hidden',
        LOCK: 'locked',
        BRING_TO_FRONT: 'visible',
        SEND_TO_BACK: 'visible',
      },
    },
    locked: {
      on: {
        UNLOCK: 'visible',
        HIDE: 'hidden',
      },
    },
  },
});

const lockedMachine = createMachine({
  id: 'layer',
  initial: 'locked',
  states: {
    hidden: {
      on: {
        SHOW: 'visible',
      },
    },
    visible: {
      on: {
        HIDE: 'hidden',
        LOCK: 'locked',
        BRING_TO_FRONT: 'visible',
        SEND_TO_BACK: 'visible',
      },
    },
    locked: {
      on: {
        UNLOCK: 'visible',
        HIDE: 'hidden',
      },
    },
  },
});

/**
 * Options for creating a layer actor
 */
export interface CreateLayerActorOptions {
  /** Initial state */
  initial?: 'hidden' | 'visible' | 'locked';
  /** Inspector function from @statelyai/inspect for DevTools integration */
  inspect?: Observer<unknown>;
}

/**
 * Create a new layer state machine actor
 *
 * @param options - Configuration options including initial state and inspector
 * @returns Actor instance for the layer machine
 *
 * @example
 * ```typescript
 * import { createBrowserInspector } from '@statelyai/inspect';
 * const { inspect } = createBrowserInspector();
 * const actor = createLayerActor({ initial: 'visible', inspect });
 * actor.start();
 * ```
 */
export const createLayerActor = (
  options?: CreateLayerActorOptions
): Actor<typeof layerMachine> => {
  const { initial, inspect } = options ?? {};
  const actorOptions = inspect ? { inspect } : undefined;

  switch (initial) {
    case 'hidden':
      return createActor(hiddenMachine, actorOptions);
    case 'locked':
      return createActor(lockedMachine, actorOptions);
    case 'visible':
    default:
      return createActor(layerMachine, actorOptions);
  }
};
