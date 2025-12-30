/**
 * @fileoverview Dataplane Module - d2ts-backed linking system
 *
 * Provides the infrastructure for linking EmbeddedBlockWrapper components
 * with differential dataflow semantics.
 *
 * @example
 * ```tsx
 * import { dataplaneOps, portsAtom, linksAtom } from '@/lib/dataplane';
 *
 * // Register a port
 * await dataplaneOps.registerPort({
 *   blockId: 'my-block',
 *   direction: 'in',
 *   dataType: 'table',
 *   position: 'left',
 * });
 *
 * // Create a link
 * await dataplaneOps.createLink({
 *   sourcePort: 'port-1',
 *   targetPort: 'port-2',
 *   direction: 'unidirectional',
 *   relationship: 'pipe',
 * });
 * ```
 */

// =============================================================================
// Schemas
// =============================================================================

export {
  // Branded ID types
  PortId,
  LinkId,
  PlaneId,
  BlockId,
  // Enum schemas
  LinkDirection,
  LinkRelationship,
  PortDirection,
  PortPosition,
  PortDataType,
  // Entity schemas
  LinkPort,
  Link,
  Plane,
  // Collection schemas
  Links,
  LinkPorts,
  Planes,
  // Config schemas
  CreateLinkConfig,
  CreatePortConfig,
  CreatePlaneConfig,
} from './schemas/link';

export type {
  PortId as PortIdType,
  LinkId as LinkIdType,
  PlaneId as PlaneIdType,
  BlockId as BlockIdType,
  LinkDirection as LinkDirectionType,
  LinkRelationship as LinkRelationshipType,
  PortDirection as PortDirectionType,
  PortPosition as PortPositionType,
  PortDataType as PortDataTypeType,
  CreateLinkConfig as CreateLinkConfigType,
  CreatePortConfig as CreatePortConfigType,
  CreatePlaneConfig as CreatePlaneConfigType,
} from './schemas/link';

// =============================================================================
// Atoms
// =============================================================================

export {
  // Runtime
  dataplaneRuntimeAtom,
  // State atoms
  portsAtom,
  linksAtom,
  planesAtom,
  versionAtom,
  graphInitializedAtom,
  // Derived atoms
  portsByIdAtom,
  linksByIdAtom,
  planesByIdAtom,
  linkCountAtom,
  portCountAtom,
  planeCountAtom,
  linksBySourceAtom,
  linksByTargetAtom,
  // Family atoms
  portAtom,
  linkAtom,
  planeAtom,
  linksForPortAtom,
  portsInPlaneAtom,
  // Operations
  dataplaneOps,
} from './atoms';

// =============================================================================
// Components
// =============================================================================

export {
  // Port indicators
  LinkPortIndicator,
  type LinkPortIndicatorProps,
  // React Flow components
  DataplaneVisualizer,
  type DataplaneVisualizerProps,
  type VisualizerMode,
  type VisualizerScope,
  BidirectionalEdge,
  type BidirectionalEdgeData,
  type BidirectionalEdgeProps,
  LinkPortNode,
  type LinkPortNodeData,
  type LinkPortNodeProps,
  // Settings panels
  LinkSettingsPanel,
  type LinkSettingsPanelProps,
  // Debug panels
  DataplaneDebugPanel,
  type DataplaneDebugPanelProps,
} from './components';

// =============================================================================
// Services
// =============================================================================

export {
  // PipelineBuilder service for d2ts pipeline wiring
  PipelineBuilder,
  PipelineBuilderLive,
  type PipelineBuilderShape,
  type PipelineConfig,
  type PipelineResult,
  type TransformFn,
} from './services';

// =============================================================================
// Hooks
// =============================================================================

export {
  // Main dataplane hook
  useDataplane,
  usePort,
  type UseDataplaneReturn,
  // Port data hooks
  usePortData,
  useHasIncoming,
  useHasOutgoing,
  useBlockPorts,
  type UsePortDataReturn,
} from './hooks';

// =============================================================================
// Persistence
// =============================================================================

export {
  // Models
  LinkPortModel,
  LinkModel,
  PlaneModel,
  // Repositories
  LinkPortRepo,
  LinkRepo,
  PlaneRepo,
  AllDataplaneRepositoriesLive,
  // Service
  DataplanePersistenceService,
  DataplanePersistenceServiceLive,
  DataplanePersistenceLive,
  DataplanePersistenceError,
  type DataplanePersistenceServiceShape,
} from './persistence';
