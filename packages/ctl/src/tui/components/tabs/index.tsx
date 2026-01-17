/** @jsxImportSource @opentui/react */
/**
 * Tabs Component
 *
 * Tabbed content navigation.
 */
import { type ReactNode, useState, Children, isValidElement } from "react"
import { useKeyboard } from "../../hooks"

// =============================================================================
// TYPES
// =============================================================================

export interface TabItem {
  id: string
  label: string
  disabled?: boolean
}

export interface TabsProps {
  tabs: TabItem[]
  activeId?: string
  focused?: boolean
  onChange?: (tabId: string) => void
  children?: ReactNode
}

export interface TabPanelProps {
  tabId: string
  children?: ReactNode
}

// =============================================================================
// COMPONENTS
// =============================================================================

export const Tabs = ({
  tabs,
  activeId,
  focused = false,
  onChange,
  children,
}: TabsProps): ReactNode => {
  const [internalActiveId, setInternalActiveId] = useState(tabs[0]?.id)
  const currentActiveId = activeId ?? internalActiveId

  const activeIndex = tabs.findIndex((t) => t.id === currentActiveId)

  useKeyboard((key) => {
    if (!focused) return

    if (key.name === "ArrowLeft" || key.name === "h") {
      const newIndex = Math.max(0, activeIndex - 1)
      const newTab = tabs[newIndex]
      if (newTab && !newTab.disabled) {
        setInternalActiveId(newTab.id)
        onChange?.(newTab.id)
      }
    } else if (key.name === "ArrowRight" || key.name === "l") {
      const newIndex = Math.min(tabs.length - 1, activeIndex + 1)
      const newTab = tabs[newIndex]
      if (newTab && !newTab.disabled) {
        setInternalActiveId(newTab.id)
        onChange?.(newTab.id)
      }
    }
  })

  // Find the active panel
  let activePanel: ReactNode = null
  Children.forEach(children, (child) => {
    if (isValidElement<TabPanelProps>(child) && child.props.tabId === currentActiveId) {
      activePanel = child.props.children
    }
  })

  return (
    <box style={{ flexDirection: "column" }}>
      {/* Tab Bar */}
      <box style={{ flexDirection: "row", marginBottom: 1 }}>
        {tabs.map((tab, idx) => {
          const isActive = tab.id === currentActiveId
          const isFocused = focused && idx === activeIndex

          return (
            <box
              key={tab.id}
              style={{
                paddingLeft: 2,
                paddingRight: 2,
                borderColor: isActive ? "cyan" : "gray",
              }}
            >
              <text
                style={{
                  fg: tab.disabled
                    ? "gray"
                    : isActive
                    ? "cyan"
                    : isFocused
                    ? "white"
                    : "gray",
                }}
              >
                {tab.label}
              </text>
            </box>
          )
        })}
      </box>

      {/* Active Panel */}
      <box style={{ flexGrow: 1 }}>
        {activePanel}
      </box>
    </box>
  )
}

export const TabPanel = ({ children }: TabPanelProps): ReactNode => {
  // TabPanel is just a container, actual rendering is handled by Tabs
  return <>{children}</>
}

// Compound export
export const TabsCompound = Object.assign(Tabs, {
  Panel: TabPanel,
})
