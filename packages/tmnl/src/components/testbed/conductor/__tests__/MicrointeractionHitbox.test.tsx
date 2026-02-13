import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { Registry, RegistryContext } from '@effect-atom/atom-react'
import { HashSet } from 'effect'

import {
  MicrointeractionHitbox,
  microinteractionHitboxAtoms,
} from '@/components/testbed/conductor/MicrointeractionHitbox'

function createWrapper(registry: Registry) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <RegistryContext.Provider value={registry as any}>
        <MicrointeractionHitbox.Provider>{children}</MicrointeractionHitbox.Provider>
      </RegistryContext.Provider>
    )
  }
}

describe('MicrointeractionHitbox', () => {
  let registry: Registry

  beforeEach(() => {
    registry = Registry.make()
    registry.mount(microinteractionHitboxAtoms.refsAtom)
    registry.mount(microinteractionHitboxAtoms.refCountAtom)
    registry.mount(microinteractionHitboxAtoms.refIdsAtom)
    registry.mount(microinteractionHitboxAtoms.topHoveredIdAtom)
    registry.mount(microinteractionHitboxAtoms.overlapIdsAtom)
    registry.mount(microinteractionHitboxAtoms.metricsAtom)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('tracks refs in HashMap without ref callback churn', async () => {
    const wrapper = createWrapper(registry)

    const ui = (
      <MicrointeractionHitbox.Root id="a" label="Tag A" dwellMs={0} hoverLeaveGraceMs={0}>
        <MicrointeractionHitbox.Target onClick={() => {}}>
          <span>A</span>
        </MicrointeractionHitbox.Target>
      </MicrointeractionHitbox.Root>
    )

    const { rerender, unmount } = render(ui, { wrapper })

    await act(async () => {})
    expect(registry.get(microinteractionHitboxAtoms.refCountAtom)).toBe(1)
    expect(registry.get(microinteractionHitboxAtoms.refIdsAtom)).toEqual(['a'])

    rerender(ui)
    await act(async () => {})
    expect(registry.get(microinteractionHitboxAtoms.refCountAtom)).toBe(1)

    unmount()
    await act(async () => {})
    expect(registry.get(microinteractionHitboxAtoms.refCountAtom)).toBe(0)
  })

  it('resolves overlap by highest priority and records overlap set', async () => {
    const wrapper = createWrapper(registry)

    render(
      <div>
        <MicrointeractionHitbox.Root id="low" label="Low" priority={0} dwellMs={0} hoverLeaveGraceMs={0}>
          <MicrointeractionHitbox.Target onClick={() => {}}>
            <span>LOW</span>
          </MicrointeractionHitbox.Target>
        </MicrointeractionHitbox.Root>

        <MicrointeractionHitbox.Root id="high" label="High" priority={100} dwellMs={0} hoverLeaveGraceMs={0}>
          <MicrointeractionHitbox.Target onClick={() => {}}>
            <span>HIGH</span>
          </MicrointeractionHitbox.Target>
        </MicrointeractionHitbox.Root>
      </div>,
      { wrapper },
    )

    const low = screen.getByRole('button', { name: 'Low' })
    const high = screen.getByRole('button', { name: 'High' })

    const elementsFromPointMock = vi.fn(() => [low as Element, high as Element])
    Object.defineProperty(document, 'elementsFromPoint', {
      value: elementsFromPointMock,
      configurable: true,
    })

    fireEvent.mouseMove(low, { clientX: 10, clientY: 10 })

    await act(async () => {})

    expect(registry.get(microinteractionHitboxAtoms.topHoveredIdAtom)).toBe('high')

    const overlap = registry.get(microinteractionHitboxAtoms.overlapIdsAtom)
    expect(HashSet.has(overlap, 'low')).toBe(true)
    expect(HashSet.has(overlap, 'high')).toBe(true)

    const metrics = registry.get(microinteractionHitboxAtoms.metricsAtom)
    expect(metrics.count).toBe(2)
  })
})
