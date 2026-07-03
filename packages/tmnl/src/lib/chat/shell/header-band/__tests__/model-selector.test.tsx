import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ModelSelector } from '../model-selector'

describe('ModelSelector', () => {
  it('renders an explicit empty-catalog state instead of disappearing', () => {
    render(
      <ModelSelector.Root models={[]} selectedId={null} onSelect={vi.fn()}>
        <ModelSelector.Trigger />
        <ModelSelector.Content>
          <ModelSelector.List />
        </ModelSelector.Content>
      </ModelSelector.Root>,
    )

    const trigger = screen.getByRole('button', { name: /no available model/i })
    expect(trigger).toBeInTheDocument()

    fireEvent.click(trigger)

    expect(screen.getByText('No available models')).toBeInTheDocument()
  })

  it('shows only authenticated models by default and quarantines locked entries behind a tab', () => {
    render(
      <ModelSelector.Root
        models={[
          { id: 'azure:gpt-5.5', label: 'GPT-5.5', provider: 'azure', description: 'auth needed', available: false },
          { id: 'openai-codex:gpt-5.5', label: 'GPT-5.5 (Codex)', provider: 'openai-codex', description: 'auth OK', available: true },
          { id: 'cloudflare:gpt-5.5', label: 'GPT-5.5 Gateway', provider: 'cloudflare', description: 'auth needed', available: false },
        ]}
        selectedId={null}
        onSelect={vi.fn()}
      >
        <ModelSelector.Trigger />
        <ModelSelector.Content>
          <ModelSelector.Tabs />
          <ModelSelector.List />
        </ModelSelector.Content>
      </ModelSelector.Root>,
    )

    fireEvent.click(screen.getByRole('button', { name: /no model/i }))

    let options = screen.getAllByRole('option')
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveTextContent('GPT-5.5 (Codex)')

    fireEvent.click(screen.getByRole('tab', { name: /locked 2/i }))

    options = screen.getAllByRole('option')
    expect(options).toHaveLength(2)
    expect(options[0]).toHaveTextContent('GPT-5.5')
    expect(options[0]).toBeDisabled()
    expect(options[1]).toHaveTextContent('GPT-5.5 Gateway')
    expect(options[1]).toBeDisabled()
  })
})
