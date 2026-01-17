/** @jsxImportSource @opentui/react */
/**
 * TUI Output Adapter
 *
 * Full-screen terminal UI mode using OpenTUI.
 * Provides persistent UI with navigation and panels.
 *
 * @module adapters/output/tui
 */

import { Effect, Layer } from "effect"
import { useState, useCallback } from "react"
import type { ReactNode } from "react"
import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"

import { Box, Column, Row, Spacer, Text, Heading, Muted } from "../../tui/primitives"
import { useKeyboard } from "../../tui/hooks"
import { Output, type OutputPort, type RenderContext, isTty, getTerminalSize } from "../../core/ports/output.js"
import type { CtlAgentOutput } from "../../core/domain/agent-output.js"

// =============================================================================
// TUI TYPES
// =============================================================================

export type TuiView = "home" | "health" | "discover" | "logs" | "catalog" | "settings"

interface TuiState {
  currentView: TuiView
  logs: string[]
  lastOutput: CtlAgentOutput | null
}

// =============================================================================
// TUI COMPONENTS
// =============================================================================

interface HeaderProps {
  title: string
  version: string
}

export const Header = ({ title, version }: HeaderProps): ReactNode => (
  <Box variant="outline" borderColor="cyan" padding={1}>
    <Row>
      <Heading>{title}</Heading>
      <text style={{ fg: "gray" }}> v{version}</text>
    </Row>
  </Box>
)

interface NavBarProps {
  items: readonly { key: string; label: string; shortcut: string }[]
  selected: string
}

export const NavBar = ({ items, selected }: NavBarProps): ReactNode => (
  <box style={{ flexDirection: "row", padding: 1 }}>
    {items.map((item) => (
      <box key={item.key} style={{ marginRight: 2 }}>
        <text
          style={{
            fg: selected === item.key ? "cyan" : "white",
          }}
        >
          {selected === item.key && <b>[{item.shortcut}] {item.label}</b>}
          {selected !== item.key && <>[{item.shortcut}] {item.label}</>}
        </text>
      </box>
    ))}
    <Spacer />
    <Muted>[Q] Quit</Muted>
  </box>
)

interface LogPanelProps {
  logs: readonly string[]
  maxLines?: number
}

export const LogPanel = ({ logs, maxLines = 10 }: LogPanelProps): ReactNode => {
  const displayLogs = logs.slice(-maxLines)
  return (
    <Box variant="card" height={maxLines + 2} flexDirection="column">
      <Muted bold>Logs</Muted>
      {displayLogs.map((log, i) => (
        <Muted key={i}>{log}</Muted>
      ))}
      {displayLogs.length === 0 && <Muted>No logs yet</Muted>}
    </Box>
  )
}

interface StatusBarProps {
  message: string
}

export const StatusBar = ({ message }: StatusBarProps): ReactNode => (
  <Box variant="muted" padding={1}>
    <Text color="yellow">{message}</Text>
  </Box>
)

// =============================================================================
// VIEW COMPONENTS
// =============================================================================

export const HomeView = (): ReactNode => (
  <Column padding={1}>
    <Heading>Welcome to CTL TUI</Heading>
    <Muted>Effect CLI Framework for building skill-driven CLIs</Muted>
    <box style={{ height: 1 }} />

    <Text color="cyan">Keyboard shortcuts:</Text>
    <Muted>  [H] Home  [E] Health  [D] Discover</Muted>
    <Muted>  [L] Logs  [C] Catalog  [S] Settings</Muted>
    <Muted>  [Q] Quit</Muted>
    <box style={{ height: 1 }} />

    <Text color="cyan">Quick commands:</Text>
    <Muted>  ctl new &lt;name&gt;     Create new CLI</Muted>
    <Muted>  ctl add &lt;type&gt;     Add component</Muted>
    <Muted>  ctl help &lt;query&gt;   Find commands</Muted>
  </Column>
)

interface HealthViewProps {
  lastOutput: CtlAgentOutput | null
}

export const HealthView = ({ lastOutput }: HealthViewProps): ReactNode => (
  <Column padding={1}>
    <Text color="green" bold>Health Check</Text>
    <Muted>Run `ctl health` for detailed output</Muted>
    {lastOutput && lastOutput.command === "health" && (
      <text style={{ fg: "white" }}>{JSON.stringify(lastOutput.result, null, 2)}</text>
    )}
  </Column>
)

interface DiscoverViewProps {
  lastOutput: CtlAgentOutput | null
}

export const DiscoverView = ({ lastOutput }: DiscoverViewProps): ReactNode => (
  <Column padding={1}>
    <Text color="blue" bold>Project Discovery</Text>
    <Muted>Run `ctl discover` for detailed output</Muted>
    {lastOutput && lastOutput.command === "discover" && (
      <text style={{ fg: "white" }}>{JSON.stringify(lastOutput.result, null, 2)}</text>
    )}
  </Column>
)

export const CatalogView = (): ReactNode => (
  <Column padding={1}>
    <Text color="magenta" bold>Component Catalog</Text>
    <Muted>Available CTL components and primitives</Muted>
    <box style={{ height: 1 }} />

    <Text color="cyan">Commands:</Text>
    <Muted>  • new         Create new CLI project</Muted>
    <Muted>  • add         Add component to existing CLI</Muted>
    <Muted>  • inspect     Analyze CLI structure</Muted>
    <Muted>  • health      Run health checks</Muted>
    <Muted>  • discover    Discover project config</Muted>
    <Muted>  • help        Search commands</Muted>
    <Muted>  • tui         This TUI mode</Muted>
    <box style={{ height: 1 }} />

    <Text color="cyan">Add types:</Text>
    <Muted>  • command     Add CLI command</Muted>
    <Muted>  • skill       Add skill file</Muted>
    <Muted>  • migration   Add database migration</Muted>
  </Column>
)

export const SettingsView = (): ReactNode => (
  <Column padding={1}>
    <Text color="yellow" bold>Settings</Text>
    <Muted>CTL configuration and preferences</Muted>
    <box style={{ height: 1 }} />

    <Text color="cyan">Output modes:</Text>
    <Muted>  • inline      Default human-readable</Muted>
    <Muted>  • --agent     Structured JSON for agents</Muted>
    <Muted>  • tui         Full terminal UI (this)</Muted>
    <box style={{ height: 1 }} />

    <Text color="cyan">Configuration files:</Text>
    <Muted>  • CTL.md      Project configuration</Muted>
    <Muted>  • skills/     Skill definitions</Muted>
    <Muted>  • package.json CLI metadata</Muted>
  </Column>
)

// =============================================================================
// MAIN TUI APP
// =============================================================================

interface TuiAppProps {
  initialState?: Partial<TuiState>
  onCommand?: (cmd: string) => void
  onExit?: () => void
}

export const TuiApp = ({ initialState, onCommand, onExit }: TuiAppProps): ReactNode => {
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

  // OpenTUI keyboard handling
  useKeyboard((key) => {
    const keyName = key.name?.toLowerCase() ?? ""

    if (keyName === "q") {
      onExit?.()
      return
    }

    // Navigation shortcuts
    const shortcuts: Record<string, TuiView> = {
      h: "home",
      e: "health",
      d: "discover",
      l: "logs",
      c: "catalog",
      s: "settings",
    }

    if (shortcuts[keyName]) {
      handleSelect(shortcuts[keyName])
    }
  })

  const renderContent = (): ReactNode => {
    switch (state.currentView) {
      case "home":
        return <HomeView />
      case "health":
        return <HealthView lastOutput={state.lastOutput} />
      case "discover":
        return <DiscoverView lastOutput={state.lastOutput} />
      case "logs":
        return <LogPanel logs={state.logs} maxLines={15} />
      case "catalog":
        return <CatalogView />
      case "settings":
        return <SettingsView />
      default:
        return null
    }
  }

  return (
    <box style={{ flexDirection: "column", width: "100%", height: "100%" }}>
      <Header title="CTL" version="0.1.0" />
      <NavBar items={navItems} selected={state.currentView} />
      <box style={{ flexGrow: 1, flexDirection: "column" }}>
        {renderContent()}
      </box>
      <StatusBar message={`View: ${state.currentView} | Press Q to quit`} />
    </box>
  )
}

// =============================================================================
// TUI OUTPUT ADAPTER
// =============================================================================

// Store for TUI state (updated by adapter methods)
let tuiLogs: string[] = []
let tuiLastOutput: CtlAgentOutput | null = null
let tuiRoot: ReturnType<typeof createRoot> | null = null
let exitCallback: (() => void) | null = null

const rerenderTui = () => {
  if (tuiRoot) {
    tuiRoot.render(
      <TuiApp
        initialState={{ logs: tuiLogs, lastOutput: tuiLastOutput }}
        onExit={() => exitCallback?.()}
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
    // Reset state
    tuiLogs = []
    tuiLastOutput = null

    // Create OpenTUI renderer and root
    createCliRenderer().then((renderer) => {
      const root = createRoot(renderer)
      tuiRoot = root

      // Set up exit callback
      exitCallback = () => {
        root.unmount()
        tuiRoot = null
        exitCallback = null
        resume(Effect.void)
      }

      // Render initial app
      root.render(
        <TuiApp
          initialState={{ currentView: initialPage }}
          onExit={exitCallback}
        />
      )
    }).catch((err) => {
      console.error("Failed to start TUI:", err)
      resume(Effect.void)
    })
  })

/**
 * Check if TUI is running
 */
export const isTuiRunning = (): boolean => tuiRoot !== null
