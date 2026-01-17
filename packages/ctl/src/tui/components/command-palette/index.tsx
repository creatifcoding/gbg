/** @jsxImportSource @opentui/react */
/**
 * Command Palette Component
 *
 * Searchable command list similar to VS Code's command palette.
 */
import { type ReactNode, useState, useMemo } from "react"
import { Box, Input, Muted, ScrollBox } from "../../primitives"
import { useKeyboard } from "../../hooks"

// =============================================================================
// TYPES
// =============================================================================

export interface CommandItem {
  id: string
  label: string
  description?: string
  shortcut?: string
  category?: string
}

export interface CommandPaletteProps {
  commands: CommandItem[]
  open: boolean
  placeholder?: string
  onSelect?: (command: CommandItem) => void
  onClose?: () => void
}

// =============================================================================
// COMPONENT
// =============================================================================

export const CommandPalette = ({
  commands,
  open,
  placeholder = "Type a command...",
  onSelect,
  onClose,
}: CommandPaletteProps): ReactNode => {
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)

  const filteredCommands = useMemo(() => {
    if (!query) return commands
    const q = query.toLowerCase()
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.description?.toLowerCase().includes(q) ||
        cmd.category?.toLowerCase().includes(q)
    )
  }, [commands, query])

  useKeyboard((key) => {
    if (!open) return

    if (key.name === "Escape") {
      onClose?.()
    } else if (key.name === "ArrowUp" || (key.ctrl && key.name === "p")) {
      setSelectedIndex((i) => Math.max(0, i - 1))
    } else if (key.name === "ArrowDown" || (key.ctrl && key.name === "n")) {
      setSelectedIndex((i) => Math.min(filteredCommands.length - 1, i + 1))
    } else if (key.name === "Enter") {
      const cmd = filteredCommands[selectedIndex]
      if (cmd) {
        onSelect?.(cmd)
        onClose?.()
      }
    }
  })

  if (!open) return null

  return (
    <box
      style={{
        position: "absolute",
        width: "100%",
        height: "100%",
        justifyContent: "flex-start",
        alignItems: "center",
        paddingTop: 2,
      }}
    >
      <Box variant="card" width={60}>
        {/* Search Input */}
        <box style={{ marginBottom: 1 }}>
          <Input
            placeholder={placeholder}
            focused={true}
            onChange={setQuery}
          />
        </box>

        {/* Command List */}
        <ScrollBox height={15}>
          {filteredCommands.length === 0 ? (
            <Muted>No commands found</Muted>
          ) : (
            filteredCommands.map((cmd, idx) => (
              <box
                key={cmd.id}
                style={{
                  flexDirection: "row",
                  padding: 0,
                  backgroundColor: idx === selectedIndex ? "#333333" : undefined,
                }}
              >
                <box style={{ flexDirection: "column", flexGrow: 1 }}>
                  <text
                    style={{
                      fg: idx === selectedIndex ? "cyan" : "white",
                    }}
                  >
                    {cmd.label}
                  </text>
                  {cmd.description && (
                    <text style={{ fg: "gray" }}>{cmd.description}</text>
                  )}
                </box>
                {cmd.shortcut && (
                  <text style={{ fg: "gray" }}>{cmd.shortcut}</text>
                )}
              </box>
            ))
          )}
        </ScrollBox>

        {/* Footer */}
        <box style={{ marginTop: 1, flexDirection: "row", justifyContent: "space-between" }}>
          <Muted>↑↓ Navigate</Muted>
          <Muted>↵ Select</Muted>
          <Muted>Esc Close</Muted>
        </box>
      </Box>
    </box>
  )
}
