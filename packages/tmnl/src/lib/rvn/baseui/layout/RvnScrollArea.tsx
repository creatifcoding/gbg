/**
 * RvnScrollArea - Brutalist Scroll Area Component
 *
 * Wraps Base UI ScrollArea with RVN styling:
 * - 3px border scrollbar track
 * - Black thumb
 *
 * @example
 * ```tsx
 * <RvnScrollArea.Root style={{ height: 300 }}>
 *   <RvnScrollArea.Viewport>
 *     <div>Scrollable content...</div>
 *   </RvnScrollArea.Viewport>
 *   <RvnScrollArea.Scrollbar orientation="vertical">
 *     <RvnScrollArea.Thumb />
 *   </RvnScrollArea.Scrollbar>
 * </RvnScrollArea.Root>
 * ```
 */

import * as React from 'react'
import { ScrollArea } from '@base-ui-components/react/scroll-area'
import {
  RVN_COLORS,
  RVN_BORDERS,
  RVN_SPACING,
} from '../../tokens'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface RvnScrollAreaRootProps extends React.ComponentProps<typeof ScrollArea.Root> {}
export interface RvnScrollAreaViewportProps extends React.ComponentProps<typeof ScrollArea.Viewport> {}

export interface RvnScrollAreaScrollbarProps extends React.ComponentProps<typeof ScrollArea.Scrollbar> {
  /** Orientation of the scrollbar */
  orientation?: 'vertical' | 'horizontal'
}

export interface RvnScrollAreaThumbProps extends React.ComponentProps<typeof ScrollArea.Thumb> {}
export interface RvnScrollAreaCornerProps extends React.ComponentProps<typeof ScrollArea.Corner> {}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = {
  root: {
    position: 'relative' as const,
    overflow: 'hidden',
  } as React.CSSProperties,
  viewport: {
    width: '100%',
    height: '100%',
    overflow: 'scroll',
  } as React.CSSProperties,
  scrollbar: {
    display: 'flex',
    userSelect: 'none' as const,
    touchAction: 'none' as const,
    padding: '2px',
    background: RVN_COLORS.surfaceHighlight,
    transition: 'background 0.15s ease',
  } as React.CSSProperties,
  scrollbarVertical: {
    width: '14px',
    borderLeft: RVN_BORDERS.primary,
  } as React.CSSProperties,
  scrollbarHorizontal: {
    flexDirection: 'column' as const,
    height: '14px',
    borderTop: RVN_BORDERS.primary,
  } as React.CSSProperties,
  scrollbarHover: {
    background: RVN_COLORS.surfaceMuted,
  } as React.CSSProperties,
  thumb: {
    flex: 1,
    background: RVN_COLORS.black,
    borderRadius: RVN_BORDERS.radius,
    position: 'relative' as const,
    cursor: 'pointer',
    transition: 'background 0.15s ease',
  } as React.CSSProperties,
  thumbHover: {
    background: '#333333',
  } as React.CSSProperties,
  corner: {
    background: RVN_COLORS.surfaceHighlight,
    borderLeft: RVN_BORDERS.primary,
    borderTop: RVN_BORDERS.primary,
  } as React.CSSProperties,
}

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

const Root = React.forwardRef<HTMLDivElement, RvnScrollAreaRootProps>(
  ({ style, ...props }, ref) => (
    <ScrollArea.Root
      ref={ref}
      style={{ ...styles.root, ...style }}
      {...props}
    />
  )
)
Root.displayName = 'RvnScrollArea.Root'

const Viewport = React.forwardRef<HTMLDivElement, RvnScrollAreaViewportProps>(
  ({ style, ...props }, ref) => (
    <ScrollArea.Viewport
      ref={ref}
      style={{ ...styles.viewport, ...style }}
      {...props}
    />
  )
)
Viewport.displayName = 'RvnScrollArea.Viewport'

const Scrollbar = React.forwardRef<HTMLDivElement, RvnScrollAreaScrollbarProps>(
  ({ orientation = 'vertical', style, ...props }, ref) => {
    const [isHovered, setIsHovered] = React.useState(false)

    const orientationStyle =
      orientation === 'vertical' ? styles.scrollbarVertical : styles.scrollbarHorizontal

    return (
      <ScrollArea.Scrollbar
        ref={ref}
        orientation={orientation}
        style={{
          ...styles.scrollbar,
          ...orientationStyle,
          ...(isHovered ? styles.scrollbarHover : {}),
          ...style,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        {...props}
      />
    )
  }
)
Scrollbar.displayName = 'RvnScrollArea.Scrollbar'

const Thumb = React.forwardRef<HTMLDivElement, RvnScrollAreaThumbProps>(
  ({ style, ...props }, ref) => {
    const [isHovered, setIsHovered] = React.useState(false)

    return (
      <ScrollArea.Thumb
        ref={ref}
        style={{
          ...styles.thumb,
          ...(isHovered ? styles.thumbHover : {}),
          ...style,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        {...props}
      />
    )
  }
)
Thumb.displayName = 'RvnScrollArea.Thumb'

const Corner = React.forwardRef<HTMLDivElement, RvnScrollAreaCornerProps>(
  ({ style, ...props }, ref) => (
    <ScrollArea.Corner
      ref={ref}
      style={{ ...styles.corner, ...style }}
      {...props}
    />
  )
)
Corner.displayName = 'RvnScrollArea.Corner'

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export const RvnScrollArea = {
  Root,
  Viewport,
  Scrollbar,
  Thumb,
  Corner,
}

export {
  Root as RvnScrollAreaRoot,
  Viewport as RvnScrollAreaViewport,
  Scrollbar as RvnScrollAreaScrollbar,
  Thumb as RvnScrollAreaThumb,
  Corner as RvnScrollAreaCorner,
}
