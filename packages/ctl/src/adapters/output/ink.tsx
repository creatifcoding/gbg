/**
 * Ink Output Adapter
 *
 * Rich terminal UI rendering using Ink (React for CLI).
 * Provides Box, Text, Spinner, Table components for inline mode.
 *
 * @module adapters/output/ink
 */

import { Effect, Layer } from "effect"
import { render, Box, Text } from "ink"
import Spinner from "ink-spinner"
import Table from "ink-table"
import * as React from "react"

import { Output, type OutputPort, type RenderContext, isTty, getTerminalSize } from "../../core/ports/output.js"
import type { CtlAgentOutput } from "../../core/domain/agent-output.js"

// =============================================================================
// INK COMPONENTS
// =============================================================================

interface StatusTextProps {
  status: "success" | "error" | "warning" | "info"
  children: React.ReactNode
}

const StatusText: React.FC<StatusTextProps> = ({ status, children }) => {
  const colors: Record<string, string> = {
    success: "green",
    error: "red",
    warning: "yellow",
    info: "blue",
  }
  const icons: Record<string, string> = {
    success: "✓",
    error: "✗",
    warning: "⚠",
    info: "ℹ",
  }

  return (
    <Text color={colors[status]}>
      {icons[status]} {children}
    </Text>
  )
}

interface LoadingProps {
  message: string
}

const Loading: React.FC<LoadingProps> = ({ message }) => (
  <Box>
    <Text color="cyan">
      <Spinner type="dots" />
    </Text>
    <Text> {message}</Text>
  </Box>
)

interface TableViewProps<T extends Record<string, unknown>> {
  data: readonly T[]
  columns?: readonly { key: keyof T; header: string }[]
}

function TableView<T extends Record<string, unknown>>({ data, columns }: TableViewProps<T>): React.ReactElement {
  if (data.length === 0) {
    return <Text color="gray">(no data)</Text>
  }

  // If columns specified, transform data to use headers
  const tableData = columns
    ? data.map((row) =>
        Object.fromEntries(columns.map((col) => [col.header, String(row[col.key] ?? "")]))
      )
    : data.map((row) =>
        Object.fromEntries(Object.entries(row).map(([k, v]) => [k, String(v ?? "")]))
      )

  return <Table data={tableData as Array<Record<string, string>>} />
}

interface HealthCheckViewProps {
  checks: Array<{ name: string; status: "pass" | "warn" | "fail"; message: string }>
  summary: { issues: number; warnings: number; passed: number }
}

const HealthCheckView: React.FC<HealthCheckViewProps> = ({ checks, summary }) => (
  <Box flexDirection="column" paddingY={1}>
    <Box marginBottom={1}>
      <Text bold color="cyan">
        🏥 CTL Health Check
      </Text>
    </Box>
    <Box flexDirection="column">
      {checks.map((check, i) => {
        const color = check.status === "pass" ? "green" : check.status === "warn" ? "yellow" : "red"
        const icon = check.status === "pass" ? "✓" : check.status === "warn" ? "⚠" : "✗"
        return (
          <Text key={i} color={color}>
            {icon} {check.name}: {check.message}
          </Text>
        )
      })}
    </Box>
    <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
      <Text>
        📊 {summary.passed} passed, {summary.warnings} warnings, {summary.issues} issues
      </Text>
    </Box>
  </Box>
)

// =============================================================================
// RENDER HELPERS
// =============================================================================

/**
 * Render an Ink component to the terminal.
 * Returns an Effect that completes when rendering is done.
 */
const renderComponent = (component: React.ReactElement): Effect.Effect<void> =>
  Effect.sync(() => {
    const { unmount } = render(component)
    // For static renders, unmount immediately after render
    unmount()
  })

// =============================================================================
// INK OUTPUT ADAPTER
// =============================================================================

const make: OutputPort = {
  text: (content: string) =>
    renderComponent(
      <Box>
        <Text>{content}</Text>
      </Box>
    ),

  table: <T extends Record<string, unknown>>(
    data: readonly T[],
    columns: readonly { key: keyof T; header: string; width?: number }[]
  ) => renderComponent(<TableView data={data} columns={columns} />),

  success: (message: string, details?: Record<string, string>) =>
    renderComponent(
      <Box flexDirection="column">
        <StatusText status="success">{message}</StatusText>
        {details &&
          Object.entries(details).map(([key, value]) => (
            <Text key={key} color="gray">
              {"  "}
              {key}: {value}
            </Text>
          ))}
      </Box>
    ),

  error: (message: string, details?: Record<string, string>) =>
    renderComponent(
      <Box flexDirection="column">
        <StatusText status="error">{message}</StatusText>
        {details &&
          Object.entries(details).map(([key, value]) => (
            <Text key={key} color="gray">
              {"  "}
              {key}: {value}
            </Text>
          ))}
      </Box>
    ),

  warning: (message: string) =>
    renderComponent(<StatusText status="warning">{message}</StatusText>),

  progress: (label: string, value: number, max?: number) =>
    renderComponent(
      <Box>
        <Text color="cyan">
          <Spinner type="dots" />
        </Text>
        <Text>
          {" "}
          {label} ({value}/{max ?? 100})
        </Text>
      </Box>
    ),

  spinner: (label: string): Effect.Effect<{ stop: () => void }> =>
    Effect.sync(() => {
      const { unmount } = render(<Loading message={label} />)
      return { stop: unmount }
    }),

  agentOutput: (output: CtlAgentOutput): Effect.Effect<void> => {
    // In Ink mode, render agent output as formatted display
    const statusColor =
      output.status === "success"
        ? "green"
        : output.status === "error"
          ? "red"
          : output.status === "pending"
            ? "yellow"
            : "cyan"

    const resultStr = output.result ? JSON.stringify(output.result, null, 2) : null

    return renderComponent(
      <Box flexDirection="column" paddingY={1}>
        <Box>
          <Text color={statusColor} bold>
            [{output.status.toUpperCase()}]
          </Text>
          <Text> {output.command}</Text>
        </Box>
        {resultStr && (
          <Box marginLeft={2}>
            <Text color="gray">{resultStr}</Text>
          </Box>
        )}
        {output.error && (
          <Box marginLeft={2} flexDirection="column">
            <Text color="red">Error: {output.error.message}</Text>
            {output.error.suggestion && (
              <Text color="yellow">Suggestion: {output.error.suggestion}</Text>
            )}
          </Box>
        )}
        {output.suggestedSkills && output.suggestedSkills.length > 0 && (
          <Box marginTop={1}>
            <Text color="blue">Skills: {output.suggestedSkills.join(", ")}</Text>
          </Box>
        )}
      </Box>
    )
  },

  json: (data: unknown): Effect.Effect<void> =>
    renderComponent(
      <Box>
        <Text>{JSON.stringify(data, null, 2)}</Text>
      </Box>
    ),

  clear: (): Effect.Effect<void> =>
    Effect.sync(() => {
      // Clear screen using ANSI escape codes
      process.stdout.write("\x1b[2J\x1b[H")
    }),

  getContext: (): Effect.Effect<RenderContext> =>
    Effect.sync(() => {
      const size = getTerminalSize()
      return {
        mode: "inline" as const,
        isTty: isTty(),
        width: size?.width,
        height: size?.height,
      }
    }),
}

// =============================================================================
// LAYER EXPORT
// =============================================================================

export const InkOutputLayer = Layer.succeed(Output, make)

// Export components for direct use
export { StatusText, Loading, TableView, HealthCheckView }
