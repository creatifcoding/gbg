/**
 * Enhanced ComponentBox
 *
 * Displays a component with:
 * - Description (supports markdown)
 * - Live preview
 * - Source code (from Vite plugin or manual)
 * - Isolate button for full-screen focus
 * - Design mode integration (style/prop overrides)
 * - Component registration with TestbedProvider
 */

import * as React from 'react'
import type { ComponentBoxProps, PropDoc } from './types'
import { useComponentSource } from './source-registry'
import { SourceViewer } from './SourceViewer'
import { IsolationModal } from './IsolationModal'
import { useTestbedOptional } from './TestbedProvider'
import { useComponentDesignStateOptional } from './useDesignMode'

// =============================================================================
// Helper: Label to ID
// =============================================================================

function labelToId(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// =============================================================================
// Prop Docs Inline Display
// =============================================================================

function PropDocsInline({ propDocs }: { propDocs: PropDoc[] }) {
  if (propDocs.length === 0) return null

  return (
    <div
      style={{
        marginTop: '10px',
        padding: '8px 10px',
        background: '#f9f9f9',
        border: '1px solid #e5e5e5',
        fontSize: '11px',
      }}
    >
      <div
        style={{
          fontWeight: 600,
          textTransform: 'uppercase',
          color: '#666',
          marginBottom: '6px',
          fontSize: '10px',
        }}
      >
        Props
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {propDocs.map((prop) => (
          <span
            key={prop.name}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 6px',
              background: '#fff',
              border: '1px solid #ddd',
              fontFamily: 'monospace',
              fontSize: '10px',
            }}
            title={prop.description}
          >
            <span style={{ fontWeight: 600 }}>{prop.name}</span>
            <span style={{ color: '#888' }}>:</span>
            <span style={{ color: '#666' }}>{prop.type}</span>
            {prop.default && (
              <span style={{ color: '#999' }}>= {prop.default}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// ComponentBox Component
// =============================================================================

export function ComponentBox({
  id,
  label,
  description,
  propDocs,
  children,
  source: manualSource,
  isolatable = true,
  showSource = true,
  style,
  className,
  minWidth = 200,
}: ComponentBoxProps) {
  const [isIsolated, setIsIsolated] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Derive id from label if not provided
  const componentId = id ?? labelToId(label)

  // Get source from registry (or use manual override)
  const registrySource = useComponentSource(componentId)
  const source = manualSource ?? registrySource

  // Testbed context (optional - works outside provider too)
  const testbedCtx = useTestbedOptional()
  const designState = useComponentDesignStateOptional(componentId)

  // Extract stable function references to prevent infinite loops
  // Per Vercel React best practices: rerender-dependencies (use primitives)
  // The context object changes when components state updates, but the functions are stable
  const registerComponent = testbedCtx?.registerComponent
  const unregisterComponent = testbedCtx?.unregisterComponent

  // Stabilize propDocs reference to prevent infinite re-renders
  const propDocsKey = React.useMemo(
    () => (propDocs ? JSON.stringify(propDocs) : ''),
    [propDocs]
  )

  // Register component with testbed provider
  React.useEffect(() => {
    if (!registerComponent || !unregisterComponent) return

    registerComponent({
      id: componentId,
      label,
      description,
      propDocs,
      source: source ?? undefined,
      ref: containerRef.current ?? undefined,
    })

    return () => {
      unregisterComponent(componentId)
    }
    // Use stable function refs and propDocsKey to prevent infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerComponent, unregisterComponent, componentId, label, description, propDocsKey, source])

  // Selection handling for design mode
  const handleClick = React.useCallback(
    (e: React.MouseEvent) => {
      if (designState?.designModeActive) {
        e.stopPropagation()
        designState.select()
      }
    },
    [designState]
  )

  // Compute style with design overrides
  const computedStyle: React.CSSProperties = {
    padding: '20px',
    border: '1px solid #ddd',
    background: '#fff',
    minWidth,
    display: 'flex',
    flexDirection: 'column',
    ...style,
    // Apply design mode overrides
    ...(designState?.styleOverrides ?? {}),
    // Selection highlight
    ...(designState?.isSelected
      ? {
          outline: '2px solid #3b82f6',
          outlineOffset: '2px',
        }
      : {}),
  }

  // Design mode indicator
  const isInDesignMode = designState?.designModeActive ?? false
  const hasOverrides =
    (designState?.styleOverrides && Object.keys(designState.styleOverrides).length > 0) ||
    (designState?.propOverrides && Object.keys(designState.propOverrides).length > 0)

  return (
    <>
      <div
        ref={containerRef}
        className={className}
        style={computedStyle}
        onClick={handleClick}
        data-testbed-id={componentId}
        data-design-mode={isInDesignMode ? 'true' : undefined}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '15px',
          }}
        >
          <div
            style={{
              fontFamily: "'Courier New', monospace",
              fontSize: '12px',
              textTransform: 'uppercase',
              color: '#666',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {label}
            {/* Design mode indicators */}
            {isInDesignMode && hasOverrides && (
              <span
                style={{
                  fontSize: '12px',
                  color: '#3b82f6',
                  fontWeight: 'bold',
                }}
                title="Has design overrides"
              >
                *
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {/* Reset button (design mode only) */}
            {isInDesignMode && hasOverrides && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  designState?.reset()
                }}
                style={{
                  background: 'none',
                  border: '1px solid #ef4444',
                  padding: '2px 6px',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  color: '#ef4444',
                  cursor: 'pointer',
                }}
                title="Reset design overrides"
              >
                RESET
              </button>
            )}
            {isolatable && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsIsolated(true)
                }}
                style={{
                  background: 'none',
                  border: '1px solid #ddd',
                  padding: '2px 6px',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  color: '#888',
                  cursor: 'pointer',
                }}
                title="Open in isolation mode"
              >
                ISOLATE
              </button>
            )}
          </div>
        </div>

        {/* Description */}
        {description && (
          <div
            style={{
              fontSize: '12px',
              color: '#444',
              marginBottom: '15px',
              lineHeight: '1.4',
            }}
          >
            {description}
          </div>
        )}

        {/* Prop Docs */}
        {propDocs && propDocs.length > 0 && (
          <PropDocsInline propDocs={propDocs} />
        )}

        {/* Live Preview */}
        <div
          style={{
            marginTop: propDocs || description ? '15px' : 0,
            padding: '15px',
            background: '#f9f9f9',
            border: '1px dashed #ddd',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60px',
          }}
        >
          {children}
        </div>

        {/* Source Code */}
        {showSource && source && (
          <div style={{ marginTop: '15px' }}>
            <SourceViewer
              source={source}
              collapsed={true}
              maxHeight={200}
            />
          </div>
        )}
      </div>

      {/* Isolation Modal */}
      {isolatable && (
        <IsolationModal
          open={isIsolated}
          onOpenChange={setIsIsolated}
          label={label}
          description={description}
          propDocs={propDocs}
          source={source ?? undefined}
        >
          {children}
        </IsolationModal>
      )}
    </>
  )
}

export default ComponentBox
