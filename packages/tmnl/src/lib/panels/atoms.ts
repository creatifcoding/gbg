/**
 * Panel System Atoms
 *
 * Reactive state management for panels using effect-atom
 */

import { Atom } from '@effect-atom/atom';
import { HashMap, Option } from 'effect';
import type {
  PanelId,
  LayoutId,
  PanelConfig,
  PanelGroupConfig,
  LayoutConfig,
  PanelState,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Materialized Views (Read-Only State)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All registered panel configurations
 * Key: PanelId, Value: PanelConfig
 */
export const panelConfigsAtom = Atom.make<
  HashMap.HashMap<PanelId, PanelConfig>
>(HashMap.empty());

/**
 * All registered panel groups
 * Key: groupId (string), Value: PanelGroupConfig
 */
export const panelGroupsAtom = Atom.make<
  HashMap.HashMap<string, PanelGroupConfig>
>(HashMap.empty());

/**
 * All registered layouts
 * Key: LayoutId, Value: LayoutConfig
 */
export const layoutsAtom = Atom.make<HashMap.HashMap<LayoutId, LayoutConfig>>(
  HashMap.empty()
);

/**
 * Current active layout ID
 */
export const activeLayoutIdAtom = Atom.make<LayoutId | null>(null);

/**
 * Runtime panel states (sizes, collapsed, visible)
 * Key: PanelId, Value: PanelState
 */
export const panelStatesAtom = Atom.make<HashMap.HashMap<PanelId, PanelState>>(
  HashMap.empty()
);

/**
 * Currently focused/active panel ID
 */
export const activePanelIdAtom = Atom.make<PanelId | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// Derived Atoms
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get active layout configuration
 */
export const activeLayoutAtom = Atom.make((get) => {
  const activeId = get(activeLayoutIdAtom);
  if (!activeId) return null;

  const layouts = get(layoutsAtom);
  return HashMap.get(layouts, activeId);
});

/**
 * Get active panel configuration
 */
export const activePanelAtom = Atom.make((get) => {
  const activeId = get(activePanelIdAtom);
  if (!activeId) return null;

  const configs = get(panelConfigsAtom);
  return HashMap.get(configs, activeId);
});

/**
 * Get active panel state
 */
export const activePanelStateAtom = Atom.make((get) => {
  const activeId = get(activePanelIdAtom);
  if (!activeId) return null;

  const states = get(panelStatesAtom);
  return HashMap.get(states, activeId);
});

/**
 * Count of visible panels
 */
export const visiblePanelCountAtom = Atom.make((get) => {
  const states = get(panelStatesAtom);
  let count = 0;

  for (const [, state] of states) {
    if (state.visible) count++;
  }

  return count;
});

/**
 * Count of collapsed panels
 */
export const collapsedPanelCountAtom = Atom.make((get) => {
  const states = get(panelStatesAtom);
  let count = 0;

  for (const [, state] of states) {
    if (state.collapsed) count++;
  }

  return count;
});

/**
 * Get all panel IDs in the active layout
 */
export const activePanelIdsAtom = Atom.make((get) => {
  const layoutOption = get(activeLayoutAtom);
  if (!layoutOption || Option.isNone(layoutOption)) return [];

  const layout = layoutOption.value;
  const allPanelIds: PanelId[] = [];

  for (const group of layout.groups) {
    allPanelIds.push(...group.panels);
  }

  return allPanelIds;
});

/**
 * Check if a layout has unsaved changes
 */
export const hasUnsavedChangesAtom = Atom.make((get) => {
  const layoutOption = get(activeLayoutAtom);
  if (!layoutOption || Option.isNone(layoutOption)) return false;

  return false;
});

// ─────────────────────────────────────────────────────────────────────────────
// Runtime Atom & Operation Atoms
// ─────────────────────────────────────────────────────────────────────────────

import { PanelService } from './service';
import * as Effect from 'effect/Effect';

export const panelRuntimeAtom = Atom.runtime(PanelService.Default);

export const panelOps = {
  registerPanel: panelRuntimeAtom.fn<PanelConfig>()((config, ctx) =>
    Effect.gen(function* () {
      const service = yield* PanelService;
      const validated = yield* service.validatePanel(config);

      const currentPanels = ctx(panelConfigsAtom);
      ctx.set(
        panelConfigsAtom,
        HashMap.set(currentPanels, validated.id, validated)
      );

      const initialState = service.createInitialState(validated);
      const currentStates = ctx(panelStatesAtom);
      ctx.set(
        panelStatesAtom,
        HashMap.set(currentStates, validated.id, initialState)
      );

      return validated;
    })
  ),

  unregisterPanel: panelRuntimeAtom.fn<PanelId>()((panelId, ctx) =>
    Effect.sync(() => {
      const currentPanels = ctx(panelConfigsAtom);
      ctx.set(panelConfigsAtom, HashMap.remove(currentPanels, panelId));

      const currentStates = ctx(panelStatesAtom);
      ctx.set(panelStatesAtom, HashMap.remove(currentStates, panelId));
    })
  ),

  registerGroup: panelRuntimeAtom.fn<PanelGroupConfig>()((group, ctx) =>
    Effect.sync(() => {
      const currentGroups = ctx(panelGroupsAtom);
      ctx.set(panelGroupsAtom, HashMap.set(currentGroups, group.id, group));
    })
  ),

  registerLayout: panelRuntimeAtom.fn<LayoutConfig>()((layout, ctx) =>
    Effect.gen(function* () {
      const service = yield* PanelService;
      const validated = yield* service.validateLayout(layout);

      const currentLayouts = ctx(layoutsAtom);
      ctx.set(
        layoutsAtom,
        HashMap.set(currentLayouts, validated.id, validated)
      );

      return validated;
    })
  ),

  setActiveLayout: panelRuntimeAtom.fn<LayoutId>()((layoutId, ctx) =>
    Effect.sync(() => {
      ctx.set(activeLayoutIdAtom, layoutId);
    })
  ),

  setActivePanel: panelRuntimeAtom.fn<PanelId | null>()((panelId, ctx) =>
    Effect.sync(() => {
      ctx.set(activePanelIdAtom, panelId);
    })
  ),

  updatePanelState: panelRuntimeAtom.fn<{
    panelId: PanelId;
    update: Partial<Omit<PanelState, '_tag' | 'id'>>;
  }>()(({ panelId, update }, ctx) =>
    Effect.sync(() => {
      const currentStates = ctx(panelStatesAtom);
      const currentStateOption = HashMap.get(currentStates, panelId);

      if (currentStateOption._tag === 'Some') {
        const updated: PanelState = {
          ...currentStateOption.value,
          ...update,
        };
        ctx.set(panelStatesAtom, HashMap.set(currentStates, panelId, updated));
      }
    })
  ),

  collapsePanel: panelRuntimeAtom.fn<PanelId>()((panelId, ctx) =>
    Effect.sync(() => {
      const currentStates = ctx(panelStatesAtom);
      const currentStateOption = HashMap.get(currentStates, panelId);

      if (currentStateOption._tag === 'Some') {
        const updated: PanelState = {
          ...currentStateOption.value,
          collapsed: true,
        };
        ctx.set(panelStatesAtom, HashMap.set(currentStates, panelId, updated));
      }
    })
  ),

  expandPanel: panelRuntimeAtom.fn<PanelId>()((panelId, ctx) =>
    Effect.sync(() => {
      const currentStates = ctx(panelStatesAtom);
      const currentStateOption = HashMap.get(currentStates, panelId);

      if (currentStateOption._tag === 'Some') {
        const updated: PanelState = {
          ...currentStateOption.value,
          collapsed: false,
        };
        ctx.set(panelStatesAtom, HashMap.set(currentStates, panelId, updated));
      }
    })
  ),

  setPanelSize: panelRuntimeAtom.fn<{ panelId: PanelId; size: number }>()(
    ({ panelId, size }, ctx) =>
      Effect.sync(() => {
        const currentStates = ctx(panelStatesAtom);
        const currentStateOption = HashMap.get(currentStates, panelId);

        if (currentStateOption._tag === 'Some') {
          const updated: PanelState = {
            ...currentStateOption.value,
            size,
          };
          ctx.set(
            panelStatesAtom,
            HashMap.set(currentStates, panelId, updated)
          );
        }
      })
  ),

  setPanelVisible: panelRuntimeAtom.fn<{
    panelId: PanelId;
    visible: boolean;
  }>()(({ panelId, visible }, ctx) =>
    Effect.sync(() => {
      const currentStates = ctx(panelStatesAtom);
      const currentStateOption = HashMap.get(currentStates, panelId);

      if (currentStateOption._tag === 'Some') {
        const updated: PanelState = {
          ...currentStateOption.value,
          visible,
        };
        ctx.set(panelStatesAtom, HashMap.set(currentStates, panelId, updated));
      }
    })
  ),
};
