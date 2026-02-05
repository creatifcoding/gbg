/**
 * Isolation Modal
 *
 * Full-screen modal for focused component design.
 * Shows component in center with AI chat panel on side.
 * Supports live edit sessions with git worktree isolation.
 */

import { useCallback, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import type { IsolationModalProps, PropDoc } from './types'
import { SourceViewer } from './SourceViewer'
import { IsolationChat } from './IsolationChat'
import {
  SessionProvider,
  SessionSwitcher,
  SessionAwareChat,
} from '@/lib/ai-core'

// NOTE: Edit session atoms temporarily disabled due to Effect/Atom type complexity
// TODO: Wire up once service layer types are fixed
// import { activeSessionAtom, editSessionOps, editSessionRegistry } from './atoms'

// =============================================================================
// Prop Documentation Table
// =============================================================================

function PropDocsTable({ propDocs }: { propDocs: PropDoc[] }) {
  if (propDocs.length === 0) return null

  return (
    <div
      style={{
        border: '2px solid #000',
        background: '#fff',
      }}
    >
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '2px solid #000',
          fontWeight: 700,
          textTransform: 'uppercase',
          fontSize: '12px',
        }}
      >
        Props
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            <th
              style={{
                textAlign: 'left',
                padding: '6px 10px',
                fontSize: '11px',
                textTransform: 'uppercase',
                fontWeight: 600,
                borderBottom: '1px solid #ddd',
              }}
            >
              Name
            </th>
            <th
              style={{
                textAlign: 'left',
                padding: '6px 10px',
                fontSize: '11px',
                textTransform: 'uppercase',
                fontWeight: 600,
                borderBottom: '1px solid #ddd',
              }}
            >
              Type
            </th>
            <th
              style={{
                textAlign: 'left',
                padding: '6px 10px',
                fontSize: '11px',
                textTransform: 'uppercase',
                fontWeight: 600,
                borderBottom: '1px solid #ddd',
              }}
            >
              Default
            </th>
            <th
              style={{
                textAlign: 'left',
                padding: '6px 10px',
                fontSize: '11px',
                textTransform: 'uppercase',
                fontWeight: 600,
                borderBottom: '1px solid #ddd',
              }}
            >
              Description
            </th>
          </tr>
        </thead>
        <tbody>
          {propDocs.map((prop) => (
            <tr key={prop.name}>
              <td
                style={{
                  padding: '6px 10px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  borderBottom: '1px solid #eee',
                }}
              >
                {prop.name}
                {prop.required && (
                  <span style={{ color: '#e11d48' }}>*</span>
                )}
              </td>
              <td
                style={{
                  padding: '6px 10px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  color: '#666',
                  borderBottom: '1px solid #eee',
                }}
              >
                {prop.type}
              </td>
              <td
                style={{
                  padding: '6px 10px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  color: '#888',
                  borderBottom: '1px solid #eee',
                }}
              >
                {prop.default ?? '—'}
              </td>
              <td
                style={{
                  padding: '6px 10px',
                  fontSize: '12px',
                  color: '#444',
                  borderBottom: '1px solid #eee',
                }}
              >
                {prop.description ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// =============================================================================
// Isolation Modal Component
// =============================================================================

export function IsolationModal({
  open,
  onOpenChange,
  label,
  description,
  propDocs,
  source,
  children,
  onDesignAction,
}: IsolationModalProps) {
  // Placeholder session state - will be replaced with atoms once types are fixed
  const [hasSession, setHasSession] = useState(false)
  const [previewPort, setPreviewPort] = useState<number | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Component ID for session
  const componentId = label.toLowerCase().replace(/[^a-z0-9]+/g, '-')

  // Placeholder session handlers - will be replaced with atom operations
  const handleStartSession = useCallback(async () => {
    setIsStarting(true)
    // TODO: Wire up editSessionOps.startSession(componentId)
    // For now, simulate session start
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setHasSession(true)
    setPreviewPort(5200)
    setIsStarting(false)
  }, [componentId])

  const handleSaveSession = useCallback(async () => {
    setIsSaving(true)
    // TODO: Wire up editSessionOps.saveSession
    await new Promise((resolve) => setTimeout(resolve, 500))
    setHasSession(false)
    setPreviewPort(null)
    setIsSaving(false)
  }, [])

  const handleDiscardSession = useCallback(async () => {
    // TODO: Wire up editSessionOps.discardSession
    setHasSession(false)
    setPreviewPort(null)
  }, [])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Backdrop */}
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(4px)',
            zIndex: 9998,
          }}
        />

        {/* Content */}
        <Dialog.Content
          style={{
            position: 'fixed',
            inset: '20px',
            background: '#e6e6e6',
            border: '4px solid #000',
            boxShadow: '8px 8px 0 #000',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              borderBottom: '3px solid #000',
              background: '#fff',
              flexShrink: 0,
            }}
          >
            <div>
              <Dialog.Title
                style={{
                  margin: 0,
                  fontSize: '24px',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '-0.02em',
                }}
              >
                {label}
              </Dialog.Title>
              {description && (
                <Dialog.Description
                  style={{
                    margin: '4px 0 0 0',
                    fontSize: '13px',
                    color: '#666',
                  }}
                >
                  {description}
                </Dialog.Description>
              )}
            </div>
            {/* Session Controls */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {!hasSession ? (
                <button
                  onClick={handleStartSession}
                  disabled={isStarting}
                  style={{
                    background: '#10b981',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    cursor: isStarting ? 'wait' : 'pointer',
                    opacity: isStarting ? 0.7 : 1,
                  }}
                >
                  {isStarting ? '● STARTING...' : '▶ START EDIT'}
                </button>
              ) : (
                <>
                  {previewPort && (
                    <span
                      style={{
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        color: '#10b981',
                        padding: '4px 8px',
                        background: '#ecfdf5',
                        border: '1px solid #10b981',
                      }}
                    >
                      :{previewPort}
                    </span>
                  )}
                  <button
                    onClick={handleSaveSession}
                    disabled={isSaving}
                    style={{
                      background: '#3b82f6',
                      color: '#fff',
                      border: 'none',
                      padding: '8px 16px',
                      fontSize: '12px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      cursor: isSaving ? 'wait' : 'pointer',
                      opacity: isSaving ? 0.7 : 1,
                    }}
                  >
                    {isSaving ? '● SAVING...' : '✓ SAVE'}
                  </button>
                  <button
                    onClick={handleDiscardSession}
                    style={{
                      background: '#ef4444',
                      color: '#fff',
                      border: 'none',
                      padding: '8px 16px',
                      fontSize: '12px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                    }}
                  >
                    ✕ DISCARD
                  </button>
                </>
              )}
              <Dialog.Close
                style={{
                  background: '#000',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 16px',
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  marginLeft: '8px',
                }}
              >
                ✕ CLOSE
              </Dialog.Close>
            </div>
          </div>

          {/* Resizable Panels Container */}
          <ResizablePanelGroup
            direction="horizontal"
            style={{ flex: 1, overflow: 'hidden' }}
          >
            {/* Main Content - Component Preview */}
            <ResizablePanel defaultSize={65} minSize={30}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                  padding: '20px',
                  overflow: 'auto',
                  height: '100%',
                }}
              >
                {/* Live Preview */}
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#fff',
                    border: '2px solid #000',
                    padding: '40px',
                    minHeight: '200px',
                  }}
                >
                  {children}
                </div>

                {/* Props Documentation */}
                {propDocs && propDocs.length > 0 && (
                  <PropDocsTable propDocs={propDocs} />
                )}

                {/* Source Code */}
                {source && (
                  <SourceViewer source={source} maxHeight={400} />
                )}
              </div>
            </ResizablePanel>

            {/* Resize Handle */}
            <ResizableHandle
              withHandle
              style={{
                background: '#000',
                width: '3px',
              }}
            />

            {/* Right Panel - AI Chat with Sessions */}
            <ResizablePanel defaultSize={35} minSize={20} maxSize={60}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  background: '#0a0a0a',
                  height: '100%',
                  overflow: 'hidden',
                }}
              >
                <SessionProvider>
                  <SessionSwitcher>
                    <SessionAwareChat
                      label={label}
                      componentId={componentId}
                      renderChat={({ messages, onUpdateMessages, setStreaming }) => (
                        <IsolationChat
                          label={label}
                          componentId={componentId}
                          description={description}
                          propDocs={propDocs}
                          source={source}
                          onDesignAction={onDesignAction}
                          externalMessages={messages}
                          onMessagesChange={onUpdateMessages}
                          onStreamingChange={setStreaming}
                        />
                      )}
                    />
                  </SessionSwitcher>
                </SessionProvider>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default IsolationModal
