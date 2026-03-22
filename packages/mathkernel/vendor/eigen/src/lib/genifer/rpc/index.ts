/**
 * Genifer RPC Layer — public barrel
 *
 * @module genifer/rpc
 */

// Tags
export * from './tags'

// Errors
export * from './errors'

// RPCs
export {
  GeniferRpcs,
  GeniferTreeRpcs,
  GeniferElementRpcs,
  GeniferCompositeRpcs,
  GeniferSignalRpcs,
  // Individual RPCs for selective import
  GetTreeById,
  FindTreesByThread,
  FindTreesByQuality,
  InsertTree,
  UpdateTreeRating,
  IncrementTreeUsage,
  DeleteTree,
  FindElementsByTree,
  FindElementByKey,
  InsertElementBatch,
  DeleteElementsByTree,
  FindCompositeByName,
  InsertComposite,
  ListComposites,
  RecordSignal,
  GetSignalsForTree,
} from './GeniferRpcs'

// Handlers
export {
  GeniferTreeHandlers,
  GeniferElementHandlers,
  GeniferCompositeHandlers,
  GeniferSignalHandlers,
} from './handlers'
