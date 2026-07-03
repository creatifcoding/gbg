import { Modal, useModal } from '@/lib/getbyshell/modal'
import { usePanelOpen } from '@/lib/getbyshell'
import { BarLayout } from './components/BarLayout'
import { WorkspaceIndicators } from './components/WorkspaceIndicators'
import { Clock } from './components/Clock'
import { TMNLStatus } from './components/TMNLStatus'
import { NetworkStatus } from './components/NetworkStatus'
import { PanelToggle } from './components/PanelToggle'

function SlotMarker({ label, color }: { label: string; color: string }) {
  return (
    <div
      data-slot-marker={label}
      style={{
        width: 24,
        height: 24,
        borderRadius: 4,
        background: color,
        color: '#000',
        fontFamily: 'monospace',
        fontSize: 12,
        fontWeight: 900,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: 2,
        boxShadow: `0 0 10px ${color}55`,
        lineHeight: 1,
      }}
    >
      {label}
    </div>
  )
}

export function App() {
  const panelOpen = usePanelOpen()

  return (
    <>
      <BarLayout>
        <BarLayout.Top>
          <SlotMarker label="T" color="#ffcc00" />
          <WorkspaceIndicators />
        </BarLayout.Top>

        <BarLayout.Center>
          <SlotMarker label="C" color="#00ccff" />
          <TMNLStatus />
          <PanelToggle active={panelOpen} />
          <NetworkStatus />
        </BarLayout.Center>

        <BarLayout.Bottom>
          <SlotMarker label="B" color="#ff66cc" />
          <Clock />
        </BarLayout.Bottom>
      </BarLayout>

      <Modal id="chronicle" entrance="holographic">
        <Modal.Content padding={0}>
          <ChronicleOverlay />
        </Modal.Content>
      </Modal>
    </>
  )
}

function ChronicleOverlay() {
  const { payload, close } = useModal()
  const dayId = (payload as { dayId?: string } | null)?.dayId

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#000000',
        borderRadius: 0,
        border: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'JetBrains Mono', monospace",
        overflow: 'hidden',
      }}
    >
      <span style={{
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: '0.3em',
        color: 'rgba(126, 200, 176, 0.6)',
      }}>
        CHRONICLE
      </span>

      {dayId && (
        <span style={{
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.1em',
          color: 'rgba(126, 200, 176, 0.35)',
          marginTop: 6,
        }}>
          {dayId}
        </span>
      )}

      <span style={{
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: '0.12em',
        color: 'rgba(184, 188, 198, 0.25)',
        marginTop: 8,
      }}>
        PHASE 3 · PENDING IMPLEMENTATION
      </span>

      <button
        onClick={close}
        style={{
          marginTop: 16,
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'transparent',
          color: 'rgba(184, 188, 198, 0.4)',
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.14em',
          padding: '4px 12px',
          borderRadius: 4,
          cursor: 'pointer',
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        ESC
      </button>
    </div>
  )
}
