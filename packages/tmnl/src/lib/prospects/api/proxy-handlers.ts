/**
 * Prospect Pipeline — EntityProxyServer Handlers
 *
 * Creates HttpApi handler layers for all 5 entities using
 * EntityProxyServer.layerHttpApi(). Routes HTTP → Cluster → Entity.
 *
 * @module prospects/api/proxy-handlers
 */

import { EntityProxyServer } from '@effect/cluster'
import { Layer } from 'effect'
import { ProspectApi } from './contract'

import { CompanyEntity } from '../entity/CompanyEntity'
import { DecisionMakerEntity } from '../entity/DecisionMakerEntity'
import { SignalEntity } from '../entity/SignalEntity'
import { ProposalEntity } from '../entity/ProposalEntity'
import { OutreachEntity } from '../entity/OutreachEntity'

/**
 * Combined proxy handler layer for all 5 prospect entities.
 *
 * Group names must match those in ProspectApi.add() calls.
 */
export const ProxyHandlers = Layer.mergeAll(
  EntityProxyServer.layerHttpApi(ProspectApi, 'companies', CompanyEntity),
  EntityProxyServer.layerHttpApi(ProspectApi, 'dms', DecisionMakerEntity),
  EntityProxyServer.layerHttpApi(ProspectApi, 'signals', SignalEntity),
  EntityProxyServer.layerHttpApi(ProspectApi, 'proposals', ProposalEntity),
  EntityProxyServer.layerHttpApi(ProspectApi, 'outreach', OutreachEntity),
)
