import { Schema } from 'effect'
import {
  AnalogId,
  CardId,
  EdgeId,
  FunctionId,
  MechanismId,
  OrganismId,
  StructureId,
} from './identifiers'

export const CardNode = Schema.TaggedStruct('card', { id: CardId })
export type CardNode = typeof CardNode.Type

export const AnalogNode = Schema.TaggedStruct('analog', { id: AnalogId })
export type AnalogNode = typeof AnalogNode.Type

export const OrganismNode = Schema.TaggedStruct('organism', { id: OrganismId })
export type OrganismNode = typeof OrganismNode.Type

export const StructureNode = Schema.TaggedStruct('structure', { id: StructureId })
export type StructureNode = typeof StructureNode.Type

export const MechanismNode = Schema.TaggedStruct('mechanism', { id: MechanismId })
export type MechanismNode = typeof MechanismNode.Type

export const FunctionNode = Schema.TaggedStruct('function', { id: FunctionId })
export type FunctionNode = typeof FunctionNode.Type

export const NodeRef = Schema.Union([
  CardNode,
  AnalogNode,
  OrganismNode,
  StructureNode,
  MechanismNode,
  FunctionNode,
])
export type NodeRef = typeof NodeRef.Type

export const EdgeKind = Schema.Literals([
  'exhibits',
  'performs',
  'via',
  'inspires',
  'contained-in',
  'depicts',
  'contradicts',
] as const)
export type EdgeKind = typeof EdgeKind.Type

export const EDGE_KINDS = [
  'exhibits',
  'performs',
  'via',
  'inspires',
  'contained-in',
  'depicts',
  'contradicts',
] as const satisfies ReadonlyArray<EdgeKind>

export const Edge = Schema.Struct({
  id: EdgeId,
  kind: EdgeKind,
  from: NodeRef,
  to: NodeRef,
  createdAt: Schema.Number,
})
export type Edge = typeof Edge.Type

export const decodeEdge = Schema.decodeUnknownSync(Edge)

export class EdgeEndpointError extends Error {
  readonly _tag = 'EdgeEndpointError'
  constructor(
    readonly kind: EdgeKind,
    readonly from: NodeRef,
    readonly to: NodeRef,
  ) {
    super(`Edge '${kind}' does not accept ${from._tag} → ${to._tag}`)
    this.name = 'EdgeEndpointError'
  }
}

function sameNode(from: NodeRef, to: NodeRef): boolean {
  return from._tag === to._tag && from.id === to.id
}

export function edgeEndpointsAllowed(
  kind: EdgeKind,
  from: NodeRef,
  to: NodeRef,
): boolean {
  switch (kind) {
    case 'exhibits':
      return from._tag === 'organism' && to._tag === 'structure'
    case 'performs':
      return from._tag === 'structure' && to._tag === 'function'
    case 'via':
      return (
        (from._tag === 'function' || from._tag === 'structure') &&
        to._tag === 'mechanism'
      )
    case 'inspires':
      return from._tag === 'mechanism' && to._tag === 'analog'
    case 'contained-in':
      return from._tag === 'card' && to._tag === 'card' && !sameNode(from, to)
    case 'depicts':
      return (
        from._tag === 'card' &&
        (to._tag === 'organism' ||
          to._tag === 'structure' ||
          to._tag === 'mechanism' ||
          to._tag === 'function' ||
          to._tag === 'analog')
      )
    case 'contradicts':
      return !sameNode(from, to)
    default: {
      const _exhaustive: never = kind
      return _exhaustive
    }
  }
}

export function assertEdge(edge: Edge): Edge {
  if (!edgeEndpointsAllowed(edge.kind, edge.from, edge.to)) {
    throw new EdgeEndpointError(edge.kind, edge.from, edge.to)
  }
  return edge
}

export function isEdgeKind(value: string): value is EdgeKind {
  return (EDGE_KINDS as readonly string[]).includes(value)
}
