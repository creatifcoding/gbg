import type { ReactNode } from "react"

export interface AppShellSidebarProps {
  /** Sidebar content */
  children: ReactNode
}

/**
 * AppShellSidebar
 *
 * Grid placement:
 * - row 1-2 (full height)
 * - col 1
 * - z-40 beneath header overlap corner
 */
export function AppShellSidebar({ children }: AppShellSidebarProps) {
  return (
    <aside
      className="row-span-2 col-start-1 z-40 bg-black"
      data-shell-sidebar
    >
      {children}
    </aside>
  )
}

export default AppShellSidebar
