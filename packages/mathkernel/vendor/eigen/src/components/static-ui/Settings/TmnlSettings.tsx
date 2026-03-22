/**
 * TmnlSettings
 *
 * Multi-paged settings modal in vantablack Tmnl UI style.
 * Slot-based page system with sidebar navigation.
 *
 * @module
 */

import { useState, useEffect, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Settings, Keyboard, Palette, Monitor, Volume2, Zap } from 'lucide-react'
import { Label, Body, Separator } from '@/components/primitives'
import { HotkeysPage } from './pages'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SettingsPage {
  id: string
  label: string
  icon: ReactNode
  content: ReactNode
}

export interface TmnlSettingsProps {
  open: boolean
  onClose: () => void
  /** Override default pages with custom pages */
  pages?: SettingsPage[]
  /** Initial page ID */
  initialPage?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Default Pages (placeholders)
// ─────────────────────────────────────────────────────────────────────────────

const GeneralPageContent = () => (
  <div className="space-y-6">
    <div>
      <h3 className="text-neutral-300 font-semibold mb-4" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
        APPLICATION
      </h3>
      <div className="space-y-4">
        <SettingRow label="Auto-save" description="Automatically save changes">
          <ToggleSwitch checked={true} />
        </SettingRow>
        <SettingRow label="Startup page" description="Default view on launch">
          <Select options={['Canvas', 'Playground', 'Testbed']} value="Canvas" />
        </SettingRow>
      </div>
    </div>
    <Separator />
    <div>
      <h3 className="text-neutral-300 font-semibold mb-4" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
        DATA
      </h3>
      <div className="space-y-4">
        <SettingRow label="Cache duration" description="How long to cache API responses">
          <Select options={['5 minutes', '15 minutes', '1 hour', 'Forever']} value="15 minutes" />
        </SettingRow>
      </div>
    </div>
  </div>
)

const AppearancePageContent = () => (
  <div className="space-y-6">
    <div>
      <h3 className="text-neutral-300 font-semibold mb-4" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
        THEME
      </h3>
      <div className="space-y-4">
        <SettingRow label="Color mode" description="Vantablack is the only way">
          <Select options={['Vantablack', 'Vantablack', 'Still Vantablack']} value="Vantablack" />
        </SettingRow>
        <SettingRow label="Accent color" description="Highlight color">
          <ColorPicker color="#67e8f9" />
        </SettingRow>
      </div>
    </div>
    <Separator />
    <div>
      <h3 className="text-neutral-300 font-semibold mb-4" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
        TYPOGRAPHY
      </h3>
      <div className="space-y-4">
        <SettingRow label="Font scale" description="Base font size multiplier">
          <Select options={['90%', '100%', '110%', '120%']} value="100%" />
        </SettingRow>
      </div>
    </div>
  </div>
)

const AudioPageContent = () => (
  <div className="space-y-6">
    <div>
      <h3 className="text-neutral-300 font-semibold mb-4" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
        SOUNDS
      </h3>
      <div className="space-y-4">
        <SettingRow label="UI sounds" description="Play sounds on interactions">
          <ToggleSwitch checked={false} />
        </SettingRow>
        <SettingRow label="Notifications" description="Sound alerts for events">
          <ToggleSwitch checked={true} />
        </SettingRow>
      </div>
    </div>
  </div>
)

const PerformancePageContent = () => (
  <div className="space-y-6">
    <div>
      <h3 className="text-neutral-300 font-semibold mb-4" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
        RENDERING
      </h3>
      <div className="space-y-4">
        <SettingRow label="Hardware acceleration" description="Use GPU for rendering">
          <ToggleSwitch checked={true} />
        </SettingRow>
        <SettingRow label="Animations" description="Enable UI animations">
          <ToggleSwitch checked={true} />
        </SettingRow>
        <SettingRow label="Reduce motion" description="Minimize animations for accessibility">
          <ToggleSwitch checked={false} />
        </SettingRow>
      </div>
    </div>
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// Primitive Components
// ─────────────────────────────────────────────────────────────────────────────

interface SettingRowProps {
  label: string
  description?: string
  children: ReactNode
}

function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1">
        <div className="text-neutral-200" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
          {label}
        </div>
        {description && (
          <div className="text-neutral-500 mt-0.5" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            {description}
          </div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange?: (v: boolean) => void }) {
  const [isChecked, setIsChecked] = useState(checked)
  return (
    <button
      onClick={() => {
        setIsChecked(!isChecked)
        onChange?.(!isChecked)
      }}
      className={`
        relative w-10 h-5 rounded-sm transition-colors
        ${isChecked ? 'bg-cyan-500/30 border-cyan-500' : 'bg-neutral-800 border-neutral-700'}
        border
      `}
    >
      <div
        className={`
          absolute top-0.5 w-4 h-4 rounded-sm transition-all
          ${isChecked ? 'left-5 bg-cyan-400' : 'left-0.5 bg-neutral-500'}
        `}
      />
    </button>
  )
}

function Select({ options, value }: { options: string[]; value: string }) {
  const [selected, setSelected] = useState(value)
  return (
    <select
      value={selected}
      onChange={(e) => setSelected(e.target.value)}
      className="bg-neutral-900 border border-neutral-700 text-neutral-300 px-2 py-1 rounded-sm cursor-pointer hover:border-neutral-600 transition-colors"
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  )
}

function ColorPicker({ color }: { color: string }) {
  const [current, setCurrent] = useState(color)
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        className="w-6 h-6 rounded-sm border border-neutral-700 cursor-pointer bg-transparent"
      />
      <span className="text-neutral-500 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
        {current.toUpperCase()}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Navigation Item
// ─────────────────────────────────────────────────────────────────────────────

interface NavItemProps {
  page: SettingsPage
  isActive: boolean
  onClick: () => void
}

function NavItem({ page, isActive, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-3 py-2 text-left transition-colors
        ${isActive
          ? 'bg-neutral-800/50 text-cyan-400 border-l-2 border-cyan-400'
          : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900/50 border-l-2 border-transparent'
        }
      `}
      style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
    >
      <span className={isActive ? 'text-cyan-400' : 'text-neutral-600'}>{page.icon}</span>
      <span className="font-medium">{page.label}</span>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function TmnlSettings({ open, onClose, pages: customPages, initialPage }: TmnlSettingsProps) {
  // Default pages if none provided
  const defaultPages: SettingsPage[] = [
    { id: 'general', label: 'General', icon: <Settings size={16} />, content: <GeneralPageContent /> },
    { id: 'hotkeys', label: 'Hotkeys', icon: <Keyboard size={16} />, content: <HotkeysPage /> },
    { id: 'appearance', label: 'Appearance', icon: <Palette size={16} />, content: <AppearancePageContent /> },
    { id: 'performance', label: 'Performance', icon: <Zap size={16} />, content: <PerformancePageContent /> },
    { id: 'audio', label: 'Audio', icon: <Volume2 size={16} />, content: <AudioPageContent /> },
  ]

  const pages = customPages ?? defaultPages
  const [activePage, setActivePage] = useState(initialPage ?? pages[0]?.id ?? 'general')

  const currentPage = pages.find((p) => p.id === activePage) ?? pages[0]

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/90 z-50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-8 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-black border border-neutral-800 w-full max-w-4xl h-[600px] pointer-events-auto flex flex-col"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 shrink-0">
                <div className="flex items-center gap-3">
                  <Settings size={16} className="text-neutral-600" />
                  <span
                    className="text-neutral-200 font-semibold tracking-wider uppercase"
                    style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
                  >
                    Settings
                  </span>
                </div>
                <button
                  onClick={onClose}
                  className="text-neutral-600 hover:text-white transition-colors p-1"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Body */}
              <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <nav className="w-48 border-r border-neutral-800 py-2 shrink-0">
                  {pages.map((page) => (
                    <NavItem
                      key={page.id}
                      page={page}
                      isActive={activePage === page.id}
                      onClick={() => setActivePage(page.id)}
                    />
                  ))}
                </nav>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activePage}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.15 }}
                    >
                      {currentPage?.content}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-800 shrink-0">
                <div className="text-neutral-600" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                  <kbd className="bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-700">ESC</kbd>
                  <span className="ml-2">to close</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={onClose}
                    className="px-3 py-1.5 text-neutral-400 hover:text-white transition-colors border border-neutral-700 hover:border-neutral-600"
                    style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onClose}
                    className="px-3 py-1.5 text-black bg-cyan-400 hover:bg-cyan-300 transition-colors"
                    style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                  >
                    Save
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default TmnlSettings
