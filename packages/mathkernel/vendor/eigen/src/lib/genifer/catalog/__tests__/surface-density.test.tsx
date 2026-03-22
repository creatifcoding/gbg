/**
 * @fileoverview Density Contract Tests — 3 densities × 16 components
 *
 * Verifies components adapt correctly at compact/normal/spacious.
 * Key behaviors tested:
 *   - Grid columns collapse at compact
 *   - Card/Alert padding scales with density
 *   - Alert title hidden at compact
 *   - Badge size/padding adapts
 *   - Button/Input height adapts
 *   - Heading/Text font size scales
 *   - Progress label visibility
 *
 * @module genifer/catalog/__tests__/surface-density
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

import { SurfaceProvider } from '../context'
import type { SurfaceDensity } from '../context'
import type { UIElement } from '@/lib/genifer/core/schemas'

// Renderers
import { GridRenderer, BoxRenderer } from '../renderers/layout'
import { TextRenderer, HeadingRenderer, CodeRenderer } from '../renderers/content'
import { CardRenderer, AlertRenderer, BadgeRenderer } from '../renderers/surface'
import { ButtonRenderer, InputRenderer } from '../renderers/interactive'
import { ListRenderer, ListItemRenderer, ProgressRenderer } from '../renderers/data'

// =============================================================================
// Helpers
// =============================================================================

function el(type: string, props: Record<string, unknown> = {}, content?: string): UIElement {
  return {
    key: `test-${type}`,
    type,
    props: { ...props },
    children: [],
    content,
  } as unknown as UIElement
}

function renderAt(
  density: SurfaceDensity,
  Component: React.FC<any>,
  element: UIElement,
  children?: React.ReactNode,
) {
  return render(
    <SurfaceProvider tier="inline" density={density}>
      <Component element={element}>{children}</Component>
    </SurfaceProvider>
  )
}

/** Get the first rendered component div (skip SurfaceProvider wrapper) */
function getComponentEl(container: HTMLElement): HTMLElement {
  // SurfaceProvider wraps in a div[style="width: 100%"], component is inside that
  const wrapper = container.querySelector('div[style*="width: 100%"]')
  return (wrapper?.firstElementChild ?? wrapper ?? container.firstElementChild) as HTMLElement
}

// =============================================================================
// Grid — column collapse
// =============================================================================

describe('Grid density adaptation', () => {
  it('compact: collapses 3 columns to 1', () => {
    const { container } = renderAt('compact', GridRenderer, el('Grid', { columns: 3 }))
    const div = getComponentEl(container)
    expect(div.style.gridTemplateColumns).toBe('repeat(1, 1fr)')
  })

  it('normal: caps 3 columns at 2', () => {
    const { container } = renderAt('normal', GridRenderer, el('Grid', { columns: 3 }))
    const div = getComponentEl(container)
    expect(div.style.gridTemplateColumns).toBe('repeat(2, 1fr)')
  })

  it('spacious: preserves 3 columns', () => {
    const { container } = renderAt('spacious', GridRenderer, el('Grid', { columns: 3 }))
    const div = getComponentEl(container)
    expect(div.style.gridTemplateColumns).toBe('repeat(3, 1fr)')
  })

  it('compact: string template collapses to 1fr', () => {
    const { container } = renderAt('compact', GridRenderer, el('Grid', { columns: '250px 1fr' }))
    const div = getComponentEl(container)
    expect(div.style.gridTemplateColumns).toBe('1fr')
  })

  it('compact: gap is 4px', () => {
    const { container } = renderAt('compact', GridRenderer, el('Grid', { columns: 1 }))
    const div = getComponentEl(container)
    expect(div.style.gap).toBe('4px')
  })

  it('spacious: gap is 12px', () => {
    const { container } = renderAt('spacious', GridRenderer, el('Grid', { columns: 1 }))
    const div = getComponentEl(container)
    expect(div.style.gap).toBe('12px')
  })
})

// =============================================================================
// Card — padding density
// =============================================================================

describe('Card density adaptation', () => {
  it('compact: padding is 8px', () => {
    const { container } = renderAt('compact', CardRenderer, el('Card'))
    const div = getComponentEl(container)
    expect(div.style.padding).toBe('8px')
  })

  it('spacious: padding is 16px', () => {
    const { container } = renderAt('spacious', CardRenderer, el('Card'))
    const div = getComponentEl(container)
    expect(div.style.padding).toBe('16px')
  })
})

// =============================================================================
// Alert — title visibility + padding
// =============================================================================

describe('Alert density adaptation', () => {
  it('compact: hides title', () => {
    renderAt('compact', AlertRenderer, el('Alert', { intent: 'info', title: 'Warning' }, 'Body text'))
    expect(screen.queryByText('Warning')).not.toBeInTheDocument()
    expect(screen.getByText('Body text')).toBeInTheDocument()
  })

  it('normal: shows title', () => {
    renderAt('normal', AlertRenderer, el('Alert', { intent: 'info', title: 'Warning' }, 'Body text'))
    expect(screen.getByText('Warning')).toBeInTheDocument()
  })

  it('compact: padding is tighter', () => {
    const { container } = renderAt('compact', AlertRenderer, el('Alert', { intent: 'info' }, 'X'))
    const div = container.querySelector('[role="alert"]') as HTMLElement
    expect(div.style.padding).toBe('6px 8px')
  })
})

// =============================================================================
// Badge — size + padding
// =============================================================================

describe('Badge density adaptation', () => {
  it('compact: fontSize is 10px', () => {
    const { container } = renderAt('compact', BadgeRenderer, el('Badge', { intent: 'info' }, 'Tag'))
    const span = container.querySelector('span') as HTMLElement
    expect(span.style.fontSize).toBe('10px')
    expect(span.style.padding).toBe('1px 6px')
  })

  it('spacious: fontSize is 11px with larger padding', () => {
    const { container } = renderAt('spacious', BadgeRenderer, el('Badge', { intent: 'info' }, 'Tag'))
    const span = container.querySelector('span') as HTMLElement
    expect(span.style.fontSize).toBe('11px')
    expect(span.style.padding).toBe('3px 10px')
  })
})

// =============================================================================
// Button — height
// =============================================================================

describe('Button density adaptation', () => {
  it('compact: height is 28px', () => {
    const { container } = renderAt('compact', ButtonRenderer, el('Button', {}, 'Go'))
    const btn = container.querySelector('button') as HTMLElement
    expect(btn.style.height).toBe('28px')
  })

  it('spacious: height is 36px', () => {
    const { container } = renderAt('spacious', ButtonRenderer, el('Button', {}, 'Go'))
    const btn = container.querySelector('button') as HTMLElement
    expect(btn.style.height).toBe('36px')
  })
})

// =============================================================================
// Input — height
// =============================================================================

describe('Input density adaptation', () => {
  it('compact: height is 28px', () => {
    const { container } = renderAt('compact', InputRenderer, el('Input', { placeholder: 'Type' }))
    const input = container.querySelector('input') as HTMLElement
    expect(input.style.height).toBe('28px')
  })

  it('spacious: height is 36px', () => {
    const { container } = renderAt('spacious', InputRenderer, el('Input', { placeholder: 'Type' }))
    const input = container.querySelector('input') as HTMLElement
    expect(input.style.height).toBe('36px')
  })
})

// =============================================================================
// Heading — font size
// =============================================================================

describe('Heading density adaptation', () => {
  it('compact: h1 is 14px', () => {
    const { container } = renderAt('compact', HeadingRenderer, el('Heading', { level: 1 }, 'Title'))
    const h1 = container.querySelector('h1') as HTMLElement
    expect(h1.style.fontSize).toBe('14px')
  })

  it('spacious: h1 is 18px', () => {
    const { container } = renderAt('spacious', HeadingRenderer, el('Heading', { level: 1 }, 'Title'))
    const h1 = container.querySelector('h1') as HTMLElement
    expect(h1.style.fontSize).toBe('18px')
  })
})

// =============================================================================
// Text — font size
// =============================================================================

describe('Text density adaptation', () => {
  it('compact: body text is 13px', () => {
    const { container } = renderAt('compact', TextRenderer, el('Text', {}, 'Hello'))
    const div = getComponentEl(container)
    expect(div.style.fontSize).toBe('13px')
  })

  it('spacious: body text is 14px', () => {
    const { container } = renderAt('spacious', TextRenderer, el('Text', {}, 'Hello'))
    const div = getComponentEl(container)
    expect(div.style.fontSize).toBe('14px')
  })
})

// =============================================================================
// Progress — label visibility
// =============================================================================

describe('Progress density adaptation', () => {
  it('compact: hides label and percentage', () => {
    const { container } = renderAt('compact', ProgressRenderer, el('Progress', { value: 72, label: 'CPU' }))
    expect(screen.queryByText('CPU')).not.toBeInTheDocument()
    expect(screen.queryByText('72%')).not.toBeInTheDocument()
  })

  it('normal: shows label but not percentage', () => {
    renderAt('normal', ProgressRenderer, el('Progress', { value: 72, label: 'CPU' }))
    expect(screen.getByText('CPU')).toBeInTheDocument()
    expect(screen.queryByText('72%')).not.toBeInTheDocument()
  })

  it('spacious: shows label and percentage', () => {
    renderAt('spacious', ProgressRenderer, el('Progress', { value: 72, label: 'CPU' }))
    expect(screen.getByText('CPU')).toBeInTheDocument()
    expect(screen.getByText('72%')).toBeInTheDocument()
  })
})

// =============================================================================
// Cross-cutting: SurfaceProvider density override
// =============================================================================

describe('SurfaceProvider density override', () => {
  it('density prop skips ResizeObserver', () => {
    const { container } = render(
      <SurfaceProvider tier="page" density="compact">
        <GridRenderer element={el('Grid', { columns: 4 })}>
          <div>A</div>
          <div>B</div>
        </GridRenderer>
      </SurfaceProvider>
    )
    const div = getComponentEl(container)
    expect(div.style.gridTemplateColumns).toBe('repeat(1, 1fr)')
  })
})
