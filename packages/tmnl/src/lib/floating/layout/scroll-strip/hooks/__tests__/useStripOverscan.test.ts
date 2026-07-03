import { afterEach, describe, expect, it } from 'vitest'
import { resetFloatingStx } from '../../../../stx/instance'
import { registerPanel } from '../../../../stx/actions'
import { panelRegistry } from '../../../../panel-registry'
import { leaf, split } from '../../../split-tree/types'
import { treeColumn } from '../../../../types/strip'
import { stripHasFullTierPanels } from '../useStripOverscan'

function DummyPanel() {
  return null
}

describe('stripHasFullTierPanels', () => {
  afterEach(() => {
    panelRegistry.unregister('test:stateless')
    panelRegistry.unregister('test:full')
    resetFloatingStx()
  })

  it('detects full-tier visitors anywhere in a split column tree', () => {
    panelRegistry.register('test:stateless', {
      label: 'Stateless',
      component: DummyPanel,
      stateTier: 'stateless',
    })
    panelRegistry.register('test:full', {
      label: 'Full',
      component: DummyPanel,
      stateTier: 'full',
    })

    registerPanel({
      id: 'primary-panel',
      title: 'Primary',
      mode: 'tiled',
      visitorId: 'test:stateless',
    })
    registerPanel({
      id: 'nested-harness-panel',
      title: 'Nested Harness',
      mode: 'tiled',
      visitorId: 'test:full',
    })

    const column = treeColumn(
      split('horizontal', leaf('primary-panel'), leaf('nested-harness-panel'), 0.5),
      'half',
    )

    expect(stripHasFullTierPanels([column])).toBe(true)
  })

  it('returns false when no panels use full state preservation', () => {
    panelRegistry.register('test:stateless', {
      label: 'Stateless',
      component: DummyPanel,
      stateTier: 'stateless',
    })

    registerPanel({
      id: 'only-panel',
      title: 'Only',
      mode: 'tiled',
      visitorId: 'test:stateless',
    })

    expect(stripHasFullTierPanels([treeColumn(leaf('only-panel'), 'half')])).toBe(false)
  })
})
