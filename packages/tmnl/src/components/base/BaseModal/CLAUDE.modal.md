# BaseModal — Agent Handoff Document

> A Higher Order Provider compound component implemented with respect to arbitrary visitor contracts of certain shapes.

---

## Quick Context

You're looking at a **compound component modal system** designed for TMNL. It supports two consumption patterns:

1. **Void Contract** — No visitor, just render children (slots or raw)
2. **Visitor Contract** — Typed data shapes that define how content renders

The system is intentionally minimal. No animation library dependencies. No external state management. Pure React compound components with context.

---

## File Map

```
src/components/base/BaseModal/
├── CLAUDE.modal.md      # You are here
├── README.md            # User-facing docs
├── types.ts             # TypeScript interfaces
├── BaseModal.tsx        # Implementation
└── index.ts             # Exports

Related:
├── src/components/base/index.ts                    # Re-exports BaseModal
├── src/components/testbed/BaseModalTestbed.tsx     # Test cases (TC1-TC6)
├── src/components/testbed/HalflifeTimeline.tsx     # Real usage (DamageReportModal)
└── src/router.tsx                                  # Route: /testbed/base-modal
```

---

## Architecture Overview

### Two Context Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    ModalProvider (Global)                    │
│  - Manages visitors registry                                 │
│  - Provides imperative API: open(visitorId, data)           │
│  - Creates portal root element                               │
│  - Used when you need to open modals from anywhere          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  LocalModalContext (Per-Modal)               │
│  - Created by Modal.Root                                     │
│  - Manages single modal's open/close state                   │
│  - Handles focus trap and escape key                         │
│  - Used by compound components (Trigger, Portal, etc.)       │
└─────────────────────────────────────────────────────────────┘
```

### Compound Component Tree

```tsx
<Modal.Root>                    // Context boundary + state
  <Modal.Trigger>               // Opens modal on click
    <button>Open</button>
  </Modal.Trigger>
  <Modal.Portal>                // Renders into portal
    <Modal.Overlay />           // Backdrop (closes on click)
    <Modal.Content>             // Dialog container
      <Modal.Header>            // Optional slot
        <h2>Title</h2>
      </Modal.Header>
      <Modal.Body>              // Optional slot
        <p>Content</p>
      </Modal.Body>
      <Modal.Footer>            // Optional slot
        <Modal.Close>           // Closes modal on click
          <button>Done</button>
        </Modal.Close>
      </Modal.Footer>
    </Modal.Content>
  </Modal.Portal>
</Modal.Root>
```

---

## Core Interfaces

### VisitorContract<TData>

The heart of the typed modal system. Defines how a data shape renders:

```typescript
interface VisitorContract<TData = unknown> {
  id: string                                              // Unique identifier
  render: (data: TData, actions: ModalActions) => ReactNode  // Main content
  header?: (data: TData, actions: ModalActions) => ReactNode // Optional header
  footer?: (data: TData, actions: ModalActions) => ReactNode // Optional footer
  size?: ModalSize                                        // 'sm' | 'md' | 'lg' | 'xl' | 'full'
  className?: string                                      // Additional styles
  disableEscapeClose?: boolean                            // Prevent Escape key close
}
```

### ModalActions

Passed to visitor render functions:

```typescript
interface ModalActions {
  close: () => void           // Close the modal
  setData: <T>(data: T) => void  // Update modal data (provider mode only)
}
```

### ModalSize

```typescript
type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

// Maps to Tailwind:
const MODAL_SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-4xl',
  full: 'max-w-[90vw] max-h-[90vh]',
}
```

---

## Usage Patterns

### Pattern 1: Void Contract (Inline)

No visitor. Modal.Content renders children directly.

```tsx
import { Modal } from '@/components/base'

function MyComponent() {
  return (
    <Modal.Root>
      <Modal.Trigger>
        <button>Open</button>
      </Modal.Trigger>
      <Modal.Portal>
        <Modal.Overlay />
        <Modal.Content>
          <Modal.Header>
            <h2>Title</h2>
          </Modal.Header>
          <Modal.Body>
            <p>Any content here</p>
          </Modal.Body>
          <Modal.Footer>
            <Modal.Close>
              <button>Close</button>
            </Modal.Close>
          </Modal.Footer>
        </Modal.Content>
      </Modal.Portal>
    </Modal.Root>
  )
}
```

**When to use:** Simple, one-off modals where content is static or locally derived.

### Pattern 2: Void Contract (Raw)

Even simpler — no slots, just raw children:

```tsx
<Modal.Root>
  <Modal.Trigger><button>Open</button></Modal.Trigger>
  <Modal.Portal>
    <Modal.Overlay />
    <Modal.Content>
      <div className="p-4">
        <h2>Raw content</h2>
        <p>No slots needed</p>
        <Modal.Close><button>X</button></Modal.Close>
      </div>
    </Modal.Content>
  </Modal.Portal>
</Modal.Root>
```

### Pattern 3: Visitor Contract (Typed)

Define a visitor, pass data to Modal.Content:

```tsx
import { Modal, createVisitor } from '@/components/base'

// Define visitor with typed data
interface UserData {
  name: string
  email: string
}

const userVisitor = createVisitor<UserData>({
  id: 'user-details',
  size: 'md',
  header: (data) => <h2>{data.name}</h2>,
  render: (data, actions) => (
    <div>
      <p>Email: {data.email}</p>
      <button onClick={actions.close}>Done</button>
    </div>
  ),
  footer: (data, actions) => (
    <button onClick={actions.close}>Close</button>
  ),
})

// Usage
function UserCard({ user }: { user: UserData }) {
  return (
    <Modal.Root>
      <Modal.Trigger><button>View</button></Modal.Trigger>
      <Modal.Portal>
        <Modal.Overlay />
        <Modal.Content visitor={userVisitor} data={user} />
      </Modal.Portal>
    </Modal.Root>
  )
}
```

**When to use:** Reusable modal layouts for specific data types.

### Pattern 4: Provider + Imperative API

For opening modals from anywhere (e.g., global notifications, context menus):

```tsx
import { ModalProvider, useModal, createVisitor } from '@/components/base'

const alertVisitor = createVisitor<{ message: string }>({
  id: 'alert',
  render: (data, actions) => (
    <div>
      <p>{data.message}</p>
      <button onClick={actions.close}>OK</button>
    </div>
  ),
})

// Wrap app
function App() {
  return (
    <ModalProvider visitors={[alertVisitor]}>
      <MyApp />
    </ModalProvider>
  )
}

// Use anywhere
function SomeDeepComponent() {
  const { open } = useModal()

  const handleError = () => {
    open('alert', { message: 'Something went wrong!' })
  }

  return <button onClick={handleError}>Trigger</button>
}
```

---

## Real-World Example: DamageReportModal

From `HalflifeTimeline.tsx` — a self-contained modal for damage reports:

```tsx
interface DamageModalData {
  id: string
  title: string
  damage: DamageContext
}

function DamageReportModal({ data }: { data: DamageModalData }) {
  return (
    <Modal.Root>
      <Modal.Trigger asChild>
        <button
          className="px-1.5 py-0.5 text-[9px] font-mono uppercase rounded bg-orange-900/30 text-orange-400 hover:bg-orange-800/50 transition-colors cursor-pointer"
          onClick={(e) => e.stopPropagation()}  // Prevent parent click
        >
          DMG
        </button>
      </Modal.Trigger>
      <Modal.Portal>
        <Modal.Overlay />
        <Modal.Content className="max-w-md">
          <Modal.Header className="border-orange-800/30">
            <div>
              <span className="text-orange-400 text-xs font-mono">{data.id}</span>
              <h3 className="text-neutral-200 text-sm font-medium mt-1">{data.title}</h3>
            </div>
          </Modal.Header>
          <Modal.Body className="space-y-4">
            {data.damage.parentFinding && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-neutral-500">PARENT FINDING:</span>
                <span className="text-violet-400 font-mono">{data.damage.parentFinding}</span>
              </div>
            )}
            <div>
              <div className="text-[10px] text-orange-500 uppercase tracking-wider mb-1 font-bold">
                Root Cause
              </div>
              <p className="text-sm text-orange-300/90">{data.damage.rootCause}</p>
            </div>
            {/* ... more fields ... */}
          </Modal.Body>
          <Modal.Footer className="border-orange-800/30">
            <div className="flex justify-end">
              <Modal.Close asChild>
                <button className="px-3 py-1.5 text-xs font-mono bg-neutral-800 hover:bg-neutral-700 rounded transition-colors">
                  DISMISS
                </button>
              </Modal.Close>
            </div>
          </Modal.Footer>
        </Modal.Content>
      </Modal.Portal>
    </Modal.Root>
  )
}

// Usage in FindingCard
{isDamage && finding.damage && (
  <DamageReportModal data={{ id: finding.id, title: finding.title, damage: finding.damage }} />
)}
```

**Key techniques:**
- `asChild` prop clones trigger onto custom element
- `onClick={(e) => e.stopPropagation()}` prevents parent handlers
- `className` on Content/Header/Footer for theming
- Self-contained — no provider needed

---

## Implementation Details

### Focus Trap (BaseModal.tsx:290-315)

Basic focus trap that cycles through focusable elements:

```typescript
useEffect(() => {
  if (!isOpen || !resolvedRef.current) return

  const focusableElements = resolvedRef.current.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  const firstElement = focusableElements[0] as HTMLElement
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

  firstElement?.focus()

  const handleTab = (e: globalThis.KeyboardEvent) => {
    if (e.key !== 'Tab') return
    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault()
      lastElement?.focus()
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault()
      firstElement?.focus()
    }
  }

  document.addEventListener('keydown', handleTab)
  return () => document.removeEventListener('keydown', handleTab)
}, [isOpen, resolvedRef])
```

### Escape Key Handler (BaseModal.tsx:276-287)

```typescript
useEffect(() => {
  if (!isOpen) return

  const handleKeyDown = (e: globalThis.KeyboardEvent) => {
    if (e.key === 'Escape' && !visitor?.disableEscapeClose) {
      setIsOpen(false)
    }
  }

  document.addEventListener('keydown', handleKeyDown)
  return () => document.removeEventListener('keydown', handleKeyDown)
}, [isOpen, setIsOpen, visitor?.disableEscapeClose])
```

### Portal Mounting (BaseModal.tsx:224-238)

Handles SSR-safe mounting:

```typescript
function ModalPortal({ children, container }: ModalPortalProps) {
  const { isOpen } = useLocalModal()
  const globalModal = useModalOptional()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!isOpen || !mounted) return null

  const portalContainer = container ?? globalModal?.portalRoot ?? document.body
  return createPortal(children, portalContainer)
}
```

### Content Branching (BaseModal.tsx:337-356)

The void vs visitor contract decision:

```tsx
{visitor && data !== undefined ? (
  // Visitor mode: use visitor.render/header/footer
  <>
    {visitor.header && (
      <div className="...">{visitor.header(data, actions)}<ModalCloseButton /></div>
    )}
    <div className="...">{visitor.render(data, actions)}</div>
    {visitor.footer && (
      <div className="...">{visitor.footer(data, actions)}</div>
    )}
  </>
) : (
  // Void mode: render children (slots or raw)
  children
)}
```

---

## Testbed Reference

Located at `/testbed/base-modal`, the testbed covers:

| TC | Name | Tests |
|----|------|-------|
| TC1 | Void Contract | Slots vs Raw children rendering |
| TC2 | Visitor Contract | Typed data flow, header/footer |
| TC3 | Imperative API | useModal().open() from provider |
| TC4 | Modal Sizes | sm/md/lg/xl/full |
| TC5 | Focus + Escape | Accessibility features |
| TC6 | Damage Report | Real visitor with DamageContext |

---

## Extension Points

### Adding Animation

Currently no entry/exit animations. To add:

1. **CSS approach** — Use `animate-in`/`animate-out` classes (already partially there)
2. **Framer Motion** — Wrap Content in `<AnimatePresence><motion.div>`
3. **GSAP/anime.js** — Use `useAnimatable` from `@/lib/animation`

### Adding Stacking

Multiple modals can stack but currently share z-index. To fix:

```typescript
// In ModalProvider
const [stackLevel, setStackLevel] = useState(0)

// When opening
setStackLevel(prev => prev + 1)

// Pass to Content
style={{ zIndex: MODAL_Z_INDEX + stackLevel }}
```

### Adding Transitions

For smooth state transitions between visitors:

```typescript
const { open, visitorId } = useModal()

// Transition to new visitor
open('new-visitor', newData) // Automatically swaps content
```

### Effect-ification

To integrate with Effect for observability:

```typescript
import * as Effect from 'effect/Effect'

const openModal = (visitorId: string, data: unknown) =>
  Effect.gen(function*() {
    yield* Effect.logInfo('Modal opening', { visitorId })
    yield* Effect.sync(() => modalContext.open(visitorId, data))
  }).pipe(Effect.withSpan('Modal.open'))
```

---

## Gotchas & Lessons Learned

### 1. React Import Required

The file uses `cloneElement`, `isValidElement`, `ReactElement` — all need explicit import:

```typescript
import React, {
  cloneElement,
  isValidElement,
  type ReactElement,
  // ...
} from 'react'
```

**Damage Report:** Caused "React is not defined" runtime error. Fixed by auditing all React.* usages.

### 2. asChild Ref Forwarding

When using `asChild`, the child must accept a ref:

```tsx
// Works
<Modal.Trigger asChild>
  <button>Open</button>  {/* button accepts ref */}
</Modal.Trigger>

// Breaks
<Modal.Trigger asChild>
  <MyComponent />  {/* Must forwardRef */}
</Modal.Trigger>
```

### 3. Stop Propagation in Nested Triggers

When modal trigger is inside a clickable parent:

```tsx
<button onClick={parentHandler}>
  <DamageReportModal />  {/* Clicking opens modal AND triggers parent */}
</button>

// Fix: stopPropagation in trigger
<Modal.Trigger asChild>
  <button onClick={(e) => e.stopPropagation()}>DMG</button>
</Modal.Trigger>
```

### 4. Controlled vs Uncontrolled

Modal.Root supports both:

```tsx
// Uncontrolled (internal state)
<Modal.Root>...</Modal.Root>

// Controlled (external state)
<Modal.Root open={isOpen} onOpenChange={setIsOpen}>...</Modal.Root>
```

---

## API Quick Reference

### Exports

```typescript
// Components
export { Modal }                // Compound component namespace
export { ModalProvider }        // Global provider
export { useModal }             // Hook for imperative API
export { useModalOptional }     // Hook that doesn't throw
export { createVisitor }        // Factory for typed visitors

// Types
export type {
  VisitorContract,
  ModalActions,
  ModalSize,
  ModalContextValue,
  ModalProviderProps,
  ModalRootProps,
  ModalTriggerProps,
  ModalPortalProps,
  ModalOverlayProps,
  ModalContentProps,
  ModalHeaderProps,
  ModalBodyProps,
  ModalFooterProps,
  ModalCloseProps,
}
```

### Modal.* Components

| Component | Props | Purpose |
|-----------|-------|---------|
| `Modal.Root` | `defaultOpen?`, `open?`, `onOpenChange?` | Context boundary |
| `Modal.Trigger` | `asChild?` | Opens modal on click |
| `Modal.Portal` | `container?` | Renders to portal |
| `Modal.Overlay` | `className?`, `onClick?` | Backdrop |
| `Modal.Content` | `visitor?`, `data?`, `className?` | Dialog container |
| `Modal.Header` | `className?`, `showClose?` | Header slot |
| `Modal.Body` | `className?` | Body slot |
| `Modal.Footer` | `className?` | Footer slot |
| `Modal.Close` | `asChild?`, `className?` | Close button |

---

## Session History

- **Created:** BaseModal system with compound components
- **Tested:** TC1-TC6 in testbed at `/testbed/base-modal`
- **Integrated:** DamageReportModal in HalflifeTimeline
- **Documented:** This handoff document

---

## Next Steps for Extending Agent

1. **Add animation** — Entry/exit transitions for Content
2. **Add drawer variant** — Slide-in from edge
3. **Add confirmation modal** — Pre-built visitor for confirm/cancel
4. **Add nested modals** — Proper z-index stacking
5. **Effect-ify** — Wrap open/close in Effect for observability
6. **Add keyboard shortcuts** — Custom key bindings per visitor

---

*Last updated: Session where BaseModal was created and DamageReportModal was wired.*
