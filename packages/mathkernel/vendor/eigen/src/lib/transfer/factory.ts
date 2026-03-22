import { nanoid } from 'nanoid'
import type {
  TransferOrigin,
  TransferReferenceToken,
  TransferTaskClusterReference,
  TransferTaskReference,
} from './types'

export function createTaskReferenceToken(
  origin: TransferOrigin,
  reference: Omit<TransferTaskReference, '_tag' | 'kind'>,
): TransferReferenceToken {
  return {
    tokenId: nanoid(),
    version: '1',
    createdAt: Date.now(),
    origin,
    reference: {
      _tag: 'TransferTaskReference',
      kind: 'task',
      ...reference,
    },
  }
}

export function createTaskClusterReferenceToken(
  origin: TransferOrigin,
  reference: Omit<TransferTaskClusterReference, '_tag' | 'kind'>,
): TransferReferenceToken {
  return {
    tokenId: nanoid(),
    version: '1',
    createdAt: Date.now(),
    origin,
    reference: {
      _tag: 'TransferTaskClusterReference',
      kind: 'task-cluster',
      ...reference,
    },
  }
}
