/**
 * @fileoverview ReactFlow TMNL Theme
 *
 * Vantablack styling for the DataplaneVisualizer canvas.
 * Uses VANTA_COLORS for consistency with the rest of the dataplane UI.
 *
 * @module dataplane/components/reactflow-theme
 */

import { VANTA_COLORS, VANTA_TYPOGRAPHY, VANTA_SPACING, VANTA_BORDERS } from '@/components/portal/tokens';

// =============================================================================
// Theme Tokens
// =============================================================================

export const REACTFLOW_THEME = {
  // Canvas background
  canvas: {
    background: VANTA_COLORS.surface.void,
    backgroundDots: 'rgba(255, 255, 255, 0.03)',
    dotSize: 1,
    dotGap: 20,
  },

  // Node colors by direction
  node: {
    in: {
      bg: 'rgba(34, 211, 238, 0.08)',
      border: VANTA_COLORS.accent.cyanMuted,
      glow: `0 0 20px ${VANTA_COLORS.accent.cyanGlow}`,
      text: VANTA_COLORS.accent.cyan,
    },
    out: {
      bg: 'rgba(251, 191, 36, 0.08)',
      border: VANTA_COLORS.accent.amberMuted,
      glow: `0 0 20px ${VANTA_COLORS.accent.amberGlow}`,
      text: VANTA_COLORS.accent.amber,
    },
    inout: {
      bg: 'rgba(167, 139, 250, 0.08)',
      border: VANTA_COLORS.accent.violetMuted,
      glow: `0 0 20px ${VANTA_COLORS.accent.violetGlow}`,
      text: VANTA_COLORS.accent.violet,
    },
  },

  // Edge (link) colors
  edge: {
    default: VANTA_COLORS.accent.cyanMuted,
    selected: VANTA_COLORS.accent.cyan,
    animated: VANTA_COLORS.accent.emerald,
    bidirectional: VANTA_COLORS.accent.violet,
  },

  // Handle (connection point) colors
  handle: {
    source: {
      bg: VANTA_COLORS.accent.amber,
      border: VANTA_COLORS.accent.amberMuted,
      glow: `0 0 8px ${VANTA_COLORS.accent.amberGlow}`,
    },
    target: {
      bg: VANTA_COLORS.accent.cyan,
      border: VANTA_COLORS.accent.cyanMuted,
      glow: `0 0 8px ${VANTA_COLORS.accent.cyanGlow}`,
    },
  },

  // Controls panel
  controls: {
    bg: 'rgba(0, 0, 0, 0.8)',
    border: VANTA_COLORS.surface.border,
    buttonBg: 'transparent',
    buttonHover: VANTA_COLORS.surface.hover,
    buttonColor: VANTA_COLORS.text.muted,
    buttonColorHover: VANTA_COLORS.text.primary,
  },

  // MiniMap
  minimap: {
    bg: 'rgba(0, 0, 0, 0.85)',
    border: VANTA_COLORS.surface.border,
    maskColor: 'rgba(0, 0, 0, 0.8)',
    nodeIn: VANTA_COLORS.accent.cyan,
    nodeOut: VANTA_COLORS.accent.amber,
    nodeInout: VANTA_COLORS.accent.violet,
  },

  // Empty state
  empty: {
    iconColor: VANTA_COLORS.text.muted,
    textColor: VANTA_COLORS.text.secondary,
    hintColor: VANTA_COLORS.text.tertiary,
  },

  // Stats badge
  stats: {
    bg: 'rgba(0, 0, 0, 0.7)',
    border: VANTA_COLORS.surface.border,
    text: VANTA_COLORS.text.secondary,
    accent: VANTA_COLORS.accent.cyan,
  },
} as const;

// =============================================================================
// CSS Custom Properties (for CSS-in-JS or style injection)
// =============================================================================

export const REACTFLOW_CSS_VARS = `
  /* ReactFlow TMNL Theme */
  --rf-background: ${REACTFLOW_THEME.canvas.background};
  --rf-background-dots: ${REACTFLOW_THEME.canvas.backgroundDots};

  --rf-node-in-bg: ${REACTFLOW_THEME.node.in.bg};
  --rf-node-in-border: ${REACTFLOW_THEME.node.in.border};
  --rf-node-out-bg: ${REACTFLOW_THEME.node.out.bg};
  --rf-node-out-border: ${REACTFLOW_THEME.node.out.border};
  --rf-node-inout-bg: ${REACTFLOW_THEME.node.inout.bg};
  --rf-node-inout-border: ${REACTFLOW_THEME.node.inout.border};

  --rf-edge-default: ${REACTFLOW_THEME.edge.default};
  --rf-edge-selected: ${REACTFLOW_THEME.edge.selected};

  --rf-controls-bg: ${REACTFLOW_THEME.controls.bg};
  --rf-controls-border: ${REACTFLOW_THEME.controls.border};
`;

// =============================================================================
// Inline Styles (for React components)
// =============================================================================

export const getContainerStyles = (mode: 'inline' | 'fullscreen', inlineHeight: number | string): React.CSSProperties => {
  const base: React.CSSProperties = {
    background: VANTA_COLORS.surface.void,
    borderRadius: VANTA_BORDERS.radius.md,
  };

  if (mode === 'fullscreen') {
    return {
      ...base,
      position: 'fixed',
      inset: '16px',
      zIndex: 50,
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05)',
    };
  }

  return {
    ...base,
    width: '100%',
    height: typeof inlineHeight === 'number' ? `${inlineHeight}px` : inlineHeight,
    border: `1px solid ${VANTA_COLORS.surface.border}`,
  };
};

export const statsStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: VANTA_SPACING['2'],
  padding: `${VANTA_SPACING['1']} ${VANTA_SPACING['2']}`,
  background: REACTFLOW_THEME.stats.bg,
  border: `1px solid ${REACTFLOW_THEME.stats.border}`,
  borderRadius: VANTA_BORDERS.radius.sm,
  color: REACTFLOW_THEME.stats.text,
  fontFamily: VANTA_TYPOGRAPHY.family.mono,
  fontSize: 'var(--tmnl-text-xs, 12px)',
};

export const modeButtonStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: VANTA_SPACING['1.5'],
  background: REACTFLOW_THEME.controls.bg,
  border: `1px solid ${REACTFLOW_THEME.controls.border}`,
  borderRadius: VANTA_BORDERS.radius.sm,
  color: REACTFLOW_THEME.controls.buttonColor,
  cursor: 'pointer',
  transition: 'all 150ms ease-out',
};

export const emptyStateStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: VANTA_SPACING['2'],
  color: REACTFLOW_THEME.empty.textColor,
};

// =============================================================================
// ReactFlow Props Helpers
// =============================================================================

export const getBackgroundProps = () => ({
  gap: REACTFLOW_THEME.canvas.dotGap,
  size: REACTFLOW_THEME.canvas.dotSize,
  color: REACTFLOW_THEME.canvas.backgroundDots,
});

export const getMinimapNodeColor = (direction: 'in' | 'out' | 'inout'): string => {
  switch (direction) {
    case 'in':
      return REACTFLOW_THEME.minimap.nodeIn;
    case 'out':
      return REACTFLOW_THEME.minimap.nodeOut;
    default:
      return REACTFLOW_THEME.minimap.nodeInout;
  }
};

// =============================================================================
// Exports
// =============================================================================

export default REACTFLOW_THEME;
