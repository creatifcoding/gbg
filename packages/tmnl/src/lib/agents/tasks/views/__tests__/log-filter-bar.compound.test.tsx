import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { createAgentTaskLogAtomSurfaceAtoms } from '../../atoms/surface'
import { AgentTaskServiceMock } from '../../services/layers'
import { LogFilterBar } from '../log-filter-bar'

describe('LogFilterBar compound', () => {
  it('supports slot composition and keeps severity buttons ARIA-pressed', async () => {
    const atoms = createAgentTaskLogAtomSurfaceAtoms(AgentTaskServiceMock)

    render(
      <LogFilterBar atoms={atoms}>
        <LogFilterBar.Severity />
        <LogFilterBar.Query>
          <LogFilterBar.SearchInput />
          <LogFilterBar.DorkChips />
        </LogFilterBar.Query>
        <LogFilterBar.ClearButton />
      </LogFilterBar>,
    )

    const debug = screen.getByTitle('Show DEBUG and above')
    const warn = screen.getByTitle('Show WARN and above')

    expect(debug).toHaveAttribute('aria-pressed', 'true')
    expect(warn).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(warn)

    await waitFor(() => {
      expect(debug).toHaveAttribute('aria-pressed', 'false')
      expect(warn).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: /clear all filters/i })).toBeInTheDocument()
    })
  })

  it('commits dork tokens from keyboard Enter and clears via ClearButton', async () => {
    const atoms = createAgentTaskLogAtomSurfaceAtoms(AgentTaskServiceMock)

    render(<LogFilterBar atoms={atoms} />)

    const search = screen.getByLabelText('Log search and dork query') as HTMLInputElement

    fireEvent.change(search, { target: { value: 'scope:runtime' } })

    expect(search.value).toBe('scope:runtime')
    expect(screen.queryByText('scope:runtime')).toBeNull()

    fireEvent.keyDown(search, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByText('SCOPE')).toBeInTheDocument()
      expect(screen.getByText('scope:runtime')).toBeInTheDocument()
      expect(search.value).toBe('')
    })

    fireEvent.click(screen.getByRole('button', { name: /clear all filters/i }))

    await waitFor(() => {
      expect(screen.queryByText('scope:runtime')).toBeNull()
      expect(search.value).toBe('')
    })
  })
})
