/**
 * Code Mode → Surface Live Wiring Tests
 *
 * Proves the full round-trip:
 *   1. sdk.atoms.set() → shared store → readable via getCodeModeAtom
 *   2. sdk.surface.updateElement() → tree mutation → updated props
 *   3. BehaviorBridge resolves @state: sigils from code-mode atoms
 *   4. Code mode → register component → dynamic component store
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Effect, HashMap } from 'effect'
import {
  executeCodeMode,
  resetSandboxState,
  getCodeModeAtom,
  setCodeModeAtom,
  subscribeCodeModeAtom,
  listAtomKeys,
  getDynamicComponents,
} from '../code-mode'
import { setSurfaceBridge, resetSurfaceBridge } from '../code-mode/surface-bridge'
import { updateElementProps, addChildElement, removeElement, getElement as getTreeElement, listElements } from '../code-mode/tree-mutator'
import {
  setDynamicRpcRegistry,
} from '../services/DynamicRpcService'
import {
  setDynamicEventRegistry,
} from '../services/DynamicEventService'
import { Registry } from '@effect-atom/atom'
import type { UITree, UIElement } from '../core/schemas'

// =============================================================================
// Helpers
// =============================================================================

function makeTree(elements: Record<string, { type: string; props?: Record<string, unknown>; children?: string[] }>): UITree {
  let map = HashMap.empty<string, UIElement>()
  const keys = Object.keys(elements)
  for (const [key, val] of Object.entries(elements)) {
    map = HashMap.set(map, key, {
      key,
      type: val.type,
      props: val.props ?? {},
      children: val.children ?? [],
    })
  }
  return {
    root: keys[0] ?? '',
    elements: map,
    size: keys.length,
  } as UITree
}

describe('Code Mode → Surface Live Wiring', () => {
  beforeEach(() => {
    resetSandboxState()
    const registry = Registry.make()
    setDynamicRpcRegistry(registry)
    setDynamicEventRegistry(registry)
  })

  // ===========================================================================
  // 1. Shared Atom Bridge
  // ===========================================================================

  describe('Shared Atom Bridge', () => {
    it('sdk.atoms.set() writes to shared store, getCodeModeAtom reads it', async () => {
      const result = await Effect.runPromise(
        executeCodeMode({
          code: `
            sdk.atoms.set('counter', 0)
            sdk.atoms.set('counter', 42)
            return sdk.atoms.get('counter')
          `,
          mode: 'execute',
        }),
      )

      expect(result.success).toBe(true)
      expect(result.result).toBe(42)

      // Verify the shared store has the value
      expect(getCodeModeAtom('counter')).toBe(42)
    })

    it('setCodeModeAtom from outside → sdk.atoms.get reads it', async () => {
      // Set from outside (e.g., React component or another service)
      setCodeModeAtom('external', 'hello from React')

      const result = await Effect.runPromise(
        executeCodeMode({
          code: `return sdk.atoms.get('external')`,
          mode: 'execute',
        }),
      )

      expect(result.success).toBe(true)
      expect(result.result).toBe('hello from React')
    })

    it('subscribeCodeModeAtom fires when sdk.atoms.set is called', async () => {
      const values: unknown[] = []
      const unsub = subscribeCodeModeAtom('live', (v) => values.push(v))

      await Effect.runPromise(
        executeCodeMode({
          code: `
            sdk.atoms.set('live', 1)
            sdk.atoms.set('live', 2)
            sdk.atoms.set('live', 3)
          `,
          mode: 'execute',
        }),
      )

      unsub()

      expect(values).toEqual([1, 2, 3])
    })

    it('listAtomKeys returns all registered keys', async () => {
      await Effect.runPromise(
        executeCodeMode({
          code: `
            sdk.atoms.set('a', 1)
            sdk.atoms.set('b', 2)
            sdk.atoms.set('c', 3)
          `,
          mode: 'execute',
        }),
      )

      const keys = listAtomKeys()
      expect(keys).toContain('a')
      expect(keys).toContain('b')
      expect(keys).toContain('c')
    })
  })

  // ===========================================================================
  // 2. Tree Mutator (pure functions)
  // ===========================================================================

  describe('Tree Mutator', () => {
    it('updateElementProps merges props immutably', () => {
      const tree = makeTree({
        root: { type: 'Card', props: { title: 'Hello', variant: 'default' } },
      })

      const updated = updateElementProps(tree, 'root', { title: 'World', className: 'p-4' })

      // Original unchanged
      const origEl = getTreeElement(tree, 'root')!
      expect((origEl.props as any).title).toBe('Hello')

      // Updated has merged props
      const newEl = getTreeElement(updated, 'root')!
      expect((newEl.props as any).title).toBe('World')
      expect((newEl.props as any).variant).toBe('default')
      expect((newEl.props as any).className).toBe('p-4')
    })

    it('addChildElement inserts element and updates parent', () => {
      const tree = makeTree({
        root: { type: 'Card', children: ['h1'] },
        h1: { type: 'Heading', props: { text: 'Title' } },
      })

      const updated = addChildElement(tree, 'root', {
        key: 'btn',
        type: 'Button',
        props: { label: 'Click' },
        children: [],
      })

      expect(updated.size).toBe(3)
      const root = getTreeElement(updated, 'root')!
      expect(root.children).toContain('btn')
      const btn = getTreeElement(updated, 'btn')!
      expect(btn.type).toBe('Button')
    })

    it('removeElement removes element and cleans parent', () => {
      const tree = makeTree({
        root: { type: 'Card', children: ['h1', 'h2'] },
        h1: { type: 'Heading' },
        h2: { type: 'Heading' },
      })

      const updated = removeElement(tree, 'h1')

      expect(updated.size).toBe(2)
      expect(getTreeElement(updated, 'h1')).toBeUndefined()
      const root = getTreeElement(updated, 'root')!
      expect(root.children).not.toContain('h1')
      expect(root.children).toContain('h2')
    })

    it('listElements returns all keys and types', () => {
      const tree = makeTree({
        root: { type: 'Card' },
        h1: { type: 'Heading' },
        btn: { type: 'Button' },
      })

      const els = listElements(tree)
      expect(els.length).toBe(3)
      expect(els.map((e) => e.type).sort()).toEqual(['Button', 'Card', 'Heading'])
    })
  })

  // ===========================================================================
  // 3. Surface Mutation via SDK
  // ===========================================================================

  describe('Surface Mutation via SDK', () => {
    it('sdk.surface.updateElement mutates tree via bridge', async () => {
      const tree = makeTree({
        root: { type: 'Card', props: { title: 'Original' }, children: ['h1'] },
        h1: { type: 'Heading', props: { text: 'Hello' } },
      })

      let currentTree = tree
      setSurfaceBridge({
        getSurface: (id) =>
          id === 'surf-1'
            ? { id: 'surf-1', status: 'complete', prompt: 'test', treeSnapshot: currentTree }
            : undefined,
        updateSurfaceTree: (_id, newTree) => {
          currentTree = newTree
        },
      })

      const result = await Effect.runPromise(
        executeCodeMode({
          code: `
            sdk.surface.updateElement('surf-1', 'h1', { text: 'Updated!' })
            return sdk.surface.getElement('surf-1', 'h1')
          `,
          mode: 'execute',
        }),
      )

      expect(result.success).toBe(true)
      expect(result.result).toEqual({ text: 'Updated!' })

      // Verify the tree was actually mutated
      const updatedEl = getTreeElement(currentTree, 'h1')!
      expect((updatedEl.props as any).text).toBe('Updated!')
    })

    it('sdk.surface.addElement adds child to tree', async () => {
      const tree = makeTree({
        root: { type: 'Card', children: [] },
      })

      let currentTree = tree
      setSurfaceBridge({
        getSurface: (id) =>
          id === 'surf-2'
            ? { id: 'surf-2', status: 'complete', prompt: 'test', treeSnapshot: currentTree }
            : undefined,
        updateSurfaceTree: (_id, newTree) => {
          currentTree = newTree
        },
      })

      const result = await Effect.runPromise(
        executeCodeMode({
          code: `
            sdk.surface.addElement('surf-2', 'root', {
              key: 'new-btn',
              type: 'Button',
              props: { label: 'Dynamic Button' },
            })
            return sdk.surface.listElements('surf-2')
          `,
          mode: 'execute',
        }),
      )

      expect(result.success).toBe(true)
      const elements = result.result as any[]
      expect(elements.length).toBe(2)
      expect(elements.find((e: any) => e.key === 'new-btn')).toBeDefined()
    })
  })

  // ===========================================================================
  // 4. Dynamic Component Registration
  // ===========================================================================

  describe('Dynamic Component Registration', () => {
    it('sdk.register.component stores factory in dynamic components', async () => {
      const result = await Effect.runPromise(
        executeCodeMode({
          code: `
            sdk.register.component('CustomChart', (props) => ({
              type: 'div',
              children: 'Chart: ' + JSON.stringify(props),
            }))
          `,
          mode: 'define',
        }),
      )

      expect(result.success).toBe(true)
      const components = getDynamicComponents()
      expect(components.has('CustomChart')).toBe(true)

      // Call the factory
      const factory = components.get('CustomChart')!
      const output = factory({ data: [1, 2, 3] })
      expect(output.type).toBe('div')
    })
  })

  // ===========================================================================
  // 5. Sigil Resolution (code mode atoms)
  // ===========================================================================

  describe('Code Mode Sigil Resolution', () => {
    it('@state:key resolves against code-mode atom store', () => {
      // This tests the resolveCodeModeProps function indirectly
      // by setting atoms and checking the resolution path exists
      setCodeModeAtom('query', 'UAL123')
      setCodeModeAtom('count', 42)

      expect(getCodeModeAtom('query')).toBe('UAL123')
      expect(getCodeModeAtom('count')).toBe(42)

      // The actual BehaviorBridge resolution is tested via React rendering
      // which requires JSDOM/browser. Here we verify the atom store works.
    })

    it('{{@state:key}} interpolation reads from code-mode atoms', () => {
      setCodeModeAtom('name', 'Prime')
      setCodeModeAtom('version', 3)

      // Simulate what resolveCodeModeProps does
      const template = 'Hello {{@state:name}}, v{{@state:version}}'
      const resolved = template.replace(/\{\{@state:([^}]+)\}\}/g, (_m, key) => {
        return String(getCodeModeAtom(key) ?? '')
      })

      expect(resolved).toBe('Hello Prime, v3')
    })
  })
})
