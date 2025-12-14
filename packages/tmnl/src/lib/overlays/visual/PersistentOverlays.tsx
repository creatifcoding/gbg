/**
 * Persistent Overlays
 *
 * Renders persistent chrome (header, sidebar) as DOM siblings.
 * NOT rendered via GlobalSlot - these are real DOM elements in document flow.
 *
 * Uses the canonical Header from static-ui.
 *
 * EPOCH-0004: Global Overlay System
 *
 * @module
 */

import { useState, useCallback } from "react"
import { Header } from "@/components/static-ui/Header"

export interface PersistentOverlaysProps {
  /** Whether to show the header (defaults to true) */
  showHeader?: boolean
  /** Whether to show the sidebar (defaults to false, future) */
  showSidebar?: boolean
  /** Navigation tabs for header */
  navTabs?: string[]
  /** Initial active tab */
  initialTab?: string
}

/**
 * PersistentOverlays
 *
 * Renders persistent chrome directly as DOM siblings.
 * Position BEFORE RouterProvider to be at top of document flow.
 *
 * @example
 * ```tsx
 * <VisualOverlayProvider>
 *   <PersistentOverlays />
 *   <GlobalSlot />
 *   <RouterProvider router={router} />
 * </VisualOverlayProvider>
 * ```
 */
export function PersistentOverlays({
  showHeader = true,
  showSidebar = false,
  navTabs = ["OVERVIEW", "DATA", "CANVAS", "TESTBED"],
  initialTab = "OVERVIEW",
}: PersistentOverlaysProps) {
  const [activeTab, setActiveTab] = useState(initialTab)

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab)
    console.log("[Header] Tab changed:", tab)
  }, [])

  const handleOpenLeftDrawer = useCallback(() => {
    console.log("[Header] Open left drawer - not yet implemented")
  }, [])

  const handleOpenRightDrawer = useCallback(() => {
    console.log("[Header] Open right drawer - not yet implemented")
  }, [])

  const handleOpenCommand = useCallback(() => {
    console.log("[Header] Open command palette - not yet implemented")
  }, [])

  const handleOpenSettings = useCallback(() => {
    console.log("[Header] Open settings - not yet implemented")
  }, [])

  if (!showHeader && !showSidebar) {
    return null
  }

  return (
    <>
      {showHeader && (
        <Header
          navTabs={navTabs}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onOpenLeftDrawer={handleOpenLeftDrawer}
          onOpenRightDrawer={handleOpenRightDrawer}
          onOpenCommand={handleOpenCommand}
          onOpenSettings={handleOpenSettings}
        />
      )}
      {/* Future: sidebar renders here as sibling */}
    </>
  )
}

export default PersistentOverlays
