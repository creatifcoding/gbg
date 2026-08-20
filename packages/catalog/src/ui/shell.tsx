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
        <aside className="catalog-sans hidden w-48 shrink-0 md:block">
          <p className="text-[12px] tracking-[0.18em] uppercase text-[color:var(--catalog-muted)]">
            @gbg/catalog
          </p>
          <h1 className="mt-3 font-serif text-2xl leading-tight">{title}</h1>
          <nav className="mt-8 flex flex-col gap-2 text-[14px]">
            <Link
              to="/"
              className="rounded-lg px-3 py-2 hover:bg-white"
              activeProps={{ className: 'rounded-lg bg-white px-3 py-2' }}
            >
              Catalog
            </Link>
            <Link
              to="/intake"
              className="rounded-lg px-3 py-2 hover:bg-white"
              activeProps={{ className: 'rounded-lg bg-white px-3 py-2' }}
            >
              Intake
            </Link>
          </nav>
          <p className="mt-10 text-[12px] leading-5 text-[color:var(--catalog-muted)]">
            Dump first. File a card in one screen. Notes wait until the card exists.
          </p>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
