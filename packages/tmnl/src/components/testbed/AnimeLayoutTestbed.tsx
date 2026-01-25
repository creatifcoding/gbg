import { useRef, useEffect } from 'react';
import { createLayout } from 'animejs';

/**
 * Anime.js Layout Testbed
 *
 * Demonstrates correct usage of anime.js auto-layout with React.
 *
 * Key Patterns:
 * 1. Import from 'animejs' or 'animejs/layout' (not deep paths)
 * 2. Use createLayout(root, parameters) to create layout instance
 * 3. Call layout.record() to snapshot initial state
 * 4. Use layout.update() or layout.animate() to trigger transitions
 * 5. Use ref to maintain layout instance across renders
 */

// Animation target identifiers using Schema.Literal pattern for type safety
const LayoutTargets = {
  container: 'layout-container',
  grid: 'grid-state',
} as const;

type LayoutTarget = (typeof LayoutTargets)[keyof typeof LayoutTargets];

export function AnimeLayoutTestbed() {
  const containerRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<ReturnType<typeof createLayout> | null>(null);

  // Initialize layout on mount
  useEffect(() => {
    if (!containerRef.current) return;

    // Create layout with correct import pattern
    const layout = createLayout(containerRef.current, {
      duration: 800,
      easing: 'easeInOutQuad',
    });

    // Record initial state (list view)
    layout.record();

    layoutRef.current = layout;

    // Cleanup on unmount
    return () => {
      layout.revert();
      layoutRef.current = null;
    };
  }, []);

  // Animate to grid view
  const handleToggleGrid = () => {
    const layout = layoutRef.current;
    if (!layout) return;

    // Update layout state and animate transition
    layout.update(({ root }) => {
      const container = root;
      if (!container) return;

      // Toggle CSS class for layout change
      container.classList.toggle('grid-layout');
    });
  };

  // Animate to list view
  const handleToggleList = () => {
    const layout = layoutRef.current;
    if (!layout) return;

    layout.animate({
      duration: 600,
      easing: 'easeOutCubic',
    });
  };

  return (
    <div className="anime-layout-testbed">
      <style>{`
        .anime-layout-testbed {
          padding: 2rem;
          background: var(--tmnl-surface-base);
          color: var(--tmnl-text-base);
          font-family: var(--tmnl-font-mono);
          min-height: 100vh;
        }

        .anime-layout-testbed h2 {
          font-size: var(--tmnl-text-lg);
          margin-bottom: 1.5rem;
          color: var(--tmnl-accent-cyan);
        }

        .anime-layout-testbed .controls {
          display: flex;
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .anime-layout-testbed .controls button {
          padding: 0.75rem 1.5rem;
          background: var(--tmnl-surface-elevated);
          border: 1px solid var(--tmnl-border-subtle);
          border-radius: 4px;
          color: var(--tmnl-text-base);
          font-family: var(--tmnl-font-mono);
          font-size: var(--tmnl-text-sm);
          cursor: pointer;
          transition: all 0.2s ease-out;
        }

        .anime-layout-testbed .controls button:hover {
          background: var(--tmnl-accent-cyan);
          color: var(--tmnl-surface-base);
          border-color: var(--tmnl-accent-cyan);
        }

        .anime-layout-testbed .controls button:active {
          transform: scale(0.98);
        }

        /* List layout (default) */
        .layout-container.list-layout {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .layout-container.list-layout .item {
          padding: 1rem;
          background: var(--tmnl-surface-elevated);
          border-radius: 4px;
          border: 1px solid var(--tmnl-border-subtle);
        }

        /* Grid layout */
        .layout-container.grid-layout {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
        }

        .layout-container.grid-layout .item {
          padding: 1rem;
          background: var(--tmnl-surface-elevated);
          border-radius: 4px;
          border: 1px solid var(--tmnl-border-subtle);
        }

        .status {
          margin-top: 1rem;
          padding: 0.75rem 1rem;
          background: var(--tmnl-surface-elevated);
          border-radius: 4px;
          font-size: var(--tmnl-text-sm);
          color: var(--tmnl-text-muted);
        }
      `}</style>

      <h2>anime.js Auto-Layout Testbed</h2>

      <div className="controls">
        <button onClick={handleToggleList}>Toggle List View</button>
        <button onClick={handleToggleGrid}>Toggle Grid View</button>
      </div>

      <div
        ref={containerRef}
        id={LayoutTargets.container}
        className="layout-container list-layout"
        data-layout="list"
      >
        <div className="item">Item A</div>
        <div className="item">Item B</div>
        <div className="item">Item C</div>
        <div className="item">Item D</div>
        <div className="item">Item E</div>
        <div className="item">Item F</div>
      </div>

      <div className="status">
        Current layout: <span id={LayoutTargets.grid}>List</span>
      </div>
    </div>
  );
}
