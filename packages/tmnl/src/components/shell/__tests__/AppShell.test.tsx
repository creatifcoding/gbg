import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppShell } from '../AppShell'

describe('AppShell', () => {
  it('renders compound sections with expected data attributes', () => {
    render(
      <AppShell>
        <AppShell.Header>
          <div>Header</div>
        </AppShell.Header>
        <AppShell.Sidebar>
          <div>Sidebar</div>
        </AppShell.Sidebar>
        <AppShell.Workspace>
          <div>Workspace</div>
        </AppShell.Workspace>
      </AppShell>
    )

    expect(screen.getByText('Header')).toBeInTheDocument()
    expect(screen.getByText('Sidebar')).toBeInTheDocument()
    expect(screen.getByText('Workspace')).toBeInTheDocument()

    expect(document.querySelector('[data-app-shell]')).toBeInTheDocument()
    expect(document.querySelector('[data-shell-header]')).toBeInTheDocument()
    expect(document.querySelector('[data-shell-sidebar]')).toBeInTheDocument()
    expect(document.querySelector('[data-shell-workspace]')).toBeInTheDocument()
  })

  it('preserves workspace overscroll behavior', () => {
    render(
      <AppShell>
        <AppShell.Header>
          <div>Header</div>
        </AppShell.Header>
        <AppShell.Sidebar>
          <div>Sidebar</div>
        </AppShell.Sidebar>
        <AppShell.Workspace>
          <div>Workspace</div>
        </AppShell.Workspace>
      </AppShell>
    )

    const workspace = document.querySelector('[data-shell-workspace]')
    expect(workspace).toHaveClass('overscroll-none')
    expect(workspace).toHaveClass('overflow-y-auto')
    expect(workspace).toHaveClass('overflow-x-hidden')
  })
})
