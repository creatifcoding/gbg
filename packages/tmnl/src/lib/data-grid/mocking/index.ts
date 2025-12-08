/**
 * Data Grid Mocking Utilities
 *
 * Effect-based streaming mock data for testbed demos.
 */

// Schemas
export {
  MockRowStatus,
  MockRow,
  RowUpdate,
  StreamEvent,
  StreamConfig,
  DEFAULT_STREAM_CONFIG,
} from './stream'

// Generators
export {
  generateMockRow,
  generateMockRows,
  applyRandomUpdates,
} from './stream'

// Streams
export {
  createMockDataStream,
  createFiniteMockStream,
} from './stream'

// Operators
export {
  filterUpdatesOnly,
  mapToRows,
  throttleStream,
} from './stream'
