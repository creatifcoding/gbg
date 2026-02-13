/**
 * Transfer v2 Token Factory
 *
 * Construct TransferToken values for task and cluster references.
 * Flattened origin — surface config is spread directly into token.
 *
 * See: src/lib/transfer/docs/redesign/02-transfer-schema-redesign.md §Token
 *
 * @since v2
 */
import { nanoid } from 'nanoid'
import type { TransferToken } from './schemas'

// ── Surface Config ───────────────────────────────────────────

/** Surface identity for token origin (first curry application) */
export interface TransferSurfaceConfig {
  readonly surfaceId: string
  readonly sourceId: string
  readonly sourceLabel: string
  readonly threadId?: string | undefined
  readonly agentId?: string | undefined
}

// ── Task Token ───────────────────────────────────────────────

export interface MakeTaskTokenInput {
  readonly taskId: string
  readonly label: string
  readonly status?: string | undefined
}

/** Create a TransferToken with a TaskRef payload */
export function makeTaskToken(
  surface: TransferSurfaceConfig,
  input: MakeTaskTokenInput,
): TransferToken {
  return {
    tokenId: nanoid(),
    version: '2',
    surfaceId: surface.surfaceId,
    sourceId: surface.sourceId,
    sourceLabel: surface.sourceLabel,
    threadId: surface.threadId,
    agentId: surface.agentId,
    ref: {
      _tag: 'TaskRef',
      kind: 'task',
      id: nanoid(),
      taskId: input.taskId,
      label: input.label,
      status: input.status,
    },
    createdAt: Date.now(),
  }
}

// ── Cluster Token ────────────────────────────────────────────

export interface MakeClusterTokenInput {
  readonly label: string
  readonly taskIds: ReadonlyArray<string>
}

/** Create a TransferToken with a ClusterRef payload */
export function makeClusterToken(
  surface: TransferSurfaceConfig,
  input: MakeClusterTokenInput,
): TransferToken {
  return {
    tokenId: nanoid(),
    version: '2',
    surfaceId: surface.surfaceId,
    sourceId: surface.sourceId,
    sourceLabel: surface.sourceLabel,
    threadId: surface.threadId,
    agentId: surface.agentId,
    ref: {
      _tag: 'ClusterRef',
      kind: 'task-cluster',
      id: nanoid(),
      clusterId: nanoid(),
      label: input.label,
      taskIds: Array.from(input.taskIds),
    },
    createdAt: Date.now(),
  }
}
