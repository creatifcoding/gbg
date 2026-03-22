import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'

import { applyPatch } from '../../core/streaming'
import { JsonPatch, UITree } from '../../core/schemas'

describe('interleaved gate: no-refine-crash', () => {
  it('does not throw when nested element patch arrives before base element exists', () => {
    const tree = UITree.empty()

    const patched = Effect.runSync(
      applyPatch(
        tree,
        new JsonPatch({
          op: 'set',
          path: '/elements/form/props/title',
          value: 'Safe no-op',
        }),
      ),
    )

    expect(patched.size).toBe(0)
    expect(patched.root).toBe('')
  })
})
