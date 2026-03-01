import { describe, expect, it } from 'vitest'

import { applyPatch } from '../core/streaming'
import { JsonPatch, UIElement, UITree } from '../core/schemas'
import { Effect } from 'effect'

const baseTree = () => UITree.fromRecord('root', {
  root: new UIElement({
    key: 'root',
    type: 'Card',
    props: { title: 'Root' },
    children: ['a', 'b'],
    parentKey: null,
  }),
  a: new UIElement({
    key: 'a',
    type: 'Stack',
    props: {},
    children: ['a1'],
    parentKey: 'root',
  }),
  a1: new UIElement({
    key: 'a1',
    type: 'Heading',
    props: { text: 'Old' },
    children: [],
    parentKey: 'a',
  }),
  b: new UIElement({
    key: 'b',
    type: 'Text',
    props: { text: 'Sibling' },
    children: [],
    parentKey: 'root',
  }),
})

describe('patch ancestor reference touching (memoized rendering support)', () => {
  it('touches changed branch ancestors while preserving unrelated sibling refs', () => {
    const tree = baseTree()

    const rootBefore = tree.getElementUnsafe('root')!
    const aBefore = tree.getElementUnsafe('a')!
    const a1Before = tree.getElementUnsafe('a1')!
    const bBefore = tree.getElementUnsafe('b')!

    const patch = new JsonPatch({
      op: 'replace',
      path: '/elements/a1/props/text',
      value: 'New',
    })

    const next = Effect.runSync(applyPatch(tree, patch))

    expect(next.getElementUnsafe('a1')).not.toBe(a1Before)
    expect(next.getElementUnsafe('a')).not.toBe(aBefore)
    expect(next.getElementUnsafe('root')).not.toBe(rootBefore)

    // Unrelated sibling branch should preserve reference identity.
    expect(next.getElementUnsafe('b')).toBe(bBefore)
  })

  it('touches parent chain when removing an element', () => {
    const tree = baseTree()
    const rootBefore = tree.getElementUnsafe('root')!
    const aBefore = tree.getElementUnsafe('a')!
    const bBefore = tree.getElementUnsafe('b')!

    const patch = new JsonPatch({
      op: 'remove',
      path: '/elements/a1',
    })

    const next = Effect.runSync(applyPatch(tree, patch))

    expect(next.getElementUnsafe('a1')).toBeUndefined()
    expect(next.getElementUnsafe('a')).not.toBe(aBefore)
    expect(next.getElementUnsafe('root')).not.toBe(rootBefore)
    expect(next.getElementUnsafe('b')).toBe(bBefore)
  })
})
