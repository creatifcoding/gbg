/**
 * CollaborationTestbed V2
 *
 * Simplified collaboration testbed using autonomous editor panels.
 * Each panel owns its own document selection, connection, and presence.
 * No page-level modals — everything is panel-local.
 *
 * CRITICAL: Each panel has ISOLATED STATE via Atom.family pattern.
 *
 * @module testbed/CollaborationTestbedV2
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type CollaborationUser } from '@/lib/editor/v3';
import {
  AutonomousEditorPanel,
  PanelRegistryProvider,
} from './collaboration/v2';
import {
  VANTA_COLORS,
  VANTA_TYPOGRAPHY,
  VANTA_SPACING,
  VANTA_BORDERS,
  VANTA_ANIMATION,
} from '@/components/portal/tokens';

// =============================================================================
// Types
// =============================================================================

interface EditorInstance {
  id: string;
  user: CollaborationUser;
  label: string;
}

// =============================================================================
// Editor Color Palette (deterministic from index)
// =============================================================================

const EDITOR_COLORS = [
  '#22d3ee', // cyan
  '#34d399', // emerald
  '#fbbf24', // amber
  '#fb7185', // rose
  '#a78bfa', // violet
  '#f472b6', // pink
  '#38bdf8', // sky
  '#4ade80', // green
];

function getEditorColor(index: number): string {
  return EDITOR_COLORS[index % EDITOR_COLORS.length];
}

// =============================================================================
// Icon Components
// =============================================================================

function PlusIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function LayoutIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  );
}

// =============================================================================
// Inner Testbed Component
// =============================================================================

function CollaborationTestbedV2Inner() {
  const [editors, setEditors] = useState<EditorInstance[]>([]);
  const [nextIndex, setNextIndex] = useState(0);

  // Spawn a new editor panel with auto-generated user
  const spawnEditor = useCallback(() => {
    const index = nextIndex;
    const color = getEditorColor(index);
    const label = `Editor ${String.fromCharCode(65 + (index % 26))}`;
    const user: CollaborationUser = {
      name: label,
      color,
    };
    const id = `panel-${Date.now()}-${index}`;

    setEditors((prev) => [...prev, { id, user, label }]);
    setNextIndex((prev) => prev + 1);
  }, [nextIndex]);

  // Close an editor panel
  const closeEditor = useCallback((id: string) => {
    setEditors((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // Calculate grid layout based on panel count
  const getGridStyle = useCallback((): React.CSSProperties => {
    const count = editors.length;
    if (count === 0) return {};
    if (count === 1) return { gridTemplateColumns: '1fr' };
    if (count === 2) return { gridTemplateColumns: '1fr 1fr' };
    if (count <= 4) return { gridTemplateColumns: '1fr 1fr' };
    return { gridTemplateColumns: 'repeat(3, 1fr)' };
  }, [editors.length]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: VANTA_COLORS.gradient.surface,
        fontFamily: VANTA_TYPOGRAPHY.family.sans,
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: VANTA_SPACING['5'],
          padding: `${VANTA_SPACING['3']} ${VANTA_SPACING['6']}`,
          borderBottom: VANTA_BORDERS.style.hairline,
          backgroundColor: VANTA_COLORS.surface.elevated,
        }}
      >
        {/* Title */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: VANTA_SPACING['2.5'],
          }}
        >
          <LayoutIcon size={18} />
          <h1
            style={{
              margin: 0,
              ...VANTA_TYPOGRAPHY.preset.cardTitle,
              color: VANTA_COLORS.text.primary,
            }}
          >
            Collaboration V2
          </h1>
        </div>

        {/* Subtitle Badge */}
        <span
          style={{
            ...VANTA_TYPOGRAPHY.preset.micro,
            color: VANTA_COLORS.accent.cyan,
            padding: `${VANTA_SPACING['1']} ${VANTA_SPACING['2']}`,
            backgroundColor: VANTA_COLORS.accent.cyanGlow,
            borderRadius: VANTA_BORDERS.radius.sm,
          }}
        >
          Autonomous Panels
        </span>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* New Editor Button */}
        <motion.button
          onClick={spawnEditor}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: VANTA_SPACING['2'],
            padding: `${VANTA_SPACING['2']} ${VANTA_SPACING['3']}`,
            background: VANTA_COLORS.surface.elevated,
            border: VANTA_BORDERS.style.hairline,
            borderRadius: VANTA_BORDERS.radius.md,
            cursor: 'pointer',
            transition: VANTA_ANIMATION.transition.all,
            color: VANTA_COLORS.accent.cyan,
          }}
        >
          <PlusIcon size={14} />
          <span
            style={{
              fontFamily: VANTA_TYPOGRAPHY.family.sans,
              fontSize: VANTA_TYPOGRAPHY.size.sm,
              fontWeight: VANTA_TYPOGRAPHY.weight.medium,
            }}
          >
            New Editor
          </span>
        </motion.button>
      </header>

      {/* Content Area */}
      <div
        style={{
          flex: 1,
          padding: VANTA_SPACING.card.padding,
          overflow: 'auto',
          backgroundColor: VANTA_COLORS.surface.void,
        }}
      >
        <AnimatePresence mode="wait">
          {editors.length === 0 ? (
            /* Empty State */
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: VANTA_SPACING['4'],
              }}
            >
              <motion.div
                whileHover={{
                  scale: 1.05,
                  borderColor: VANTA_COLORS.accent.cyan,
                }}
                onClick={spawnEditor}
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: VANTA_BORDERS.radius.lg,
                  backgroundColor: VANTA_COLORS.surface.elevated,
                  border: VANTA_BORDERS.style.crisp,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: VANTA_COLORS.text.muted,
                  cursor: 'pointer',
                  transition: VANTA_ANIMATION.transition.all,
                }}
              >
                <PlusIcon size={32} />
              </motion.div>
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    ...VANTA_TYPOGRAPHY.preset.cardSubtitle,
                    color: VANTA_COLORS.text.secondary,
                    marginBottom: VANTA_SPACING['1'],
                  }}
                >
                  No Editors Open
                </div>
                <div
                  style={{
                    ...VANTA_TYPOGRAPHY.preset.micro,
                    color: VANTA_COLORS.text.muted,
                  }}
                >
                  Click to spawn an autonomous editor panel
                </div>
              </div>
            </motion.div>
          ) : (
            /* Editor Grid */
            <div
              key="grid"
              style={{
                display: 'grid',
                gap: VANTA_SPACING.card.gap,
                height: '100%',
                ...getGridStyle(),
              }}
            >
              <AnimatePresence initial={false}>
                {editors.map((editor) => (
                  <motion.div
                    key={editor.id}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    style={{
                      minHeight: 400,
                      borderRadius: VANTA_BORDERS.radius.md,
                      border: VANTA_BORDERS.style.crisp,
                      boxShadow: VANTA_BORDERS.shadow.card,
                      position: 'relative',
                    }}
                  >
                    <AutonomousEditorPanel
                      panelId={editor.id}
                      user={editor.user}
                      label={editor.label}
                      onClose={() => closeEditor(editor.id)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <footer
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: `${VANTA_SPACING['2.5']} ${VANTA_SPACING['6']}`,
          borderTop: VANTA_BORDERS.style.hairline,
          backgroundColor: VANTA_COLORS.surface.elevated,
        }}
      >
        <span
          style={{
            ...VANTA_TYPOGRAPHY.preset.micro,
            color: VANTA_COLORS.text.muted,
          }}
        >
          y-sweet · localhost:8080
        </span>
        <span
          style={{
            ...VANTA_TYPOGRAPHY.preset.micro,
            color: VANTA_COLORS.text.muted,
          }}
        >
          {editors.length} panel{editors.length !== 1 ? 's' : ''} active
        </span>
      </footer>
    </div>
  );
}

// =============================================================================
// Main Export
// =============================================================================

export function CollaborationTestbedV2() {
  return (
    <PanelRegistryProvider>
      <CollaborationTestbedV2Inner />
    </PanelRegistryProvider>
  );
}

export default CollaborationTestbedV2;
