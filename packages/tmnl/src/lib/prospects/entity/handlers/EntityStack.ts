/**
 * Prospect Pipeline — Entity Stack Layer Composition
 *
 * All entity handlers merged into a single layer.
 * Mirrors IIoT EntityStack.ts pattern.
 *
 * Requires:
 * - CompanyRepository, DecisionMakerRepository, SignalRepository,
 *   OutreachRepository, ProposalRepository
 * - CIPScoring
 * - ProvenanceService
 * - SqlClient (from PG or SQLite layer)
 *
 * @module prospects/entity/handlers/EntityStack
 */

import { Layer } from 'effect'
import { CompanyEntityHandlers } from './CompanyHandlers'
import { DecisionMakerEntityHandlers } from './DecisionMakerHandlers'
import { SignalEntityHandlers } from './SignalHandlers'
import { ProposalEntityHandlers } from './ProposalHandlers'
import { OutreachEntityHandlers } from './OutreachHandlers'

// =============================================================================
// Handler Layer Composition
// =============================================================================

/**
 * All prospect entity handlers merged into a single layer.
 *
 * Usage:
 * ```typescript
 * const program = Effect.gen(function* () {
 *   // Use entity clients via Sharding
 * }).pipe(
 *   Effect.provide(ProspectEntityHandlers),
 *   Effect.provide(ProspectServicesLayer),  // repos + CIP + provenance
 *   Effect.provide(ProspectPgLayer),        // SqlClient
 * )
 * ```
 */
export const ProspectEntityHandlers = Layer.mergeAll(
  CompanyEntityHandlers,
  DecisionMakerEntityHandlers,
  SignalEntityHandlers,
  ProposalEntityHandlers,
  OutreachEntityHandlers,
)
