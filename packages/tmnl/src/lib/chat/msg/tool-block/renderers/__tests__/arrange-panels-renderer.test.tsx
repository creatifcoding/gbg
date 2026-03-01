import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ToolRendererProps } from '../registry'
import { ArrangePanelsHeaderMeta } from '../panel-tools/arrange-panels/ArrangePanelsHeaderMeta'
import { ArrangePanelsRenderer } from '../panel-tools/arrange-panels/ArrangePanelsRenderer'
import { SpatialMinimap } from '../panel-tools/arrange-panels/SpatialMinimap'
import type { ArrangeResult } from '@/lib/panels/layout/schemas'

vi.mock('lucide-react', () => {
  const icon =
    (testId: string) =>
    ({ className }: { className?: string }) => <svg data-testid={testId} className={className} />

  return {
    LayoutGrid: icon('icon-layout-grid'),
    Loader2: icon('icon-loader-2'),
    AlertTriangle: icon('icon-alert-triangle'),
  }
})

const sampleArrangeResult: ArrangeResult = {
  targets: [
    {
      panelId: 'p-1',
      position: { x: 0, y: 0 },
      dimensions: { width: 333, height: 800 },
    },
    {
      panelId: 'p-2',
      position: { x: 333, y: 0 },
      dimensions: { width: 333, height: 800 },
    },
    {
      panelId: 'p-3',
      position: { x: 666, y: 0 },
      dimensions: { width: 334, height: 800 },
    },
  ],
  layoutMode: 'tile-horizontal',
  appliedAt: 1709150400000,
}

function makeRendererProps(overrides: Partial<ToolRendererProps> = {}): ToolRendererProps {
  return {
    state: 'done',
    toolCallId: 'tool-arrange-panels-test',
    ...overrides,
  }
}

describe('ArrangePanelsHeaderMeta', () => {
  it('shows layout mode from input and panel count', () => {
    render(
      <ArrangePanelsHeaderMeta
        {...makeRendererProps({
          input: {
            arguments: {
              mode: 'grid',
              panelIds: ['p-1', 'p-2', 'p-3'],
            },
          },
        })}
      />,
    )

    expect(screen.getByText('grid')).toBeInTheDocument()
    expect(screen.getByText('· 3 panels')).toBeInTheDocument()
  })

  it('shows spinner when running', () => {
    render(
      <ArrangePanelsHeaderMeta
        {...makeRendererProps({
          state: 'running',
          input: {
            arguments: {
              mode: 'tile-horizontal',
              panelIds: ['p-1'],
            },
          },
        })}
      />,
    )

    const spinner = screen.getByTestId('icon-loader-2')
    expect(spinner).toBeInTheDocument()
    expect(spinner.className).toContain('animate-spin')
  })
})

describe('ArrangePanelsRenderer', () => {
  it('renders title, amber mode badge, and panel count', () => {
    render(
      <ArrangePanelsRenderer
        {...makeRendererProps({
          input: {
            arguments: {
              mode: 'tile-horizontal',
              panelIds: ['p-1', 'p-2', 'p-3'],
            },
          },
          output: sampleArrangeResult,
        })}
      />,
    )

    expect(screen.getByText('Arrange Panels')).toBeInTheDocument()

    const modeBadge = screen.getByText('tile-horizontal')
    expect(modeBadge).toBeInTheDocument()
    expect(modeBadge.className).toContain('text-amber-400/80')

    expect(screen.getByText('3 panels')).toBeInTheDocument()
  })

  it('shows spinner placeholder when running without targets', () => {
    render(
      <ArrangePanelsRenderer
        {...makeRendererProps({
          state: 'running',
          input: {
            arguments: {
              mode: 'tile-horizontal',
              panelIds: ['p-1', 'p-2'],
            },
          },
        })}
      />,
    )

    const spinner = screen.getByTestId('icon-loader-2')
    expect(spinner).toBeInTheDocument()
    expect(spinner.className).toContain('animate-spin')
  })

  it('renders SpatialMinimap when result has targets', () => {
    render(
      <ArrangePanelsRenderer
        {...makeRendererProps({
          input: {
            arguments: {
              mode: 'tile-horizontal',
            },
          },
          output: sampleArrangeResult,
        })}
      />,
    )

    expect(screen.getByTitle('p-1')).toBeInTheDocument()
    expect(screen.getByTitle('p-2')).toBeInTheDocument()
    expect(screen.getByTitle('p-3')).toBeInTheDocument()
  })

  it('shows metadata row when gap and region are available', () => {
    render(
      <ArrangePanelsRenderer
        {...makeRendererProps({
          input: {
            arguments: {
              mode: 'tile-horizontal',
              gap: 16,
              region: 'full',
            },
          },
          output: sampleArrangeResult,
        })}
      />,
    )

    expect(screen.getByText('gap: 16px')).toBeInTheDocument()
    expect(screen.getByText('region: full')).toBeInTheDocument()
  })

  it('handles error state', () => {
    render(
      <ArrangePanelsRenderer
        {...makeRendererProps({
          state: 'error',
          errorText: 'Arrange failed hard',
          input: {
            arguments: {
              mode: 'grid',
              panelIds: ['p-1'],
            },
          },
        })}
      />,
    )

    expect(screen.getByText('Arrange failed hard')).toBeInTheDocument()
    expect(screen.getByTestId('icon-alert-triangle')).toBeInTheDocument()
  })
})

describe('SpatialMinimap', () => {
  it('renders panel rectangles for each target', () => {
    render(<SpatialMinimap targets={sampleArrangeResult.targets} />)

    expect(screen.getByTitle('p-1')).toBeInTheDocument()
    expect(screen.getByTitle('p-2')).toBeInTheDocument()
    expect(screen.getByTitle('p-3')).toBeInTheDocument()
  })

  it('shows "No targets" when empty', () => {
    render(<SpatialMinimap targets={[]} />)

    expect(screen.getByText('No targets')).toBeInTheDocument()
  })

  it('renders panel names in rectangles', () => {
    render(<SpatialMinimap targets={sampleArrangeResult.targets} />)

    expect(screen.getByText('p-1')).toBeInTheDocument()
    expect(screen.getByText('p-2')).toBeInTheDocument()
    expect(screen.getByText('p-3')).toBeInTheDocument()
  })
})
