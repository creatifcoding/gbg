import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'

export function Shell({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto flex w-full max-w-6xl gap-8 px-6 py-8">
        <aside className="hidden w-48 shrink-0 md:block">
          <p className="vanta-label">@gbg/catalog</p>
          <h1 className="vanta-heading mt-3 text-2xl leading-tight">{title}</h1>
          <nav className="vanta-nav mt-8 flex flex-col gap-1">
            <Link to="/">Catalog</Link>
            <Link to="/intake">Intake</Link>
            <Link to="/testbed/vanta">Testbed</Link>
          </nav>
          <p className="vanta-muted mt-10 text-[12px] leading-5">
            Dump first. File a specimen in one screen. Body waits until the specimen exists.
          </p>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
