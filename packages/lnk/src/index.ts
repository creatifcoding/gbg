/**
 * @tmnl/lnk — Effect v4-native Durable Streams library
 *
 * 🚧 Under active construction. See `./ARCHITECTURE.md` (in package root) for the rebuild plan.
 *
 * Phase status:
 *   - Phase 0 (Foundation contracts) : in progress
 *   - Phase 1 (Wire layer)           : not started
 *   - Phase 2 (Stream handle)        : not started
 *   - Phase 3 (Idempotent producer)  : not started
 *   - Phase 4 (React/Atom surface)   : not started
 *   - Phase 5 (NATS-bridge adapter)  : not started
 *   - Phase 6 (Observability)        : not started
 *   - Phase 7 (StreamDB / state)     : not started
 *
 * @module
 */

// Phase 0 — wire & type contracts
export * as Contracts from './contracts/index.js'

// Phase 1 — wire layer
export * as Services from './services/index.js'

// Phase 2 exports (forthcoming):
//   export * from './client/index.js';
//   export * from './stream/index.js';

// Phase 3 exports (forthcoming):
//   export * from './producer/index.js';
