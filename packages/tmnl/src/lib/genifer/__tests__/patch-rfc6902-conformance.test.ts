import { describe, it, expect } from 'vitest'
import { Effect, Option } from 'effect'

import { applyPatch, parsePatchLine } from '../core/streaming'
import { UITree, JsonPatch } from '../core/schemas'

const apply = (tree: UITree, patch: ConstructorParameters<typeof JsonPatch>[0]) =>
  Effect.runSync(applyPatch(tree, new JsonPatch(patch)))

describe('Genifer patch engine — RFC6902 semantics', () => {
  it('parses RFC-style line with from/path fields', () => {
    const line = '{"op":"move","from":"/a","path":"/b"}'
    const parsed = Effect.runSync(
      parsePatchLine(line, { chunk: line, lineIndex: 1, streamId: 'test' }),
    )

    expect(Option.isSome(parsed)).toBe(true)
    if (Option.isSome(parsed)) {
      expect(parsed.value.op).toBe('move')
      expect(parsed.value.from).toBe('/a')
      expect(parsed.value.path).toBe('/b')
    }
  })

  it('supports add/replace/remove with JSON Pointer escapes (~1, ~0)', () => {
    let tree = UITree.empty()

    tree = apply(tree, { op: 'set', path: '/root', value: 'root' })
    tree = apply(tree, {
      op: 'add',
      path: '/elements/root',
      value: {
        key: 'root',
        type: 'Card',
        props: {},
        children: [],
        parentKey: null,
      },
    })

    tree = apply(tree, { op: 'replace', path: '/elements/root/props/a~1b', value: 1 })
    tree = apply(tree, { op: 'replace', path: '/elements/root/props/m~0n', value: 2 })
    tree = apply(tree, { op: 'remove', path: '/elements/root/props/a~1b' })

    const root = tree.getElementUnsafe('root')
    expect(root).toBeDefined()
    expect((root?.props as any)['a/b']).toBeUndefined()
    expect((root?.props as any)['m~n']).toBe(2)
  })

  it('supports copy + move across pointer paths', () => {
    let tree = UITree.empty()

    tree = apply(tree, { op: 'set', path: '/root', value: 'source' })
    tree = apply(tree, {
      op: 'add',
      path: '/elements/source',
      value: {
        key: 'source',
        type: 'Text',
        props: { title: 'alpha' },
        children: ['target'],
        parentKey: null,
      },
    })
    tree = apply(tree, {
      op: 'add',
      path: '/elements/target',
      value: {
        key: 'target',
        type: 'Text',
        props: {},
        children: [],
        parentKey: 'source',
      },
    })

    tree = apply(tree, {
      op: 'copy',
      from: '/elements/source/props/title',
      path: '/elements/target/props/copied',
    })
    tree = apply(tree, {
      op: 'move',
      from: '/elements/target/props/copied',
      path: '/elements/target/props/final',
    })

    const target = tree.getElementUnsafe('target')
    expect((target?.props as any).copied).toBeUndefined()
    expect((target?.props as any).final).toBe('alpha')
  })

  it('accepts test operation (pass/fail is non-mutating)', () => {
    let tree = UITree.empty()
    tree = apply(tree, { op: 'set', path: '/root', value: 'r' })
    tree = apply(tree, {
      op: 'add',
      path: '/elements/r',
      value: {
        key: 'r',
        type: 'Card',
        props: { count: 1 },
        children: [],
        parentKey: null,
      },
    })

    const before = JSON.stringify(tree.toRecord())
    tree = apply(tree, { op: 'test', path: '/elements/r/props/count', value: 1 })
    tree = apply(tree, { op: 'test', path: '/elements/r/props/count', value: 2 })
    const after = JSON.stringify(tree.toRecord())

    expect(after).toBe(before)
  })

  it('ignores nested element patches for missing element records', () => {
    const empty = UITree.empty()

    const patched = apply(empty, {
      op: 'set',
      path: '/elements/form/props/title',
      value: 'Hello',
    })

    expect(patched.root).toBe('')
    expect(patched.size).toBe(0)
  })
})
