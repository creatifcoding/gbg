import { describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Effect } from 'effect'
import { Command as CommandPrimitive } from 'cmdk'
import { ResultsBand } from '../components/ResultsBand'
import type { NuCmdkItemModel } from '../item-contract'

const makeItem = (id: string, label: string): NuCmdkItemModel => ({
  version: 1,
  semantic: {
    itemId: id,
    label,
    description: `${label} description`,
    kind: 'action',
    status: null,
  },
  actions: [
    {
      actionId: `${id}:execute`,
      kind: 'execute',
      label: 'Execute',
      resolverIdentity: `command:${id}`,
      payload: null,
    },
    {
      actionId: `${id}:preview`,
      kind: 'preview',
      label: 'Preview',
      resolverIdentity: `command:${id}:preview`,
      payload: null,
    },
  ],
  display: {
    iconToken: null,
    badges: [{ text: 'READY', tone: 'info' }],
    emphasis: 'normal',
    shortcuts: ['↵'],
  },
  layout: {
    sectionKey: 'operations',
    sectionPriority: 10,
    density: 'comfortable',
    compactMeta: false,
    pinTop: false,
  },
  telemetry: {
    providerId: 'test-provider',
    laneId: 'test-lane',
    traceId: `trace-${id}`,
    impressionId: `impression-${id}`,
    attributes: {},
  },
  extensions: {
    'test.provider': { id },
  },
})

const renderInCmdk = (node: ReactElement) =>
  render(
    <CommandPrimitive shouldFilter={false} label='results-band-test-root'>
      {node}
    </CommandPrimitive>,
  )

describe('ResultsBand slot behavior (#1035)', () => {
  it('renders fallback default item composition', () => {
    renderInCmdk(
      <ResultsBand
        items={[makeItem('item-1', 'Run Remediation Pipeline')]}
        onSelectItem={() => {}}
      />,
    )

    expect(screen.getByText('Run Remediation Pipeline')).toBeInTheDocument()
    expect(screen.getByText('Run Remediation Pipeline description')).toBeInTheDocument()
  })

  it('renders slot overrides (icon/content/meta/actions)', () => {
    renderInCmdk(
      <ResultsBand
        items={[makeItem('item-2', 'View Datagrid Testbed')]}
        onSelectItem={() => {}}
        itemSlots={{
          icon: () => <span data-testid='custom-icon'>⚡</span>,
          content: (ctx) => <span data-testid='custom-content'>{ctx.semantic.label.toUpperCase()}</span>,
          meta: () => <span data-testid='custom-meta'>META</span>,
          actions: () => <button type='button'>CUSTOM ACTION</button>,
        }}
      />,
    )

    expect(screen.getByTestId('custom-icon')).toBeInTheDocument()
    expect(screen.getByTestId('custom-content')).toHaveTextContent('VIEW DATAGRID TESTBED')
    expect(screen.getByTestId('custom-meta')).toHaveTextContent('META')
    expect(screen.getByRole('button', { name: 'CUSTOM ACTION' })).toBeInTheDocument()
  })

  it('uses provider section catalog when supplied', () => {
    const item = makeItem('item-6', 'Provider Section Item')

    renderInCmdk(
      <ResultsBand
        items={[item]}
        sections={[
          {
            sectionId: 'operations',
            title: 'Provider Operations',
            order: 5,
            hint: 'from provider',
          },
        ]}
        onSelectItem={() => {}}
      />,
    )

    expect(screen.getByText('Provider Operations')).toBeInTheDocument()
    expect(screen.getByText('from provider')).toBeInTheDocument()
  })
})

describe('ResultsBand guardrails (#1036)', () => {
  it('keeps slot outputs inside shell layout envelopes', () => {
    const { container } = renderInCmdk(
      <ResultsBand
        items={[makeItem('item-3', 'Filter Tasks')]}
        onSelectItem={() => {}}
        itemSlots={{
          icon: () => <span data-testid='icon-inner'>I</span>,
          content: () => <span data-testid='content-inner'>C</span>,
          meta: () => <span data-testid='meta-inner'>M</span>,
          actions: () => <span data-testid='actions-inner'>A</span>,
        }}
      />,
    )

    expect(container.querySelector('[data-slot="results-item-icon-slot"]')).toBeTruthy()
    expect(container.querySelector('[data-slot="results-item-content-slot"]')).toBeTruthy()
    expect(container.querySelector('[data-slot="results-item-meta-slot"]')).toBeTruthy()
    expect(container.querySelector('[data-slot="results-item-actions-slot"]')).toBeTruthy()

    const itemRoot = container.querySelector('[data-slot="results-item"]') as HTMLElement
    expect(itemRoot).toBeTruthy()
    expect(itemRoot.style.minHeight).toBe('44px')
  })

  it('action button runs action intent without selecting item', async () => {
    const user = userEvent.setup()
    const onSelectItem = vi.fn()
    const onActionIntent = vi.fn(() => Effect.void)

    renderInCmdk(
      <ResultsBand
        items={[makeItem('item-4', 'Open Panel')]}
        onSelectItem={onSelectItem}
        onActionIntent={onActionIntent}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Preview' }))

    expect(onActionIntent).toHaveBeenCalledTimes(1)
    expect(onSelectItem).not.toHaveBeenCalled()
  })

  it('selects item on row click', async () => {
    const user = userEvent.setup()
    const onSelectItem = vi.fn()

    renderInCmdk(
      <ResultsBand
        items={[makeItem('item-5', 'Open Settings')]}
        onSelectItem={onSelectItem}
      />,
    )

    await user.click(screen.getByText('Open Settings'))
    expect(onSelectItem).toHaveBeenCalledTimes(1)
  })
})
