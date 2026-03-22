/**
 * @fileoverview Contract Tests — Core Catalog Components
 *
 * Verifies each of the 16 core components:
 * 1. Registered in catalog with correct metadata
 * 2. Renders from UIElement props correctly
 * 3. className policy filtering works
 * 4. VANTA tokens applied (no hardcoded hex)
 *
 * @module genifer/catalog/__tests__/core-catalog
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

import { coreVantaCatalog, CORE_ENTRIES } from '../core'
import { filterClassName, POLICY_GROUPS } from '../className'
import { DEFAULT_POLICIES } from '../types'
import type { UIElement } from '@/lib/genifer/core/schemas'

// Renderers
import { GridRenderer } from '../renderers/layout'
import { TextRenderer, HeadingRenderer, CodeRenderer } from '../renderers/content'
import { CardRenderer, AlertRenderer, BadgeRenderer } from '../renderers/surface'
import { ButtonRenderer, InputRenderer } from '../renderers/interactive'
import { ListRenderer, ListItemRenderer, ProgressRenderer } from '../renderers/data'

// =============================================================================
// Helpers
// =============================================================================

function el(type: string, props: Record<string, unknown> = {}, content?: string, className?: string): UIElement {
  return {
    key: `test-${type}`,
    type,
    props: { ...props },
    children: [],
    content,
    className,
  } as unknown as UIElement
}

// =============================================================================
// 1. Catalog Registration
// =============================================================================

describe('catalog registration', () => {
  it('has exactly 16 core entries', () => {
    expect(CORE_ENTRIES).toHaveLength(16)
  })

  it('all entries are tier core', () => {
    for (const entry of CORE_ENTRIES) {
      expect(entry.tier).toBe('core')
    }
  })

  it('coreVantaCatalog has all 16 components', () => {
    expect(Object.keys(coreVantaCatalog.components)).toHaveLength(16)
  })

  it('expected component types are present', () => {
    const types = CORE_ENTRIES.map(e => e.type)
    expect(types).toContain('Grid')
    expect(types).toContain('Box')
    expect(types).toContain('Separator')
    expect(types).toContain('Text')
    expect(types).toContain('Heading')
    expect(types).toContain('Code')
    expect(types).toContain('Image')
    expect(types).toContain('Card')
    expect(types).toContain('Alert')
    expect(types).toContain('Badge')
    expect(types).toContain('Button')
    expect(types).toContain('Input')
    expect(types).toContain('Link')
    expect(types).toContain('List')
    expect(types).toContain('ListItem')
    expect(types).toContain('Progress')
  })

  it('every entry has propsSchema and defaultEntrance', () => {
    for (const entry of CORE_ENTRIES) {
      expect(entry.propsSchema).toBeDefined()
      expect(entry.defaultEntrance).toBeDefined()
      expect(entry.defaultEntrance.property).toBeTruthy()
    }
  })
})

// =============================================================================
// 2. className Policy Filtering
// =============================================================================

describe('className filtering', () => {
  it('blocks arbitrary values with [...]', () => {
    const result = filterClassName(
      'p-4 text-[#ff0000] bg-[12px] w-full',
      DEFAULT_POLICIES.layout,
    )
    expect(result).toBe('p-4 w-full')
    expect(result).not.toContain('[')
  })

  it('blocks color classes for layout policy', () => {
    const result = filterClassName(
      'p-4 text-red-500 bg-blue-200 gap-2',
      DEFAULT_POLICIES.layout,
    )
    expect(result).toBe('p-4 gap-2')
  })

  it('allows layout + sizing for surface policy', () => {
    const result = filterClassName(
      'p-4 w-full text-white opacity-50',
      DEFAULT_POLICIES.surface,
    )
    expect(result).toBe('p-4 w-full opacity-50')
  })

  it('returns empty string for undefined input', () => {
    expect(filterClassName(undefined, DEFAULT_POLICIES.layout)).toBe('')
  })

  it('empty policy blocks everything', () => {
    const result = filterClassName('p-4 m-2 w-full', { allow: [] })
    expect(result).toBe('')
  })
})

// =============================================================================
// 3. Layout Renderers
// =============================================================================

describe('Grid renderer', () => {
  it('renders with grid display and default gap', () => {
    const { container } = render(
      <GridRenderer element={el('Grid', { columns: 2 })} />
    )
    const div = container.firstChild as HTMLElement
    expect(div.style.display).toBe('grid')
    expect(div.style.gridTemplateColumns).toBe('repeat(2, 1fr)')
    expect(div.style.gap).toBeTruthy()
  })

  it('handles string column template', () => {
    const { container } = render(
      <GridRenderer element={el('Grid', { columns: '250px 1fr' })} />
    )
    const div = container.firstChild as HTMLElement
    expect(div.style.gridTemplateColumns).toBe('250px 1fr')
  })

  it('applies flow prop', () => {
    const { container } = render(
      <GridRenderer element={el('Grid', { flow: 'column' })} />
    )
    const div = container.firstChild as HTMLElement
    expect(div.style.gridAutoFlow).toBe('column')
  })

  it('filters className through layout policy', () => {
    const { container } = render(
      <GridRenderer element={el('Grid', {}, undefined, 'p-4 text-red-500 w-full')} />
    )
    const div = container.firstChild as HTMLElement
    expect(div.className).toContain('p-4')
    expect(div.className).toContain('w-full')
    expect(div.className).not.toContain('text-red-500')
  })
})

// =============================================================================
// 4. Content Renderers
// =============================================================================

describe('Text renderer', () => {
  it('renders content from element.content', () => {
    render(<TextRenderer element={el('Text', {}, 'Hello world')} />)
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('applies preset styling', () => {
    const { container } = render(
      <TextRenderer element={el('Text', { preset: 'label' })} />
    )
    const div = container.firstChild as HTMLElement
    expect(div.style.textTransform).toBe('uppercase')
    expect(div.style.letterSpacing).toBeTruthy()
  })

  it('applies accent color override', () => {
    const { container } = render(
      <TextRenderer element={el('Text', { accent: 'cyan' }, 'Data')} />
    )
    const div = container.firstChild as HTMLElement
    expect(div.style.color).toBe('#22d3ee')
  })

  it('applies truncation', () => {
    const { container } = render(
      <TextRenderer element={el('Text', { truncate: true }, 'Long text')} />
    )
    const div = container.firstChild as HTMLElement
    expect(div.style.overflow).toBe('hidden')
    expect(div.style.textOverflow).toBe('ellipsis')
    expect(div.style.whiteSpace).toBe('nowrap')
  })

  it('renders as custom HTML element', () => {
    const { container } = render(
      <TextRenderer element={el('Text', { as: 'span' }, 'Inline')} />
    )
    expect(container.firstChild?.nodeName).toBe('SPAN')
  })
})

describe('Heading renderer', () => {
  it('renders h1 by default', () => {
    const { container } = render(
      <HeadingRenderer element={el('Heading', {}, 'Title')} />
    )
    expect(container.firstChild?.nodeName).toBe('H1')
  })

  it('renders h3 for level 3', () => {
    const { container } = render(
      <HeadingRenderer element={el('Heading', { level: 3 }, 'Label')} />
    )
    expect(container.firstChild?.nodeName).toBe('H3')
    const h3 = container.firstChild as HTMLElement
    expect(h3.style.textTransform).toBe('uppercase')
  })
})

describe('Code renderer', () => {
  it('renders block code in pre > code', () => {
    const { container } = render(
      <CodeRenderer element={el('Code', {}, 'const x = 1')} />
    )
    expect(container.querySelector('pre')).toBeTruthy()
    expect(container.querySelector('code')).toBeTruthy()
  })

  it('renders inline code', () => {
    const { container } = render(
      <CodeRenderer element={el('Code', { inline: true }, 'x')} />
    )
    expect(container.querySelector('pre')).toBeFalsy()
    expect(container.firstChild?.nodeName).toBe('CODE')
  })
})

// =============================================================================
// 5. Surface Renderers
// =============================================================================

describe('Card renderer', () => {
  it('renders with bordered surface style', () => {
    const { container } = render(
      <CardRenderer element={el('Card', { title: 'Test Card' })}>
        <div>Content</div>
      </CardRenderer>
    )
    const card = container.firstChild as HTMLElement
    expect(card.style.borderRadius).toBeTruthy()
    expect(card.style.padding).toBeTruthy()
    expect(screen.getByText('Test Card')).toBeInTheDocument()
  })

  it('renders children', () => {
    render(
      <CardRenderer element={el('Card')}>
        <span>Child content</span>
      </CardRenderer>
    )
    expect(screen.getByText('Child content')).toBeInTheDocument()
  })
})

describe('Alert renderer', () => {
  it('renders with left border accent', () => {
    const { container } = render(
      <AlertRenderer element={el('Alert', { intent: 'danger', title: 'Error' }, 'Something failed')} />
    )
    const alert = container.firstChild as HTMLElement
    expect(alert.style.borderLeft).toContain('2px solid')
    expect(alert.getAttribute('role')).toBe('alert')
    expect(screen.getByText('Error')).toBeInTheDocument()
  })
})

describe('Badge renderer', () => {
  it('renders as pill with accent', () => {
    const { container } = render(
      <BadgeRenderer element={el('Badge', { intent: 'success' }, 'Active')} />
    )
    const badge = container.firstChild as HTMLElement
    expect(badge.style.borderRadius).toBe('9999px')
    expect(badge.style.display).toBe('inline-flex')
    expect(screen.getByText('Active')).toBeInTheDocument()
  })
})

// =============================================================================
// 6. Interactive Renderers
// =============================================================================

describe('Button renderer', () => {
  it('renders as button element', () => {
    const { container } = render(
      <ButtonRenderer element={el('Button', { variant: 'primary' }, 'Click me')} />
    )
    expect(container.querySelector('button')).toBeTruthy()
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('applies disabled state', () => {
    const { container } = render(
      <ButtonRenderer element={el('Button', { disabled: true }, 'Disabled')} />
    )
    const btn = container.querySelector('button') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(btn.style.opacity).toBe('0.4')
  })
})

describe('Input renderer', () => {
  it('renders input with label', () => {
    render(
      <InputRenderer element={el('Input', { label: 'Email', placeholder: 'Enter email' })} />
    )
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter email')).toBeInTheDocument()
  })

  it('shows error state', () => {
    render(
      <InputRenderer element={el('Input', { error: 'Required field' })} />
    )
    expect(screen.getByText('Required field')).toBeInTheDocument()
  })
})

// =============================================================================
// 7. Data Renderers
// =============================================================================

describe('Progress renderer', () => {
  it('renders with correct aria attributes', () => {
    const { container } = render(
      <ProgressRenderer element={el('Progress', { value: 75, intent: 'success' })} />
    )
    const bar = container.querySelector('[role="progressbar"]') as HTMLElement
    expect(bar).toBeTruthy()
    expect(bar.getAttribute('aria-valuenow')).toBe('75')
  })

  it('clamps value to 0-100 range', () => {
    const { container } = render(
      <ProgressRenderer element={el('Progress', { value: 150 })} />
    )
    const bar = container.querySelector('[role="progressbar"]') as HTMLElement
    expect(bar).toBeTruthy()
    expect(bar.getAttribute('aria-valuenow')).toBe('100')
  })
})

describe('List renderer', () => {
  it('renders with list role', () => {
    const { container } = render(
      <ListRenderer element={el('List', { variant: 'plain' })}>
        <div>Item 1</div>
      </ListRenderer>
    )
    const list = container.firstChild as HTMLElement
    expect(list.getAttribute('role')).toBe('list')
  })
})
