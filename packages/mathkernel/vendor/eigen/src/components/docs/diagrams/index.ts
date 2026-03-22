/**
 * Living Documentation - Diagrams
 *
 * Mermaid-powered architectural diagrams for TMNL.
 *
 * @module docs/diagrams
 */

export { DiagramViewer, type DiagramViewerProps } from "./DiagramViewer"
export { DiagramsPage } from "./DiagramsPage"
export {
  DIAGRAM_REGISTRY,
  getDiagram,
  getDiagramsByCategory,
  getCategoryCounts,
  type DiagramId,
  type DiagramCategory,
  type DiagramEntry,
} from "./registry"
