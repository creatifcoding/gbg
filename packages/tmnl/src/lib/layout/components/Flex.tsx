/**
 * @module layout/components/Flex
 * @description Full flexbox control component
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import {
  spacingToCss,
  type AlignItems,
  type FlexDirection,
  type FlexWrap,
  type JustifyContent,
  type SpacingToken,
} from "../schemas"

/**
 * Flex component props
 */
export interface FlexProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Flex direction */
  direction?: FlexDirection
  /** Flex wrap behavior */
  wrap?: FlexWrap
  /** Gap between items */
  gap?: SpacingToken
  /** Row gap (overrides gap for rows) */
  rowGap?: SpacingToken
  /** Column gap (overrides gap for columns) */
  columnGap?: SpacingToken
  /** Align items on cross-axis */
  alignItems?: AlignItems
  /** Align content (for multi-line) */
  alignContent?: JustifyContent
  /** Justify content on main-axis */
  justifyContent?: JustifyContent
  /** Whether flex should fill available space */
  fill?: boolean
  /** Whether to render as inline-flex */
  inline?: boolean
  /** Children */
  children: React.ReactNode
}

/**
 * Flex component
 *
 * Full flexbox control for advanced layouts.
 *
 * @example
 * ```tsx
 * // Basic row layout
 * <Flex gap={8} justifyContent="space-between">
 *   {items.map(item => <Item key={item.id} />)}
 * </Flex>
 *
 * // Wrapping grid-like layout
 * <Flex wrap="wrap" gap={16} rowGap={24}>
 *   {items.map(item => <Card key={item.id} style={{ flex: '0 0 300px' }} />)}
 * </Flex>
 *
 * // Centered content
 * <Flex alignItems="center" justifyContent="center" fill>
 *   <Modal />
 * </Flex>
 * ```
 */
export const Flex = React.forwardRef<HTMLDivElement, FlexProps>(
  function Flex(
    {
      direction = "row",
      wrap = "nowrap",
      gap = 0 as SpacingToken,
      rowGap,
      columnGap,
      alignItems,
      alignContent,
      justifyContent,
      fill = false,
      inline = false,
      className,
      style,
      children,
      ...props
    },
    ref
  ) {
    const flexStyle: React.CSSProperties = {
      display: inline ? "inline-flex" : "flex",
      flexDirection: direction,
      flexWrap: wrap,
      gap: spacingToCss(gap),
      ...(rowGap !== undefined && { rowGap: spacingToCss(rowGap) }),
      ...(columnGap !== undefined && { columnGap: spacingToCss(columnGap) }),
      ...(alignItems && { alignItems }),
      ...(alignContent && { alignContent }),
      ...(justifyContent && { justifyContent }),
      ...(fill && { flex: 1 }),
      ...style,
    }

    return (
      <div ref={ref} className={cn(className)} style={flexStyle} {...props}>
        {children}
      </div>
    )
  }
)

Flex.displayName = "Flex"

/**
 * FlexItem - Child with explicit flex properties
 */
export interface FlexItemProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Flex grow factor */
  grow?: number
  /** Flex shrink factor */
  shrink?: number
  /** Flex basis */
  basis?: string | number
  /** Align self (override parent's alignItems) */
  alignSelf?: AlignItems
  /** Order (for reordering) */
  order?: number
  /** Children */
  children: React.ReactNode
}

export const FlexItem = React.forwardRef<HTMLDivElement, FlexItemProps>(
  function FlexItem(
    {
      grow = 0,
      shrink = 1,
      basis = "auto",
      alignSelf,
      order,
      className,
      style,
      children,
      ...props
    },
    ref
  ) {
    const itemStyle: React.CSSProperties = {
      flexGrow: grow,
      flexShrink: shrink,
      flexBasis: typeof basis === "number" ? `${basis}px` : basis,
      ...(alignSelf && { alignSelf }),
      ...(order !== undefined && { order }),
      ...style,
    }

    return (
      <div ref={ref} className={cn(className)} style={itemStyle} {...props}>
        {children}
      </div>
    )
  }
)

FlexItem.displayName = "FlexItem"

/**
 * Center - Shorthand for centering content
 */
export interface CenterProps extends Omit<FlexProps, "alignItems" | "justifyContent"> {}

export const Center = React.forwardRef<HTMLDivElement, CenterProps>(
  function Center(props, ref) {
    return <Flex ref={ref} alignItems="center" justifyContent="center" {...props} />
  }
)

Center.displayName = "Center"

/**
 * Wrap - Shorthand for wrapping flex layout
 */
export interface WrapProps extends Omit<FlexProps, "wrap"> {}

export const Wrap = React.forwardRef<HTMLDivElement, WrapProps>(
  function Wrap(props, ref) {
    return <Flex ref={ref} wrap="wrap" {...props} />
  }
)

Wrap.displayName = "Wrap"

/**
 * AspectRatio - Maintain aspect ratio container
 */
export interface AspectRatioProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Aspect ratio (width / height) */
  ratio?: number
  /** Children */
  children: React.ReactNode
}

export const AspectRatio = React.forwardRef<HTMLDivElement, AspectRatioProps>(
  function AspectRatio({ ratio = 1, className, style, children, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn("relative", className)}
        style={{
          ...style,
        }}
        {...props}
      >
        <div
          style={{
            paddingBottom: `${(1 / ratio) * 100}%`,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        >
          {children}
        </div>
      </div>
    )
  }
)

AspectRatio.displayName = "AspectRatio"
