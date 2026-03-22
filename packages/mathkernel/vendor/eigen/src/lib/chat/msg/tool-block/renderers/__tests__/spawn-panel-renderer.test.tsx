import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import type { ToolRendererProps } from '../registry'
import { SpawnPanelHeaderMeta } from '../panel-tools/spawn-panel/SpawnPanelHeaderMeta'
import { StatusCard, type StatusCardProps } from '../panel-tools/spawn-panel/StatusCard'
import { SpawnPanelRenderer } from '../panel-tools/spawn-panel/SpawnPanelRenderer'

vi.mock('lucide-react', () => {
  const makeIcon =
    (testId: string) =>
      (props: Record<string, unknown>) => <span data-testid={testId} {...props} />

  return {
    Monitor: makeIcon('monitor-icon'),
    RefreshCw: makeIcon('refresh-cw-icon'),
    XCircle: makeIcon('x-circle-icon'),
    CheckCircle2: makeIcon('check-circle2-icon'),
  }
})

const makeToolProps = (
  overrides: Partial<ToolRendererProps> = {},
): ToolRendererProps => ({
  state: 'done',
  toolCallId: 'tool-call-1',
  ...overrides,
})

const makeStatusCardProps = (
  overrides: Partial<StatusCardProps> = {},
): StatusCardProps => ({
  operation: 'spawn',
  isRunning: false,
  isError: false,
  ...overrides,
})

describe('SpawnPanelHeaderMeta', () => {
  it('shows spinning dot for spawn + running', () => {
    const { container } = render(
      <SpawnPanelHeaderMeta
        {...makeToolProps({
          input: { prompt: 'Generate dashboard', title: 'Ops Dashboard' },
          state: 'running',
        })}
      />,
    )

    expect(container.querySelector('.animate-ping')).toBeInTheDocument()
    expect(screen.getByText('Ops Dashboard')).toBeInTheDocument()
  })

  it('shows green check for spawn + completed', () => {
    render(
      <SpawnPanelHeaderMeta
        {...makeToolProps({
          input: { prompt: 'Generate dashboard', title: 'Ops Dashboard' },
          state: 'done',
        })}
      />,
    )

    const readyIcon = screen.getByTestId('check-circle2-icon')
    expect(readyIcon).toBeInTheDocument()
    expect(readyIcon).toHaveClass('text-emerald-400')
  })

  it('shows red icon for close operation', () => {
    render(
      <SpawnPanelHeaderMeta
        {...makeToolProps({
          input: { panelId: 'panel-close-1', close: true },
        })}
      />,
    )

    const closeIcon = screen.getByTestId('x-circle-icon')
    expect(closeIcon).toBeInTheDocument()
    expect(closeIcon).toHaveClass('text-red-400/70')
  })

  it('shows blue icon for update operation', () => {
    render(
      <SpawnPanelHeaderMeta
        {...makeToolProps({
          input: { surfaceId: 'surface-1', update: 'Refine typography' },
        })}
      />,
    )

    const updateIcon = screen.getByTestId('refresh-cw-icon')
    expect(updateIcon).toBeInTheDocument()
    expect(updateIcon).toHaveClass('text-blue-400/70')
  })

  it('shows title text from input', () => {
    render(
      <SpawnPanelHeaderMeta
        {...makeToolProps({
          input: { prompt: 'Generate panel', title: 'Alpha Surface' },
        })}
      />,
    )

    expect(screen.getByText('Alpha Surface')).toBeInTheDocument()
  })
})

describe('StatusCard', () => {
  it('spawn + running: shows generating text', () => {
    render(
      <StatusCard
        {...makeStatusCardProps({
          operation: 'spawn',
          isRunning: true,
          title: 'Spawn Test',
        })}
      />,
    )

    expect(screen.getByText(/^generating$/i)).toBeInTheDocument()
  })

  it('spawn + complete: shows ready text', () => {
    render(
      <StatusCard
        {...makeStatusCardProps({
          operation: 'spawn',
          isRunning: false,
          title: 'Spawn Ready',
        })}
      />,
    )

    expect(screen.getByText(/^ready$/i)).toBeInTheDocument()
  })

  it('spawn + error: shows error message', () => {
    render(
      <StatusCard
        {...makeStatusCardProps({
          operation: 'spawn',
          isError: true,
          errorText: 'Spawn failed hard',
        })}
      />,
    )

    expect(screen.getByText('Spawn failed hard')).toBeInTheDocument()
  })

  it('close: shows closed confirmation', () => {
    render(
      <StatusCard
        {...makeStatusCardProps({
          operation: 'close',
          panelId: 'panel-close-1',
        })}
      />,
    )

    expect(screen.getByText(/closed\./i)).toBeInTheDocument()
  })

  it('update: shows updated confirmation', () => {
    render(
      <StatusCard
        {...makeStatusCardProps({
          operation: 'update',
          surfaceId: 'surface-1',
        })}
      />,
    )

    expect(screen.getByText(/updated\./i)).toBeInTheDocument()
  })

  it('display: shows displaying confirmation', () => {
    render(
      <StatusCard
        {...makeStatusCardProps({
          operation: 'display',
          panelId: 'panel-1',
          surfaceId: 'surface-1',
        })}
      />,
    )

    expect(screen.getByText(/displaying surface/i)).toBeInTheDocument()
  })

  it('shows subscription badge when subscriptionAttached=true', () => {
    render(
      <StatusCard
        {...makeStatusCardProps({
          operation: 'spawn',
          title: 'Subscription Test',
          subscriptionAttached: true,
        })}
      />,
    )

    expect(screen.getByText('subscription attached')).toBeInTheDocument()
  })
})

describe('SpawnPanelRenderer', () => {
  it('renders StatusCard for spawn operation', () => {
    render(
      <SpawnPanelRenderer
        {...makeToolProps({
          input: { prompt: 'Build me a panel', title: 'Spawn Ops' },
          state: 'running',
        })}
      />,
    )

    expect(screen.getByText('Spawn Ops')).toBeInTheDocument()
    expect(screen.getByText(/^generating$/i)).toBeInTheDocument()
  })

  it('detects close operation from input.close=true', () => {
    render(
      <SpawnPanelRenderer
        {...makeToolProps({
          input: { panelId: 'panel-close-2', close: true },
        })}
      />,
    )

    expect(screen.getByText(/closed\./i)).toBeInTheDocument()
    expect(screen.getByText('panel-close-2')).toBeInTheDocument()
  })

  it('passes title from input', () => {
    render(
      <SpawnPanelRenderer
        {...makeToolProps({
          input: { prompt: 'Fallback title source', title: 'Input Title' },
        })}
      />,
    )

    expect(screen.getByText('Input Title')).toBeInTheDocument()
  })

  it('passes panelId from parsed output details', () => {
    const output = {
      content: [
        {
          type: 'text',
          text: 'Panel panel-1 spawning with surface surface-1. Content will render incrementally.',
        },
      ],
      details: {
        surfaceId: 'surface-1',
        panelId: 'panel-1',
        operation: 'spawn',
      },
    }

    render(
      <SpawnPanelRenderer
        {...makeToolProps({
          input: { prompt: 'Create panel from prompt', title: 'From Details' },
          output,
        })}
      />,
    )

    expect(screen.getByText('panel-1')).toBeInTheDocument()
  })
})
