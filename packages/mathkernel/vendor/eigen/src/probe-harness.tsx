/**
 * Probe page for isolated harness verification.
 * Bypasses AppShell/router, renders MorphChat with live harness adapter.
 *
 * Access: http://localhost:1420/probe-harness.html
 */
import React from 'react'
import { createRoot } from 'react-dom/client'
import { MorphChatTestbed } from './components/testbed/MorphChatTestbed'

// Global error handler — writes to DOM so agent-browser can read it
window.onerror = (msg, source, lineno, colno, error) => {
  const el = document.getElementById('error-output')
  if (el) {
    el.textContent += `\n[ERROR] ${msg}\n  at ${source}:${lineno}:${colno}\n  ${error?.stack ?? ''}\n`
    el.style.display = 'block'
  }
  console.error('[PROBE ERROR]', msg, source, lineno, colno, error)
}

window.onunhandledrejection = (event) => {
  const el = document.getElementById('error-output')
  if (el) {
    const reason = event.reason
    el.textContent += `\n[UNHANDLED REJECTION] ${reason?.message ?? reason}\n  ${reason?.stack ?? ''}\n`
    el.style.display = 'block'
  }
  console.error('[PROBE UNHANDLED REJECTION]', event.reason)
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-900/30 border border-red-500 rounded m-4 font-mono text-sm">
          <h2 className="text-red-400 text-lg mb-2">React Error Boundary</h2>
          <pre className="text-red-300 whitespace-pre-wrap">
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

function ProbeHarness() {
  return (
    <div className="w-full h-screen bg-black">
      <div
        id="error-output"
        className="hidden bg-red-900/30 border border-red-500 p-4 m-4 rounded font-mono text-xs text-red-300 whitespace-pre-wrap max-h-[200px] overflow-auto"
      />
      <ErrorBoundary>
        <MorphChatTestbed />
      </ErrorBoundary>
    </div>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(
  <React.StrictMode>
    <ProbeHarness />
  </React.StrictMode>,
)
