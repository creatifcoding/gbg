import {
  assertEdge,
  decodeEdge,
  type Edge,
  type EdgeKind,
  type NodeRef,
} from '../schemas/edge'

export function createEdge(input: {
  id: string
  kind: EdgeKind
  from: NodeRef
  to: NodeRef
  createdAt?: number
}): Edge {
  return assertEdge(
    decodeEdge({
      id: input.id,
      kind: input.kind,
      from: input.from,
      to: input.to,
      createdAt: input.createdAt ?? Date.now(),
    }),
  )
}

export { assertEdge, EdgeEndpointError } from '../schemas/edge'
