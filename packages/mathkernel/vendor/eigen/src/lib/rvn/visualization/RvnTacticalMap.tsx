/**
 * RVN Tactical Map
 *
 * Compound component for tactical map displays.
 * Provides frame, overlay, and canvas layers with brutalist styling.
 *
 * @example
 * ```tsx
 * <RvnTacticalMap.Frame>
 *   <RvnTacticalMap.Canvas>
 *     <MapboxMap />
 *   </RvnTacticalMap.Canvas>
 *   <RvnTacticalMap.Overlay>
 *     <RvnTacticalMap.CrosshairCorners />
 *     <RvnMapMarker position={{ x: '50%', y: '30%' }} label="ALPHA" />
 *     <RvnThreatMarker position={{ x: '60%', y: '40%' }} designation="T1" />
 *   </RvnTacticalMap.Overlay>
 * </RvnTacticalMap.Frame>
 * ```
 */

import * as React from 'react'
import { RVN_CROSSHAIR } from '../tokens/borders'
import { RVN_FONTS, RVN_FONT_SIZES } from '../tokens/typography'
import { RvnCrosshairCorners, type CornerPosition } from './RvnCrosshairCorners'
import { RVN_STATIC_GRID_CSS } from './rvn-mapbox-config'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface TacticalMapContextValue {
  /** Whether crosshairs are enabled */
  showCrosshairs: boolean
  /** Whether grid overlay is enabled */
  showGrid: boolean
  /** Current map bounds (if tracking) */
  bounds?: { north: number; south: number; east: number; west: number }
}

interface FrameProps {
  children: React.ReactNode
  /** Show crosshair corner decorations */
  showCrosshairs?: boolean
  /** Show grid overlay on canvas */
  showGrid?: boolean
  /** Frame title (optional header) */
  title?: string
  /** Subtitle text */
  subtitle?: string
  /** Footer content */
  footer?: React.ReactNode
  /** Additional class name */
  className?: string
  /** Additional styles */
  style?: React.CSSProperties
}

interface CanvasProps {
  children: React.ReactNode
  /** Minimum height */
  minHeight?: string | number
  /** Show grid pattern background */
  showGrid?: boolean
  /** Additional class name */
  className?: string
  /** Additional styles */
  style?: React.CSSProperties
}

interface OverlayProps {
  children: React.ReactNode
  /** Additional class name */
  className?: string
  /** Additional styles */
  style?: React.CSSProperties
}

interface CrosshairCornersProps {
  /** Which corners to show */
  corners?: CornerPosition[]
  /** Size of crosshair arms */
  size?: string
  /** Thickness of lines */
  thickness?: string
  /** Color of lines */
  color?: string
}

interface LegendProps {
  children: React.ReactNode
  /** Position within overlay */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  /** Additional class name */
  className?: string
  /** Additional styles */
  style?: React.CSSProperties
}

interface LegendItemProps {
  /** Visual indicator element */
  indicator: React.ReactNode
  /** Label text */
  label: string
}

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

const TacticalMapContext = React.createContext<TacticalMapContextValue | null>(null)

function useTacticalMap(): TacticalMapContextValue {
  const ctx = React.use(TacticalMapContext)
  if (!ctx) {
    throw new Error('TacticalMap components must be used within TacticalMap.Frame')
  }
  return ctx
}

// -----------------------------------------------------------------------------
// Frame Component
// -----------------------------------------------------------------------------

/**
 * Root frame container for tactical maps.
 * Provides context and visual frame with optional header/footer.
 */
function Frame({
  children,
  showCrosshairs = true,
  showGrid = true,
  title,
  subtitle,
  footer,
  className,
  style,
}: FrameProps) {
  const contextValue = React.useMemo<TacticalMapContextValue>(
    () => ({
      showCrosshairs,
      showGrid,
    }),
    [showCrosshairs, showGrid]
  )

  const frameStyle: React.CSSProperties = {
    position: 'relative',
    border: '3px solid #000000',
    backgroundColor: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    ...style,
  }

  const headerStyle: React.CSSProperties = {
    backgroundColor: '#000000',
    color: '#ffffff',
    padding: '10px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '3px solid #000000',
  }

  const titleStyle: React.CSSProperties = {
    fontFamily: RVN_FONTS.sans,
    fontSize: RVN_FONT_SIZES.heading,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }

  const subtitleStyle: React.CSSProperties = {
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.caption,
    opacity: 0.8,
  }

  const footerStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    padding: '8px 20px',
    borderTop: '1px solid #000000',
    display: 'flex',
    justifyContent: 'space-between',
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.caption,
  }

  return (
    <TacticalMapContext value={contextValue}>
      <div className={className} style={frameStyle} data-rvn-tactical-map="">
        {title && (
          <div style={headerStyle}>
            <span style={titleStyle}>{title}</span>
            {subtitle && <span style={subtitleStyle}>{subtitle}</span>}
          </div>
        )}
        {children}
        {footer && <div style={footerStyle}>{footer}</div>}
      </div>
    </TacticalMapContext>
  )
}

// -----------------------------------------------------------------------------
// Canvas Component
// -----------------------------------------------------------------------------

/**
 * Main map canvas area.
 * Contains the actual map content (Mapbox, static image, etc).
 */
function Canvas({ children, minHeight = '400px', showGrid, className, style }: CanvasProps) {
  const ctx = useTacticalMap()
  const shouldShowGrid = showGrid ?? ctx.showGrid

  const canvasStyle: React.CSSProperties = {
    position: 'relative',
    flex: 1,
    minHeight: typeof minHeight === 'number' ? `${minHeight}px` : minHeight,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    ...(shouldShowGrid && RVN_STATIC_GRID_CSS),
    ...style,
  }

  return (
    <div className={className} style={canvasStyle} data-rvn-canvas="">
      {children}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Overlay Component
// -----------------------------------------------------------------------------

/**
 * Overlay layer for markers, zones, and UI elements.
 * Positioned absolutely over the canvas.
 */
function Overlay({ children, className, style }: OverlayProps) {
  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
    ...style,
  }

  return (
    <div className={className} style={overlayStyle} data-rvn-overlay="">
      {/* Enable pointer events for interactive children */}
      <div style={{ width: '100%', height: '100%', pointerEvents: 'auto' }}>{children}</div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// CrosshairCorners Component (Map-specific wrapper)
// -----------------------------------------------------------------------------

/**
 * Crosshair corner decorations for the tactical map.
 * Uses context settings by default.
 */
function MapCrosshairCorners({
  corners,
  size = RVN_CROSSHAIR.size,
  thickness = RVN_CROSSHAIR.thickness,
  color = RVN_CROSSHAIR.color,
}: CrosshairCornersProps) {
  return <RvnCrosshairCorners corners={corners} size={size} thickness={thickness} color={color} inset="10px" />
}

// -----------------------------------------------------------------------------
// Legend Component
// -----------------------------------------------------------------------------

/**
 * Map legend container.
 */
function Legend({ children, position = 'bottom-left', className, style }: LegendProps) {
  const getPositionStyles = (): React.CSSProperties => {
    const offset = '20px'
    switch (position) {
      case 'top-left':
        return { top: offset, left: offset }
      case 'top-right':
        return { top: offset, right: offset }
      case 'bottom-right':
        return { bottom: offset, right: offset }
      default:
        return { bottom: offset, left: offset }
    }
  }

  const legendStyle: React.CSSProperties = {
    position: 'absolute',
    backgroundColor: '#ffffff',
    border: '2px solid #000000',
    padding: '10px',
    fontFamily: RVN_FONTS.mono,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    zIndex: 10,
    ...getPositionStyles(),
    ...style,
  }

  return (
    <div className={className} style={legendStyle} data-rvn-legend="" aria-label="Map legend">
      {children}
    </div>
  )
}

/**
 * Individual legend item.
 */
function LegendItem({ indicator, label }: LegendItemProps) {
  const itemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: RVN_FONT_SIZES.caption,
    textTransform: 'uppercase',
  }

  const indicatorStyle: React.CSSProperties = {
    width: '12px',
    height: '12px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  return (
    <div style={itemStyle}>
      <span style={indicatorStyle}>{indicator}</span>
      <span>{label}</span>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Legend Indicator Components
// -----------------------------------------------------------------------------

/**
 * Solid square indicator for legend.
 */
function SolidIndicator({ color = '#000000' }: { color?: string }) {
  return <div style={{ width: '12px', height: '12px', backgroundColor: color }} />
}

/**
 * Dashed square indicator for legend.
 */
function DashedIndicator({ color = '#000000' }: { color?: string }) {
  return <div style={{ width: '12px', height: '12px', border: `2px dashed ${color}` }} />
}

/**
 * Circle indicator for legend.
 */
function CircleIndicator({ color = '#000000' }: { color?: string }) {
  return (
    <div
      style={{
        width: '12px',
        height: '12px',
        borderRadius: '50%',
        border: `2px solid ${color}`,
      }}
    />
  )
}

// -----------------------------------------------------------------------------
// Compound Component Export
// -----------------------------------------------------------------------------

export const RvnTacticalMap = {
  Frame,
  Canvas,
  Overlay,
  CrosshairCorners: MapCrosshairCorners,
  Legend,
  LegendItem,
  SolidIndicator,
  DashedIndicator,
  CircleIndicator,
}

// Display names
Frame.displayName = 'RvnTacticalMap.Frame'
Canvas.displayName = 'RvnTacticalMap.Canvas'
Overlay.displayName = 'RvnTacticalMap.Overlay'
MapCrosshairCorners.displayName = 'RvnTacticalMap.CrosshairCorners'
Legend.displayName = 'RvnTacticalMap.Legend'
LegendItem.displayName = 'RvnTacticalMap.LegendItem'

export type {
  TacticalMapContextValue,
  FrameProps,
  CanvasProps,
  OverlayProps,
  CrosshairCornersProps,
  LegendProps,
  LegendItemProps,
}
