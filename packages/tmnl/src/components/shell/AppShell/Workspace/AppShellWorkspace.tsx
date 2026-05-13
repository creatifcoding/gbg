import type { ReactNode } from "react"

export interface AppShellWorkspaceProps {
  /** Workspace content (routes, pages) */
  children: ReactNode
}

/**
 * AppShellWorkspace
 *
 * Grid placement:
 * - row 2
 * - col 2
 *
 * Scroll behavior:
 * - overflow-y-auto: independent vertical scrolling
 * - overflow-x-hidden: prevent horizontal bleed
 * - overscroll-none: disable browser overscroll bounce/chaining
 */
export function AppShellWorkspace({ children }: AppShellWorkspaceProps) {
  return (
    <main
      className="row-start-2 col-start-2 relative isolate overflow-y-auto overflow-x-hidden overscroll-none"
      data-shell-workspace
      data-shell-content
    >
      {children}
    </main>
  )
}

export default AppShellWorkspace
