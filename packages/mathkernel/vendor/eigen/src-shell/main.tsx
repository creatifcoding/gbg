import React from 'react'
import ReactDOM from 'react-dom/client'

// Phase 1: Render a visible sentinel IMMEDIATELY — proves React works
const root = ReactDOM.createRoot(document.getElementById('root')!)
root.render(
  React.createElement('div', {
    id: 'sentinel',
    style: {
      position: 'fixed', top: 0, left: 0,
      width: 48, height: '100vh',
      background: '#060608',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }
  },
    React.createElement('div', {
      style: { color: '#7ec8b0', fontSize: 9, fontFamily: 'monospace', writingMode: 'vertical-rl' }
    }, '...')
  )
)

// Phase 2: Dynamically import the real app
async function boot() {
  try {
    const { RegistryProvider } = await import('@effect-atom/atom-react/RegistryContext')
    const { App } = await import('./App')

    root.render(
      React.createElement(RegistryProvider, null,
        React.createElement(App)
      )
    )
  } catch (err: any) {
    // Show error in the bar strip area
    root.render(
      React.createElement('div', {
        style: {
          position: 'fixed', top: 0, left: 0,
          width: 48, height: '100vh',
          background: '#ff0000',
          color: '#fff', fontSize: 6,
          fontFamily: 'monospace',
          writingMode: 'vertical-rl',
          padding: 3, wordBreak: 'break-all',
          overflow: 'hidden',
        }
      }, String(err?.message || err))
    )
  }
}

boot()
