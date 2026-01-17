/** @jsxImportSource @opentui/react */
/**
 * Sidebar Component
 *
 * Vertical navigation sidebar with sections and items.
 */
import { type ReactNode, useState } from "react"
import { Box, Muted } from "../../primitives"
import { useKeyboard } from "../../hooks"

// =============================================================================
// TYPES
// =============================================================================

export interface SidebarItem {
  id: string
  label: string
  icon?: string
  shortcut?: string
}

export interface SidebarSection {
  title?: string
  items: SidebarItem[]
}

export interface SidebarProps {
  sections: SidebarSection[]
  selectedId?: string
  focused?: boolean
  width?: number
  onSelect?: (item: SidebarItem) => void
}

// =============================================================================
// COMPONENT
// =============================================================================

export const Sidebar = ({
  sections,
  selectedId,
  focused = false,
  width = 30,
  onSelect,
}: SidebarProps): ReactNode => {
  const [focusedIndex, setFocusedIndex] = useState(0)

  // Flatten all items for keyboard navigation
  const allItems = sections.flatMap((s) => s.items)

  useKeyboard((key) => {
    if (!focused) return

    if (key.name === "ArrowUp" || key.name === "k") {
      setFocusedIndex((i) => Math.max(0, i - 1))
    } else if (key.name === "ArrowDown" || key.name === "j") {
      setFocusedIndex((i) => Math.min(allItems.length - 1, i + 1))
    } else if (key.name === "Enter") {
      const item = allItems[focusedIndex]
      if (item && onSelect) {
        onSelect(item)
      }
    }
  })

  let itemIndex = 0

  return (
    <Box
      variant="outline"
      width={width}
      height="100%"
      flexDirection="column"
    >
      {sections.map((section, sectionIdx) => (
        <box key={sectionIdx} style={{ flexDirection: "column", marginBottom: 1 }}>
          {section.title && (
            <box style={{ marginBottom: 1 }}>
              <Muted>{section.title.toUpperCase()}</Muted>
            </box>
          )}

          {section.items.map((item) => {
            const currentIndex = itemIndex++
            const isSelected = item.id === selectedId
            const isFocused = focused && currentIndex === focusedIndex

            return (
              <box
                key={item.id}
                style={{
                  flexDirection: "row",
                  padding: 0,
                  backgroundColor: isFocused ? "#333333" : isSelected ? "#222222" : undefined,
                }}
              >
                {item.icon && (
                  <text style={{ fg: isFocused ? "cyan" : "gray" }}>{item.icon} </text>
                )}
                <text
                  style={{
                    fg: isFocused ? "cyan" : isSelected ? "white" : "gray",
                    flexGrow: 1,
                  }}
                >
                  {item.label}
                </text>
                {item.shortcut && (
                  <text style={{ fg: "gray" }}>{item.shortcut}</text>
                )}
              </box>
            )
          })}
        </box>
      ))}
    </Box>
  )
}
