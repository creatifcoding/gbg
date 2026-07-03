/**
 * BarLayout — Blacked-out machined aluminum panel.
 *
 * The persistent layer-shell surface is 48px wide:
 *   [0–48px] = bar strip (anodized black alu, exclusive zone)
 * Popovers and overlays request temporary surface expansion through the
 * Tauri resize/input-region bridge; there is no permanent 400px slab.
 *
 * Skeuomorphic details:
 *   - Micro-noise grain texture (anodized surface)
 *   - Machined chamfer on right edge (specular highlight)
 *   - Milled groove dividers between sections
 *   - Inset indicator wells with inner shadow
 *   - Subtle convex curvature gradient
 *   - Endcap details at top/bottom
 */

import React, { type ReactNode, useState, useEffect } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'motion/react'
import { TMNL_FONT_SIZE } from '@/lib/tmnl-ui/tokens'
import { FUI_COLORS } from '@/lib/fui/tokens'
import { useClockTick, useCompositorSync } from '@/lib/getbyshell'
import { BAR_WIDTH } from '@/lib/getbyshell/popover'

// ─── Vantablack Tokens ──────────────────────────────────────────────────────

const dense = (value: number, _floor = 0) => value
const densePx = (value: number, _floor = 0) => `${value}px`

export const V = {
  void: FUI_COLORS.vantablack,
  surface: '#060608',
  raised: '#0c0c10',
  panel: '#0a0b0f',

  // Machined aluminum highlights
  specular: 'rgba(255, 255, 255, 0.045)',
  specularHot: 'rgba(255, 255, 255, 0.07)',
  groove: 'rgba(255, 255, 255, 0.035)',
  grooveShadow: 'rgba(0, 0, 0, 0.6)',
  insetShadow: 'rgba(0, 0, 0, 0.5)',
  insetHighlight: 'rgba(255, 255, 255, 0.025)',

  phosphor: '#7ec8b0',
  phosphorMid: '#4a7a68',
  phosphorDim: '#2a4a3c',
  phosphorGhost: 'rgba(126, 200, 176, 0.06)',
  phosphorGlow: 'rgba(126, 200, 176, 0.15)',

  amber: '#c8a87e',
  amberGlow: 'rgba(200, 168, 126, 0.10)',

  alert: '#c87e7e',
  alertGlow: 'rgba(200, 126, 126, 0.12)',

  ink: '#b8bcc6',
  inkMid: '#5a6070',
  inkFaint: '#2a2e38',
  inkGhost: '#161820',

  border: FUI_COLORS.border,
  borderHover: FUI_COLORS.borderHover,

  xs: TMNL_FONT_SIZE.xs,
  sm: TMNL_FONT_SIZE.sm,
} as const

// ─── Noise Texture (inline SVG data URI) ────────────────────────────────────
// Tiny 100×100 feTurbulence grain → anodized aluminum surface feel.
// Rendered once, tiled via CSS. Nearly invisible at 3-4% opacity.

const NOISE_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E")`

// ─── Milled Groove Divider ──────────────────────────────────────────────────
// Two-line groove: dark slot with specular highlight below.
// Simulates a CNC-cut channel in the panel surface.

function MilledGroove() {
  return (
    <div style={{
      width: '100%',
      padding: `0 ${densePx(6, 3)}`,
    }}>
      <div style={{
        width: '100%',
        height: dense(3, 2),
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Shadow slot (top) */}
        <div style={{
          height: 1,
          background: `linear-gradient(90deg,
            transparent 0%,
            ${V.grooveShadow} 20%,
            ${V.grooveShadow} 80%,
            transparent 100%
          )`,
        }} />
        {/* Specular highlight (bottom catch light) */}
        <div style={{
          height: 1,
          background: `linear-gradient(90deg,
            transparent 0%,
            ${V.groove} 15%,
            ${V.specular} 50%,
            ${V.groove} 85%,
            transparent 100%
          )`,
        }} />
        {/* Phosphor trace in the groove — barely there */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: '20%',
          right: '20%',
          height: 1,
          background: `linear-gradient(90deg,
            transparent 0%,
            ${V.phosphorDim}12 35%,
            ${V.phosphorDim}18 50%,
            ${V.phosphorDim}12 65%,
            transparent 100%
          )`,
          opacity: 0.5,
        }} />
      </div>
    </div>
  )
}

// ─── Inset Well ─────────────────────────────────────────────────────────────
// Wraps indicator zones in a recessed cavity with inner shadow.
// Like an LED or gauge set into a milled panel recess.

function InsetWell({ children, compact }: { children: ReactNode; compact?: boolean }) {
  return (
    <div style={{
      position: 'relative',
      borderRadius: dense(4, 3),
      margin: compact
        ? `${densePx(2, 1)} ${densePx(5, 3)}`
        : `${densePx(4, 2)} ${densePx(5, 3)}`,
      padding: compact ? `${densePx(4, 2)} 0` : `${densePx(6, 3)} 0`,
      // Inner shadow = recessed into surface
      boxShadow: `
        inset 0 1px 2px ${V.insetShadow},
        inset 0 -1px 0 ${V.insetHighlight},
        0 1px 0 ${V.insetHighlight}
      `,
      background: 'rgba(0, 0, 0, 0.25)',
    }}>
      {children}
    </div>
  )
}

// ─── Endcap Detail ──────────────────────────────────────────────────────────
// Tiny machined detail at top and bottom of the bar strip — like
// the radius on the edge of a milled billet. Decorative only.

function Endcap({ position }: { position: 'top' | 'bottom' }) {
  const isTop = position === 'top'
  return (
    <div style={{
      width: '100%',
      height: dense(3, 2),
      background: isTop
        ? `linear-gradient(180deg, ${V.specular} 0%, transparent 100%)`
        : `linear-gradient(0deg, ${V.specular} 0%, transparent 100%)`,
      flexShrink: 0,
    }} />
  )
}

// ─── Mounting Pin ───────────────────────────────────────────────────────────
// Tiny countersunk screw/pin detail. Purely decorative chrome.

function MountingPin() {
  return (
    <div style={{
      width: dense(4, 3),
      height: dense(4, 3),
      borderRadius: '50%',
      background: `radial-gradient(circle at 35% 35%, 
        ${V.specularHot} 0%, 
        rgba(30,30,35,1) 50%, 
        rgba(15,15,18,1) 100%
      )`,
      boxShadow: `
        inset 0 0.5px 0 ${V.insetHighlight},
        0 0.5px 1px ${V.insetShadow}
      `,
      flexShrink: 0,
    }} />
  )
}

// ─── Slots ──────────────────────────────────────────────────────────────────

function Top({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: dense(6, 3),
        paddingBottom: dense(4, 2),
        width: '100%',
      }}
    >
      <InsetWell>
        {children}
      </InsetWell>
      <MilledGroove />
    </motion.div>
  )
}

function Center({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.12 }}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        gap: dense(6, 3),
      }}
    >
      {React.Children.map(children, (child) => (
        <InsetWell compact>{child}</InsetWell>
      ))}
    </motion.div>
  )
}

function Bottom({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: dense(4, 2),
        paddingBottom: dense(8, 4),
        width: '100%',
        gap: dense(4, 2),
      }}
    >
      <MilledGroove />
      <InsetWell>
        {children}
      </InsetWell>
    </motion.div>
  )
}

// ─── Scanline Materializer ───────────────────────────────────────────────────
// CRT-style boot: a bright phosphor scanline sweeps top→bottom.
// Content behind it materializes row by row, like pixels assembling.
// The scanline leaves a fading phosphor trail.
// Total: ~1.4s sweep + 0.3s afterglow fade.

function ScanlineMaterializer({ children }: { children: ReactNode }) {
  const [booted, setBooted] = useState(false)
  const scanY = useMotionValue(0)

  // Scanline position as CSS top %
  const scanTop = useTransform(scanY, (y) => `${y}%`)

  useEffect(() => {
    const ctrl = animate(scanY, 100, {
      duration: 1.4,
      ease: [0.25, 0.1, 0.25, 1],
      onComplete: () => setBooted(true),
    })
    return () => ctrl.stop()
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Content is always visible. The scanline is decorative only; masking
          can leave WebKitGTK layer-shell surfaces permanently blank. */}
      <motion.div
        style={{
          width: '100%',
          height: '100%',
        }}
      >
        {children}
      </motion.div>

      {/* Scanline beam — bright phosphor line */}
      {!booted && (
        <motion.div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: scanTop,
            height: 2,
            background: `linear-gradient(90deg,
              transparent 0%,
              ${V.phosphor}90 15%,
              ${V.phosphor} 50%,
              ${V.phosphor}90 85%,
              transparent 100%
            )`,
            boxShadow: `
              0 0 8px 2px ${V.phosphor}50,
              0 0 20px 4px ${V.phosphorDim}30,
              0 -3px 12px 1px ${V.phosphorGhost},
              0 3px 12px 1px ${V.phosphorGhost}
            `,
            pointerEvents: 'none',
            zIndex: 50,
          }}
        />
      )}

      {/* Trailing afterglow — faint phosphor wash behind the beam */}
      {!booted && (
        <motion.div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: scanTop,
            background: `linear-gradient(180deg,
              transparent 60%,
              ${V.phosphor}06 85%,
              ${V.phosphor}12 100%
            )`,
            pointerEvents: 'none',
            zIndex: 49,
          }}
        />
      )}

      {/* Final afterglow fade — whole bar flashes briefly after complete */}
      {booted && (
        <motion.div
          initial={{ opacity: 0.08 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            inset: 0,
            background: V.phosphor,
            pointerEvents: 'none',
            zIndex: 49,
          }}
        />
      )}
    </div>
  )
}

// ─── Root ───────────────────────────────────────────────────────────────────

function useLayerShellViewportCompensation() {
  const measureMetrics = () => {
    const rootRect = document.getElementById('root')?.getBoundingClientRect()
    const rawWidth = Math.abs(rootRect?.width || window.innerWidth || BAR_WIDTH)
    const scale = rawWidth > 100_000 ? rawWidth / BAR_WIDTH : 1
    const screenHeight = Math.max(
      480,
      Math.round(
        window.screen?.height
          || Math.abs(window.outerHeight)
          || Math.abs(rootRect?.height || 0) / scale
          || 900,
      ),
    )

    return { scale, height: screenHeight }
  }

  const [metrics, setMetrics] = useState({ scale: 1, height: 900 })

  useEffect(() => {
    const measure = () => setMetrics(measureMetrics())
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  return metrics
}

export function BarLayout({ children }: { children: ReactNode }) {
  useCompositorSync()
  useClockTick()
  const viewport = useLayerShellViewportCompensation()

  return (
    <div data-tmnl-bar-root="true" style={{
      position: 'fixed',
      left: 0,
      top: 0,
      width: BAR_WIDTH * viewport.scale,
      height: viewport.height * viewport.scale,
      minHeight: viewport.height * viewport.scale,
      background: V.void,
      overflow: 'hidden',
      overscrollBehavior: 'none',
      zIndex: 2147483646,
      isolation: 'isolate',
    }}>
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: BAR_WIDTH,
        height: viewport.height,
        minHeight: viewport.height,
        zoom: viewport.scale,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        userSelect: 'none',
        WebkitUserSelect: 'none',
        overflow: 'hidden',
        overscrollBehavior: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        {/* Layer 1: Convex curvature gradient — subtle cylindrical surface */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(90deg,
            rgba(255,255,255,0.012) 0%,
            rgba(255,255,255,0.025) 35%,
            rgba(255,255,255,0.018) 55%,
            rgba(255,255,255,0.005) 85%,
            transparent 100%
          )`,
          pointerEvents: 'none',
          zIndex: 1,
        }} />

        {/* Layer 2: Vertical ambient gradient — top-lit */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(180deg,
            rgba(255,255,255,0.015) 0%,
            transparent 15%,
            transparent 85%,
            rgba(0,0,0,0.1) 100%
          )`,
          pointerEvents: 'none',
          zIndex: 2,
        }} />

        {/* Layer 3: Micro-noise grain (anodized surface texture) */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: NOISE_SVG,
          backgroundRepeat: 'repeat',
          mixBlendMode: 'overlay',
          opacity: 0.6,
          pointerEvents: 'none',
          zIndex: 3,
        }} />

        {/* Right edge: Machined chamfer — specular highlight strip */}
        <div style={{
          position: 'absolute',
          top: dense(4, 2),
          right: 0,
          bottom: dense(4, 2),
          width: dense(3, 2),
          background: `linear-gradient(90deg,
            transparent 0%,
            ${V.specular} 40%,
            ${V.specularHot} 100%
          )`,
          pointerEvents: 'none',
          zIndex: 20,
        }} />

        {/* Right edge: Phosphor trace in the chamfer */}
        <div style={{
          position: 'absolute',
          top: '10%',
          right: 0,
          bottom: '10%',
          width: 1,
          background: `linear-gradient(180deg,
            transparent 0%,
            ${V.phosphorDim}20 15%,
            ${V.phosphorDim}14 50%,
            ${V.phosphorDim}20 85%,
            transparent 100%
          )`,
          pointerEvents: 'none',
          zIndex: 21,
        }} />

        {/* Left edge: Very subtle inner shadow — panel depth */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: 4,
          background: `linear-gradient(90deg,
            rgba(0,0,0,0.15) 0%,
            transparent 100%
          )`,
          pointerEvents: 'none',
          zIndex: 4,
        }} />

        {/* Bar content — wrapped in scanline materializer */}
        <ScanlineMaterializer>
          <div style={{
            position: 'relative',
            zIndex: 10,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Top endcap */}
            <Endcap position="top" />

            {/* Top mounting pin */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              padding: `${densePx(3, 1)} 0 ${densePx(1, 1)}`,
            }}>
              <MountingPin />
            </div>

            {children}

            {/* Bottom mounting pin */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              padding: `${densePx(1, 1)} 0 ${densePx(3, 1)}`,
            }}>
              <MountingPin />
            </div>

            {/* Bottom endcap */}
            <Endcap position="bottom" />
          </div>
        </ScanlineMaterializer>
      </div>
    </div>
  )
}

BarLayout.Top = Top
BarLayout.Center = Center
BarLayout.Bottom = Bottom
