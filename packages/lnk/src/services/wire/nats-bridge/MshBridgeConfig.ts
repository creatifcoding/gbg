/** Shared naming helpers for the MSH-backed bridge substrate. */

import type { StreamId } from "../../../contracts/StreamId.js"
import {
  DEFAULT_NATS_BRIDGE_OPTIONS,
  resolveNatsBridgeWireOptions,
  type NatsBridgeWireOptions,
  type ResolvedNatsBridgeWireOptions,
} from "./NatsBridgeWire.js"

export type MshBridgeSubstrateOptions = NatsBridgeWireOptions
export type ResolvedMshBridgeSubstrateOptions = ResolvedNatsBridgeWireOptions

export const DEFAULT_MSH_BRIDGE_SUBSTRATE_OPTIONS = DEFAULT_NATS_BRIDGE_OPTIONS
export const resolveMshBridgeSubstrateOptions = resolveNatsBridgeWireOptions

export const safeStreamToken = (streamId: StreamId): string =>
  encodeURIComponent(streamId as string)
    .replaceAll("%", "_")
    .replaceAll(".", "_2E")
    .replaceAll("-", "_2D")

export const metadataKeyForStream = (streamId: StreamId): string =>
  `stream.${safeStreamToken(streamId)}`

export const subjectForStream = (
  streamId: StreamId,
  options: ResolvedMshBridgeSubstrateOptions,
): string => `${options.subjectRoot}.${safeStreamToken(streamId)}`

export const streamNameForStream = (
  streamId: StreamId,
  options: ResolvedMshBridgeSubstrateOptions,
): string => `${options.streamNamePrefix}_${safeStreamToken(streamId)}`
