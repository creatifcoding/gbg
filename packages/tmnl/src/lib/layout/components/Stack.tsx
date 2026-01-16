/**
 * @module layout/components/Stack
 * @description Linear flex layout component (vertical or horizontal)
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import { spacingToCss, type AlignItems, type JustifyContent, type SpacingToken } from "../schemas"

/**
 * Stack component props
 */
export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Stack direction */
  direction?: "row" | "column"
  /** Gap between items */
  gap?: SpacingToken
  /** Align items on cross-axis */
  align?: AlignItems
  /** Justify content on main-axis */
  justify?: JustifyContent
  /** Whether stack should fill available space */
  fill?: boolean
  /** Whether to wrap items */
  wrap?: boolean
  /** Children */
  children: React.ReactNode
}

/**
 * Stack component
 *
 * A simple linear layout using flexbox. Default direction is column (vertical).
 *
 * @example
 * ```tsx
 * // Vertical stack
 * <Stack gap={16}>
 *   <Header />
 *   <Content />
 *   <Footer />
 * </Stack>
 *
 * // Horizontal stack
 * <Stack direction="row" gap={8} align="center">
 *   <Icon />
 *   <Text />
 * </Stack>
 *
 * // With alignment
 * <Stack direction="row" justify="space-between" align="center">
 *   <Logo />
 *   <Navigation />
 * </Stack>
 * ```
 */
export const Stack = React.forwardRef<HTMLDivElement, StackProps>(
  function Stack(
    {
      direction = "column",
      gap = 16 as SpacingToken,
      align = "stretch",
      justify,
      fill = false,
      wrap = false,
      className,
      style,
      children,
      ...props
    },
    ref
  ) {
    const stackStyle: React.CSSProperties = {
      display: "flex",
      flexDirection: direction,
      gap: spacingToCss(gap),
      alignItems: align,
      ...(justify && { justifyContent: justify }),
      ...(fill && { flex: 1 }),
      ...(wrap && { flexWrap: "wrap" }),
      ...style,
    }

    return (
      <div ref={ref} className={cn(className)} style={stackStyle} {...props}>
        {children}
      </div>
    )
  }
)

Stack.displayName = "Stack"

/**
 * VStack - Vertical stack shorthand
 */
export interface VStackProps extends Omit<StackProps, "direction"> {}

export const VStack = React.forwardRef<HTMLDivElement, VStackProps>(
  function VStack(props, ref) {
    return <Stack ref={ref} direction="column" {...props} />
  }
)

VStack.displayName = "VStack"

/**
 * HStack - Horizontal stack shorthand
 */
export interface HStackProps extends Omit<StackProps, "direction"> {}

export const HStack = React.forwardRef<HTMLDivElement, HStackProps>(
  function HStack(props, ref) {
    return <Stack ref={ref} direction="row" {...props} />
  }
)

HStack.displayName = "HStack"

/**
 * Spacer - Flexible space filler
 *
 * Takes up all available space in a flex container.
 * Useful for pushing items to opposite ends.
 */
export const Spacer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function Spacer({ style, ...props }, ref) {
  return <div ref={ref} style={{ flex: 1, ...style }} {...props} />
})

Spacer.displayName = "Spacer"

/**
 * Divider - Visual separator
 *
 * A line separator that adapts to stack direction.
 */
export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Orientation (auto-detected from parent if not specified) */
  orientation?: "horizontal" | "vertical"
  /** Spacing around divider */
  spacing?: SpacingToken
}

export const Divider = React.forwardRef<HTMLDivElement, DividerProps>(
  function Divider(
    { orientation = "horizontal", spacing = 8 as SpacingToken, className, style, ...props },
    ref
  ) {
    const isHorizontal = orientation === "horizontal"

    const dividerStyle: React.CSSProperties = {
      ...(isHorizontal
        ? {
            width: "100%",
            height: 1,
            marginTop: spacingToCss(spacing),
            marginBottom: spacingToCss(spacing),
          }
        : {
            height: "100%",
            width: 1,
            marginLeft: spacingToCss(spacing),
            marginRight: spacingToCss(spacing),
          }),
      backgroundColor: "var(--border)",
      ...style,
    }

    return (
      <div
        ref={ref}
        role="separator"
        aria-orientation={orientation}
        className={cn(className)}
        style={dividerStyle}
        {...props}
      />
    )
  }
)

Divider.displayName = "Divider"
