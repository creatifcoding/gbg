import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import './transfer-drag-badge.css'

export interface TransferDragBadgeProps {
  readonly label: string
}

export function TransferDragBadge({ label }: TransferDragBadgeProps) {
  return <div className="tmnl-transfer-drag-badge">↗ {label}</div>
}

export interface MountedTransferDragBadge {
  readonly element: HTMLElement
  readonly dispose: () => void
}

export function mountTransferDragBadge(label: string): MountedTransferDragBadge {
  const host = document.createElement('div')
  host.className = 'tmnl-transfer-drag-badge-host'
  document.body.appendChild(host)

  const root = createRoot(host)
  flushSync(() => {
    root.render(<TransferDragBadge label={label} />)
  })

  return {
    element: host,
    dispose: () => {
      root.unmount()
      host.remove()
    },
  }
}
