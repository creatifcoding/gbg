import { useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { HoundstoothGOL } from './components/houndstooth-gol';
import { withLayering } from './lib/layers';
import './App.css';

/**
 * Background Layer - HoundstoothGOL with full viewport
 *
 * NOTE: Uses positionMode: 'fixed' for full viewport coverage
 * NOTE: pointerEvents: 'auto' allows background to capture clicks (resets simulation)
 */
const BackgroundLayer = withLayering(() => <HoundstoothGOL />, {
  name: 'houndstooth-background',
  zIndex: -10,
  positionMode: 'fixed', // NOTE: Fixed positioning for full viewport coverage
  pointerEvents: 'auto', // Background captures clicks (resets simulation)
});

/**
 * Content Layer - Interactive UI elements
 *
 * NOTE: Uses positionMode: 'relative' (default) for normal flow
 * NOTE: pointerEvents: 'pass-through' with captureClicks: true allows
 *       the container to pass events through while children can still capture
 *
 * TODO: Consider adding more granular pointer-events control per child
 */
const ContentLayer = withLayering(
  ({ children }: { children: ReactNode }) => (
    <div className="min-h-screen flex items-center justify-center overflow-hidden scrollbar-hide">
      {children}
    </div>
  ),
  {
    name: 'main-content',
    zIndex: 10,
    positionMode: 'relative',
    pointerEvents: 'pass-through', // Container passes through events
    captureClicks: true, // NOTE: Hotfix - enables inner wrapper for click capture
  }
);

function Content() {
  const [count, setCount] = useState(0);

  return (
    /**
     * Center contents per the viewport
     */
    <div className="min-h-screen flex items-center justify-center overflow-hidden scrollbar-hide">
      <motion.div
        className="container"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          TMNL
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          Terminal & Multi-Modal Navigation Layer
        </motion.p>

        <motion.div
          className="card"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <button
            onClickCapture={() => console.log(`count is ${count}`)}
            onClick={() => setCount((count) => count + 1)}
          >
            count is blah {count}
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
function App() {
  return (
    <>
      {/* Background - Full viewport HoundstoothGOL simulation */}
      <BackgroundLayer />

      {/* Content - Interactive UI elements */}
      <ContentLayer>
        <Content />
      </ContentLayer>
    </>
  );
}

export default App;
