import type React from "react"
import type { ReactNode } from "react"
import { createContext, useContext, useCallback, useRef, useEffect, useMemo } from "react"
import { motion, AnimatePresence, useMotionValue, animate, useTransform } from "framer-motion"
import { createMachine, assign } from "xstate"
import { useMachine } from "@xstate/react"

// ============================================================================
// TIMING & EASING
// ============================================================================

const TIMING = {
  reticle: 100,
  morph: 180,
  content: 120,
  stagger: 30,
} as const

const EASING = {
  snap: [0.2, 0, 0, 1],
  smooth: [0.4, 0, 0.2, 1],
  bounce: [0.34, 1.56, 0.64, 1],
  sharp: [0.4, 0, 0.6, 1],
} as const

// ============================================================================
// TRANSITION GRAMMAR SYSTEM
// ============================================================================

type TransitionVerb =
  | "morph"
  | "snap"
  | "expand"
  | "collapse"
  | "slide"
  | "fade"
  | "glitch"
  | "shutter"
  | "cascade"
  | "teleport"
  | "elastic"
  | "cinematic"

type TransitionModifier = "fast" | "slow" | "smooth" | "bounce" | "sharp"

export interface TransitionGrammar {
  verb: TransitionVerb
  modifier?: TransitionModifier
  direction?: "left" | "right" | "up" | "down"
}

const VERB_VARIANTS: Record<TransitionVerb, { initial: object; animate: object; exit: object }> = {
  morph: {
    initial: { opacity: 0, scale: 0.95, filter: "blur(4px)" },
    animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
    exit: { opacity: 0, scale: 1.02, filter: "blur(4px)" },
  },
  snap: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
  },
  expand: {
    initial: { opacity: 0, scale: 0.8, y: -10 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.85, y: 5 },
  },
  collapse: {
    initial: { opacity: 0, scale: 1.1, y: 10 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.9, y: -5 },
  },
  slide: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  },
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  glitch: {
    initial: { opacity: 0, x: -5, filter: "blur(8px) hue-rotate(90deg)" },
    animate: { opacity: 1, x: 0, filter: "blur(0px) hue-rotate(0deg)" },
    exit: { opacity: 0, x: 5, filter: "blur(8px) hue-rotate(-90deg)" },
  },
  shutter: {
    initial: { opacity: 0, scaleY: 0, originY: 0 },
    animate: { opacity: 1, scaleY: 1 },
    exit: { opacity: 0, scaleY: 0, originY: 1 },
  },
  cascade: {
    initial: { opacity: 0, y: 30, rotateX: -15 },
    animate: { opacity: 1, y: 0, rotateX: 0 },
    exit: { opacity: 0, y: -20, rotateX: 10 },
  },
  teleport: {
    initial: { opacity: 0, scale: 0, filter: "blur(20px)" },
    animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
    exit: { opacity: 0, scale: 2, filter: "blur(20px)" },
  },
  elastic: {
    initial: { opacity: 0, scale: 0.5, rotate: -5 },
    animate: { opacity: 1, scale: 1, rotate: 0 },
    exit: { opacity: 0, scale: 0.8, rotate: 5 },
  },
  cinematic: {
    initial: { opacity: 0, scale: 1.1, filter: "blur(10px) brightness(2)" },
    animate: { opacity: 1, scale: 1, filter: "blur(0px) brightness(1)" },
    exit: { opacity: 0, scale: 0.95, filter: "blur(10px) brightness(0.5)" },
  },
}

const MODIFIER_TIMING: Record<TransitionModifier, number> = {
  fast: 0.12,
  slow: 0.5,
  smooth: 0.3,
  bounce: 0.4,
  sharp: 0.15,
}

function parseGrammar(grammar: string | TransitionGrammar): TransitionGrammar {
  if (typeof grammar === "object") return grammar

  const parts = grammar.toLowerCase().split(":")
  return {
    verb: (parts[0] as TransitionVerb) || "morph",
    modifier: parts[1] as TransitionModifier,
    direction: parts[2] as TransitionGrammar["direction"],
  }
}

function grammarToVariants(grammar: TransitionGrammar) {
  const base = VERB_VARIANTS[grammar.verb] || VERB_VARIANTS.morph
  const duration = grammar.modifier ? MODIFIER_TIMING[grammar.modifier] : 0.2

  const ease =
    grammar.modifier === "bounce" ? EASING.bounce : grammar.modifier === "sharp" ? EASING.sharp : EASING.smooth

  return {
    initial: base.initial,
    animate: {
      ...base.animate,
      transition: { duration, ease },
    },
    exit: {
      ...base.exit,
      transition: { duration: duration * 0.8, ease: EASING.snap },
    },
  }
}

// ============================================================================
// ANIMATED ITEM COMPONENT
// ============================================================================

interface AnimatedItemProps {
  children: ReactNode
  index?: number
  config?: {
    stagger?: number
    style?: "fade" | "slide" | "scale" | "blur" | "glitch"
    from?: "left" | "right" | "top" | "bottom"
    duration?: number
  }
}

const ITEM_STYLES = {
  fade: { initial: { opacity: 0 }, animate: { opacity: 1 } },
  slide: { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } },
  scale: { initial: { opacity: 0, scale: 0.8 }, animate: { opacity: 1, scale: 1 } },
  blur: { initial: { opacity: 0, filter: "blur(4px)" }, animate: { opacity: 1, filter: "blur(0px)" } },
  glitch: {
    initial: { opacity: 0, x: -3, filter: "hue-rotate(90deg)" },
    animate: { opacity: 1, x: 0, filter: "hue-rotate(0deg)" },
  },
}

export function AnimatedItem({ children, index = 0, config = {} }: AnimatedItemProps) {
  const { stagger = 0.05, style = "fade", from, duration = 0.3 } = config

  let variants = ITEM_STYLES[style] || ITEM_STYLES.fade

  if (style === "slide" && from) {
    const offsets = { left: { x: -12 }, right: { x: 12 }, top: { y: -12 }, bottom: { y: 12 } }
    variants = {
      initial: { opacity: 0, ...offsets[from] },
      animate: { opacity: 1, x: 0, y: 0 },
    }
  }

  return (
    <motion.div initial={variants.initial} animate={variants.animate} transition={{ duration, delay: index * stagger }}>
      {children}
    </motion.div>
  )
}

// ============================================================================
// RETICLE VARIANTS (24 total)
// ============================================================================

export type ReticleVariant =
  | "none"
  | "corners"
  | "crosshair"
  | "scan"
  | "pulse"
  | "diamond"
  | "hexagon"
  | "brackets"
  | "targeting"
  | "orbital"
  | "grid"
  | "dashed"
  | "radar"
  | "chevron"
  | "triangles"
  | "ring"
  | "segments"
  | "parallax"
  | "vortex"
  | "matrix"
  | "circuit"
  | "sine"
  | "binary"
  | "glitch"

interface ReticleProps {
  color: string
  width: number
  height: number
}

function CornersReticle({ color, width, height }: ReticleProps) {
  const s = Math.min(width, height) * 0.15
  return (
    <svg className="absolute inset-0 w-full h-full">
      <g stroke={color} strokeWidth="1" fill="none">
        <path d={`M0,${s} L0,0 L${s},0`} />
        <path d={`M${width - s},0 L${width},0 L${width},${s}`} />
        <path d={`M${width},${height - s} L${width},${height} L${width - s},${height}`} />
        <path d={`M${s},${height} L0,${height} L0,${height - s}`} />
      </g>
    </svg>
  )
}

function CrosshairReticle({ color, width, height }: ReticleProps) {
  const cx = width / 2,
    cy = height / 2,
    g = 8
  return (
    <svg className="absolute inset-0 w-full h-full">
      <g stroke={color} strokeWidth="1">
        <line x1={cx} y1={0} x2={cx} y2={cy - g} />
        <line x1={cx} y1={cy + g} x2={cx} y2={height} />
        <line x1={0} y1={cy} x2={cx - g} y2={cy} />
        <line x1={cx + g} y1={cy} x2={width} y2={cy} />
        <circle cx={cx} cy={cy} r={g} fill="none" />
      </g>
    </svg>
  )
}

function ScanReticle({ color, width, height }: ReticleProps) {
  return (
    <motion.div
      className="absolute left-0 right-0 h-px"
      style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
      initial={{ top: 0, opacity: 0.8 }}
      animate={{ top: height, opacity: 0 }}
      transition={{ duration: 0.5, ease: "linear" }}
    />
  )
}

function PulseReticle({ color, width, height }: ReticleProps) {
  return (
    <motion.div
      className="absolute rounded-full border"
      style={{ borderColor: color, left: "50%", top: "50%", x: "-50%", y: "-50%" }}
      initial={{ width: 10, height: 10, opacity: 1 }}
      animate={{ width: Math.max(width, height), height: Math.max(width, height), opacity: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    />
  )
}

function DiamondReticle({ color, width, height }: ReticleProps) {
  const cx = width / 2,
    cy = height / 2,
    s = Math.min(width, height) * 0.3
  return (
    <svg className="absolute inset-0 w-full h-full">
      <motion.polygon
        points={`${cx},${cy - s} ${cx + s},${cy} ${cx},${cy + s} ${cx - s},${cy}`}
        stroke={color}
        strokeWidth="1"
        fill="none"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
        style={{ transformOrigin: "center" }}
      />
    </svg>
  )
}

function HexagonReticle({ color, width, height }: ReticleProps) {
  const cx = width / 2,
    cy = height / 2,
    r = Math.min(width, height) * 0.25
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (i * Math.PI) / 3 - Math.PI / 2
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
  }).join(" ")
  return (
    <svg className="absolute inset-0 w-full h-full">
      <motion.polygon
        points={pts}
        stroke={color}
        strokeWidth="1"
        fill="none"
        initial={{ rotate: 30, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={{ duration: 0.2 }}
        style={{ transformOrigin: "center" }}
      />
    </svg>
  )
}

function BracketsReticle({ color, width, height }: ReticleProps) {
  const m = 8,
    l = 12
  return (
    <svg className="absolute inset-0 w-full h-full">
      <g stroke={color} strokeWidth="1" fill="none">
        <path d={`M${m + l},${m} L${m},${m} L${m},${m + l}`} />
        <path d={`M${width - m - l},${m} L${width - m},${m} L${width - m},${m + l}`} />
        <path d={`M${width - m},${height - m - l} L${width - m},${height - m} L${width - m - l},${height - m}`} />
        <path d={`M${m},${height - m - l} L${m},${height - m} L${m + l},${height - m}`} />
      </g>
    </svg>
  )
}

function TargetingReticle({ color, width, height }: ReticleProps) {
  const cx = width / 2,
    cy = height / 2
  return (
    <svg className="absolute inset-0 w-full h-full">
      <motion.g stroke={color} strokeWidth="1" fill="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <circle cx={cx} cy={cy} r={6} />
        <circle cx={cx} cy={cy} r={14} strokeDasharray="4 4" />
        <line x1={cx - 20} y1={cy} x2={cx - 8} y2={cy} />
        <line x1={cx + 8} y1={cy} x2={cx + 20} y2={cy} />
        <line x1={cx} y1={cy - 20} x2={cx} y2={cy - 8} />
        <line x1={cx} y1={cy + 8} x2={cx} y2={cy + 20} />
      </motion.g>
    </svg>
  )
}

function OrbitalReticle({ color, width, height }: ReticleProps) {
  const cx = width / 2,
    cy = height / 2
  return (
    <svg className="absolute inset-0 w-full h-full">
      <motion.g
        stroke={color}
        strokeWidth="1"
        fill="none"
        initial={{ rotate: -90 }}
        animate={{ rotate: 0 }}
        transition={{ duration: 0.3 }}
        style={{ transformOrigin: "center" }}
      >
        <ellipse cx={cx} cy={cy} rx={20} ry={8} />
        <ellipse cx={cx} cy={cy} rx={8} ry={20} />
        <circle cx={cx} cy={cy} r={3} fill={color} />
      </motion.g>
    </svg>
  )
}

function GridReticle({ color, width, height }: ReticleProps) {
  const cols = 5,
    rows = 3
  return (
    <svg className="absolute inset-0 w-full h-full">
      <g stroke={color} strokeWidth="0.5" opacity={0.6}>
        {Array.from({ length: cols - 1 }, (_, i) => (
          <line key={`v${i}`} x1={((i + 1) * width) / cols} y1={0} x2={((i + 1) * width) / cols} y2={height} />
        ))}
        {Array.from({ length: rows - 1 }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={((i + 1) * height) / rows} x2={width} y2={((i + 1) * height) / rows} />
        ))}
      </g>
    </svg>
  )
}

function DashedReticle({ color, width, height }: ReticleProps) {
  return (
    <svg className="absolute inset-0 w-full h-full">
      <rect
        x={4}
        y={4}
        width={width - 8}
        height={height - 8}
        stroke={color}
        strokeWidth="1"
        strokeDasharray="8 4"
        fill="none"
      />
    </svg>
  )
}

function RadarReticle({ color, width, height }: ReticleProps) {
  const cx = width / 2,
    cy = height / 2
  return (
    <svg className="absolute inset-0 w-full h-full overflow-visible">
      <defs>
        <linearGradient id="radarGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity={0} />
          <stop offset="100%" stopColor={color} stopOpacity={0.8} />
        </linearGradient>
      </defs>
      <motion.g
        initial={{ rotate: 0 }}
        animate={{ rotate: 360 }}
        transition={{ duration: 1.5, repeat: 0, ease: "linear" }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      >
        <path d={`M${cx},${cy} L${cx + 30},${cy - 5} A30,30 0 0,1 ${cx + 30},${cy + 5} Z`} fill="url(#radarGrad)" />
      </motion.g>
      <circle cx={cx} cy={cy} r={2} fill={color} />
    </svg>
  )
}

function ChevronReticle({ color, width, height }: ReticleProps) {
  const cx = width / 2
  return (
    <svg className="absolute inset-0 w-full h-full">
      <motion.g
        stroke={color}
        strokeWidth="1.5"
        fill="none"
        initial={{ y: -5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <path d={`M${cx - 15},8 L${cx},16 L${cx + 15},8`} />
        <path d={`M${cx - 15},${height - 8} L${cx},${height - 16} L${cx + 15},${height - 8}`} />
      </motion.g>
    </svg>
  )
}

function TrianglesReticle({ color, width, height }: ReticleProps) {
  return (
    <svg className="absolute inset-0 w-full h-full">
      <g fill={color}>
        <polygon points="8,8 16,8 12,16" />
        <polygon points={`${width - 8},8 ${width - 16},8 ${width - 12},16`} />
        <polygon points={`8,${height - 8} 16,${height - 8} 12,${height - 16}`} />
        <polygon points={`${width - 8},${height - 8} ${width - 16},${height - 8} ${width - 12},${height - 16}`} />
      </g>
    </svg>
  )
}

function RingReticle({ color, width, height }: ReticleProps) {
  const cx = width / 2,
    cy = height / 2
  return (
    <svg className="absolute inset-0 w-full h-full">
      <motion.circle
        cx={cx}
        cy={cy}
        r={Math.min(width, height) * 0.35}
        stroke={color}
        strokeWidth="2"
        fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
      />
    </svg>
  )
}

function SegmentsReticle({ color, width, height }: ReticleProps) {
  const cx = width / 2,
    cy = height / 2,
    r = Math.min(width, height) * 0.3
  return (
    <svg className="absolute inset-0 w-full h-full">
      {[0, 90, 180, 270].map((angle) => (
        <motion.path
          key={angle}
          d={`M${cx + r * 0.6 * Math.cos((angle * Math.PI) / 180)},${cy + r * 0.6 * Math.sin((angle * Math.PI) / 180)} L${cx + r * Math.cos((angle * Math.PI) / 180)},${cy + r * Math.sin((angle * Math.PI) / 180)}`}
          stroke={color}
          strokeWidth="2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.2, delay: angle / 1000 }}
        />
      ))}
    </svg>
  )
}

function ParallaxReticle({ color, width, height }: ReticleProps) {
  return (
    <>
      <motion.div
        className="absolute inset-2 border"
        style={{ borderColor: color }}
        initial={{ x: -3, y: -3, opacity: 0 }}
        animate={{ x: 0, y: 0, opacity: 0.3 }}
        transition={{ duration: 0.2 }}
      />
      <motion.div
        className="absolute inset-4 border"
        style={{ borderColor: color }}
        initial={{ x: 3, y: 3, opacity: 0 }}
        animate={{ x: 0, y: 0, opacity: 0.6 }}
        transition={{ duration: 0.2, delay: 0.05 }}
      />
    </>
  )
}

function VortexReticle({ color, width, height }: ReticleProps) {
  const cx = width / 2,
    cy = height / 2
  return (
    <svg className="absolute inset-0 w-full h-full">
      <motion.g
        initial={{ rotate: 180, scale: 0 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ duration: 0.3 }}
        style={{ transformOrigin: "center" }}
      >
        {[12, 20, 28].map((r, i) => (
          <circle key={r} cx={cx} cy={cy} r={r} stroke={color} strokeWidth="0.5" fill="none" opacity={1 - i * 0.25} />
        ))}
      </motion.g>
    </svg>
  )
}

function MatrixReticle({ color, width, height }: ReticleProps) {
  return (
    <div className="absolute inset-0 overflow-hidden opacity-30">
      {Array.from({ length: 8 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-[8px] font-mono"
          style={{ color, left: `${10 + i * 12}%`, top: 4 }}
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.2, delay: i * 0.02 }}
        >
          {Math.random().toString(16).slice(2, 4)}
        </motion.div>
      ))}
    </div>
  )
}

function CircuitReticle({ color, width, height }: ReticleProps) {
  return (
    <svg className="absolute inset-0 w-full h-full">
      <g stroke={color} strokeWidth="1" fill="none" opacity={0.5}>
        <path d={`M0,${height / 2} L20,${height / 2} L25,${height / 2 - 5} L40,${height / 2 - 5}`} />
        <path
          d={`M${width},${height / 2} L${width - 20},${height / 2} L${width - 25},${height / 2 + 5} L${width - 40},${height / 2 + 5}`}
        />
        <circle cx={40} cy={height / 2 - 5} r={2} fill={color} />
        <circle cx={width - 40} cy={height / 2 + 5} r={2} fill={color} />
      </g>
    </svg>
  )
}

function SineReticle({ color, width, height }: ReticleProps) {
  const cy = height / 2
  let d = `M0,${cy}`
  for (let x = 0; x <= width; x += 2) {
    d += ` L${x},${cy + Math.sin(x / 10) * 8}`
  }
  return (
    <svg className="absolute inset-0 w-full h-full">
      <motion.path
        d={d}
        stroke={color}
        strokeWidth="1"
        fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.5 }}
        transition={{ duration: 0.4 }}
      />
    </svg>
  )
}

function BinaryReticle({ color, width, height }: ReticleProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-between px-2 opacity-20 overflow-hidden">
      <motion.span
        className="text-[6px] font-mono"
        style={{ color }}
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
      >
        01101001
      </motion.span>
      <motion.span
        className="text-[6px] font-mono"
        style={{ color }}
        initial={{ x: 20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
      >
        10010110
      </motion.span>
    </div>
  )
}

function GlitchReticle({ color, width, height }: ReticleProps) {
  return (
    <>
      <motion.div
        className="absolute inset-0"
        style={{ border: `1px solid ${color}`, opacity: 0.5 }}
        animate={{ x: [0, 2, -2, 0], opacity: [0.5, 0.8, 0.3, 0.5] }}
        transition={{ duration: 0.15, times: [0, 0.33, 0.66, 1] }}
      />
      <motion.div
        className="absolute inset-0"
        style={{ border: `1px solid ${color}`, opacity: 0.3 }}
        animate={{ x: [0, -3, 3, 0], opacity: [0.3, 0.1, 0.5, 0.3] }}
        transition={{ duration: 0.15, times: [0, 0.33, 0.66, 1], delay: 0.05 }}
      />
    </>
  )
}

const RETICLE_MAP: Record<ReticleVariant, React.FC<ReticleProps> | null> = {
  none: null,
  corners: CornersReticle,
  crosshair: CrosshairReticle,
  scan: ScanReticle,
  pulse: PulseReticle,
  diamond: DiamondReticle,
  hexagon: HexagonReticle,
  brackets: BracketsReticle,
  targeting: TargetingReticle,
  orbital: OrbitalReticle,
  grid: GridReticle,
  dashed: DashedReticle,
  radar: RadarReticle,
  chevron: ChevronReticle,
  triangles: TrianglesReticle,
  ring: RingReticle,
  segments: SegmentsReticle,
  parallax: ParallaxReticle,
  vortex: VortexReticle,
  matrix: MatrixReticle,
  circuit: CircuitReticle,
  sine: SineReticle,
  binary: BinaryReticle,
  glitch: GlitchReticle,
}

function ReticleOverlay({
  variant,
  isActive,
  color,
  width,
  height,
}: {
  variant: ReticleVariant
  isActive: boolean
  color: string
  width: number
  height: number
}) {
  const Component = RETICLE_MAP[variant]
  if (!Component || !isActive) return null

  return (
    <motion.div
      className="absolute inset-0 pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.1 }}
    >
      <Component color={color} width={width} height={height} />
    </motion.div>
  )
}

// ============================================================================
// TYPES
// ============================================================================

export interface SizePreset {
  width: number
  height: number
}

export interface IslandConfig {
  sizes: Record<string, SizePreset>
  borderRadius: number
  borderIntensity: number
  spring: { stiffness: number; damping: number; mass: number }
  reticle: ReticleVariant
  reticleColor: string
  motionBlur: boolean
  transitions?: Record<string, TransitionGrammar>
}

// ============================================================================
// DURATION NORMALIZATION TYPES & CONFIG
// ============================================================================

export type TrajectoryPoint = { x: number; y: number; timestamp: number }

export type DurationNormalization = {
  mode: "logarithmic" | "power" | "linear"
  baseDuration: number // Minimum "snappy" feel in ms
  referenceLength: number // Path length that feels "normal" at baseDuration
  scale: number // For logarithmic: multiplier on ln(); for power: exponent (0.3-0.5)
  minDuration: number // Floor clamp
  maxDuration: number // Ceiling clamp
}

export const defaultDurationNormalization: DurationNormalization = {
  mode: "logarithmic",
  baseDuration: 300, // Short paths feel this snappy
  referenceLength: 200, // 200px path = reference "normal" length
  scale: 150, // Logarithmic growth factor
  minDuration: 200, // Never faster than 200ms
  maxDuration: 1500, // Never slower than 1.5s
}

function computePerceptualDuration(totalLength: number, normalization: DurationNormalization): number {
  const { mode, baseDuration, referenceLength, scale, minDuration, maxDuration } = normalization

  let duration: number

  switch (mode) {
    case "logarithmic":
      // Weber-Fechner: perceived time is logarithmic with distance
      // duration = base + scale * ln(1 + length / reference)
      duration = baseDuration + scale * Math.log(1 + totalLength / referenceLength)
      break

    case "power":
      // Stevens' Power Law alternative: duration = base * (length / reference)^scale
      // With scale < 1 (e.g., 0.4), compresses long paths
      duration = baseDuration * Math.pow(Math.max(1, totalLength / referenceLength), scale)
      break

    case "linear":
    default:
      // Fallback: direct proportional (no normalization)
      duration = baseDuration * (totalLength / referenceLength)
      break
  }

  // Clamp to bounds
  return Math.max(minDuration, Math.min(maxDuration, duration))
}

// ============================================================================
// DRAG PHYSICS - Dependency Injectable Interface
// ============================================================================

export interface DragVector {
  x: number
  y: number
  vx: number
  vy: number
  ax: number
  ay: number
  timestamp: number
}

export interface DragConstraints {
  left?: number
  right?: number
  top?: number
  bottom?: number
}

export interface BackpressureConfig {
  // Resistance coefficient: 0 = free movement, 1 = immovable
  resistance: number
  // Elastic tension when approaching bounds
  tension: number
  // Viscous damping on velocity
  viscosity: number
  // Mass affects momentum and inertia
  mass: number
  // Boundary softness: 0 = hard stop, 1 = fully elastic
  boundaryElasticity: number
}

export interface DragPhysicsResult {
  // Transformed position after backpressure
  position: { x: number; y: number }
  // Resultant velocity post-damping
  velocity: { x: number; y: number }
  // Force feedback for haptics/visual
  forceFeedback: number
  // Whether at boundary
  atBoundary: { x: boolean; y: boolean }
}

export interface DragPhysicsEngine {
  /**
   * Compute backpressure-adjusted position from raw drag delta
   */
  computeBackpressure(
    current: DragVector,
    delta: { dx: number; dy: number },
    constraints: DragConstraints,
    config: BackpressureConfig,
  ): DragPhysicsResult

  /**
   * Compute momentum decay for drag release
   */
  computeMomentumDecay(
    velocity: { x: number; y: number },
    config: BackpressureConfig,
    dt: number,
  ): { x: number; y: number }

  /**
   * Compute elastic snapback when released beyond bounds
   */
  computeSnapback(
    position: { x: number; y: number },
    constraints: DragConstraints,
    config: BackpressureConfig,
  ): { x: number; y: number; duration: number }
}

// Default physics implementation
export const defaultDragPhysics: DragPhysicsEngine = {
  computeBackpressure(current, delta, constraints, config) {
    const { resistance, tension, viscosity, mass, boundaryElasticity } = config

    // Apply resistance to delta
    const resistedDx = delta.dx * (1 - resistance)
    const resistedDy = delta.dy * (1 - resistance)

    // Compute raw new position
    let newX = current.x + resistedDx
    let newY = current.y + resistedDy

    // Boundary detection and elastic response
    const atBoundary = { x: false, y: false }
    let forceFeedback = 0

    // X-axis boundary backpressure
    if (constraints.left !== undefined && newX < constraints.left) {
      const overshoot = constraints.left - newX
      const elasticForce = overshoot * tension
      newX = constraints.left - (overshoot * boundaryElasticity) / (1 + elasticForce)
      atBoundary.x = true
      forceFeedback += overshoot
    } else if (constraints.right !== undefined && newX > constraints.right) {
      const overshoot = newX - constraints.right
      const elasticForce = overshoot * tension
      newX = constraints.right + (overshoot * boundaryElasticity) / (1 + elasticForce)
      atBoundary.x = true
      forceFeedback += overshoot
    }

    // Y-axis boundary backpressure
    if (constraints.top !== undefined && newY < constraints.top) {
      const overshoot = constraints.top - newY
      const elasticForce = overshoot * tension
      newY = constraints.top - (overshoot * boundaryElasticity) / (1 + elasticForce)
      atBoundary.y = true
      forceFeedback += overshoot
    } else if (constraints.bottom !== undefined && newY > constraints.bottom) {
      const overshoot = newY - constraints.bottom
      const elasticForce = overshoot * tension
      newY = constraints.bottom + (overshoot * boundaryElasticity) / (1 + elasticForce)
      atBoundary.y = true
      forceFeedback += overshoot
    }

    // Compute velocity with viscous damping
    const dt = Math.max(current.timestamp, 1) / 1000
    const rawVx = resistedDx / dt
    const rawVy = resistedDy / dt
    const dampedVx = rawVx * (1 - viscosity)
    const dampedVy = rawVy * (1 - viscosity)

    // Mass affects how much velocity is retained
    const finalVx = dampedVx / mass
    const finalVy = dampedVy / mass

    return {
      position: { x: newX, y: newY },
      velocity: { x: finalVx, y: finalVy },
      forceFeedback: Math.min(forceFeedback, 100),
      atBoundary,
    }
  },

  computeMomentumDecay(velocity, config, dt) {
    const decay = Math.exp(-config.viscosity * dt * 10)
    return {
      x: velocity.x * decay,
      y: velocity.y * decay,
    }
  },

  computeSnapback(position, constraints, config) {
    let targetX = position.x
    let targetY = position.y
    let maxOvershoot = 0

    if (constraints.left !== undefined && position.x < constraints.left) {
      maxOvershoot = Math.max(maxOvershoot, constraints.left - position.x)
      targetX = constraints.left
    } else if (constraints.right !== undefined && position.x > constraints.right) {
      maxOvershoot = Math.max(maxOvershoot, position.x - constraints.right)
      targetX = constraints.right
    }

    if (constraints.top !== undefined && position.y < constraints.top) {
      maxOvershoot = Math.max(maxOvershoot, constraints.top - position.y)
      targetY = constraints.top
    } else if (constraints.bottom !== undefined && position.y > constraints.bottom) {
      maxOvershoot = Math.max(maxOvershoot, position.y - constraints.bottom)
      targetY = constraints.bottom
    }

    // Duration scales with overshoot and inverse of tension
    const duration = Math.min(0.6, 0.1 + (maxOvershoot * 0.01) / config.tension)

    return { x: targetX, y: targetY, duration }
  },
}

export const defaultBackpressureConfig: BackpressureConfig = {
  resistance: 0.0,
  tension: 0.5,
  viscosity: 0.1,
  mass: 1.0,
  boundaryElasticity: 0.3,
}

// ============================================================================
// STATE MACHINE
// ============================================================================

type IslandContext = {
  sizeKey: string
  previousSizeKey: string
  reticle: ReticleVariant
  activeTransition: TransitionGrammar
}

type IslandEvent =
  | { type: "TRANSITION"; sizeKey: string; grammar?: TransitionGrammar }
  | { type: "SET_RETICLE"; reticle: ReticleVariant }
  | { type: "RETICLE_DONE" }
  | { type: "MORPH_DONE" }

const DEFAULT_GRAMMAR: TransitionGrammar = { verb: "morph", modifier: "fast" }

const islandMachine = createMachine({
  id: "dynamicIsland",
  initial: "idle",
  context: {
    sizeKey: "default",
    previousSizeKey: "default",
    reticle: "corners" as ReticleVariant,
    activeTransition: DEFAULT_GRAMMAR,
  } as IslandContext,
  states: {
    idle: {
      on: {
        TRANSITION: {
          target: "reticleActive",
          actions: assign({
            previousSizeKey: ({ context }) => context.sizeKey,
            sizeKey: ({ event }) => event.sizeKey,
            activeTransition: ({ event, context }) => {
              if (event.grammar) return event.grammar
              const route = `${context.sizeKey}->${event.sizeKey}`
              return DEFAULT_GRAMMAR
            },
          }),
        },
        SET_RETICLE: {
          actions: assign({ reticle: ({ event }) => event.reticle }),
        },
      },
    },
    reticleActive: {
      after: {
        [TIMING.reticle]: { target: "morphing" },
      },
      on: {
        TRANSITION: {
          target: "reticleActive",
          actions: assign({
            previousSizeKey: ({ context }) => context.sizeKey,
            sizeKey: ({ event }) => event.sizeKey,
            activeTransition: ({ event }) => event.grammar || DEFAULT_GRAMMAR,
          }),
        },
      },
    },
    morphing: {
      after: {
        [TIMING.morph]: { target: "idle" },
      },
      on: {
        TRANSITION: {
          target: "reticleActive",
          actions: assign({
            previousSizeKey: ({ context }) => context.sizeKey,
            sizeKey: ({ event }) => event.sizeKey,
            activeTransition: ({ event }) => event.grammar || DEFAULT_GRAMMAR,
          }),
        },
      },
    },
  },
})

// ============================================================================
// CONTEXT & PROVIDER
// ============================================================================

interface IslandContextValue {
  sizeKey: string
  state: string
  transition: (sizeKey: string, grammar?: TransitionGrammar | string) => void
  setReticle: (variant: ReticleVariant) => void
  config: IslandConfig
  activeTransition: TransitionGrammar
}

const IslandContext = createContext<IslandContextValue | null>(null)

export function useDynamicIsland() {
  const ctx = useContext(IslandContext)
  if (!ctx) throw new Error("useDynamicIsland must be used within DynamicIslandProvider")
  return ctx
}

const DEFAULT_CONFIG: IslandConfig = {
  sizes: {
    idle: { width: 120, height: 36 },
    minimal: { width: 100, height: 32 },
    compact: { width: 200, height: 44 },
    default: { width: 280, height: 56 },
    expanded: { width: 340, height: 120 },
    large: { width: 380, height: 160 },
    ultra: { width: 420, height: 200 },
    alert: { width: 320, height: 140 },
    media: { width: 300, height: 80 },
    timer: { width: 240, height: 80 },
    notification: { width: 300, height: 70 },
    call: { width: 340, height: 80 },
    navigation: { width: 320, height: 100 },
    weather: { width: 280, height: 70 },
    progress: { width: 300, height: 70 },
    battery: { width: 140, height: 44 },
  },
  borderRadius: 22,
  borderIntensity: 0.2,
  spring: { stiffness: 500, damping: 35, mass: 0.8 },
  reticle: "corners",
  reticleColor: "rgba(255,255,255,0.4)",
  motionBlur: true,
}

export function DynamicIslandProvider({
  children,
  config: userConfig,
}: {
  children: ReactNode
  config?: Partial<IslandConfig>
}) {
  const config = useMemo(() => ({ ...DEFAULT_CONFIG, ...userConfig }), [userConfig])
  const [snapshot, send] = useMachine(islandMachine)

  const transition = useCallback(
    (sizeKey: string, grammar?: TransitionGrammar | string) => {
      const parsed = grammar ? parseGrammar(grammar) : undefined
      send({ type: "TRANSITION", sizeKey, grammar: parsed })
    },
    [send],
  )

  const setReticle = useCallback(
    (reticle: ReticleVariant) => {
      send({ type: "SET_RETICLE", reticle })
    },
    [send],
  )

  const value = useMemo(
    () => ({
      sizeKey: snapshot.context.sizeKey,
      state: snapshot.value as string,
      transition,
      setReticle,
      config: { ...config, reticle: snapshot.context.reticle },
      activeTransition: snapshot.context.activeTransition,
    }),
    [snapshot, transition, setReticle, config],
  )

  return <IslandContext.Provider value={value}>{children}</IslandContext.Provider>
}

// ============================================================================
// DYNAMIC ISLAND COMPONENT - Framer Motion based position/trajectory
// ============================================================================

export function DynamicIsland({
  children,
  position = { x: 0, y: 0 },
  draggable = false,
  onDragEnd,
  trajectory,
  trajectoryDuration, // Now optional - if not provided, uses perceptual normalization
  durationNormalization = defaultDurationNormalization,
  onTrajectoryComplete,
  dragPhysics = defaultDragPhysics,
  backpressure = defaultBackpressureConfig,
  dragConstraints,
  onForceFeedback,
}: {
  children: ReactNode
  position?: { x: number; y: number }
  draggable?: boolean
  onDragEnd?: (position: { x: number; y: number }) => void
  trajectory?: TrajectoryPoint[]
  trajectoryDuration?: number // Now optional
  durationNormalization?: DurationNormalization // Added
  onTrajectoryComplete?: () => void
  dragPhysics?: DragPhysicsEngine
  backpressure?: BackpressureConfig
  dragConstraints?: DragConstraints
  onForceFeedback?: (force: number, atBoundary: { x: boolean; y: boolean }) => void
}) {
  const { sizeKey, state, config, activeTransition } = useDynamicIsland()
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const internalPosition = useRef({ x: position.x, y: position.y })
  const dragVector = useRef<DragVector>({
    x: position.x,
    y: position.y,
    vx: 0,
    vy: 0,
    ax: 0,
    ay: 0,
    timestamp: 0,
  })
  const lastDragTime = useRef(Date.now())

  const motionX = useMotionValue(position.x)
  const motionY = useMotionValue(position.y)
  const blur = useMotionValue(0)
  const forceFeedback = useMotionValue(0)

  useEffect(() => {
    if (isDragging.current || trajectory) return
    motionX.set(position.x)
    motionY.set(position.y)
    internalPosition.current = { x: position.x, y: position.y }
  }, [position.x, position.y, motionX, motionY, trajectory])

  useEffect(() => {
    if (!trajectory || trajectory.length < 2) return

    // Capture current position as origin
    const originX = motionX.get()
    const originY = motionY.get()

    const { cumulativeDistances, totalLength } = computeArcLengthParameterization(trajectory)
    const times = computeUniformTimes(cumulativeDistances, totalLength, 0.4)

    const effectiveDuration = trajectoryDuration ?? computePerceptualDuration(totalLength, durationNormalization)

    const xKeyframes = trajectory.map((p) => originX + p.x)
    const yKeyframes = trajectory.map((p) => originY + p.y)

    const blurKeyframes = trajectory.map((_, i) => {
      if (i === 0 || i === trajectory.length - 1) return 0 // Ease blur at endpoints
      const segmentLength = i > 0 ? cumulativeDistances[i] - cumulativeDistances[i - 1] : 0
      // Normalize by average segment length for consistent blur
      const avgSegmentLength = totalLength / (trajectory.length - 1)
      const velocityRatio = avgSegmentLength > 0 ? segmentLength / avgSegmentLength : 1
      return config.motionBlur ? Math.min(velocityRatio * 4, 8) : 0
    })

    const durationSec = effectiveDuration / 1000

    const controlsX = animate(motionX, xKeyframes, {
      duration: durationSec,
      ease: "linear", // Linear here because easing is baked into times
      times,
    })

    const controlsY = animate(motionY, yKeyframes, {
      duration: durationSec,
      ease: "linear",
      times,
    })

    const controlsBlur = animate(blur, blurKeyframes, {
      duration: durationSec,
      ease: "linear",
      times,
      onComplete: () => {
        blur.set(0)
        const last = trajectory[trajectory.length - 1]
        const finalX = originX + last.x
        const finalY = originY + last.y
        internalPosition.current = { x: finalX, y: finalY }
        onTrajectoryComplete?.()
      },
    })

    return () => {
      controlsX.stop()
      controlsY.stop()
      controlsBlur.stop()
    }
  }, [
    trajectory,
    trajectoryDuration,
    durationNormalization,
    config.motionBlur,
    onTrajectoryComplete,
    motionX,
    motionY,
    blur,
  ])

  // Border glow
  const borderGlow = `
    inset 0 0 0 1px rgba(255,255,255,${config.borderIntensity}),
    inset 0 1px 0 rgba(255,255,255,${config.borderIntensity * 0.8}),
    0 0 0 1px rgba(255,255,255,${config.borderIntensity * 0.3}),
    0 2px 8px rgba(0,0,0,0.8),
    0 0 40px rgba(0,0,0,0.5)
  `

  const handleDragStart = useCallback(() => {
    isDragging.current = true
  }, [])

  const handleDrag = useCallback(
    (
      event: MouseEvent | TouchEvent | PointerEvent,
      info: { point: { x: number; y: number }; delta: { x: number; y: number } },
    ) => {
      const now = Date.now()
      const dt = now - lastDragTime.current
      lastDragTime.current = now

      // Update drag vector
      dragVector.current = {
        x: internalPosition.current.x,
        y: internalPosition.current.y,
        vx: dt > 0 ? info.delta.x / dt : 0,
        vy: dt > 0 ? info.delta.y / dt : 0,
        ax: 0,
        ay: 0,
        timestamp: dt,
      }

      // Compute backpressure-adjusted position
      const result = dragPhysics.computeBackpressure(
        dragVector.current,
        { dx: info.delta.x, dy: info.delta.y },
        dragConstraints ?? {},
        backpressure,
      )

      // Apply physics result
      motionX.set(result.position.x)
      motionY.set(result.position.y)
      internalPosition.current = result.position

      // Motion blur based on velocity magnitude
      if (config.motionBlur) {
        const velocityMag = Math.sqrt(result.velocity.x ** 2 + result.velocity.y ** 2)
        blur.set(Math.min(velocityMag * 0.05, 8))
      }

      // Force feedback callback
      forceFeedback.set(result.forceFeedback)
      onForceFeedback?.(result.forceFeedback, result.atBoundary)
    },
    [
      dragPhysics,
      backpressure,
      dragConstraints,
      motionX,
      motionY,
      blur,
      forceFeedback,
      onForceFeedback,
      config.motionBlur,
    ],
  )

  const handleDragEnd = useCallback(() => {
    isDragging.current = false
    blur.set(0)
    forceFeedback.set(0)

    const finalPos = { x: motionX.get(), y: motionY.get() }

    // Compute snapback if beyond constraints
    if (dragConstraints) {
      const snapback = dragPhysics.computeSnapback(finalPos, dragConstraints, backpressure)

      if (snapback.x !== finalPos.x || snapback.y !== finalPos.y) {
        animate(motionX, snapback.x, {
          type: "spring",
          stiffness: 400 * backpressure.tension,
          damping: 30,
          duration: snapback.duration,
        })
        animate(motionY, snapback.y, {
          type: "spring",
          stiffness: 400 * backpressure.tension,
          damping: 30,
          duration: snapback.duration,
        })
        internalPosition.current = { x: snapback.x, y: snapback.y }
        onDragEnd?.({ x: snapback.x, y: snapback.y })
        return
      }
    }

    internalPosition.current = finalPos
    onDragEnd?.(finalPos)
  }, [motionX, motionY, blur, forceFeedback, onDragEnd, dragPhysics, dragConstraints, backpressure])

  const filterStyle = useTransform(blur, (b) => (config.motionBlur && b > 0.1 ? `blur(${b}px)` : "none"))

  const forceFeedbackGlow = useTransform(forceFeedback, (f) =>
    f > 0 ? `0 0 ${f}px rgba(255, 50, 50, ${Math.min(f * 0.02, 0.5)})` : "none",
  )

  return (
    <motion.div
      ref={containerRef}
      className="relative will-change-transform"
      style={{
        x: motionX,
        y: motionY,
        filter: filterStyle,
        boxShadow: forceFeedbackGlow,
      }}
      drag={draggable}
      dragMomentum={false}
      dragElastic={0} // Disabled built-in elastic - we handle it via physics engine
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      whileDrag={{ scale: 1.02, cursor: "grabbing" }}
      animate={{
        width: config.sizes[sizeKey]?.width || config.sizes.default.width,
        height: config.sizes[sizeKey]?.height || config.sizes.default.height,
      }}
      transition={{
        type: "spring",
        stiffness: config.spring.stiffness,
        damping: config.spring.damping,
        mass: config.spring.mass,
      }}
    >
      {/* Main container */}
      <motion.div
        className="relative w-full h-full overflow-hidden"
        style={{
          backgroundColor: "oklch(0.02 0 0)",
          borderRadius: config.borderRadius,
          boxShadow: borderGlow,
          cursor: draggable ? "grab" : "default",
        }}
        layout
      >
        {/* Content with transition grammar */}
        <AnimatePresence mode="wait">
          <motion.div key={sizeKey} className="absolute inset-0" {...grammarToVariants(activeTransition)}>
            {children}
          </motion.div>
        </AnimatePresence>

        {/* Reticle overlay */}
        <ReticleOverlay
          variant={config.reticle}
          isActive={state === "reticleActive"}
          color={config.reticleColor}
          width={config.sizes[sizeKey]?.width || config.sizes.default.width}
          height={config.sizes[sizeKey]?.height || config.sizes.default.height}
        />
      </motion.div>
    </motion.div>
  )
}

// ============================================================================
// EXPORTS
// ============================================================================

export { TIMING, EASING }

function computeArcLengthParameterization(trajectory: TrajectoryPoint[]): {
  cumulativeDistances: number[]
  totalLength: number
} {
  const cumulativeDistances: number[] = [0]
  let totalLength = 0

  for (let i = 1; i < trajectory.length; i++) {
    const dx = trajectory[i].x - trajectory[i - 1].x
    const dy = trajectory[i].y - trajectory[i - 1].y
    const segmentLength = Math.sqrt(dx * dx + dy * dy)
    totalLength += segmentLength
    cumulativeDistances.push(totalLength)
  }

  return { cumulativeDistances, totalLength }
}

function computeUniformTimes(cumulativeDistances: number[], totalLength: number, easeStrength = 0.3): number[] {
  if (totalLength === 0) return cumulativeDistances.map(() => 0)

  // Normalize to 0-1 based on arc length (uniform velocity)
  const linearTimes = cumulativeDistances.map((d) => d / totalLength)

  // Apply ease-in-out via smoothstep
  return linearTimes.map((t) => {
    // Hermite smoothstep for ease-in-out
    const eased = t * t * (3 - 2 * t)
    // Blend between linear and eased based on strength
    return t * (1 - easeStrength) + eased * easeStrength
  })
}
