/**
 * Agent Task Atoms — default atom surface exports.
 *
 * This module preserves the existing import surface used by views/components,
 * while delegating construction to the DI-able atom surface factory.
 *
 * For dependency injection, use `AgentTaskLogAtomSurface` from `./surface`.
 *
 * @module agent-task/atoms
 */

import { AgentTaskServiceMock } from '../services/layers'
import {
  createAgentTaskLogAtomSurfaceAtoms,
  DEFAULT_FILTER,
  type LogFilterState,
  type TailMode,
} from './surface'

const defaultAtoms = createAgentTaskLogAtomSurfaceAtoms(AgentTaskServiceMock)

// ---------------------------------------------------------------------------
// Backward-compatible named exports (current consumers)
// ---------------------------------------------------------------------------

export { DEFAULT_FILTER, type LogFilterState, type TailMode }

export const logRuntimeAtom = defaultAtoms.logRuntimeAtom
export const logBufferFamily = defaultAtoms.logBufferFamily
export const logStreamTrigger = defaultAtoms.logStreamTrigger
export const logFilterAtom = defaultAtoms.logFilterAtom
export const tailModeFamily = defaultAtoms.tailModeFamily
export const filteredLogBufferFamily = defaultAtoms.filteredLogBufferFamily
export const logCountFamily = defaultAtoms.logCountFamily
export const logTotalCountFamily = defaultAtoms.logTotalCountFamily

// ---------------------------------------------------------------------------
// DI-able surface exports
// ---------------------------------------------------------------------------

export {
  AgentTaskLogAtomSurface,
  AgentTaskLogAtomSurfaceMock,
  AgentTaskLogAtomSurfaceNats,
  AgentTaskLogAtomSurfaceNatsMicro,
  AgentTaskLogAtomSurfaceCustom,
  createAgentTaskLogAtomSurfaceAtoms,
  type AgentTaskLogAtomSurfaceAtoms,
  type AgentTaskLogAtomSurfaceShape,
} from './surface'

// ---------------------------------------------------------------------------
// View state/action atoms
// ---------------------------------------------------------------------------

export {
  taskViewModeFamily,
  viewOrder,
  getSlideDirection,
  type TaskViewMode,
} from './view-state'

export {
  taskStatusFamily,
  taskActionsFamily,
  getActionsForStatus,
  type TaskAction,
  type ActionVariant,
} from './task-actions'
