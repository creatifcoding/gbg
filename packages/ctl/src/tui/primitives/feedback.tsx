/** @jsxImportSource @opentui/react */
/**
 * Feedback Primitives
 *
 * Spinner, Badge, Status indicators.
 */
import type { ReactNode } from "react"

// =============================================================================
// SPINNER
// =============================================================================

export type SpinnerStyle = "dots" | "line" | "arc" | "pulse"

const spinnerFrames: Record<SpinnerStyle, string[]> = {
  dots: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
  line: ["-", "\\", "|", "/"],
  arc: ["◜", "◠", "◝", "◞", "◡", "◟"],
  pulse: ["█", "▓", "▒", "░", "▒", "▓"],
}

export interface SpinnerProps {
  style?: SpinnerStyle
  color?: string
  label?: string
  frame?: number  // For controlled animation
}

export const Spinner = ({
  style = "dots",
  color = "cyan",
  label,
  frame = 0,
}: SpinnerProps): ReactNode => {
  const frames = spinnerFrames[style]
  const currentFrame = frames[frame % frames.length]

  return (
    <box style={{ flexDirection: "row" }}>
      <text style={{ fg: color }}>{currentFrame}</text>
      {label && <text style={{ fg: "white" }}> {label}</text>}
    </box>
  )
}

// =============================================================================
// BADGE
// =============================================================================

export type BadgeVariant = "default" | "success" | "warning" | "error" | "info"

const badgeColors: Record<BadgeVariant, string> = {
  default: "gray",
  success: "green",
  warning: "yellow",
  error: "red",
  info: "cyan",
}

export interface BadgeProps {
  variant?: BadgeVariant
  children?: string
}

export const Badge = ({
  variant = "default",
  children,
}: BadgeProps): ReactNode => {
  const color = badgeColors[variant]
  return (
    <text style={{ fg: "black", bg: color }}> {children} </text>
  )
}

// =============================================================================
// STATUS
// =============================================================================

export type StatusType = "success" | "error" | "warning" | "info" | "pending"

const statusIcons: Record<StatusType, string> = {
  success: "✓",
  error: "✗",
  warning: "⚠",
  info: "ℹ",
  pending: "○",
}

const statusColors: Record<StatusType, string> = {
  success: "green",
  error: "red",
  warning: "yellow",
  info: "cyan",
  pending: "gray",
}

export interface StatusProps {
  type: StatusType
  children?: string
}

export const Status = ({
  type,
  children,
}: StatusProps): ReactNode => {
  const icon = statusIcons[type]
  const color = statusColors[type]

  return (
    <box style={{ flexDirection: "row" }}>
      <text style={{ fg: color }}>{icon}</text>
      {children && <text style={{ fg: "white" }}> {children}</text>}
    </box>
  )
}

// Convenience components
export const SuccessStatus = (props: Omit<StatusProps, "type">): ReactNode => (
  <Status type="success" {...props} />
)
export const ErrorStatus = (props: Omit<StatusProps, "type">): ReactNode => (
  <Status type="error" {...props} />
)
export const WarningStatus = (props: Omit<StatusProps, "type">): ReactNode => (
  <Status type="warning" {...props} />
)
export const InfoStatus = (props: Omit<StatusProps, "type">): ReactNode => (
  <Status type="info" {...props} />
)
export const PendingStatus = (props: Omit<StatusProps, "type">): ReactNode => (
  <Status type="pending" {...props} />
)
