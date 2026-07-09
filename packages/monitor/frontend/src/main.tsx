import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { App } from './App.tsx'
import './styles/brutalist.css'

// Register GSAP React plugin once at startup.
gsap.registerPlugin(useGSAP)

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element #root not found')

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
