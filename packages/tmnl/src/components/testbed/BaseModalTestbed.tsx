/**
 * BaseModal Testbed
 *
 * Exercises the BaseModal compound component and visitor contract patterns.
 *
 * Test Cases:
 * - TC1: Basic compound component usage (Modal.Root → Modal.Content)
 * - TC2: Visitor contract pattern (createVisitor + typed data)
 * - TC3: Provider-based imperative API (useModal().open)
 * - TC4: Nested modals / modal stacking
 * - TC5: Custom sizes and styling
 * - TC6: Focus trap and escape key
 */

import React, { useState, useRef } from 'react'
import {
  Modal,
  ModalProvider,
  useModal,
  createVisitor,
  type VisitorContract,
} from '@/components/base/BaseModal'
import { SectionLabel, TestCard } from '@/components/testbed/shared'

// =============================================================================
// TEST DATA TYPES
// =============================================================================

interface SimpleData {
  title: string
  message: string
}

interface CounterData {
  count: number
  label: string
}

interface DamageReportData {
  id: string
  title: string
  rootCause: string
  whatWasMissed: string
  prevention: string
  parentFinding: string | null
}

// =============================================================================
// VISITOR CONTRACTS
// =============================================================================

const simpleVisitor = createVisitor<SimpleData>({
  id: 'simple',
  size: 'sm',
  header: (data) => (
    <span className="text-cyan-400 font-mono font-bold">{data.title}</span>
  ),
  render: (data, { close }) => (
    <div className="space-y-4">
      <p className="text-neutral-300">{data.message}</p>
      <button
        onClick={close}
        className="px-4 py-2 bg-cyan-900/50 text-cyan-400 rounded hover:bg-cyan-900 transition-colors font-mono text-sm"
      >
        Got it
      </button>
    </div>
  ),
})

const counterVisitor = createVisitor<CounterData>({
  id: 'counter',
  size: 'md',
  header: (data) => (
    <div className="flex items-center gap-3">
      <span className="text-amber-400 font-mono font-bold">Counter</span>
      <span className="text-neutral-500 text-xs">{data.label}</span>
    </div>
  ),
  render: (data, { close }) => (
    <div className="space-y-4 text-center">
      <div className="text-6xl font-mono text-amber-400 tabular-nums">
        {data.count}
      </div>
      <p className="text-neutral-500 text-sm">
        This demonstrates typed visitor data
      </p>
      <button
        onClick={close}
        className="px-4 py-2 bg-amber-900/50 text-amber-400 rounded hover:bg-amber-900 transition-colors font-mono text-sm"
      >
        Close
      </button>
    </div>
  ),
  footer: (data) => (
    <div className="text-xs text-neutral-600 font-mono text-center">
      {data.label} • Count: {data.count}
    </div>
  ),
})

const damageVisitor = createVisitor<DamageReportData>({
  id: 'damage',
  size: 'lg',
  className: 'border-orange-800/50',
  header: (data) => (
    <div className="flex items-center gap-3">
      <span className="text-orange-400">⚠</span>
      <span className="text-orange-400 font-mono font-bold">{data.id}</span>
      <span className="text-neutral-300">{data.title}</span>
    </div>
  ),
  render: (data, { close }) => (
    <div className="space-y-4">
      {data.parentFinding && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-neutral-500">PARENT:</span>
          <span className="text-violet-400 font-mono">{data.parentFinding}</span>
        </div>
      )}

      <div className="p-3 bg-orange-950/20 border border-orange-800/30 rounded">
        <div className="text-orange-500 uppercase tracking-wider mb-1 font-bold" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          Root Cause
        </div>
        <p className="text-sm text-orange-300/80">{data.rootCause}</p>
      </div>

      <div className="p-3 bg-neutral-900/50 border border-neutral-800 rounded">
        <div className="text-neutral-500 uppercase tracking-wider mb-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          What Was Missed
        </div>
        <p className="text-sm text-neutral-400">{data.whatWasMissed}</p>
      </div>

      <div className="p-3 bg-green-950/20 border border-green-800/30 rounded">
        <div className="text-green-500 uppercase tracking-wider mb-1 font-bold" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          Prevention
        </div>
        <p className="text-sm text-green-400/80">{data.prevention}</p>
      </div>

      <div className="pt-4 border-t border-neutral-800">
        <button
          onClick={close}
          className="w-full px-4 py-2 bg-orange-900/30 text-orange-400 rounded hover:bg-orange-900/50 transition-colors font-mono text-sm"
        >
          Acknowledged
        </button>
      </div>
    </div>
  ),
})

const VISITORS: VisitorContract[] = [simpleVisitor, counterVisitor, damageVisitor]

// =============================================================================
// TEST CASE COMPONENTS
// =============================================================================

/**
 * TC1: Void Contract - Slot-based rendering
 *
 * When no visitor is provided, Modal.Content renders children directly.
 * This is the "void contract" path.
 */
function TC1_VoidContract() {
  return (
    <TestCard
      title="TC1: VOID CONTRACT (Slots)"
      description="No visitor — Modal.Content renders children directly"
    >
      <div className="flex flex-wrap gap-3">
        {/* Void contract with slots */}
        <Modal.Root>
          <Modal.Trigger asChild>
            <button className="px-4 py-2 bg-cyan-900/50 text-cyan-400 rounded hover:bg-cyan-900 transition-colors font-mono text-sm">
              Void + Slots
            </button>
          </Modal.Trigger>
          <Modal.Portal>
            <Modal.Overlay />
            <Modal.Content className="max-w-md">
              <Modal.Header>
                <span className="text-cyan-400 font-mono">Void Contract</span>
              </Modal.Header>
              <Modal.Body>
                <p className="text-neutral-300">
                  No <code className="text-amber-400">visitor</code> prop passed.
                  Using <code className="text-amber-400">Modal.Header/Body/Footer</code> slots.
                </p>
              </Modal.Body>
              <Modal.Footer>
                <div className="flex justify-end">
                  <Modal.Close asChild>
                    <button className="px-4 py-2 bg-neutral-800 text-neutral-300 rounded hover:bg-neutral-700 transition-colors font-mono text-sm">
                      Close
                    </button>
                  </Modal.Close>
                </div>
              </Modal.Footer>
            </Modal.Content>
          </Modal.Portal>
        </Modal.Root>

        {/* Void contract with raw content (no slots at all) */}
        <Modal.Root>
          <Modal.Trigger asChild>
            <button className="px-4 py-2 bg-red-900/50 text-red-400 rounded hover:bg-red-900 transition-colors font-mono text-sm">
              Void + Raw
            </button>
          </Modal.Trigger>
          <Modal.Portal>
            <Modal.Overlay />
            <Modal.Content className="max-w-sm p-6">
              {/* No slots, no visitor — just raw content */}
              <div className="text-center space-y-4">
                <div className="text-4xl">🔥</div>
                <h2 className="text-xl font-mono text-red-400">Raw Content</h2>
                <p className="text-neutral-400 text-sm">
                  No visitor. No slots. Just children.
                </p>
                <Modal.Close asChild>
                  <button className="px-4 py-2 bg-red-900/50 text-red-400 rounded hover:bg-red-900 transition-colors font-mono text-sm">
                    Dismiss
                  </button>
                </Modal.Close>
              </div>
            </Modal.Content>
          </Modal.Portal>
        </Modal.Root>
      </div>
    </TestCard>
  )
}

/**
 * TC2: Visitor Contract Pattern
 */
function TC2_VisitorContract() {
  const [counter, setCounter] = useState(0)

  return (
    <TestCard
      title="TC2: Visitor Contract Pattern"
      description="createVisitor<T> with typed data injection"
    >
      <div className="flex flex-wrap gap-3">
        <Modal.Root>
          <Modal.Trigger asChild>
            <button className="px-4 py-2 bg-cyan-900/50 text-cyan-400 rounded hover:bg-cyan-900 transition-colors font-mono text-sm">
              Simple Visitor
            </button>
          </Modal.Trigger>
          <Modal.Portal>
            <Modal.Overlay />
            <Modal.Content
              visitor={simpleVisitor}
              data={{ title: 'Hello!', message: 'This is a simple visitor with typed SimpleData.' }}
            />
          </Modal.Portal>
        </Modal.Root>

        <Modal.Root>
          <Modal.Trigger asChild>
            <button
              onClick={() => setCounter((c) => c + 1)}
              className="px-4 py-2 bg-amber-900/50 text-amber-400 rounded hover:bg-amber-900 transition-colors font-mono text-sm"
            >
              Counter Visitor ({counter})
            </button>
          </Modal.Trigger>
          <Modal.Portal>
            <Modal.Overlay />
            <Modal.Content
              visitor={counterVisitor}
              data={{ count: counter, label: 'Click count' }}
            />
          </Modal.Portal>
        </Modal.Root>
      </div>
    </TestCard>
  )
}

/**
 * TC3: Imperative API via Provider
 */
function TC3_ImperativeContent() {
  const { open } = useModal()

  const openSimple = () => {
    open('simple', {
      title: 'Imperative Modal',
      message: 'Opened via useModal().open() — provider-based pattern.',
    })
  }

  const openDamage = () => {
    open('damage', {
      id: 'H3.5.dmg1',
      title: 'Dangling Atom Reference',
      parentFinding: 'H3.5',
      rootCause: 'Renamed atom to family pattern but didn\'t audit all usages',
      whatWasMissed: 'Line 1475 in H3_ResultAtoms still referenced old atom name',
      prevention: 'Always grep -n \'oldName\' before removing/renaming.',
    })
  }

  return (
    <TestCard
      title="TC3: Imperative API"
      description="useModal().open(visitorId, data) — provider pattern"
    >
      <div className="flex flex-wrap gap-3">
        <button
          onClick={openSimple}
          className="px-4 py-2 bg-violet-900/50 text-violet-400 rounded hover:bg-violet-900 transition-colors font-mono text-sm"
        >
          open('simple', data)
        </button>
        <button
          onClick={openDamage}
          className="px-4 py-2 bg-orange-900/50 text-orange-400 rounded hover:bg-orange-900 transition-colors font-mono text-sm"
        >
          open('damage', data)
        </button>
      </div>
    </TestCard>
  )
}

function TC3_ImperativeAPI() {
  return (
    <ModalProvider visitors={VISITORS}>
      <TC3_ImperativeContent />
      <ImperativeModalRenderer />
    </ModalProvider>
  )
}

/**
 * Renders the modal when opened via imperative API
 */
function ImperativeModalRenderer() {
  const { isOpen, visitorId, data, close, getVisitor } = useModal()

  if (!isOpen || !visitorId) return null

  const visitor = getVisitor(visitorId)
  if (!visitor) return null

  return (
    <Modal.Root open={isOpen} onOpenChange={(open) => !open && close()}>
      <Modal.Portal>
        <Modal.Overlay />
        <Modal.Content visitor={visitor} data={data} />
      </Modal.Portal>
    </Modal.Root>
  )
}

/**
 * TC4: Modal Sizes
 */
function TC4_Sizes() {
  const sizes = ['sm', 'md', 'lg', 'xl', 'full'] as const

  return (
    <TestCard
      title="TC4: Modal Sizes"
      description="sm | md | lg | xl | full"
    >
      <div className="flex flex-wrap gap-2">
        {sizes.map((size) => (
          <Modal.Root key={size}>
            <Modal.Trigger asChild>
              <button className="px-3 py-1.5 bg-neutral-800 text-neutral-300 rounded hover:bg-neutral-700 transition-colors font-mono text-xs uppercase">
                {size}
              </button>
            </Modal.Trigger>
            <Modal.Portal>
              <Modal.Overlay />
              <Modal.Content
                visitor={createVisitor<{ size: string }>({
                  id: `size-${size}`,
                  size,
                  header: (d) => <span className="text-neutral-300 font-mono">Size: {d.size}</span>,
                  render: (d, { close }) => (
                    <div className="space-y-4">
                      <p className="text-neutral-400">
                        This modal uses <code className="text-cyan-400">size: '{d.size}'</code>
                      </p>
                      <button
                        onClick={close}
                        className="px-4 py-2 bg-neutral-800 text-neutral-300 rounded hover:bg-neutral-700 transition-colors font-mono text-sm"
                      >
                        Close
                      </button>
                    </div>
                  ),
                })}
                data={{ size }}
              />
            </Modal.Portal>
          </Modal.Root>
        ))}
      </div>
    </TestCard>
  )
}

/**
 * TC5: Focus Trap & Escape
 */
function TC5_FocusTrap() {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <TestCard
      title="TC5: Focus Trap & Escape"
      description="Tab cycles through focusable elements, Escape closes"
    >
      <Modal.Root>
        <Modal.Trigger asChild>
          <button className="px-4 py-2 bg-green-900/50 text-green-400 rounded hover:bg-green-900 transition-colors font-mono text-sm">
            Open Focus Test
          </button>
        </Modal.Trigger>
        <Modal.Portal>
          <Modal.Overlay />
          <Modal.Content className="max-w-md">
            <Modal.Header>
              <span className="text-green-400 font-mono">Focus Trap Test</span>
            </Modal.Header>
            <Modal.Body>
              <div className="space-y-4">
                <p className="text-neutral-400 text-sm">
                  Tab through these elements. Focus should stay trapped.
                  Press Escape to close.
                </p>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="First input"
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-neutral-200 placeholder:text-neutral-600"
                />
                <input
                  type="text"
                  placeholder="Second input"
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-neutral-200 placeholder:text-neutral-600"
                />
                <div className="flex gap-2">
                  <button className="flex-1 px-4 py-2 bg-neutral-800 text-neutral-300 rounded hover:bg-neutral-700 transition-colors font-mono text-sm">
                    Button 1
                  </button>
                  <button className="flex-1 px-4 py-2 bg-neutral-800 text-neutral-300 rounded hover:bg-neutral-700 transition-colors font-mono text-sm">
                    Button 2
                  </button>
                </div>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <div className="flex justify-end gap-2">
                <Modal.Close asChild>
                  <button className="px-4 py-2 bg-neutral-800 text-neutral-300 rounded hover:bg-neutral-700 transition-colors font-mono text-sm">
                    Cancel
                  </button>
                </Modal.Close>
                <button className="px-4 py-2 bg-green-900/50 text-green-400 rounded hover:bg-green-900 transition-colors font-mono text-sm">
                  Submit
                </button>
              </div>
            </Modal.Footer>
          </Modal.Content>
        </Modal.Portal>
      </Modal.Root>
    </TestCard>
  )
}

/**
 * TC6: Damage Report Modal (the real use case!)
 */
function TC6_DamageReport() {
  const sampleDamage: DamageReportData = {
    id: 'H3.5.dmg1',
    title: 'Dangling Atom Reference After Refactor',
    parentFinding: 'H3.5',
    rootCause: 'Renamed atom to family pattern but didn\'t audit all usages',
    whatWasMissed: 'Line 1475 in H3_ResultAtoms still referenced old atom name',
    prevention: 'Always grep -n \'oldName\' before removing/renaming. The CLAUDE.md warning exists for this.',
  }

  return (
    <TestCard
      title="TC6: Damage Report Modal"
      description="The actual use case — damage badge → modal"
    >
      <div className="flex items-center gap-4">
        <span className="text-neutral-500 text-sm">Click the badge:</span>
        <Modal.Root>
          <Modal.Trigger asChild>
            <button className="flex items-center gap-2 px-3 py-1.5 bg-orange-900/30 border border-orange-800/50 rounded hover:bg-orange-900/50 transition-colors">
              <span className="text-orange-400">⚠</span>
              <span className="text-orange-400 font-mono text-xs">{sampleDamage.id}</span>
              <span className="px-1.5 py-0.5 font-mono uppercase rounded bg-orange-900/50 text-orange-400" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                DMG
              </span>
            </button>
          </Modal.Trigger>
          <Modal.Portal>
            <Modal.Overlay />
            <Modal.Content visitor={damageVisitor} data={sampleDamage} />
          </Modal.Portal>
        </Modal.Root>
      </div>
    </TestCard>
  )
}

// =============================================================================
// MAIN TESTBED
// =============================================================================

export function BaseModalTestbed() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-mono font-bold text-violet-400">
          BaseModal Testbed
        </h1>
        <p className="text-neutral-500 mt-2 font-mono text-sm">
          Higher Order Provider compound component with visitor contracts
        </p>
      </header>

      <div className="space-y-8 max-w-4xl">
        <section>
          <SectionLabel>Compound Component Pattern</SectionLabel>
          <div className="space-y-4">
            <TC1_VoidContract />
            <TC2_VisitorContract />
          </div>
        </section>

        <section>
          <SectionLabel>Provider Pattern</SectionLabel>
          <div className="space-y-4">
            <TC3_ImperativeAPI />
          </div>
        </section>

        <section>
          <SectionLabel>Configuration</SectionLabel>
          <div className="space-y-4">
            <TC4_Sizes />
            <TC5_FocusTrap />
          </div>
        </section>

        <section>
          <SectionLabel>Real Use Case</SectionLabel>
          <div className="space-y-4">
            <TC6_DamageReport />
          </div>
        </section>
      </div>
    </div>
  )
}

export default BaseModalTestbed
