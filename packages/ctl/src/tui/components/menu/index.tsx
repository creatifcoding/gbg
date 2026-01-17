/** @jsxImportSource @opentui/react */
/**
 * Menu Component
 *
 * Dropdown or context menu with items and separators.
 */
import { type ReactNode, useState } from "react"
import { Box, Divider } from "../../primitives"
import { useKeyboard } from "../../hooks"

// =============================================================================
// TYPES
// =============================================================================

export type MenuItemType = "item" | "separator" | "submenu"

export interface MenuItem {
  type?: MenuItemType
  id?: string
  label?: string
  shortcut?: string
  disabled?: boolean
  danger?: boolean
  items?: MenuItem[]  // For submenus
}

export interface MenuProps {
  items: MenuItem[]
  open: boolean
  focused?: boolean
  onSelect?: (item: MenuItem) => void
  onClose?: () => void
}

// =============================================================================
// COMPONENT
// =============================================================================

export const Menu = ({
  items,
  open,
  focused = true,
  onSelect,
  onClose,
}: MenuProps): ReactNode => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Filter out separators for navigation
  const selectableItems = items.filter((item) => item.type !== "separator" && !item.disabled)

  useKeyboard((key) => {
    if (!open || !focused) return

    if (key.name === "Escape") {
      onClose?.()
    } else if (key.name === "ArrowUp" || key.name === "k") {
      setSelectedIndex((i) => Math.max(0, i - 1))
    } else if (key.name === "ArrowDown" || key.name === "j") {
      setSelectedIndex((i) => Math.min(selectableItems.length - 1, i + 1))
    } else if (key.name === "Enter") {
      const item = selectableItems[selectedIndex]
      if (item && item.type !== "submenu") {
        onSelect?.(item)
        onClose?.()
      }
    }
  })

  if (!open) return null

  let selectableIndex = 0

  return (
    <Box variant="card" padding={0}>
      {items.map((item, idx) => {
        if (item.type === "separator") {
          return <Divider key={idx} color="#333333" />
        }

        const isSelectable = !item.disabled
        const currentSelectableIndex = isSelectable ? selectableIndex++ : -1
        const isSelected = focused && currentSelectableIndex === selectedIndex

        return (
          <box
            key={item.id ?? idx}
            style={{
              flexDirection: "row",
              paddingLeft: 1,
              paddingRight: 1,
              backgroundColor: isSelected ? "#333333" : undefined,
            }}
          >
            <text
              style={{
                fg: item.disabled
                  ? "gray"
                  : item.danger
                  ? "red"
                  : isSelected
                  ? "cyan"
                  : "white",
                flexGrow: 1,
              }}
            >
              {item.label}
            </text>

            {item.shortcut && (
              <text style={{ fg: "gray" }}>{item.shortcut}</text>
            )}

            {item.type === "submenu" && (
              <text style={{ fg: "gray" }}>▶</text>
            )}
          </box>
        )
      })}
    </Box>
  )
}

// =============================================================================
// HELPERS
// =============================================================================

export const createMenuItem = (
  label: string,
  id?: string,
  shortcut?: string
): MenuItem => ({
  type: "item",
  id: id ?? label.toLowerCase().replace(/\s+/g, "-"),
  label,
  shortcut,
})

export const createSeparator = (): MenuItem => ({
  type: "separator",
})

export const createSubmenu = (label: string, items: MenuItem[]): MenuItem => ({
  type: "submenu",
  label,
  items,
})
