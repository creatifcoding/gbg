/**
 * DataCardShape
 *
 * A compact card shape spawned when dragging a row out of an AG-Grid.
 * Displays row data in a TMNL-styled card with status indicator.
 */

import {
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
  type TLBaseShape,
  type TLResizeInfo,
  resizeBox,
} from 'tldraw';
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { TMNL_TOKENS, STATUS_COLORS } from './data-grid-theme';
import type { DataGridRow } from './data-grid-shape';

// ============================================
// DATA CARD SHAPE TYPE
// ============================================

export type DataCardShape = TLBaseShape<
  'data-card',
  {
    w: number;
    h: number;
    rowData: DataGridRow;
    sourceGridId: string;
  }
>;

// ============================================
// DATA CARD COMPONENT
// ============================================

function DataCardComponent({ shape }: { shape: DataCardShape }) {
  const { rowData, w, h } = shape.props;
  const cardRef = useRef<HTMLDivElement>(null);
  const statusColor = STATUS_COLORS[rowData.status] || STATUS_COLORS.default;
  const valueIntensity = Math.min(1, rowData.value / 100);

  // Subtle pulse animation on mount
  useEffect(() => {
    if (cardRef.current) {
      gsap.fromTo(
        cardRef.current,
        { boxShadow: `0 0 0px ${TMNL_TOKENS.colors.accentCyan}00` },
        {
          boxShadow: `0 0 15px ${TMNL_TOKENS.colors.accentCyan}40`,
          duration: 0.5,
          yoyo: true,
          repeat: 1,
          ease: 'power2.inOut',
        }
      );
    }
  }, []);

  return (
    <div
      ref={cardRef}
      data-shape-id={shape.id}
      className="w-full h-full flex flex-col overflow-hidden"
      style={{
        width: w,
        height: h,
        background: TMNL_TOKENS.colors.backgroundCard,
        border: `1px solid ${TMNL_TOKENS.colors.border}`,
        fontFamily: TMNL_TOKENS.typography.fontFamily,
      }}
    >
      {/* Corner decorations */}
      <div
        className="absolute top-0 left-0 w-1 h-1"
        style={{ borderTop: `1px solid ${statusColor}`, borderLeft: `1px solid ${statusColor}` }}
      />
      <div
        className="absolute top-0 right-0 w-1 h-1"
        style={{ borderTop: `1px solid ${statusColor}`, borderRight: `1px solid ${statusColor}` }}
      />
      <div
        className="absolute bottom-0 left-0 w-1 h-1"
        style={{ borderBottom: `1px solid ${statusColor}`, borderLeft: `1px solid ${statusColor}` }}
      />
      <div
        className="absolute bottom-0 right-0 w-1 h-1"
        style={{ borderBottom: `1px solid ${statusColor}`, borderRight: `1px solid ${statusColor}` }}
      />

      {/* Header with ID and status */}
      <div
        className="flex items-center justify-between px-2 py-1"
        style={{
          borderBottom: `1px solid ${TMNL_TOKENS.colors.borderMuted}`,
          background: `${statusColor}10`,
        }}
      >
        <span
          style={{
            fontSize: TMNL_TOKENS.typography.fontSizeXs,
            color: TMNL_TOKENS.colors.textMuted,
            letterSpacing: '0.05em',
          }}
        >
          #{rowData.id}
        </span>
        <div className="flex items-center gap-1">
          <div
            style={{
              width: 5,
              height: 5,
              backgroundColor: statusColor,
              boxShadow: `0 0 4px ${statusColor}60`,
            }}
          />
          <span
            style={{
              fontSize: '7px',
              color: statusColor,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontWeight: 500,
            }}
          >
            {rowData.status}
          </span>
        </div>
      </div>

      {/* Name */}
      <div className="flex-1 flex flex-col justify-center px-2 py-1">
        <span
          style={{
            fontSize: TMNL_TOKENS.typography.fontSizeSm,
            color: TMNL_TOKENS.colors.textPrimary,
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
            lineHeight: 1.2,
          }}
        >
          {rowData.name}
        </span>
      </div>

      {/* Value bar */}
      <div className="px-2 pb-2">
        <div className="flex items-center gap-2">
          <span
            style={{
              fontSize: TMNL_TOKENS.typography.fontSizeXs,
              color: TMNL_TOKENS.colors.textSecondary,
              fontVariantNumeric: 'tabular-nums',
              minWidth: 20,
            }}
          >
            {rowData.value}
          </span>
          <div
            style={{
              flex: 1,
              height: 3,
              backgroundColor: TMNL_TOKENS.colors.borderMuted,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${valueIntensity * 100}%`,
                height: '100%',
                backgroundColor: TMNL_TOKENS.colors.accentCyan,
                opacity: 0.7,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// DATA CARD SHAPE UTIL
// ============================================

export class DataCardShapeUtil extends BaseBoxShapeUtil<DataCardShape> {
  static override type = 'data-card' as const;
  static override props = {
    w: T.number,
    h: T.number,
    rowData: T.object({
      id: T.string,
      name: T.string,
      value: T.number,
      status: T.string,
    }),
    sourceGridId: T.string,
  };

  override canResize() {
    return true;
  }

  override canEdit() {
    return false;
  }

  getDefaultProps(): DataCardShape['props'] {
    return {
      w: 180,
      h: 100,
      rowData: {
        id: '000',
        name: 'Unknown',
        value: 0,
        status: 'inactive',
      },
      sourceGridId: '',
    };
  }

  override onResize(shape: DataCardShape, info: TLResizeInfo<DataCardShape>) {
    return resizeBox(shape, info);
  }

  override component(shape: DataCardShape) {
    return (
      <HTMLContainer id={shape.id} style={{ width: '100%', height: '100%', pointerEvents: 'all' }}>
        <DataCardComponent shape={shape} />
      </HTMLContainer>
    );
  }

  override indicator(shape: DataCardShape) {
    return <rect x={0} y={0} width={shape.props.w} height={shape.props.h} />;
  }
}
