/**
 * DragBadge - Custom AG-Grid Drag Ghost
 *
 * Minimal pill badge showing: [STATUS_DOT] ROW_NAME
 * With corner flicker animation
 */

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { STATUS_COLORS, TMNL_TOKENS } from './data-grid-theme';
import type { CustomDragAndDropImageProps } from 'ag-grid-community';

interface DragBadgeProps extends CustomDragAndDropImageProps {
  // Custom params passed via dragAndDropImageComponentParams
  rowData?: {
    name: string;
    status: 'active' | 'pending' | 'inactive';
  };
}

export function DragBadge({ label, rowData }: DragBadgeProps) {
  const badgeRef = useRef<HTMLDivElement>(null);
  const cornersRef = useRef<HTMLDivElement[]>([]);

  const status = rowData?.status || 'active';
  const name = rowData?.name || label || 'ROW';
  const statusColor = STATUS_COLORS[status] || STATUS_COLORS.default;

  // Corner flicker animation - monochrome
  useEffect(() => {
    if (!badgeRef.current) return;

    // Create corner flicker timeline
    const tl = gsap.timeline({ repeat: -1 });

    // Stagger flicker across corners
    cornersRef.current.forEach((corner, i) => {
      if (!corner) return;

      tl.to(
        corner,
        {
          opacity: 1,
          boxShadow: '0 0 6px rgba(255, 255, 255, 0.5)',
          duration: 0.1,
          ease: 'power2.out',
        },
        i * 0.08
      );
      tl.to(
        corner,
        {
          opacity: 0.3,
          boxShadow: 'none',
          duration: 0.15,
          ease: 'power2.in',
        },
        i * 0.08 + 0.1
      );
    });

    // Add overall badge pulse - monochrome
    gsap.to(badgeRef.current, {
      boxShadow: '0 0 10px rgba(255, 255, 255, 0.3)',
      duration: 0.4,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });

    return () => {
      tl.kill();
      gsap.killTweensOf(badgeRef.current);
    };
  }, []);

  return (
    <div
      ref={badgeRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        background: TMNL_TOKENS.colors.backgroundCard,
        border: '1px solid rgba(255, 255, 255, 0.3)',
        fontFamily: TMNL_TOKENS.typography.fontFamily,
        fontSize: TMNL_TOKENS.typography.fontSizeXs,
        color: TMNL_TOKENS.colors.textPrimary,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        whiteSpace: 'nowrap',
        position: 'relative',
        boxShadow: '0 0 6px rgba(255, 255, 255, 0.2)',
      }}
    >
      {/* Corner accents - monochrome */}
      <div
        ref={(el) => { if (el) cornersRef.current[0] = el; }}
        style={{
          position: 'absolute',
          top: -1,
          left: -1,
          width: 4,
          height: 4,
          borderTop: '1px solid rgba(255, 255, 255, 0.6)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.6)',
          opacity: 0.3,
        }}
      />
      <div
        ref={(el) => { if (el) cornersRef.current[1] = el; }}
        style={{
          position: 'absolute',
          top: -1,
          right: -1,
          width: 4,
          height: 4,
          borderTop: '1px solid rgba(255, 255, 255, 0.6)',
          borderRight: '1px solid rgba(255, 255, 255, 0.6)',
          opacity: 0.3,
        }}
      />
      <div
        ref={(el) => { if (el) cornersRef.current[2] = el; }}
        style={{
          position: 'absolute',
          bottom: -1,
          right: -1,
          width: 4,
          height: 4,
          borderBottom: '1px solid rgba(255, 255, 255, 0.6)',
          borderRight: '1px solid rgba(255, 255, 255, 0.6)',
          opacity: 0.3,
        }}
      />
      <div
        ref={(el) => { if (el) cornersRef.current[3] = el; }}
        style={{
          position: 'absolute',
          bottom: -1,
          left: -1,
          width: 4,
          height: 4,
          borderBottom: '1px solid rgba(255, 255, 255, 0.6)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.6)',
          opacity: 0.3,
        }}
      />

      {/* Status indicator */}
      <div
        style={{
          width: 6,
          height: 6,
          backgroundColor: statusColor,
          boxShadow: `0 0 6px ${statusColor}`,
        }}
      />

      {/* Row name */}
      <span>{name}</span>
    </div>
  );
}

export default DragBadge;
