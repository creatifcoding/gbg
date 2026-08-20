import { assertEdge, type Edge } from '../schemas/edge'
import type { EdgeId } from '../schemas/identifiers'
import type { CatalogSnapshot } from '../models/catalog-snapshot'

export function findEdge(
  snapshot: CatalogSnapshot,
  id: EdgeId | string,
): Edge | undefined {
  return snapshot.edges.find((edge) => edge.id === id)
}

export function insertEdge(
  snapshot: CatalogSnapshot,
  edge: Edge,
): CatalogSnapshot {
  assertEdge(edge)
  if (snapshot.edges.some((item) => item.id === edge.id)) {
    return snapshot
  }
  return { ...snapshot, edges: [edge, ...snapshot.edges] }
}
