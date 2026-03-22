/**
 * uilabs-inspired contextual toolbar
 * Transforms based on state - no mode switching, the whole bar morphs
 *
 * Uses Radix DropdownMenu for document breadcrumb with TMNL Vanta design tokens.
 *
 * @module testbed/collaboration/v2/ContextualToolbar
 */
import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

import {
  VANTA_COLORS,
  VANTA_TYPOGRAPHY,
  VANTA_SPACING,
  VANTA_BORDERS,
  VANTA_ANIMATION,
} from '@/components/portal/tokens';

import type { RecentDoc } from './panel-stx';

// =============================================================================
// Animation Config
// =============================================================================

// Snappy spring for toolbar morphing
const snappySpring = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 35,
  mass: 0.8,
};

// Fast transition for items
const fastTransition = {
  duration: 0.15,
  ease: [0.25, 0.1, 0.25, 1] as const,
};

// =============================================================================
// ToolbarItem
// =============================================================================

interface ToolbarItemProps {
  icon?: ReactNode;
  label?: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  variant?: 'default' | 'primary' | 'danger';
}

function ToolbarItem({
  icon,
  label,
  onClick,
  active = false,
  disabled = false,
  variant = 'default',
}: ToolbarItemProps) {
  const variantColors = {
    default: VANTA_COLORS.text.primary,
    primary: VANTA_COLORS.accent.cyan,
    danger: VANTA_COLORS.accent.rose,
  };

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.05 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      onClick={disabled ? undefined : onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: `${VANTA_SPACING['1.5']} ${VANTA_SPACING['2.5']}`,
        borderRadius: VANTA_BORDERS.radius.md,
        border: 'none',
        backgroundColor: active ? VANTA_COLORS.surface.raised : 'transparent',
        color: disabled ? VANTA_COLORS.text.muted : variantColors[variant],
        ...VANTA_TYPOGRAPHY.preset.label,
        textTransform: 'none' as const,
        letterSpacing: '0.02em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: VANTA_ANIMATION.transition.colors,
      }}
    >
      {icon}
      {label && <span>{label}</span>}
    </motion.button>
  );
}

// =============================================================================
// ToolbarDivider
// =============================================================================

interface ToolbarDividerProps {
  vertical?: boolean;
}

function ToolbarDivider({ vertical = true }: ToolbarDividerProps) {
  return (
    <div
      style={{
        width: vertical ? 1 : '100%',
        height: vertical ? 16 : 1,
        backgroundColor: VANTA_COLORS.surface.border,
        margin: vertical
          ? `0 ${VANTA_SPACING['1']}`
          : `${VANTA_SPACING['1']} 0`,
      }}
    />
  );
}

// =============================================================================
// ToolbarGroup
// =============================================================================

interface ToolbarGroupProps {
  children: ReactNode;
  layoutId?: string;
}

function ToolbarGroup({ children, layoutId }: ToolbarGroupProps) {
  return (
    <motion.div
      layoutId={layoutId}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={fastTransition}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
      }}
    >
      {children}
    </motion.div>
  );
}

// =============================================================================
// Document Breadcrumb with Dropdown
// =============================================================================

interface DocumentBreadcrumbProps {
  documentName?: string;
  recentDocs?: readonly RecentDoc[];
  onSelectDoc?: (docId: string) => void;
  onNewDocument?: () => void;
  onOpenDrawer?: () => void;
}

function DocumentBreadcrumb({
  documentName,
  recentDocs = [],
  onSelectDoc,
  onNewDocument,
  onOpenDrawer,
}: DocumentBreadcrumbProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: VANTA_SPACING['1.5'],
            padding: `${VANTA_SPACING['1']} ${VANTA_SPACING['2']}`,
            backgroundColor: VANTA_COLORS.surface.base,
            borderRadius: VANTA_BORDERS.radius.sm,
            border: VANTA_BORDERS.style.hairline,
            cursor: 'pointer',
            transition: VANTA_ANIMATION.transition.all,
          }}
        >
          <DocumentIcon />
          <span
            style={{
              ...VANTA_TYPOGRAPHY.preset.label,
              textTransform: 'none' as const,
              letterSpacing: '0.02em',
              color: VANTA_COLORS.text.primary,
              maxWidth: 120,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {documentName || 'Untitled'}
          </span>
          <ChevronIcon />
        </motion.button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={6}
          align="start"
          style={{
            minWidth: 200,
            backgroundColor: VANTA_COLORS.surface.base,
            border: VANTA_BORDERS.style.default,
            borderRadius: VANTA_BORDERS.radius.md,
            padding: VANTA_SPACING['1'],
            boxShadow: VANTA_BORDERS.shadow.elevated,
            backdropFilter: 'blur(12px)',
            zIndex: 9999,
            animationDuration: '150ms',
            animationTimingFunction: VANTA_ANIMATION.easing.out,
          }}
        >
          {/* Current Document */}
          <DropdownMenu.Label
            style={{
              ...VANTA_TYPOGRAPHY.preset.micro,
              color: VANTA_COLORS.text.muted,
              padding: `${VANTA_SPACING['1.5']} ${VANTA_SPACING['2']}`,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.1em',
            }}
          >
            Current Document
          </DropdownMenu.Label>
          <DropdownMenu.Item
            disabled
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: VANTA_SPACING['2'],
              padding: `${VANTA_SPACING['1.5']} ${VANTA_SPACING['2']}`,
              borderRadius: VANTA_BORDERS.radius.sm,
              ...VANTA_TYPOGRAPHY.preset.cardSubtitle,
              color: VANTA_COLORS.accent.emerald,
              outline: 'none',
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: VANTA_COLORS.accent.emerald,
              }}
            />
            {documentName || 'Untitled'}
          </DropdownMenu.Item>

          <DropdownMenu.Separator
            style={{
              height: 1,
              backgroundColor: VANTA_COLORS.surface.border,
              margin: `${VANTA_SPACING['1.5']} 0`,
            }}
          />

          {/* Recent Documents */}
          {recentDocs.length > 0 && (
            <>
              <DropdownMenu.Label
                style={{
                  ...VANTA_TYPOGRAPHY.preset.micro,
                  color: VANTA_COLORS.text.muted,
                  padding: `${VANTA_SPACING['1.5']} ${VANTA_SPACING['2']}`,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.1em',
                }}
              >
                Recent Documents
              </DropdownMenu.Label>
              {recentDocs.slice(0, 5).map((doc) => (
                <DropdownMenu.Item
                  key={doc.docId}
                  onSelect={() => onSelectDoc?.(doc.docId)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: VANTA_SPACING['2'],
                    padding: `${VANTA_SPACING['1.5']} ${VANTA_SPACING['2']}`,
                    borderRadius: VANTA_BORDERS.radius.sm,
                    ...VANTA_TYPOGRAPHY.preset.cardSubtitle,
                    color: VANTA_COLORS.text.secondary,
                    cursor: 'pointer',
                    outline: 'none',
                    transition: VANTA_ANIMATION.transition.colors,
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor =
                      VANTA_COLORS.surface.elevated;
                    e.currentTarget.style.color = VANTA_COLORS.text.primary;
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = VANTA_COLORS.text.secondary;
                  }}
                >
                  <DocumentIcon small />
                  <span
                    style={{
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {doc.petName}
                  </span>
                </DropdownMenu.Item>
              ))}
              <DropdownMenu.Separator
                style={{
                  height: 1,
                  backgroundColor: VANTA_COLORS.surface.border,
                  margin: `${VANTA_SPACING['1.5']} 0`,
                }}
              />
            </>
          )}

          {/* Actions */}
          <DropdownMenu.Item
            onSelect={() => onNewDocument?.()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: VANTA_SPACING['2'],
              padding: `${VANTA_SPACING['1.5']} ${VANTA_SPACING['2']}`,
              borderRadius: VANTA_BORDERS.radius.sm,
              ...VANTA_TYPOGRAPHY.preset.cardSubtitle,
              color: VANTA_COLORS.accent.cyan,
              cursor: 'pointer',
              outline: 'none',
              transition: VANTA_ANIMATION.transition.colors,
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor =
                VANTA_COLORS.accent.cyanGlow;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <PlusIcon />
            <span>New Document</span>
          </DropdownMenu.Item>

          <DropdownMenu.Item
            onSelect={() => onOpenDrawer?.()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: VANTA_SPACING['2'],
              padding: `${VANTA_SPACING['1.5']} ${VANTA_SPACING['2']}`,
              borderRadius: VANTA_BORDERS.radius.sm,
              ...VANTA_TYPOGRAPHY.preset.cardSubtitle,
              color: VANTA_COLORS.text.secondary,
              cursor: 'pointer',
              outline: 'none',
              transition: VANTA_ANIMATION.transition.colors,
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor =
                VANTA_COLORS.surface.elevated;
              e.currentTarget.style.color = VANTA_COLORS.text.primary;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = VANTA_COLORS.text.secondary;
            }}
          >
            <FolderIcon />
            <span>Browse All...</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

// =============================================================================
// ContextualToolbar
// =============================================================================

export type ToolbarState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'selecting';

interface ContextualToolbarProps {
  /** Unique ID for this toolbar instance — CRITICAL for layout animation isolation */
  id?: string;
  state: ToolbarState;
  onDisconnect?: () => void;
  onOpenDocPicker?: () => void;
  onNewDocument?: () => void;
  onSelectDoc?: (docId: string) => void;
  documentName?: string;
  recentDocs?: readonly RecentDoc[];
  children?: ReactNode;
}

export function ContextualToolbar({
  id,
  state,
  onDisconnect,
  onOpenDocPicker,
  onNewDocument,
  onSelectDoc,
  documentName,
  recentDocs = [],
  children,
}: ContextualToolbarProps) {
  // Generate unique layoutId prefix to prevent cross-panel animation conflicts
  const layoutPrefix = id ? `toolbar-${id}` : 'toolbar-default';

  return (
    <motion.div
      layout
      layoutId={`${layoutPrefix}-container`}
      transition={snappySpring}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: VANTA_SPACING['1'],
        padding: `${VANTA_SPACING['1']} ${VANTA_SPACING['1.5']}`,
        backgroundColor: VANTA_COLORS.surface.elevated,
        borderRadius: VANTA_BORDERS.radius.md,
        border: VANTA_BORDERS.style.hairline,
        backdropFilter: 'blur(12px)',
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {state === 'disconnected' && (
          <ToolbarGroup key="disconnected" layoutId={`${layoutPrefix}-content`}>
            <ToolbarItem
              icon={<FolderIcon />}
              label="Open"
              onClick={onOpenDocPicker}
            />
            <ToolbarDivider />
            <ToolbarItem
              icon={<PlusIcon />}
              label="New"
              onClick={onNewDocument}
              variant="primary"
            />
          </ToolbarGroup>
        )}

        {state === 'connecting' && (
          <ToolbarGroup key="connecting" layoutId={`${layoutPrefix}-content`}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              style={{ display: 'flex', alignItems: 'center' }}
            >
              <SpinnerIcon />
            </motion.div>
            <span
              style={{
                ...VANTA_TYPOGRAPHY.preset.micro,
                color: VANTA_COLORS.text.secondary,
                marginLeft: VANTA_SPACING['1.5'],
              }}
            >
              Connecting...
            </span>
          </ToolbarGroup>
        )}

        {state === 'connected' && (
          <ToolbarGroup key="connected" layoutId={`${layoutPrefix}-content`}>
            <DocumentBreadcrumb
              documentName={documentName}
              recentDocs={recentDocs}
              onSelectDoc={onSelectDoc}
              onNewDocument={onNewDocument}
              onOpenDrawer={onOpenDocPicker}
            />
            <ToolbarDivider />
            {children}
            <ToolbarDivider />
            <ToolbarItem
              icon={<DisconnectIcon />}
              onClick={onDisconnect}
              variant="danger"
            />
          </ToolbarGroup>
        )}

        {state === 'selecting' && (
          <ToolbarGroup key="selecting" layoutId={`${layoutPrefix}-content`}>
            <span
              style={{
                ...VANTA_TYPOGRAPHY.preset.micro,
                color: VANTA_COLORS.text.secondary,
                padding: `${VANTA_SPACING['1']} ${VANTA_SPACING['2']}`,
              }}
            >
              Select document...
            </span>
          </ToolbarGroup>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// =============================================================================
// Icons (12x12 / 14x14 for toolbar)
// =============================================================================

function FolderIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke={VANTA_COLORS.accent.cyan}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function DocumentIcon({ small }: { small?: boolean }) {
  const size = small ? 12 : 12;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={VANTA_COLORS.accent.emerald}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke={VANTA_COLORS.text.muted}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function DisconnectIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
      <line x1="12" y1="2" x2="12" y2="12" />
    </svg>
  );
}

export { ToolbarItem, ToolbarDivider, ToolbarGroup };
