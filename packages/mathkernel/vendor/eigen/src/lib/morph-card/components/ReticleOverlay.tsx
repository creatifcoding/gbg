/**
 * ReticleOverlay
 *
 * Visual transition overlay for MorphCard.
 * Mirrors DynamicIsland reticle variants.
 */

import { motion } from 'framer-motion';
import type { ReticleVariant } from '../schemas/animation-config';

interface ReticleProps {
  color: string;
  width: number;
  height: number;
}

function CornersReticle({ color, width, height }: ReticleProps) {
  const s = Math.min(width, height) * 0.15;
  return (
    <svg className="absolute inset-0 h-full w-full">
      <g stroke={color} strokeWidth="1" fill="none">
        <path d={`M0,${s} L0,0 L${s},0`} />
        <path d={`M${width - s},0 L${width},0 L${width},${s}`} />
        <path
          d={`M${width},${height - s} L${width},${height} L${width - s},${height}`}
        />
        <path d={`M${s},${height} L0,${height} L0,${height - s}`} />
      </g>
    </svg>
  );
}

function CrosshairReticle({ color, width, height }: ReticleProps) {
  const cx = width / 2;
  const cy = height / 2;
  const g = 8;
  return (
    <svg className="absolute inset-0 h-full w-full">
      <g stroke={color} strokeWidth="1">
        <line x1={cx} y1={0} x2={cx} y2={cy - g} />
        <line x1={cx} y1={cy + g} x2={cx} y2={height} />
        <line x1={0} y1={cy} x2={cx - g} y2={cy} />
        <line x1={cx + g} y1={cy} x2={width} y2={cy} />
        <circle cx={cx} cy={cy} r={g} fill="none" />
      </g>
    </svg>
  );
}

function ScanReticle({ color, height }: ReticleProps) {
  return (
    <motion.div
      className="absolute left-0 right-0 h-px"
      style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
      initial={{ top: 0, opacity: 0.8 }}
      animate={{ top: height, opacity: 0 }}
      transition={{ duration: 0.5, ease: 'linear' }}
    />
  );
}

function PulseReticle({ color, width, height }: ReticleProps) {
  return (
    <motion.div
      className="absolute rounded-full border"
      style={{ borderColor: color, left: '50%', top: '50%', x: '-50%', y: '-50%' }}
      initial={{ width: 10, height: 10, opacity: 1 }}
      animate={{
        width: Math.max(width, height),
        height: Math.max(width, height),
        opacity: 0,
      }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    />
  );
}

function DiamondReticle({ color, width, height }: ReticleProps) {
  const cx = width / 2;
  const cy = height / 2;
  const s = Math.min(width, height) * 0.3;
  return (
    <svg className="absolute inset-0 h-full w-full">
      <motion.polygon
        points={`${cx},${cy - s} ${cx + s},${cy} ${cx},${cy + s} ${cx - s},${cy}`}
        stroke={color}
        strokeWidth="1"
        fill="none"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
        style={{ transformOrigin: 'center' }}
      />
    </svg>
  );
}

function HexagonReticle({ color, width, height }: ReticleProps) {
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) * 0.25;
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (i * Math.PI) / 3 - Math.PI / 2;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(' ');
  return (
    <svg className="absolute inset-0 h-full w-full">
      <motion.polygon
        points={pts}
        stroke={color}
        strokeWidth="1"
        fill="none"
        initial={{ rotate: 30, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={{ duration: 0.2 }}
        style={{ transformOrigin: 'center' }}
      />
    </svg>
  );
}

function BracketsReticle({ color, width, height }: ReticleProps) {
  const m = 8;
  const l = 12;
  return (
    <svg className="absolute inset-0 h-full w-full">
      <g stroke={color} strokeWidth="1" fill="none">
        <path d={`M${m + l},${m} L${m},${m} L${m},${m + l}`} />
        <path
          d={`M${width - m - l},${m} L${width - m},${m} L${width - m},${m + l}`}
        />
        <path
          d={`M${width - m},${height - m - l} L${width - m},${height - m} L${width - m - l},${height - m}`}
        />
        <path
          d={`M${m},${height - m - l} L${m},${height - m} L${m + l},${height - m}`}
        />
      </g>
    </svg>
  );
}

function TargetingReticle({ color, width, height }: ReticleProps) {
  const cx = width / 2;
  const cy = height / 2;
  return (
    <svg className="absolute inset-0 h-full w-full">
      <motion.g
        stroke={color}
        strokeWidth="1"
        fill="none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <circle cx={cx} cy={cy} r={6} />
        <circle cx={cx} cy={cy} r={14} strokeDasharray="4 4" />
        <line x1={cx - 20} y1={cy} x2={cx - 8} y2={cy} />
        <line x1={cx + 8} y1={cy} x2={cx + 20} y2={cy} />
        <line x1={cx} y1={cy - 20} x2={cx} y2={cy - 8} />
        <line x1={cx} y1={cy + 8} x2={cx} y2={cy + 20} />
      </motion.g>
    </svg>
  );
}

function OrbitalReticle({ color, width, height }: ReticleProps) {
  const cx = width / 2;
  const cy = height / 2;
  return (
    <svg className="absolute inset-0 h-full w-full">
      <motion.g
        stroke={color}
        strokeWidth="1"
        fill="none"
        initial={{ rotate: -90 }}
        animate={{ rotate: 0 }}
        transition={{ duration: 0.3 }}
        style={{ transformOrigin: 'center' }}
      >
        <ellipse cx={cx} cy={cy} rx={20} ry={8} />
        <ellipse cx={cx} cy={cy} rx={8} ry={20} />
        <circle cx={cx} cy={cy} r={3} fill={color} />
      </motion.g>
    </svg>
  );
}

function GridReticle({ color, width, height }: ReticleProps) {
  const cols = 5;
  const rows = 3;
  return (
    <svg className="absolute inset-0 h-full w-full">
      <g stroke={color} strokeWidth="0.5" opacity={0.6}>
        {Array.from({ length: cols - 1 }, (_, i) => (
          <line
            key={`v${i}`}
            x1={((i + 1) * width) / cols}
            y1={0}
            x2={((i + 1) * width) / cols}
            y2={height}
          />
        ))}
        {Array.from({ length: rows - 1 }, (_, i) => (
          <line
            key={`h${i}`}
            x1={0}
            y1={((i + 1) * height) / rows}
            x2={width}
            y2={((i + 1) * height) / rows}
          />
        ))}
      </g>
    </svg>
  );
}

function DashedReticle({ color, width, height }: ReticleProps) {
  return (
    <svg className="absolute inset-0 h-full w-full">
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
  );
}

function RadarReticle({ color, width, height }: ReticleProps) {
  const cx = width / 2;
  const cy = height / 2;
  return (
    <svg className="absolute inset-0 h-full w-full overflow-visible">
      <defs>
        <linearGradient id="radarGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity={0} />
          <stop offset="100%" stopColor={color} stopOpacity={0.8} />
        </linearGradient>
      </defs>
      <motion.g
        initial={{ rotate: 0 }}
        animate={{ rotate: 360 }}
        transition={{ duration: 1.5, repeat: 0, ease: 'linear' }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      >
        <path
          d={`M${cx},${cy} L${cx + 30},${cy - 5} A30,30 0 0,1 ${cx + 30},${cy + 5} Z`}
          fill="url(#radarGrad)"
        />
      </motion.g>
      <circle cx={cx} cy={cy} r={2} fill={color} />
    </svg>
  );
}

function ChevronReticle({ color, width, height }: ReticleProps) {
  const cx = width / 2;
  return (
    <svg className="absolute inset-0 h-full w-full">
      <motion.g
        stroke={color}
        strokeWidth="1.5"
        fill="none"
        initial={{ y: -5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <path d={`M${cx - 15},8 L${cx},16 L${cx + 15},8`} />
        <path
          d={`M${cx - 15},${height - 8} L${cx},${height - 16} L${cx + 15},${height - 8}`}
        />
      </motion.g>
    </svg>
  );
}

function TrianglesReticle({ color, width, height }: ReticleProps) {
  return (
    <svg className="absolute inset-0 h-full w-full">
      <g fill={color}>
        <polygon points="8,8 16,8 12,16" />
        <polygon points={`${width - 8},8 ${width - 16},8 ${width - 12},16`} />
        <polygon points={`8,${height - 8} 16,${height - 8} 12,${height - 16}`} />
        <polygon
          points={`${width - 8},${height - 8} ${width - 16},${height - 8} ${width - 12},${height - 16}`}
        />
      </g>
    </svg>
  );
}

function RingReticle({ color, width, height }: ReticleProps) {
  const cx = width / 2;
  const cy = height / 2;
  return (
    <svg className="absolute inset-0 h-full w-full">
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
  );
}

function SegmentsReticle({ color, width, height }: ReticleProps) {
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) * 0.3;
  return (
    <svg className="absolute inset-0 h-full w-full">
      {[0, 90, 180, 270].map((angle) => (
        <motion.path
          key={angle}
          d={`M${cx + r * 0.6 * Math.cos((angle * Math.PI) / 180)},${
            cy + r * 0.6 * Math.sin((angle * Math.PI) / 180)
          } L${cx + r * Math.cos((angle * Math.PI) / 180)},${
            cy + r * Math.sin((angle * Math.PI) / 180)
          }`}
          stroke={color}
          strokeWidth="2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.2, delay: angle / 1000 }}
        />
      ))}
    </svg>
  );
}

function ParallaxReticle({ color }: ReticleProps) {
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
  );
}

function VortexReticle({ color, width, height }: ReticleProps) {
  const cx = width / 2;
  const cy = height / 2;
  return (
    <svg className="absolute inset-0 h-full w-full">
      <motion.g
        initial={{ rotate: 180, scale: 0 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ duration: 0.3 }}
        style={{ transformOrigin: 'center' }}
      >
        {[12, 20, 28].map((r, i) => (
          <circle
            key={r}
            cx={cx}
            cy={cy}
            r={r}
            stroke={color}
            strokeWidth="0.5"
            fill="none"
            opacity={1 - i * 0.25}
          />
        ))}
      </motion.g>
    </svg>
  );
}

function MatrixReticle({ color }: ReticleProps) {
  return (
    <div className="absolute inset-0 overflow-hidden opacity-30">
      {Array.from({ length: 8 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-xs font-mono"
          style={{ color, left: `${10 + i * 12}%`, top: 4 }}
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.2, delay: i * 0.02 }}
        >
          {Math.random().toString(16).slice(2, 4)}
        </motion.div>
      ))}
    </div>
  );
}

function CircuitReticle({ color, width, height }: ReticleProps) {
  return (
    <svg className="absolute inset-0 h-full w-full">
      <g stroke={color} strokeWidth="1" fill="none" opacity={0.5}>
        <path
          d={`M0,${height / 2} L20,${height / 2} L25,${height / 2 - 5} L40,${
            height / 2 - 5
          }`}
        />
        <path
          d={`M${width},${height / 2} L${width - 20},${height / 2} L${
            width - 25
          },${height / 2 + 5} L${width - 40},${height / 2 + 5}`}
        />
        <circle cx={40} cy={height / 2 - 5} r={2} fill={color} />
        <circle cx={width - 40} cy={height / 2 + 5} r={2} fill={color} />
      </g>
    </svg>
  );
}

function SineReticle({ color, width, height }: ReticleProps) {
  const cy = height / 2;
  let d = `M0,${cy}`;
  for (let x = 0; x <= width; x += 2) {
    d += ` L${x},${cy + Math.sin(x / 10) * 8}`;
  }
  return (
    <svg className="absolute inset-0 h-full w-full">
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
  );
}

function BinaryReticle({ color }: ReticleProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-between overflow-hidden px-2 opacity-20">
      <motion.span
        className="text-xs font-mono"
        style={{ color }}
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
      >
        01101001
      </motion.span>
      <motion.span
        className="text-xs font-mono"
        style={{ color }}
        initial={{ x: 20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
      >
        10010110
      </motion.span>
    </div>
  );
}

function GlitchReticle({ color }: ReticleProps) {
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
  );
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
};

export interface ReticleOverlayProps {
  variant: ReticleVariant;
  isActive: boolean;
  color: string;
  width: number;
  height: number;
}

export function ReticleOverlay({
  variant,
  isActive,
  color,
  width,
  height,
}: ReticleOverlayProps) {
  const Component = RETICLE_MAP[variant];
  if (!Component || !isActive) return null;

  return (
    <motion.div
      className="pointer-events-none absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.1 }}
    >
      <Component color={color} width={width} height={height} />
    </motion.div>
  );
}

