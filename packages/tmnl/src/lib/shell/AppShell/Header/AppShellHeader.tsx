import type { ReactNode } from "react"

export interface AppShellHeaderProps {
  /** Header content */
  children: ReactNode
}

/**
 * AppShellHeader
 *
 * Grid placement:
 * - row 1
 * - col 1-2 (full width)
 * - z-50 above sidebar corner overlap
 */
export function AppShellHeader({ children }: AppShellHeaderProps) {
  return (
    <header
      className="col-span-2 row-start-1 z-50 bg-black"
      data-shell-header
    >
      {children}
    </header>
  )
}

export default AppShellHeader
