/**
 * CTL TUI Primitives
 *
 * Reusable UI components for terminal interfaces using Ink.
 * These primitives can be used in both inline (Ink) and TUI modes.
 *
 * @module render/primitives
 */

import * as React from "react"
import { Box, Text } from "ink"

// =============================================================================
// FEEDBACK PRIMITIVES
// =============================================================================

/**
 * Alert component for displaying messages with different severities
 */
export interface AlertProps {
  type: "info" | "success" | "warning" | "error"
  title?: string
  children: React.ReactNode
}

export const Alert: React.FC<AlertProps> = ({ type, title, children }) => {
  const colors = {
    info: "cyan",
    success: "green",
    warning: "yellow",
    error: "red",
  } as const

  const icons = {
    info: "ℹ",
    success: "✓",
    warning: "⚠",
    error: "✗",
  }

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={colors[type]} paddingX={1}>
      {title && (
        <Text color={colors[type]} bold>
          {icons[type]} {title}
        </Text>
      )}
      <Text color={colors[type]}>{children}</Text>
    </Box>
  )
}

/**
 * Badge component for tags and labels
 */
export interface BadgeProps {
  color?: "gray" | "cyan" | "green" | "yellow" | "red" | "magenta" | "blue"
  children: React.ReactNode
}

export const Badge: React.FC<BadgeProps> = ({ color = "cyan", children }) => (
  <Text color={color} bold>
    [{children}]
  </Text>
)

/**
 * Status indicator with icon and message
 */
export interface StatusProps {
  status: "idle" | "loading" | "success" | "error" | "warning"
  message: string
}

export const Status: React.FC<StatusProps> = ({ status, message }) => {
  const config = {
    idle: { icon: "○", color: "gray" },
    loading: { icon: "◐", color: "cyan" },
    success: { icon: "✓", color: "green" },
    error: { icon: "✗", color: "red" },
    warning: { icon: "⚠", color: "yellow" },
  } as const

  const { icon, color } = config[status]

  return (
    <Text color={color}>
      {icon} {message}
    </Text>
  )
}

/**
 * Progress bar component
 */
export interface ProgressBarProps {
  value: number
  max?: number
  width?: number
  label?: string
  showPercentage?: boolean
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  width = 20,
  label,
  showPercentage = true,
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))
  const filled = Math.round((percentage / 100) * width)
  const empty = width - filled

  const bar = "█".repeat(filled) + "░".repeat(empty)
  const percentText = showPercentage ? ` ${Math.round(percentage)}%` : ""

  return (
    <Box>
      {label && <Text color="gray">{label} </Text>}
      <Text color="cyan">[{bar}]</Text>
      <Text color="gray">{percentText}</Text>
    </Box>
  )
}

// =============================================================================
// DATA DISPLAY PRIMITIVES
// =============================================================================

/**
 * Key-value pair display
 */
export interface KeyValueProps {
  label: string
  value: React.ReactNode
  labelColor?: string
  valueColor?: string
}

export const KeyValue: React.FC<KeyValueProps> = ({
  label,
  value,
  labelColor = "gray",
  valueColor = "white",
}) => (
  <Box>
    <Text color={labelColor}>{label}: </Text>
    <Text color={valueColor}>{value}</Text>
  </Box>
)

/**
 * Section with title and content
 */
export interface SectionProps {
  title: string
  children: React.ReactNode
  color?: string
}

export const Section: React.FC<SectionProps> = ({ title, children, color = "cyan" }) => (
  <Box flexDirection="column" marginY={1}>
    <Text color={color} bold>
      {title}
    </Text>
    <Box flexDirection="column" paddingLeft={2}>
      {children}
    </Box>
  </Box>
)

/**
 * Divider line
 */
export interface DividerProps {
  width?: number
  char?: string
  color?: string
}

export const Divider: React.FC<DividerProps> = ({ width = 40, char = "─", color = "gray" }) => (
  <Text color={color}>{char.repeat(width)}</Text>
)

/**
 * List item with bullet
 */
export interface ListItemProps {
  bullet?: string
  children: React.ReactNode
  color?: string
}

export const ListItem: React.FC<ListItemProps> = ({ bullet = "•", children, color = "white" }) => (
  <Box>
    <Text color="gray">{bullet} </Text>
    <Text color={color}>{children}</Text>
  </Box>
)

// =============================================================================
// LAYOUT PRIMITIVES
// =============================================================================

/**
 * Card with border and optional title
 */
export interface CardProps {
  title?: string
  children: React.ReactNode
  borderColor?: string
}

export const Card: React.FC<CardProps> = ({ title, children, borderColor = "gray" }) => (
  <Box flexDirection="column" borderStyle="single" borderColor={borderColor} paddingX={1}>
    {title && (
      <>
        <Text bold>{title}</Text>
        <Divider width={20} />
      </>
    )}
    {children}
  </Box>
)

/**
 * Spacer for vertical spacing
 */
export interface SpacerProps {
  lines?: number
}

export const Spacer: React.FC<SpacerProps> = ({ lines = 1 }) => (
  <>
    {Array.from({ length: lines }).map((_, i) => (
      <Text key={i}> </Text>
    ))}
  </>
)

// =============================================================================
// COMMAND OUTPUT PRIMITIVES
// =============================================================================

/**
 * Command suggestion display
 */
export interface CommandSuggestionProps {
  command: string
  description: string
  confidence?: number
}

export const CommandSuggestion: React.FC<CommandSuggestionProps> = ({
  command,
  description,
  confidence,
}) => {
  const icon = confidence !== undefined
    ? confidence >= 80 ? "✓" : confidence >= 50 ? "◐" : "○"
    : "→"
  const color = confidence !== undefined
    ? confidence >= 80 ? "green" : confidence >= 50 ? "yellow" : "gray"
    : "cyan"

  return (
    <Box>
      <Text color={color}>{icon} </Text>
      <Text color="cyan" bold>{command.padEnd(25)}</Text>
      <Text color="gray">{description}</Text>
      {confidence !== undefined && (
        <Text color="gray" dimColor> ({confidence}%)</Text>
      )}
    </Box>
  )
}

/**
 * Skill reference display
 */
export interface SkillRefProps {
  skill: string
  trigger?: string
}

export const SkillRef: React.FC<SkillRefProps> = ({ skill, trigger }) => (
  <Box flexDirection="column" marginTop={1}>
    <Text color="gray">SKILL: {skill}</Text>
    {trigger && <Text color="gray">  Trigger: "{trigger}"</Text>}
  </Box>
)
