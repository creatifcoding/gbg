/**
 * Relational Chart Schemas
 *
 * Effect Schema definitions for relational/network chart types:
 * FlowGraph, NetworkGraph, OrganizationChart, MindMap, etc.
 *
 * These charts visualize hierarchical and network data structures.
 *
 * @module charts/schemas/relational
 */

import { Schema } from 'effect';
import { BaseChartPropsSchema, RelationalBaseChartPropsSchema } from './base';

// =============================================================================
// Common Node/Edge Schemas
// =============================================================================

/**
 * Node position schema
 */
export const NodePositionSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
});

/**
 * Base node schema for graph charts
 */
export const GraphNodeSchema = Schema.Struct({
  id: Schema.String,
  label: Schema.optional(Schema.String),
  style: Schema.optional(Schema.Unknown),
  labelCfg: Schema.optional(Schema.Unknown),
});

/**
 * Base edge schema for graph charts
 */
export const GraphEdgeSchema = Schema.Struct({
  source: Schema.String,
  target: Schema.String,
  label: Schema.optional(Schema.String),
  style: Schema.optional(Schema.Unknown),
});

// =============================================================================
// Layout Configuration Schemas
// =============================================================================

export const LayoutTypeSchema = Schema.Literal(
  'dagre',
  'force',
  'circular',
  'radial',
  'concentric',
  'grid',
  'mds',
  'fruchterman',
  'gForce',
  'comboForce',
  'compactBox',
  'dendrogram',
  'indented',
  'mindmap'
);

export const LayoutConfigSchema = Schema.Struct({
  type: LayoutTypeSchema,
  direction: Schema.optional(Schema.Literal('TB', 'BT', 'LR', 'RL', 'H', 'V')),
  rankSep: Schema.optional(Schema.Number),
  nodeSep: Schema.optional(Schema.Number),
  preventOverlap: Schema.optional(Schema.Boolean),
  nodeSize: Schema.optional(Schema.Number),
  linkDistance: Schema.optional(Schema.Number),
  nodeStrength: Schema.optional(Schema.Number),
  edgeStrength: Schema.optional(Schema.Number),
  collideStrength: Schema.optional(Schema.Number),
});

// =============================================================================
// FlowGraph Chart Schema
// =============================================================================

export const FlowGraphChartPropsSchema = RelationalBaseChartPropsSchema.pipe(
  Schema.extend(
    Schema.Struct({
      /** Graph data with nodes and edges */
      data: Schema.optional(
        Schema.Struct({
          nodes: Schema.Array(GraphNodeSchema),
          edges: Schema.Array(GraphEdgeSchema),
        })
      ),
      /** Node configuration */
      nodeCfg: Schema.optional(Schema.Unknown),
      /** Edge configuration */
      edgeCfg: Schema.optional(Schema.Unknown),
      /** Layout configuration */
      layout: Schema.optional(LayoutConfigSchema),
      /** Behaviors (zoom, drag, etc.) */
      behaviors: Schema.optional(Schema.Array(Schema.String)),
      /** Fit view on render */
      fitView: Schema.optional(Schema.Boolean),
      /** Fit view padding */
      fitViewPadding: Schema.optional(
        Schema.Union(Schema.Number, Schema.Array(Schema.Number))
      ),
      /** Marker configuration for flow arrows */
      markerCfg: Schema.optional(Schema.Unknown),
      /** Animation */
      animate: Schema.optional(Schema.Boolean),
    })
  )
);

export type FlowGraphChartProps = typeof FlowGraphChartPropsSchema.Type;

// =============================================================================
// NetworkGraph Chart Schema
// =============================================================================

export const NetworkGraphChartPropsSchema = RelationalBaseChartPropsSchema.pipe(
  Schema.extend(
    Schema.Struct({
      /** Graph data with nodes and edges */
      data: Schema.optional(
        Schema.Struct({
          nodes: Schema.Array(GraphNodeSchema),
          edges: Schema.Array(GraphEdgeSchema),
        })
      ),
      /** Node configuration */
      nodeCfg: Schema.optional(Schema.Unknown),
      /** Edge configuration */
      edgeCfg: Schema.optional(Schema.Unknown),
      /** Layout configuration */
      layout: Schema.optional(LayoutConfigSchema),
      /** Behaviors */
      behaviors: Schema.optional(Schema.Array(Schema.String)),
      /** Fit view on render */
      fitView: Schema.optional(Schema.Boolean),
      /** Fit view padding */
      fitViewPadding: Schema.optional(
        Schema.Union(Schema.Number, Schema.Array(Schema.Number))
      ),
      /** Animation */
      animate: Schema.optional(Schema.Boolean),
    })
  )
);

export type NetworkGraphChartProps = typeof NetworkGraphChartPropsSchema.Type;

// =============================================================================
// OrganizationChart Schema
// =============================================================================

export const OrganizationChartPropsSchema = BaseChartPropsSchema.pipe(
  Schema.extend(
    Schema.Struct({
      /** Field for node ID */
      nodeField: Schema.optional(Schema.String),
      /** Node configuration */
      nodeCfg: Schema.optional(Schema.Unknown),
      /** Edge configuration */
      edgeCfg: Schema.optional(Schema.Unknown),
      /** Layout direction */
      direction: Schema.optional(Schema.Literal('TB', 'BT', 'LR', 'RL')),
      /** Level separation */
      rankSep: Schema.optional(Schema.Number),
      /** Node separation */
      nodeSep: Schema.optional(Schema.Number),
      /** Behaviors */
      behaviors: Schema.optional(Schema.Array(Schema.String)),
      /** Fit view on render */
      fitView: Schema.optional(Schema.Boolean),
      /** Animation */
      animate: Schema.optional(Schema.Boolean),
    })
  )
);

export type OrganizationChartProps = typeof OrganizationChartPropsSchema.Type;

// =============================================================================
// MindMap Chart Schema
// =============================================================================

export const MindMapChartPropsSchema = BaseChartPropsSchema.pipe(
  Schema.extend(
    Schema.Struct({
      /** Node configuration */
      nodeCfg: Schema.optional(Schema.Unknown),
      /** Edge configuration */
      edgeCfg: Schema.optional(Schema.Unknown),
      /** Layout direction */
      direction: Schema.optional(Schema.Literal('H', 'V', 'LR', 'RL', 'TB', 'BT')),
      /** H/V separation */
      hGap: Schema.optional(Schema.Number),
      vGap: Schema.optional(Schema.Number),
      /** Behaviors */
      behaviors: Schema.optional(Schema.Array(Schema.String)),
      /** Fit view on render */
      fitView: Schema.optional(Schema.Boolean),
      /** Animation */
      animate: Schema.optional(Schema.Boolean),
    })
  )
);

export type MindMapChartProps = typeof MindMapChartPropsSchema.Type;

// =============================================================================
// IndentedTree Chart Schema
// =============================================================================

export const IndentedTreeChartPropsSchema = BaseChartPropsSchema.pipe(
  Schema.extend(
    Schema.Struct({
      /** Node configuration */
      nodeCfg: Schema.optional(Schema.Unknown),
      /** Edge configuration */
      edgeCfg: Schema.optional(Schema.Unknown),
      /** Layout direction */
      direction: Schema.optional(Schema.Literal('LR', 'RL')),
      /** Indent distance */
      indent: Schema.optional(Schema.Number),
      /** Drop cap configuration */
      dropCap: Schema.optional(Schema.Boolean),
      /** Behaviors */
      behaviors: Schema.optional(Schema.Array(Schema.String)),
      /** Fit view on render */
      fitView: Schema.optional(Schema.Boolean),
      /** Animation */
      animate: Schema.optional(Schema.Boolean),
    })
  )
);

export type IndentedTreeChartProps = typeof IndentedTreeChartPropsSchema.Type;

// =============================================================================
// Dendrogram Chart Schema
// =============================================================================

export const DendrogramChartPropsSchema = BaseChartPropsSchema.pipe(
  Schema.extend(
    Schema.Struct({
      /** Node configuration */
      nodeCfg: Schema.optional(Schema.Unknown),
      /** Edge configuration */
      edgeCfg: Schema.optional(Schema.Unknown),
      /** Layout direction */
      direction: Schema.optional(Schema.Literal('TB', 'BT', 'LR', 'RL')),
      /** Node separation */
      nodeSep: Schema.optional(Schema.Number),
      /** Rank separation */
      rankSep: Schema.optional(Schema.Number),
      /** Behaviors */
      behaviors: Schema.optional(Schema.Array(Schema.String)),
      /** Fit view on render */
      fitView: Schema.optional(Schema.Boolean),
      /** Animation */
      animate: Schema.optional(Schema.Boolean),
    })
  )
);

export type DendrogramChartProps = typeof DendrogramChartPropsSchema.Type;

// =============================================================================
// Fishbone Chart Schema
// =============================================================================

export const FishboneChartPropsSchema = BaseChartPropsSchema.pipe(
  Schema.extend(
    Schema.Struct({
      /** Node configuration */
      nodeCfg: Schema.optional(Schema.Unknown),
      /** Edge configuration */
      edgeCfg: Schema.optional(Schema.Unknown),
      /** Layout direction */
      direction: Schema.optional(Schema.Literal('LR', 'RL')),
      /** H/V separation */
      hGap: Schema.optional(Schema.Number),
      vGap: Schema.optional(Schema.Number),
      /** Behaviors */
      behaviors: Schema.optional(Schema.Array(Schema.String)),
      /** Fit view on render */
      fitView: Schema.optional(Schema.Boolean),
      /** Animation */
      animate: Schema.optional(Schema.Boolean),
    })
  )
);

export type FishboneChartProps = typeof FishboneChartPropsSchema.Type;

// =============================================================================
// FlowDirectionGraph Chart Schema
// =============================================================================

export const FlowDirectionGraphChartPropsSchema = RelationalBaseChartPropsSchema.pipe(
  Schema.extend(
    Schema.Struct({
      /** Graph data with nodes and edges */
      data: Schema.optional(
        Schema.Struct({
          nodes: Schema.Array(GraphNodeSchema),
          edges: Schema.Array(GraphEdgeSchema),
        })
      ),
      /** Node configuration */
      nodeCfg: Schema.optional(Schema.Unknown),
      /** Edge configuration */
      edgeCfg: Schema.optional(Schema.Unknown),
      /** Layout configuration */
      layout: Schema.optional(LayoutConfigSchema),
      /** Arrow indicator configuration */
      markerCfg: Schema.optional(Schema.Unknown),
      /** Behaviors */
      behaviors: Schema.optional(Schema.Array(Schema.String)),
      /** Fit view on render */
      fitView: Schema.optional(Schema.Boolean),
      /** Animation */
      animate: Schema.optional(Schema.Boolean),
    })
  )
);

export type FlowDirectionGraphChartProps = typeof FlowDirectionGraphChartPropsSchema.Type;

// Note: Tiny chart schemas (TinyLine, TinyArea, etc.) were removed in @ant-design/charts v2.
// Use regular charts with compact height for similar effects.
