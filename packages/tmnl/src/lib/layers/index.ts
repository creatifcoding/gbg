// Services
export { IdGenerator, IdGeneratorConfig } from './services/IdGenerator';
export { LayerFactory } from './services/LayerFactory';
export { LayerManager } from './services/LayerManager';

// Machines
export { layerMachine, createLayerActor } from './machines/layerMachine';

// Atoms
export {
  layerRuntimeAtom,
  layersAtom,
  layerIndexAtom,
  layerSortedAtom,
  layerAtom,
  layerOpsAtom,
} from './atoms';

// React Integration
export { withLayering } from './withLayering';
export { useLayer } from './useLayer';

// Types
export type {
  LayerConfig,
  LayerInstance,
  LayerManagerOps,
  PointerEventsBehavior,
  PositionMode,
  IdStrategy,
  IdGeneratorConfig as IdGeneratorConfigType,
} from './types';
