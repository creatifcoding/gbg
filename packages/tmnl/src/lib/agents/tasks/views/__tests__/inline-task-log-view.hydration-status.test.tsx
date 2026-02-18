import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  InlineTaskLogViewProvider,
  type InlineTaskLogViewContextValue,
} from '../inline-task-log-view-context'
import { InlineTaskLogView } from '../inline-task-log-view'

const makeContextValue = (
  overrides: Partial<InlineTaskLogViewContextValue> = {},
): InlineTaskLogViewContextValue => ({
  taskId: 'hydration-status-test',
  compact: false,
  atoms: undefined,
  entries: [],
  tailMode: 'inspect',
  unreadCount: 0,
  hydrationLoading: false,
  hydrationError: null,
  scrollRef: createRef<HTMLDivElement>(),
  head: {
    ref: createRef<HTMLDivElement>(),
    isVisible: false,
    scrollTo: () => {},
  },
  tail: {
    ref: createRef<HTMLDivElement>(),
    isVisible: false,
    scrollTo: () => {},
  },
  pointer: {
    targetKey: null,
    setTarget: () => {},
    scrollTo: () => {},
    focus: () => {},
    clear: () => {},
  },
  tailInterruptProps: {
    onScroll: () => {},
    onWheel: () => {},
    onMouseDown: () => {},
    onTouchStart: () => {},
    onKeyDown: () => {},
  },
  interruptTail: () => {},
  jumpToLatest: () => {},
  ...overrides,
})

describe('InlineTaskLogView hydration status row', () => {
  it('shows loading row and removes it once loading resolves', () => {
    const loadingCtx = makeContextValue({ hydrationLoading: true })

    const { rerender } = render(
      <InlineTaskLogViewProvider value={loadingCtx}>
        <InlineTaskLogView.HydrationStatus />
      </InlineTaskLogViewProvider>,
    )

    expect(screen.getByText('Hydrating archived logs…')).toBeInTheDocument()

    rerender(
      <InlineTaskLogViewProvider value={makeContextValue({ hydrationLoading: false })}>
        <InlineTaskLogView.HydrationStatus />
      </InlineTaskLogViewProvider>,
    )

    expect(screen.queryByText('Hydrating archived logs…')).toBeNull()
  })

  it('shows error row and clears after recovery', () => {
    const errorCtx = makeContextValue({ hydrationError: 'archive read failed' })

    const { rerender } = render(
      <InlineTaskLogViewProvider value={errorCtx}>
        <InlineTaskLogView.HydrationStatus />
      </InlineTaskLogViewProvider>,
    )

    expect(screen.getByText('Hydration failed: archive read failed')).toBeInTheDocument()

    rerender(
      <InlineTaskLogViewProvider value={makeContextValue({ hydrationError: null })}>
        <InlineTaskLogView.HydrationStatus />
      </InlineTaskLogViewProvider>,
    )

    expect(screen.queryByText(/Hydration failed:/)).toBeNull()
  })
})
