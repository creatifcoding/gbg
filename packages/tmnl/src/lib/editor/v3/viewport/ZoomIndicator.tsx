/**
 * ZoomIndicator
 *
 * Browser-style zoom popup that appears briefly when zooming.
 * Fades in when zoom changes, auto-hides after a delay.
 *
 * @module editor/v3/viewport/ZoomIndicator
 */

import React, { useEffect, useState, useRef } from 'react';

// =============================================================================
// Types
// =============================================================================

export interface ZoomIndicatorProps {
  /** Current zoom level (1 = 100%) */
  zoom: number;
  /** Is currently zooming (show immediately) */
  isZooming?: boolean;
  /** Duration to show after zooming stops (ms) */
  hideDelay?: number;
  /** Position of the indicator */
  position?: 'top-center' | 'top-right' | 'bottom-center';
  /** Custom styles */
  style?: React.CSSProperties;
}

// =============================================================================
// Styles
// =============================================================================

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  zIndex: 100,
  pointerEvents: 'none',
  transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
};

const indicatorStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  padding: '0.5rem 1rem',
  borderRadius: '0.5rem',
  backgroundColor: 'rgba(23, 23, 23, 0.95)',
  border: '1px solid rgba(64, 64, 64, 0.5)',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
  backdropFilter: 'blur(8px)',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  fontFamily: 'JetBrains Mono, monospace',
  fontWeight: 500,
  color: '#e5e5e5',
  letterSpacing: '-0.02em',
};

const iconStyle: React.CSSProperties = {
  width: 16,
  height: 16,
  color: '#737373',
};

// =============================================================================
// Component
// =============================================================================

export function ZoomIndicator({
  zoom,
  isZooming = false,
  hideDelay = 1500,
  position = 'top-center',
  style,
}: ZoomIndicatorProps) {
  const [visible, setVisible] = useState(false);
  const [displayZoom, setDisplayZoom] = useState(zoom);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastZoomRef = useRef(zoom);

  // Show indicator when zoom changes
  useEffect(() => {
    const zoomChanged = Math.abs(zoom - lastZoomRef.current) > 0.001;
    lastZoomRef.current = zoom;

    if (zoomChanged || isZooming) {
      setVisible(true);
      setDisplayZoom(zoom);

      // Clear existing timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }

      // Set new timeout to hide
      if (!isZooming) {
        hideTimeoutRef.current = setTimeout(() => {
          setVisible(false);
        }, hideDelay);
      }
    }

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [zoom, isZooming, hideDelay]);

  // Position styles
  const positionStyles: React.CSSProperties = {
    ...(position === 'top-center' && {
      top: 16,
      left: '50%',
      transform: visible
        ? 'translateX(-50%) translateY(0)'
        : 'translateX(-50%) translateY(-10px)',
    }),
    ...(position === 'top-right' && {
      top: 16,
      right: 16,
      transform: visible ? 'translateY(0)' : 'translateY(-10px)',
    }),
    ...(position === 'bottom-center' && {
      bottom: 16,
      left: '50%',
      transform: visible
        ? 'translateX(-50%) translateY(0)'
        : 'translateX(-50%) translateY(10px)',
    }),
  };

  const percentage = Math.round(displayZoom * 100);
  const isZoomedIn = percentage > 100;
  const isZoomedOut = percentage < 100;

  return (
    <div
      style={{
        ...containerStyle,
        ...positionStyles,
        opacity: visible ? 1 : 0,
        ...style,
      }}
      aria-hidden={!visible}
    >
      <div style={indicatorStyle}>
        {/* Zoom icon */}
        <svg
          style={iconStyle}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
          {isZoomedIn && <path d="M11 8v6M8 11h6" />}
          {isZoomedOut && <path d="M8 11h6" />}
        </svg>

        {/* Zoom level */}
        <span style={labelStyle}>{percentage}%</span>
      </div>
    </div>
  );
}

export default ZoomIndicator;
