/**
 * @fileoverview BidirectionalEdge Component
 *
 * Custom React Flow edge for bidirectional dataplane links.
 * Shows animated data flow in both directions with relationship indicator.
 *
 * @module dataplane/components/BidirectionalEdge
 */

import React, { memo, useMemo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';
import { useAtomValue } from '@effect-atom/atom-react';
import { Atom } from '@effect-atom/atom-react';

import { linkOpacityAtom, hoveredLinkIdAtom } from '../atoms';
import type { Link, LinkRelationship, LinkId } from '../schemas/link';

// =============================================================================
// Types
// =============================================================================

export interface BidirectionalEdgeData {
  /** Link data for this edge */
  link: Link;
  /** Whether edge is selected */
  isSelected?: boolean;
  /** Whether edge is hovered */
  isHovered?: boolean;
}

export type BidirectionalEdgeProps = EdgeProps<BidirectionalEdgeData>;

// =============================================================================
// Constants
// =============================================================================

const RELATIONSHIP_COLORS: Record<LinkRelationship, string> = {
  pipe: 'rgba(34, 211, 238, 0.8)',      // Cyan
  sync: 'rgba(167, 139, 250, 0.8)',     // Violet
  aggregate: 'rgba(251, 191, 36, 0.8)', // Amber
  mirror: 'rgba(74, 222, 128, 0.8)',    // Emerald
};

const RELATIONSHIP_LABELS: Record<LinkRelationship, string> = {
  pipe: '→',
  sync: '⇄',
  aggregate: '∑',
  mirror: '≡',
};

// =============================================================================
// Component
// =============================================================================

/**
 * Custom edge for bidirectional dataplane links.
 *
 * Features:
 * - Dual-direction animated flow
 * - Relationship-based coloring
 * - Label showing relationship type
 * - Transform indicator
 * - Fade when not hovered or selected
 */
export const BidirectionalEdge = memo(function BidirectionalEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: BidirectionalEdgeProps): React.ReactElement {
  const link = data?.link;
  const linkId = link?.id as LinkId;
  const relationship = link?.relationship ?? 'mirror';
  const isBidirectional = link?.direction === 'bidirectional';

  // Get opacity from atom (fade behavior)
  const opacity = useAtomValue(useMemo(() =>
    linkId ? linkOpacityAtom(linkId) : Atom.make(1.0),
    [linkId]
  ));

  // Handle hover for link
  const handleMouseEnter = useMemo(() => () => {
    if (linkId) Atom.set(hoveredLinkIdAtom, linkId);
  }, [linkId]);

  const handleMouseLeave = useMemo(() => () => {
    Atom.set(hoveredLinkIdAtom, null);
  }, []);

  // Calculate path
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  // Get colors based on relationship
  const strokeColor = RELATIONSHIP_COLORS[relationship];
  const labelIcon = RELATIONSHIP_LABELS[relationship];

  // Animation classes
  const animationClass = useMemo(() => {
    if (isBidirectional) {
      return 'animate-pulse';
    }
    return '';
  }, [isBidirectional]);

  return (
    <g
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        opacity,
        transition: 'opacity 150ms ease-out',
      }}
    >
      {/* Main edge path */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth: selected ? 3 : 2,
          filter: selected ? `drop-shadow(0 0 4px ${strokeColor})` : 'none',
        }}
        className={animationClass}
      />

      {/* Secondary path for bidirectional (offset) */}
      {isBidirectional && (
        <BaseEdge
          id={`${id}-reverse`}
          path={edgePath}
          style={{
            stroke: strokeColor,
            strokeWidth: 1,
            strokeDasharray: '4 4',
            strokeDashoffset: 0,
            opacity: 0.5,
          }}
        />
      )}

      {/* Edge label */}
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
            opacity,
            transition: 'opacity 150ms ease-out',
          }}
        >
          <div
            className="
              flex items-center justify-center
              w-6 h-6 rounded-full
              text-xs font-mono font-bold
              cursor-pointer
              transition-all duration-150
              hover:scale-125
            "
            style={{
              backgroundColor: strokeColor,
              color: 'rgba(0, 0, 0, 0.8)',
              boxShadow: `0 0 8px ${strokeColor}`,
            }}
            title={`${relationship}${link?.hasTransform ? ' (transformed)' : ''}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {labelIcon}
          </div>

          {/* Transform indicator */}
          {link?.hasTransform && (
            <div
              className="
                absolute -top-1 -right-1
                w-3 h-3 rounded-full
                bg-white text-black
                text-[8px] font-bold
                flex items-center justify-center
              "
              title={`Transform: ${link.transform}`}
            >
              ƒ
            </div>
          )}
        </div>
      </EdgeLabelRenderer>

      {/* Arrow markers for direction indication */}
      <defs>
        <marker
          id={`arrow-${id}`}
          markerWidth="10"
          markerHeight="10"
          refX="8"
          refY="5"
          orient="auto"
        >
          <path
            d="M0,0 L10,5 L0,10"
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.5"
          />
        </marker>
        {isBidirectional && (
          <marker
            id={`arrow-reverse-${id}`}
            markerWidth="10"
            markerHeight="10"
            refX="2"
            refY="5"
            orient="auto-start-reverse"
          >
            <path
              d="M10,0 L0,5 L10,10"
              fill="none"
              stroke={strokeColor}
              strokeWidth="1.5"
            />
          </marker>
        )}
      </defs>
    </g>
  );
});

// =============================================================================
// Exports
// =============================================================================

export default BidirectionalEdge;
