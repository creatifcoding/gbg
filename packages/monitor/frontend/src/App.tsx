/**
 * App — root shell for getbymonitor.
 *
 * Query/cache state is held in Effect v4 atoms under src/lib/query.ts.
 */
import { SessionList } from './components/SessionList.tsx'
import { GraphCanvas } from './components/GraphCanvas.tsx'
import { NodeDetail } from './components/NodeDetail.tsx'
import { HarnessPanel } from './components/HarnessPanel.tsx'
import { useAtomValue, selectedSessionIdAtom } from './lib/atoms.ts'


function TopBar() {
  const sessionId = useAtomValue(selectedSessionIdAtom)
  return (
    <header className="gbm-topbar">
      <span className="gbm-topbar__logo">getbymonitor</span>
      <span className="gbm-topbar__sep">·</span>
      <span className="gbm-topbar__tag">rca</span>
      {sessionId && (
        <>
          <span className="gbm-topbar__sep">·</span>
          <span className="gbm-topbar__tag">{sessionId}</span>
        </>
      )}
      <span className="gbm-topbar__status gbm-topbar__status--live">
        {import.meta.env.VITE_RCA_API_BASE ?? 'http://127.0.0.1:8765'}
      </span>
    </header>
  )
}

function Shell() {
  return (
    <div className="gbm-shell">
      <TopBar />
      <SessionList />
      <GraphCanvas />
      <NodeDetail />
      <HarnessPanel />
    </div>
  )
}

export function App() {
  return <Shell />
}
