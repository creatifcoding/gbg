/**
 * DropZoneOverlay
 *
 * Renders the drop zone visual feedback when dragging AG-Grid rows.
 * Shows green striations for valid battlespace terrain.
 *
 * Listens for custom events dispatched by AG-Grid components.
 */

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

// Custom event types for AG-Grid drag communication
export const GRID_DRAG_EVENTS = {
  ENTER: 'ag-grid-drag-enter',
  LEAVE: 'ag-grid-drag-leave',
  DROP: 'ag-grid-drag-drop',
} as const;

// Helper to dispatch drag events
export function dispatchGridDragEvent(
  type: keyof typeof GRID_DRAG_EVENTS,
  detail?: { rowName?: string; status?: string }
) {
  window.dispatchEvent(
    new CustomEvent(GRID_DRAG_EVENTS[type], { detail })
  );
}

export function DropZoneOverlay() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const handleDragEnter = (e: CustomEvent) => {
      console.log('[DropZoneOverlay] Drag enter', e.detail);
      setIsActive(true);
    };

    const handleDragLeave = () => {
      console.log('[DropZoneOverlay] Drag leave');
      setIsActive(false);
    };

    const handleDrop = () => {
      console.log('[DropZoneOverlay] Drop');
      setIsActive(false);
    };

    window.addEventListener(GRID_DRAG_EVENTS.ENTER, handleDragEnter as EventListener);
    window.addEventListener(GRID_DRAG_EVENTS.LEAVE, handleDragLeave);
    window.addEventListener(GRID_DRAG_EVENTS.DROP, handleDrop);

    return () => {
      window.removeEventListener(GRID_DRAG_EVENTS.ENTER, handleDragEnter as EventListener);
      window.removeEventListener(GRID_DRAG_EVENTS.LEAVE, handleDragLeave);
      window.removeEventListener(GRID_DRAG_EVENTS.DROP, handleDrop);
    };
  }, []);

  // Animate overlay in/out
  useEffect(() => {
    if (!overlayRef.current) return;

    if (isActive) {
      gsap.fromTo(
        overlayRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.2, ease: 'power2.out' }
      );
    } else {
      gsap.to(overlayRef.current, {
        opacity: 0,
        duration: 0.15,
        ease: 'power2.in',
      });
    }
  }, [isActive]);

  return (
    <div
      ref={overlayRef}
      className="drop-zone-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        opacity: 0,
        zIndex: 999,
        // Ensure all children also ignore pointer events
        userSelect: 'none',
      }}
    >
      {/* Monochrome striation pattern */}
      <svg
        width="100%"
        height="100%"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
        }}
      >
        <defs>
          {/* Diagonal striation pattern - monochrome */}
          <pattern
            id="drop-zone-striations"
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="20"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="2"
            />
          </pattern>

          {/* Animated scan line - monochrome */}
          <linearGradient id="scan-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0)" />
            <stop offset="45%" stopColor="rgba(255, 255, 255, 0)" />
            <stop offset="50%" stopColor="rgba(255, 255, 255, 0.15)" />
            <stop offset="55%" stopColor="rgba(255, 255, 255, 0)" />
            <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
            <animate
              attributeName="y1"
              values="-100%;100%;-100%"
              dur="2s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="y2"
              values="0%;200%;0%"
              dur="2s"
              repeatCount="indefinite"
            />
          </linearGradient>
        </defs>

        {/* Base striation fill */}
        <rect
          width="100%"
          height="100%"
          fill="url(#drop-zone-striations)"
          style={{ pointerEvents: 'none' }}
        />

        {/* Scan line overlay */}
        <rect
          width="100%"
          height="100%"
          fill="url(#scan-gradient)"
          style={{ pointerEvents: 'none' }}
        />

        {/* Border - monochrome */}
        <rect
          x="2"
          y="2"
          width="calc(100% - 4px)"
          height="calc(100% - 4px)"
          fill="none"
          stroke="rgba(255, 255, 255, 0.2)"
          strokeWidth="1"
          strokeDasharray="10 5"
          style={{ pointerEvents: 'none' }}
        >
          <animate
            attributeName="stroke-dashoffset"
            values="0;15"
            dur="0.5s"
            repeatCount="indefinite"
          />
        </rect>
      </svg>

      {/* Corner brackets - monochrome */}
      <div style={{ position: 'absolute', top: 8, left: 8, width: 20, height: 20, pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 12,
          height: 2,
          background: 'rgba(255, 255, 255, 0.4)',
        }} />
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 2,
          height: 12,
          background: 'rgba(255, 255, 255, 0.4)',
        }} />
      </div>
      <div style={{ position: 'absolute', top: 8, right: 8, width: 20, height: 20, pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 12,
          height: 2,
          background: 'rgba(255, 255, 255, 0.4)',
        }} />
        <div style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 2,
          height: 12,
          background: 'rgba(255, 255, 255, 0.4)',
        }} />
      </div>
      <div style={{ position: 'absolute', bottom: 8, left: 8, width: 20, height: 20, pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: 12,
          height: 2,
          background: 'rgba(255, 255, 255, 0.4)',
        }} />
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: 2,
          height: 12,
          background: 'rgba(255, 255, 255, 0.4)',
        }} />
      </div>
      <div style={{ position: 'absolute', bottom: 8, right: 8, width: 20, height: 20, pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: 12,
          height: 2,
          background: 'rgba(255, 255, 255, 0.4)',
        }} />
        <div style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: 2,
          height: 12,
          background: 'rgba(255, 255, 255, 0.4)',
        }} />
      </div>

      {/* Label - monochrome */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '4px 12px',
          background: 'rgba(0, 0, 0, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          fontFamily: 'monospace',
          fontSize: 12,
          color: 'rgba(255, 255, 255, 0.6)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          pointerEvents: 'none',
        }}
      >
        Deploy Ready
      </div>
    </div>
  );
}

export default DropZoneOverlay;
