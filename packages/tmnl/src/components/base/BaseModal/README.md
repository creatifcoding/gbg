# BaseModal

**A Higher Order Provider compound component implemented with respect to arbitrary visitor contracts of certain shapes.**

---

## Philosophy

BaseModal separates **orchestration** (open/close, portal, overlay, focus trap) from **content** (what renders inside). Content is injected via visitor contracts — typed shapes that define what data flows into the modal and how it's rendered.

This enables:
- One modal system, infinite content shapes
- Type-safe visitor contracts per use case
- Compound component API for ergonomic composition
- Zero coupling between modal chrome and modal content

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     ModalProvider                            │
│  (Context: open/close, register visitors, portal root)       │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    Modal.Root                            ││
│  │  (Portal, Overlay, FocusTrap, Escape handling)           ││
│  │                                                          ││
│  │  ┌─────────────────────────────────────────────────────┐││
│  │  │              Modal.Content                          │││
│  │  │  (Visitor contract renderer)                        │││
│  │  │                                                     │││
│  │  │  visitor.render(data) → ReactNode                   │││
│  │  └─────────────────────────────────────────────────────┘││
│  │                                                          ││
│  │  ┌─────────────────┐  ┌─────────────────┐               ││
│  │  │  Modal.Header   │  │  Modal.Footer   │               ││
│  │  │  (optional)     │  │  (optional)     │               ││
│  │  └─────────────────┘  └─────────────────┘               ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Visitor Contract

A visitor contract defines the shape of data a modal accepts and how to render it:

```typescript
interface VisitorContract<TData> {
  /** Unique identifier for this visitor type */
  id: string
  /** Render function: data → ReactNode */
  render: (data: TData, actions: ModalActions) => ReactNode
  /** Optional: custom header renderer */
  header?: (data: TData) => ReactNode
  /** Optional: custom footer renderer */
  footer?: (data: TData, actions: ModalActions) => ReactNode
  /** Optional: modal size preset */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}
```

## Usage

### 1. Define a Visitor Contract

```typescript
import { createVisitor } from '@/components/base/BaseModal'

interface HalflifeData {
  findings: Finding[]
  version: string
}

export const halflifeVisitor = createVisitor<HalflifeData>({
  id: 'halflife',
  size: 'xl',
  header: (data) => (
    <div className="flex items-center gap-3">
      <span className="text-violet-400 font-mono font-bold">HALFLIFE</span>
      <span className="text-neutral-500 text-xs">v{data.version}</span>
    </div>
  ),
  render: (data, { close }) => (
    <HalflifeTimeline data={data} onClose={close} />
  ),
})
```

### 2. Register Visitors with Provider

```typescript
import { ModalProvider } from '@/components/base/BaseModal'
import { halflifeVisitor, damageVisitor } from './visitors'

function App() {
  return (
    <ModalProvider visitors={[halflifeVisitor, damageVisitor]}>
      <YourApp />
    </ModalProvider>
  )
}
```

### 3. Open Modal with Data

```typescript
import { useModal } from '@/components/base/BaseModal'

function Toolbar() {
  const { open } = useModal()

  return (
    <button onClick={() => open('halflife', { findings, version: '1.1' })}>
      Open HALFLIFE
    </button>
  )
}
```

### 4. Compound Component API (Alternative)

```tsx
<Modal.Root>
  <Modal.Trigger asChild>
    <button>Open</button>
  </Modal.Trigger>
  <Modal.Portal>
    <Modal.Overlay />
    <Modal.Content visitor={halflifeVisitor} data={halflifeData}>
      <Modal.Header />
      <Modal.Body />
      <Modal.Footer />
    </Modal.Content>
  </Modal.Portal>
</Modal.Root>
```

## API Reference

### ModalProvider

| Prop | Type | Description |
|------|------|-------------|
| `visitors` | `VisitorContract[]` | Array of visitor contracts to register |
| `children` | `ReactNode` | App content |

### useModal

```typescript
const {
  open,      // (visitorId: string, data: unknown) => void
  close,     // () => void
  isOpen,    // boolean
  visitorId, // string | null
  data,      // unknown
} = useModal()
```

### Modal.* Compound Components

| Component | Description |
|-----------|-------------|
| `Modal.Root` | Context boundary for a single modal instance |
| `Modal.Trigger` | Button/element that opens the modal |
| `Modal.Portal` | Renders children into portal root |
| `Modal.Overlay` | Semi-transparent backdrop |
| `Modal.Content` | Main content container with visitor rendering |
| `Modal.Header` | Optional header slot |
| `Modal.Body` | Main body slot (visitor.render output) |
| `Modal.Footer` | Optional footer slot |
| `Modal.Close` | Close button |

## Design Tokens

BaseModal respects TMNL design tokens:

```typescript
const MODAL_SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-[90vw] max-h-[90vh]',
}

const MODAL_Z = 9999
```

## Accessibility

- Focus trap inside modal content
- Escape key closes modal
- `aria-modal="true"` on content
- `aria-labelledby` linked to header
- Focus returns to trigger on close
