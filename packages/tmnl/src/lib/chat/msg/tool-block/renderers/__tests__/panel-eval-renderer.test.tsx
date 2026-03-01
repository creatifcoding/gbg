import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import type { ToolRendererProps } from '../registry'
import {
  detectOpType,
  PanelEvalHeaderMeta,
  PanelEvalRenderer,
} from '../panel-tools/panel-eval'

vi.mock('lucide-react', () => {
  const makeIcon = (testId: string) =>
    (props: Record<string, unknown>) => <span data-testid={testId} {...props} />

  return {
    Hexagon: makeIcon('hexagon-icon'),
    Loader2: makeIcon('loader2-icon'),
    AlertTriangle: makeIcon('alert-triangle-icon'),
    CheckCircle2: makeIcon('check-circle2-icon'),
    XCircle: makeIcon('x-circle-icon'),
  }
})

const makeProps = (overrides: Partial<ToolRendererProps> = {}): ToolRendererProps => ({
  state: 'done',
  toolCallId: 'tool-call-1',
  ...overrides,
})

describe('detectOpType', () => {
  it.each([
    ['panels.all()', 'query'],
    ['panels.get("p-1")', 'lookup'],
    ['surfaces.tree("s-1")', 'introspect'],
    ['layout.arrange(...)', 'arrange'],
    ['subscriptions.attach(...)', 'subscribe'],
    ['return 42', 'eval'],
  ])('maps "%s" to "%s"', (code, expected) => {
    expect(detectOpType(code)).toBe(expected)
  })
})

describe('PanelEvalHeaderMeta', () => {
  it('renders the hexagon icon and operation summary from code', () => {
    render(
      <PanelEvalHeaderMeta
        {...makeProps({
          input: { code: 'panels.get("p-1")' },
        })}
      />,
    )

    expect(screen.getByTestId('hexagon-icon')).toBeInTheDocument()
    expect(screen.getByText('lookup')).toBeInTheDocument()
  })

  it('shows a spinner while running', () => {
    render(
      <PanelEvalHeaderMeta
        {...makeProps({
          input: { code: 'return 42' },
          state: 'running',
        })}
      />,
    )

    expect(screen.getByTestId('loader2-icon')).toBeInTheDocument()
  })
})

describe('PanelEvalRenderer', () => {
  it('renders title, operation badge, code pane, and parsed panel list result', () => {
    const output = JSON.stringify([
      {
        id: 'panel-1',
        title: 'Alpha',
        elementCount: 3,
        surfaceStatus: 'ready',
      },
    ])

    render(
      <PanelEvalRenderer
        {...makeProps({
          input: { code: 'panels.all()' },
          output,
        })}
      />,
    )

    expect(screen.getByText('Panel Eval')).toBeInTheDocument()
    expect(screen.getByText('Query')).toBeInTheDocument()
    expect(screen.getByText('panels.all()')).toBeInTheDocument()
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('panel-1')).toBeInTheDocument()
  })

  it('shows spinner(s) when running', () => {
    render(
      <PanelEvalRenderer
        {...makeProps({
          input: { code: '' },
          state: 'running',
        })}
      />,
    )

    expect(screen.getAllByTestId('loader2-icon').length).toBeGreaterThan(0)
  })

  it('renders error output with error styling', () => {
    render(
      <PanelEvalRenderer
        {...makeProps({
          input: { code: 'return 42' },
          errorText: 'Panel evaluation failed hard',
          state: 'failed',
        })}
      />,
    )

    const errorMessage = screen.getByText('Panel evaluation failed hard')
    expect(errorMessage).toBeInTheDocument()
    expect(errorMessage.closest('section')).toHaveClass('border-red-500/30')
  })
})
