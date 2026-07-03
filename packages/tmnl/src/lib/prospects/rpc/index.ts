/**
 * Prospect Pipeline — RPC Groups (Entity-Derived)
 *
 * Uses EntityProxy.toRpcGroup() to derive RPCs from each Entity.
 * Combined into ProspectRpcs for server mounting.
 *
 * Following the IIoT rpc/index.ts barrel pattern.
 *
 * @module prospects/rpc
 */

import { RpcGroup } from '@effect/rpc'
import { EntityProxy } from '@effect/cluster'
import { CompanyEntity } from '../entity/CompanyEntity'
import { DecisionMakerEntity } from '../entity/DecisionMakerEntity'
import { SignalEntity } from '../entity/SignalEntity'
import { ProposalEntity } from '../entity/ProposalEntity'
import { OutreachEntity } from '../entity/OutreachEntity'

// =============================================================================
// Entity-Derived RPC Groups
// =============================================================================

export class CompanyRpcs extends EntityProxy.toRpcGroup(CompanyEntity) {}
export class DecisionMakerRpcs extends EntityProxy.toRpcGroup(DecisionMakerEntity) {}
export class SignalRpcs extends EntityProxy.toRpcGroup(SignalEntity) {}
export class ProposalRpcs extends EntityProxy.toRpcGroup(ProposalEntity) {}
export class OutreachRpcs extends EntityProxy.toRpcGroup(OutreachEntity) {}

// =============================================================================
// Combined Prospect RPC Group
// =============================================================================

/**
 * All prospect pipeline RPCs in a single group.
 *
 * 5 entities × (N RPCs each) × 2 (standard + discard) = ~50 RPCs total.
 *
 * Entities:
 * - Company: Create, Get, UpdateStage, Enrich
 * - DecisionMaker: Create, Get, RecalculateCIP, UpdateContacts, SetContractEstimate, UpdateStage
 * - Signal: Create, Get, AttachToDM, Expire
 * - Proposal: Create, Get, DraftSection, AdvanceStatus, SetEstimate, SetCapabilities
 * - Outreach: Create, Get, MarkSent, MarkReplied, MarkBounced
 */
export const ProspectRpcs = RpcGroup.make(
  ...Array.from(CompanyRpcs.requests.values()),
  ...Array.from(DecisionMakerRpcs.requests.values()),
  ...Array.from(SignalRpcs.requests.values()),
  ...Array.from(ProposalRpcs.requests.values()),
  ...Array.from(OutreachRpcs.requests.values()),
)

export type ProspectRpcs = typeof ProspectRpcs
