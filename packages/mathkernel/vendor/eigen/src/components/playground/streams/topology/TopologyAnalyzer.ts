import type { TopologyLink, TopologyNode } from '../viz/D3TopologyGraph'

export type DegreeBucket = {
  readonly degree: number
  readonly count: number
}

export type TopologyMetrics = {
  readonly nodeCount: number
  readonly linkCount: number
  readonly sourceCount: number
  readonly sinkCount: number
  readonly isolatedCount: number
  readonly averageInDegree: number
  readonly averageOutDegree: number
  readonly averageDegree: number
  readonly maxDegree: number
  readonly edgeDensity: number
  readonly isolatedRatio: number
  readonly degreeDistribution: ReadonlyArray<DegreeBucket>
}

const round = (value: number, precision = 3): number => {
  const scale = 10 ** precision
  return Math.round(value * scale) / scale
}

export const analyzeTopology = (
  nodes: ReadonlyArray<TopologyNode>,
  links: ReadonlyArray<TopologyLink>
): TopologyMetrics => {
  const nodeCount = nodes.length
  const linkCount = links.length

  if (nodeCount === 0) {
    return {
      nodeCount: 0,
      linkCount: 0,
      sourceCount: 0,
      sinkCount: 0,
      isolatedCount: 0,
      averageInDegree: 0,
      averageOutDegree: 0,
      averageDegree: 0,
      maxDegree: 0,
      edgeDensity: 0,
      isolatedRatio: 0,
      degreeDistribution: [],
    }
  }

  const indegree = new Map<string, number>()
  const outdegree = new Map<string, number>()

  for (const node of nodes) {
    indegree.set(node.id, 0)
    outdegree.set(node.id, 0)
  }

  for (const link of links) {
    if (outdegree.has(link.source)) {
      outdegree.set(link.source, (outdegree.get(link.source) ?? 0) + 1)
    }
    if (indegree.has(link.target)) {
      indegree.set(link.target, (indegree.get(link.target) ?? 0) + 1)
    }
  }

  let sourceCount = 0
  let sinkCount = 0
  let isolatedCount = 0
  let maxDegree = 0
  let inTotal = 0
  let outTotal = 0

  const degreeBuckets = new Map<number, number>()

  for (const node of nodes) {
    const inDeg = indegree.get(node.id) ?? 0
    const outDeg = outdegree.get(node.id) ?? 0
    const degree = inDeg + outDeg

    inTotal += inDeg
    outTotal += outDeg

    if (inDeg === 0 && outDeg > 0) sourceCount += 1
    if (inDeg > 0 && outDeg === 0) sinkCount += 1
    if (degree === 0) isolatedCount += 1

    if (degree > maxDegree) {
      maxDegree = degree
    }

    degreeBuckets.set(degree, (degreeBuckets.get(degree) ?? 0) + 1)
  }

  const maxPossibleEdges = nodeCount > 1 ? nodeCount * (nodeCount - 1) : 0

  return {
    nodeCount,
    linkCount,
    sourceCount,
    sinkCount,
    isolatedCount,
    averageInDegree: round(inTotal / nodeCount),
    averageOutDegree: round(outTotal / nodeCount),
    averageDegree: round((inTotal + outTotal) / nodeCount),
    maxDegree,
    edgeDensity:
      maxPossibleEdges === 0 ? 0 : round(linkCount / maxPossibleEdges),
    isolatedRatio: round(isolatedCount / nodeCount),
    degreeDistribution: Array.from(degreeBuckets.entries())
      .map(([degree, count]) => ({ degree, count }))
      .sort((a, b) => a.degree - b.degree),
  }
}
