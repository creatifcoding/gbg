/**
 * Layer System v1
 *
 * Re-exports from v1/ for backwards compatibility.
 * v2 architecture in development — see IDEA-MILL for roadmap.
 */

// Services
export { IdGenerator, IdGeneratorConfig } from './v1/services/IdGenerator';
export { LayerFactory } from './v1/services/LayerFactory';
export { LayerManager } from './v1/services/LayerManager';

// Machines
export { layerMachine, createLayerActor } from './v1/machines/layerMachine';

// Atoms
export {
  layerRuntimeAtom,
  layersAtom,
  layerIndexAtom,
  layerSortedAtom,
  layerAtom,
  layerOpsAtom,
} from './v1/atoms';

// React Integration
export { withLayering } from './v1/withLayering';
export { useLayer } from './v1/useLayer';

// Types
export type {
  LayerConfig,
  LayerInstance,
  LayerManagerOps,
  PointerEventsBehavior,
  PositionMode,
  IdStrategy,
  IdGeneratorConfig as IdGeneratorConfigType,
} from './v1/types';
