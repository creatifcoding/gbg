/**
 * TUI Output Adapter
 *
 * Full-screen terminal UI mode using Ink.
 * Provides persistent UI with navigation and panels.
 * This is a scaffold for OpenTUI integration.
 *
 * @module adapters/output/tui
 */

import { Effect, Layer } from "effect"
import { render, Box, Text, useInput, useApp } from "ink"
import * as React from "react"
import { useState, useCallback } from "react"

import { Output, type OutputPort, type RenderContext, isTty, getTerminalSize } from "../../core/ports/output.js"
import type { CtlAgentOutput } from "../../core/domain/agent-output.js"

// =============================================================================
// TUI TYPES
// =============================================================================

type TuiView = "home" | "health" | "discover" | "logs" | "catalog" | "settings"

interface TuiState {
  currentView: TuiView
  logs: string[]
  lastOutput: CtlAgentOutput | null
}

// TuiAction type reserved for future reducer pattern
// type TuiAction = { type: "SET_VIEW" | "ADD_LOG" | "SET_OUTPUT" | "CLEAR_LOGS"; payload?: unknown }

// =============================================================================
// TUI COMPONENTS
// =============================================================================

interface HeaderProps {
  title: string
  version: string
}

const Header: React.FC<HeaderProps> = ({ title, version }) => (
  <Box borderStyle="single" borderColor="cyan" paddingX={1}>
    <Text bold color="cyan">{title}</Text>
    <Text color="gray"> v{version}</Text>
  </Box>
)

interface NavBarProps {
  items: readonly { key: string; label: string }[]
  selected: string
  onSelect: (key: string) => void
}

const NavBar: React.FC<NavBarProps> = ({ items, selected, onSelect: _onSelect }) => (
  <Box paddingY={1} gap={2}>
    {items.map((item) => (
      <Text
        key={item.key}
        color={selected === item.key ? "cyan" : "white"}
        bold={selected === item.key}
      >
        [{item.key.charAt(0).toUpperCase()}] {item.label}
      </Text>
    ))}
    <Text color="gray">[Q] Quit</Text>
  </Box>
)

interface LogPanelProps {
  logs: readonly string[]
  maxLines?: number
}

const LogPanel: React.FC<LogPanelProps> = ({ logs, maxLines = 10 }) => {
  const displayLogs = logs.slice(-maxLines)
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1} height={maxLines + 2}>
      <Text color="gray" bold>Logs</Text>
      {displayLogs.map((log, i) => (
        <Text key={i} color="gray">{log}</Text>
      ))}
      {displayLogs.length === 0 && <Text color="gray" dimColor>No logs yet</Text>}
    </Box>
  )
}

interface StatusBarProps {
  message: string
}

const StatusBar: React.FC<StatusBarProps> = ({ message }) => (
  <Box borderStyle="single" borderColor="gray" paddingX={1}>
    <Text color="yellow">{message}</Text>
  </Box>
)

// =============================================================================
// MAIN TUI APP
// =============================================================================

interface TuiAppProps {
  initialState?: Partial<TuiState>
  onCommand?: (cmd: string) => void
}

const TuiApp: React.FC<TuiAppProps> = ({ initialState, onCommand }) => {
  const { exit } = useApp()
  const [state, setState] = useState<TuiState>({
    currentView: initialState?.currentView ?? "home",
    logs: initialState?.logs ?? [],
    lastOutput: initialState?.lastOutput ?? null,
  })

  const navItems = [
    { key: "home", label: "Home", shortcut: "H" },
    { key: "health", label: "Health", shortcut: "E" },
    { key: "discover", label: "Discover", shortcut: "D" },
    { key: "logs", label: "Logs", shortcut: "L" },
    { key: "catalog", label: "Catalog", shortcut: "C" },
    { key: "settings", label: "Settings", shortcut: "S" },
  ] as const

  const handleSelect = useCallback((key: string) => {
    setState((s) => ({ ...s, currentView: key as TuiState["currentView"] }))
    onCommand?.(key)
  }, [onCommand])

  // Reserved for future use
  const _addLog = useCallback((msg: string) => {
    setState((s) => ({ ...s, logs: [...s.logs, `[${new Date().toLocaleTimeString()}] ${msg}`] }))
  }, [])

  useInput((input, _key) => {
    if (input === "q" || input === "Q") {
      exit()
      return
    }
    if (input === "h" || input === "H") handleSelect("home")
    if (input === "e" || input === "E") handleSelect("health")
    if (input === "d" || input === "D") handleSelect("discover")
    if (input === "l" || input === "L") handleSelect("logs")
    if (input === "c" || input === "C") handleSelect("catalog")
    if (input === "s" || input === "S") handleSelect("settings")
  })

  const renderContent = () => {
    switch (state.currentView) {
      case "home":
        return (
          <Box flexDirection="column" padding={1}>
            <Text bold>Welcome to CTL TUI</Text>
            <Text color="gray">Effect CLI Framework for building skill-driven CLIs</Text>
            <Text> </Text>
            <Text color="cyan">Keyboard shortcuts:</Text>
            <Text color="gray">  [H] Home  [E] Health  [D] Discover</Text>
            <Text color="gray">  [L] Logs  [C] Catalog  [S] Settings</Text>
            <Text color="gray">  [Q] Quit</Text>
            <Text> </Text>
            <Text color="cyan">Quick commands:</Text>
            <Text color="gray">  ctl new &lt;name&gt;     Create new CLI</Text>
            <Text color="gray">  ctl add &lt;type&gt;     Add component</Text>
            <Text color="gray">  ctl help &lt;query&gt;   Find commands</Text>
          </Box>
        )
      case "health":
        return (
          <Box flexDirection="column" padding={1}>
            <Text bold color="green">Health Check</Text>
            <Text color="gray">Run `ctl health` for detailed output</Text>
            {state.lastOutput && state.lastOutput.command === "health" && (
              <Text>{JSON.stringify(state.lastOutput.result, null, 2)}</Text>
            )}
          </Box>
        )
      case "discover":
        return (
          <Box flexDirection="column" padding={1}>
            <Text bold color="blue">Project Discovery</Text>
            <Text color="gray">Run `ctl discover` for detailed output</Text>
            {state.lastOutput && state.lastOutput.command === "discover" && (
              <Text>{JSON.stringify(state.lastOutput.result, null, 2)}</Text>
            )}
          </Box>
        )
      case "logs":
        return <LogPanel logs={state.logs} maxLines={15} />
      case "catalog":
        return (
          <Box flexDirection="column" padding={1}>
            <Text bold color="magenta">Component Catalog</Text>
            <Text color="gray">Available CTL components and primitives</Text>
            <Text> </Text>
            <Text color="cyan">Commands:</Text>
            <Text color="gray">  • new         Create new CLI project</Text>
            <Text color="gray">  • add         Add component to existing CLI</Text>
            <Text color="gray">  • inspect     Analyze CLI structure</Text>
            <Text color="gray">  • health      Run health checks</Text>
            <Text color="gray">  • discover    Discover project config</Text>
            <Text color="gray">  • help        Search commands</Text>
            <Text color="gray">  • tui         This TUI mode</Text>
            <Text> </Text>
            <Text color="cyan">Add types:</Text>
            <Text color="gray">  • command     Add CLI command</Text>
            <Text color="gray">  • skill       Add skill file</Text>
            <Text color="gray">  • migration   Add database migration</Text>
          </Box>
        )
      case "settings":
        return (
          <Box flexDirection="column" padding={1}>
            <Text bold color="yellow">Settings</Text>
            <Text color="gray">CTL configuration and preferences</Text>
            <Text> </Text>
            <Text color="cyan">Output modes:</Text>
            <Text color="gray">  • inline      Default human-readable</Text>
            <Text color="gray">  • --agent     Structured JSON for agents</Text>
            <Text color="gray">  • tui         Full terminal UI (this)</Text>
            <Text> </Text>
            <Text color="cyan">Configuration files:</Text>
            <Text color="gray">  • CTL.md      Project configuration</Text>
            <Text color="gray">  • skills/     Skill definitions</Text>
            <Text color="gray">  • package.json CLI metadata</Text>
          </Box>
        )
      default:
        return null
    }
  }

  return (
    <Box flexDirection="column" width="100%">
      <Header title="CTL" version="0.1.0" />
      <NavBar items={navItems} selected={state.currentView} onSelect={handleSelect} />
      <Box flexGrow={1} flexDirection="column">
        {renderContent()}
      </Box>
      <StatusBar message={`View: ${state.currentView} | Press Q to quit`} />
    </Box>
  )
}

// =============================================================================
// TUI OUTPUT ADAPTER
// =============================================================================

// Store for TUI state (updated by adapter methods)
let tuiLogs: string[] = []
let tuiLastOutput: CtlAgentOutput | null = null
let tuiInstance: { rerender: (node: React.ReactElement) => void; unmount: () => void } | null = null

const rerenderTui = () => {
  if (tuiInstance) {
    tuiInstance.rerender(
      <TuiApp
        initialState={{ logs: tuiLogs, lastOutput: tuiLastOutput }}
      />
    )
  }
}

const make: OutputPort = {
  text: (content: string) =>
    Effect.sync(() => {
      tuiLogs.push(content)
      rerenderTui()
    }),

  table: (data, _columns) =>
    Effect.sync(() => {
      tuiLogs.push(`[Table: ${data.length} rows]`)
      rerenderTui()
    }),

  success: (message: string, _details?: Record<string, string>) =>
    Effect.sync(() => {
      tuiLogs.push(`✓ ${message}`)
      rerenderTui()
    }),

  error: (message: string, _details?: Record<string, string>) =>
    Effect.sync(() => {
      tuiLogs.push(`✗ ${message}`)
      rerenderTui()
    }),

  warning: (message: string) =>
    Effect.sync(() => {
      tuiLogs.push(`⚠ ${message}`)
      rerenderTui()
    }),

  progress: (label: string, value: number, max?: number) =>
    Effect.sync(() => {
      tuiLogs.push(`${label}: ${value}/${max ?? 100}`)
      rerenderTui()
    }),

  spinner: (label: string) =>
    Effect.sync(() => {
      tuiLogs.push(`⏳ ${label}`)
      rerenderTui()
      return { stop: () => {} }
    }),

  agentOutput: (output: CtlAgentOutput) =>
    Effect.sync(() => {
      tuiLastOutput = output
      tuiLogs.push(`[${output.status}] ${output.command}`)
      rerenderTui()
    }),

  json: (data: unknown) =>
    Effect.sync(() => {
      tuiLogs.push(JSON.stringify(data, null, 2))
      rerenderTui()
    }),

  clear: () =>
    Effect.sync(() => {
      tuiLogs = []
      rerenderTui()
    }),

  getContext: () =>
    Effect.sync((): RenderContext => {
      const size = getTerminalSize()
      return {
        mode: "tui",
        isTty: isTty(),
        width: size?.width,
        height: size?.height,
      }
    }),
}

// =============================================================================
// LAYER & UTILITIES
// =============================================================================

export const TuiOutputLayer = Layer.succeed(Output, make)

/**
 * Start the TUI application
 * @param initialPage - The initial page/view to display
 */
export const startTui = (initialPage: TuiView = "home"): Effect.Effect<void> =>
  Effect.async<void>((resume) => {
    tuiLogs = []
    tuiLastOutput = null

    const instance = render(
      <TuiApp initialState={{ currentView: initialPage }} />
    )
    tuiInstance = instance

    instance.waitUntilExit().then(() => {
      tuiInstance = null
      resume(Effect.void)
    })
  })

/**
 * Check if TUI is running
 */
export const isTuiRunning = (): boolean => tuiInstance !== null

// Export components and types for extension
export { TuiApp, Header, NavBar, LogPanel, StatusBar }
export type { TuiView }
