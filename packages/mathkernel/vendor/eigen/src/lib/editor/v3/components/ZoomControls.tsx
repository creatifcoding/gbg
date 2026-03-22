/**
 * ZoomControls
 *
 * Simple zoom control component for the editor.
 * Uses viewport atoms for state management.
 *
 * @module editor/v3/components/ZoomControls
 */

import React, { useMemo, useCallback, useContext } from 'react';
import { useAtomValue, RegistryContext } from '@effect-atom/atom-react';
import {
  zoomLabelAtom,
  canZoomInAtom,
  canZoomOutAtom,
  createZoomOps,
} from '../atoms/viewport';

// =============================================================================
// Types
// =============================================================================

export interface ZoomControlsProps {
  /** Custom class name */
  className?: string;
  /** Custom styles */
  style?: React.CSSProperties;
  /** Compact mode (icon-only) */
  compact?: boolean;
}

// =============================================================================
// Styles
// =============================================================================

const containerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
  padding: '0.25rem',
  borderRadius: '0.375rem',
  backgroundColor: 'rgba(38, 38, 38, 0.8)',
  border: '1px solid rgba(64, 64, 64, 0.5)',
};

const buttonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '1.5rem',
  height: '1.5rem',
  padding: 0,
  border: 'none',
  borderRadius: '0.25rem',
  backgroundColor: 'transparent',
  color: '#a3a3a3',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  fontSize: '0.875rem',
  fontWeight: 500,
};

const buttonDisabledStyle: React.CSSProperties = {
  ...buttonStyle,
  opacity: 0.4,
  cursor: 'not-allowed',
};

const labelStyle: React.CSSProperties = {
  minWidth: '2.5rem',
  textAlign: 'center',
  fontSize: '0.6875rem',
  fontFamily: 'JetBrains Mono, monospace',
  color: '#737373',
  userSelect: 'none',
};

// =============================================================================
// Component
// =============================================================================

/**
 * ZoomControls
 *
 * Provides zoom in/out/reset buttons with current zoom level display.
 *
 * @example
 * ```tsx
 * <ZoomControls />
 * <ZoomControls compact />
 * ```
 */
export function ZoomControls({
  className,
  style,
  compact = false,
}: ZoomControlsProps) {
  // Context-aware atom reads via RegistryContext
  const zoomLabel = useAtomValue(zoomLabelAtom);
  const canZoomIn = useAtomValue(canZoomInAtom);
  const canZoomOut = useAtomValue(canZoomOutAtom);

  // Get registry from context for operations
  const registry = useContext(RegistryContext);
  const zoomOps = useMemo(() => createZoomOps(registry), [registry]);

  const handleZoomIn = useCallback(() => {
    zoomOps.zoomIn();
  }, [zoomOps]);

  const handleZoomOut = useCallback(() => {
    zoomOps.zoomOut();
  }, [zoomOps]);

  const handleReset = useCallback(() => {
    zoomOps.resetZoom();
  }, [zoomOps]);

  return (
    <div className={className} style={{ ...containerStyle, ...style }}>
      {/* Zoom Out */}
      <button
        onClick={handleZoomOut}
        disabled={!canZoomOut}
        style={canZoomOut ? buttonStyle : buttonDisabledStyle}
        title="Zoom out (Ctrl+-)"
        onMouseOver={(e) => {
          if (canZoomOut) {
            e.currentTarget.style.backgroundColor = 'rgba(64, 64, 64, 0.8)';
            e.currentTarget.style.color = '#e5e5e5';
          }
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = '#a3a3a3';
        }}
      >
        <MinusIcon />
      </button>

      {/* Zoom Label (click to reset) */}
      {!compact && (
        <button
          onClick={handleReset}
          style={{
            ...labelStyle,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0.125rem 0.25rem',
            borderRadius: '0.25rem',
          }}
          title="Reset zoom (Ctrl+0)"
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(64, 64, 64, 0.5)';
            e.currentTarget.style.color = '#e5e5e5';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#737373';
          }}
        >
          {zoomLabel}
        </button>
      )}

      {/* Zoom In */}
      <button
        onClick={handleZoomIn}
        disabled={!canZoomIn}
        style={canZoomIn ? buttonStyle : buttonDisabledStyle}
        title="Zoom in (Ctrl++)"
        onMouseOver={(e) => {
          if (canZoomIn) {
            e.currentTarget.style.backgroundColor = 'rgba(64, 64, 64, 0.8)';
            e.currentTarget.style.color = '#e5e5e5';
          }
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = '#a3a3a3';
        }}
      >
        <PlusIcon />
      </button>
    </div>
  );
}

// =============================================================================
// Icons
// =============================================================================

function MinusIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export default ZoomControls;
