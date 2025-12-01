import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Radar, Crosshair, Target, ScanLine, Ear, Radio, Zap, 
  Ghost, GitMerge, Cpu, Anchor, Activity, Disc, Lightbulb, RefreshCw,
  Server, AlertTriangle, Lock, Slash, Power, Ban, Layers, Minimize, Loader
} from 'lucide-react';

/**
 * DOMAIN: CEW OPERATIONAL ONTOLOGY v3.2 (RESTORATION)
 * Context: Full-Spectrum Emitter & System States
 * Updates: 
 * - Hard Physics Reset for all states
 * - Visual semantics rectified for ACQUIRE, BEACON, ALARM
 * - Monochromatic enforcement for TRACK
 */

const CATEGORIES = {
  PASSIVE: ['LURK', 'STATION', 'SENSE', 'SYNC', 'FUSE', 'INTAKE', 'COALESCE'],
  ACTIVE: ['SWEEP', 'ACQUIRE', 'GATE', 'PROBE', 'BEACON', 'ALARM'],
  KINETIC: ['TRACK', 'JAM', 'OVERLOAD'],
  OBSCURE: ['VEIL', 'CALIB', 'LEARN', 'SECURE', 'FRAGMENT', 'NULL'],
  SYSTEM: ['SPOOL', 'RECONFIG', 'COMPRESS', 'SAG', 'ABERRATION', 'HALT', 'SEVER', 'PURGE']
};

const getCategory = (id: string) => {
  for (const [cat, ids] of Object.entries(CATEGORIES)) {
    if (ids.includes(id)) return cat;
  }
  return 'SYSTEM';
};

const CEW_STATES = [
  // --- PASSIVE ---
  { id: 'LURK', label: 'LURK', icon: Ear, desc: 'EMCON Alpha. Passive Sentry.' },
  { id: 'STATION', label: 'STATION', icon: Anchor, desc: 'Gyroscopic Idle. Station keeping.' },
  { id: 'SENSE', label: 'SENSE', icon: Radio, desc: 'Noise Floor Intake.' },
  { id: 'SYNC', label: 'SYNC', icon: RefreshCw, desc: 'Buffer Synchronization.' },
  { id: 'FUSE', label: 'FUSE', icon: GitMerge, desc: 'Multi-INT Correlation.' },
  { id: 'INTAKE', label: 'INTAKE', icon: Layers, desc: 'Raw Spectrum Ingest.' },
  { id: 'COALESCE', label: 'COALESCE', icon: GitMerge, desc: 'Data Synthesis.' },

  // --- ACTIVE ---
  { id: 'SWEEP', label: 'SWEEP', icon: Radar, desc: 'Volumetric Search.' },
  { id: 'ACQUIRE', label: 'ACQUIRE', icon: Crosshair, desc: 'Soft Lock. Bearing transition.' },
  { id: 'GATE', label: 'GATE', icon: ScanLine, desc: 'Sector Isolation.' },
  { id: 'PROBE', label: 'PROBE', icon: Activity, desc: 'Active Interrogation.' },
  { id: 'BEACON', label: 'BEACON', icon: Lightbulb, desc: 'IFF Pilot Tone. Broadcast.' },
  { id: 'ALARM', label: 'ALARM', icon: AlertTriangle, desc: 'Priority Interrupt.' },

  // --- KINETIC ---
  { id: 'TRACK', label: 'TRACK', icon: Target, desc: 'Hard Lock. Fire-control.' },
  { id: 'JAM', label: 'JAM', icon: Zap, desc: 'Electronic Attack.' },
  { id: 'OVERLOAD', label: 'OVERLOAD', icon: AlertTriangle, desc: 'System Surge.' },

  // --- OBSCURE ---
  { id: 'VEIL', label: 'VEIL', icon: Ghost, desc: 'Signature Masking.' },
  { id: 'CALIB', label: 'CALIB', icon: Disc, desc: 'Sensor Calibration.' },
  { id: 'LEARN', label: 'LEARN', icon: Cpu, desc: 'ML Model Update.' },
  { id: 'SECURE', label: 'SECURE', icon: Lock, desc: 'Cryptographic Lock.' },
  { id: 'FRAGMENT', label: 'FRAGMENT', icon: Layers, desc: 'Pattern Dissolution.' },
  { id: 'NULL', label: 'NULL', icon: Ban, desc: 'Void State.' },

  // --- SYSTEM ---
  { id: 'SPOOL', label: 'SPOOL', icon: Loader, desc: 'Buffer Load.' },
  { id: 'RECONFIG', label: 'RECONFIG', icon: Server, desc: 'Logic Rebuild.' },
  { id: 'COMPRESS', label: 'COMPRESS', icon: Minimize, desc: 'Bandwidth Opt.' },
  { id: 'SAG', label: 'SAG', icon: Activity, desc: 'Voltage Sag.' },
  { id: 'ABERRATION', label: 'ABERRATION', icon: Zap, desc: 'Clock Desync.' },
  { id: 'HALT', label: 'HALT', icon: Slash, desc: 'Process Freeze.' },
  { id: 'SEVER', label: 'SEVER', icon: Slash, desc: 'Link Loss.' },
  { id: 'PURGE', label: 'PURGE', icon: Power, desc: 'Emergency Shutdown.' },
];

// --- TRANSITION FX ---
const TransitionFX = ({ type }: { type: string | null }) => {
  if (!type) return null;
  const fxVariants = {
    IGNITION: { scale: [1, 1.3, 1], opacity: [0, 1, 0], borderColor: ['rgba(34,211,238,0)', 'rgba(34,211,238,1)', 'rgba(34,211,238,0)'], transition: { duration: 0.15 } },
    DAMPEN: { scale: [1, 0.9, 1], opacity: [0, 0.4, 0], transition: { duration: 0.15 } },
    HARD_LOCK: { scale: [1.05, 0.95, 1], borderWidth: ['1px', '3px', '1px'], borderColor: ['#f43f5e', '#f43f5e', '#f43f5e'], transition: { duration: 0.12 } },
    DIFFRACTION: { filter: ['blur(0px)', 'blur(6px)', 'blur(0px)'], opacity: [1, 0.7, 1], transition: { duration: 0.15 } },
    ERROR: { x: [-5, 5, -5, 0], borderColor: ['#ef4444', '#ef4444', 'rgba(6,182,212,0.3)'], transition: { duration: 0.2 } }
  };
  // @ts-ignore
  return <motion.div className="absolute inset-[-15px] rounded-full border border-transparent pointer-events-none z-50" initial="initial" animate={type} variants={fxVariants} />;
};

// --- VISUALIZERS ---

const StationVisual = () => (
  <>
    {/* Stable Gyro Ring - Base Idle */}
    <motion.div className="absolute inset-3 border border-dashed border-cyan-500/20 rounded-full" animate={{ rotate: 360 }} transition={{ duration: 40, repeat: Infinity, ease: "linear" }} />
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-cyan-900/50 rounded-full" />
  </>
);

const SyncVisual = () => (
  <>
    <motion.div className="absolute inset-1 border-2 border-t-cyan-500/40 border-r-transparent border-b-cyan-500/40 border-l-transparent rounded-full" animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} />
    <motion.div className="absolute inset-3 border-2 border-t-transparent border-r-cyan-400/30 border-b-transparent border-l-cyan-400/30 rounded-full" animate={{ rotate: -360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} />
    <div className="absolute inset-0 overflow-hidden rounded-full"><motion.div className="w-full h-[2px] bg-cyan-400/50 shadow-[0_0_10px_cyan]" animate={{ top: ['0%', '100%'] }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} /></div>
  </>
);

const FuseVisual = () => (
  <>
    {[0, 1, 2].map((i) => (
      <motion.div key={i} className="absolute inset-0 rounded-full border border-cyan-500/40"
        initial={{ scale: 1.5, opacity: 0 }} animate={{ scale: 0.5, opacity: 0.8 }} // Contracting INWARD
        transition={{ duration: 3, repeat: Infinity, delay: i * 1, ease: "easeInOut" }}
      />
    ))}
  </>
);

const AcquireVisual = () => (
  <>
    {/* Soft Lock: Wide, loose brackets rotating slowly */}
    <motion.div className="absolute inset-0 border-2 border-cyan-500/30 rounded-full" style={{ borderTopColor: 'transparent', borderBottomColor: 'transparent' }} animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }} />
    <motion.div className="absolute inset-2 border-2 border-cyan-500/30 rounded-full" style={{ borderLeftColor: 'transparent', borderRightColor: 'transparent' }} animate={{ rotate: -360 }} transition={{ duration: 12, repeat: Infinity, ease: "linear" }} />
    {/* Pulsing center target area */}
    <motion.div className="absolute inset-8 border border-cyan-500/20 rounded-full" animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }} />
  </>
);

const GateVisual = () => (
  <>
    <motion.div className="absolute inset-0 rounded-full" >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-2 bg-cyan-500/50 blur-[2px] rounded-full" />
      <div className="absolute inset-2 border-t-2 border-cyan-400/50 rounded-full" />
    </motion.div>
  </>
);

const BeaconVisual = () => (
  <>
    {/* High Intensity Pilot Tone */}
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-[0_0_20px_white]" />
    {/* Radio Waves */}
    {[0, 1, 2].map(i => (
      <motion.div key={i} className="absolute inset-0 rounded-full border border-white/30"
        initial={{ opacity: 1, scale: 0.1 }} animate={{ opacity: 0, scale: 1.5 }}
        transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.5, ease: "easeOut" }}
      />
    ))}
  </>
);

const AlarmVisual = () => (
  <>
    <motion.div className="absolute inset-0 rounded-full" style={{ background: 'conic-gradient(from 0deg, transparent 0%, rgba(239,68,68,0.1) 20%, rgba(239,68,68,0.6) 50%, transparent 100%)' }} animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} />
    <div className="absolute inset-0 flex items-center justify-center">
      <AlertTriangle className="text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]" size={24} />
    </div>
  </>
);

const TrackVisual = () => (
  <>
    <motion.div className="absolute inset-0 border-2 border-rose-500 rounded-full" animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 0.2, repeat: Infinity }} />
    {/* Hard Lock Brackets - Strictly Monochromatic Red */}
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-2 bg-rose-500" />
    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-2 bg-rose-500" />
    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-1 bg-rose-500" />
    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-1 bg-rose-500" />
    <motion.div className="absolute inset-0 bg-rose-500/10 rounded-full" animate={{ opacity: [0.1, 0.3, 0.1] }} transition={{ duration: 0.2, repeat: Infinity }} />
  </>
);

const SpoolVisual = () => <svg className="absolute inset-0 w-full h-full rotate-[-90deg]" viewBox="0 0 100 100"><motion.circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" /><motion.circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4" pathLength="1" strokeDasharray="1 1" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} /></svg>;
const IntakeVisual = () => <>{[0, 1, 2].map(i => (<motion.div key={i} className="absolute inset-0 rounded-full border border-cyan-500/30" initial={{ scale: 1.5, opacity: 0 }} animate={{ scale: 0.5, opacity: 1 }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.6, ease: "easeIn" }} />))}</>;
const CoalesceVisual = () => <><motion.div className="absolute w-4 h-4 bg-cyan-400 rounded-full blur-[2px]" animate={{ x: [-20, 0], opacity: [0, 1] }} transition={{ duration: 2, repeat: Infinity }} /><motion.div className="absolute w-4 h-4 bg-cyan-400 rounded-full blur-[2px]" animate={{ x: [20, 0], opacity: [0, 1] }} transition={{ duration: 2, repeat: Infinity }} /><motion.div className="absolute w-6 h-6 bg-white blur-md rounded-full" animate={{ scale: [0, 1.5], opacity: [0, 1, 0] }} transition={{ duration: 2, repeat: Infinity, delay: 1.5 }} /></>;
const AberrationVisual = () => <><motion.div className="absolute inset-0 rounded-full border-2 border-red-500 opacity-50" animate={{ x: [-2, 2], y: [1, -1] }} transition={{ duration: 0.05, repeat: Infinity }} /><motion.div className="absolute inset-0 rounded-full border-2 border-blue-500 opacity-50" animate={{ x: [2, -2], y: [-1, 1] }} transition={{ duration: 0.06, repeat: Infinity }} /></>;
const SecureVisual = () => <motion.div className="absolute inset-0 flex items-center justify-center"><Lock size={24} className="text-cyan-200" /><motion.div className="absolute inset-4 border border-cyan-500/50 rounded-lg" animate={{ rotate: [0, 90, 180, 270, 360] }} transition={{ duration: 4, repeat: Infinity, ease: "circInOut" }} /></motion.div>;
const FragmentVisual = () => <div className="absolute inset-0 overflow-hidden rounded-full"><motion.div className="absolute inset-[-50%] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-100" animate={{ opacity: [1, 0, 1], x: [-10, 10] }} transition={{ duration: 0.2, repeat: Infinity }} /></div>;
const SweepVisual = () => <motion.div className="absolute inset-0 rounded-full" style={{ background: 'conic-gradient(from 0deg, transparent 0%, rgba(6,182,212,0.05) 60%, rgba(6,182,212,0.5) 100%)' }} animate={{ rotate: 360 }} transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }} />;
const SenseVisual = () => <>{[0, 1].map((i) => (<motion.div key={i} className="absolute inset-0 rounded-full border-2 border-cyan-500/40" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: [0, 0.6, 0], scale: [0.8, 2.0] }} transition={{ duration: 3.5, repeat: Infinity, delay: i * 1.75, ease: "easeOut" }} />))}</>;
const JamVisual = () => <motion.div className="absolute inset-0 rounded-full overflow-hidden"><motion.div className="absolute inset-[-50%] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-50 mix-blend-overlay" animate={{ x: [-10, 10], y: [-10, 10] }} transition={{ duration: 0.1, repeat: Infinity, repeatType: "mirror" }} /><motion.div className="absolute inset-0 border-2 border-rose-500/30 rounded-full" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 0.1, repeat: Infinity }} /></motion.div>;

// --- EMITTER CORE ---

const Emitter = ({ mode, transitionType }: { mode: string, transitionType: string | null }) => {
  
  /**
   * UNIVERSAL PHYSICS BASE
   * Defining the zero-state for all animatable properties.
   * This ensures clean state transitions without style retention.
   */
  const BASE_PHYSICS = {
    x: 0, y: 0, z: 0, rotate: 0, scale: 1, scaleX: 1, scaleY: 1, skew: 0,
    opacity: 1, filter: "blur(0px) contrast(100%) brightness(100%) invert(0)",
    borderRadius: "50%", borderWidth: "1px", borderColor: "rgba(6,182,212,0.3)", backgroundColor: "rgba(8,145,178,0.1)",
    boxShadow: "0 0 40px rgba(8,145,178,0.1), inset 0 0 10px rgba(8,145,178,0.1)"
  };

  const getModeStyles = () => {
    switch (getCategory(mode)) {
      case 'KINETIC': return 'bg-rose-950/20 border-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.3)]';
      case 'OBSCURE': return 'bg-gray-900/40 border-white/10 shadow-none';
      case 'SYSTEM': return 'bg-amber-950/10 border-amber-500/30 shadow-[inset_0_0_20px_rgba(245,158,11,0.1)]';
      default: return 'bg-cyan-950/10 border-cyan-500/30 shadow-[0_0_40px_rgba(8,145,178,0.1),inset_0_0_10px_rgba(8,145,178,0.1)]';
    }
  };

  const variants: any = {
    // PASSIVE
    LURK: { 
      ...BASE_PHYSICS, 
      scale: [1, 1.05, 1], 
      opacity: [0.4, 0.7, 0.4], 
      transition: { duration: 4, repeat: Infinity, ease: "easeInOut" } 
    },
    STATION: { ...BASE_PHYSICS },
    SENSE: { ...BASE_PHYSICS }, 
    SYNC: { 
      ...BASE_PHYSICS, 
      y: [-6, 6, -6], 
      scaleY: [0.98, 1.02, 0.98], 
      transition: { duration: 4, repeat: Infinity, ease: "easeInOut" } 
    },
    FUSE: { ...BASE_PHYSICS },
    INTAKE: { ...BASE_PHYSICS, scale: [1, 0.95, 1], transition: { duration: 0.5, repeat: Infinity } },
    COALESCE: { ...BASE_PHYSICS },

    // ACTIVE
    SWEEP: { ...BASE_PHYSICS },
    ACQUIRE: { 
      ...BASE_PHYSICS, 
      borderColor: "rgba(6,182,212,0.6)", 
      transition: { duration: 0.5 } 
    },
    GATE: { 
      ...BASE_PHYSICS, 
      rotate: [0, 20, 0, -20, 0], 
      transition: { duration: 4, repeat: Infinity, ease: "easeInOut" } 
    },
    PROBE: { ...BASE_PHYSICS, scale: [1, 1.1, 1], transition: { duration: 0.3, repeat: Infinity, repeatDelay: 1 } },
    BEACON: { ...BASE_PHYSICS, backgroundColor: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.5)" },
    ALARM: { ...BASE_PHYSICS, borderColor: "rgba(239,68,68,0.8)" },

    // KINETIC
    TRACK: { ...BASE_PHYSICS, scale: [1, 1.02, 1], borderColor: "#f43f5e", backgroundColor: "rgba(244,63,94,0.1)", transition: { duration: 0.1, repeat: Infinity } },
    JAM: { ...BASE_PHYSICS, x: [0, 2, -2, 0], transition: { duration: 0.05, repeat: Infinity } },
    OVERLOAD: { ...BASE_PHYSICS, scale: [1, 1.3, 1], filter: ["invert(0)", "invert(1)", "invert(0)"], transition: { duration: 0.5, repeat: Infinity } },

    // OBSCURE
    VEIL: { ...BASE_PHYSICS, y: [-2, 2, -2], filter: ['blur(1px)', 'blur(4px)', 'blur(1px)'], transition: { duration: 5, repeat: Infinity } },
    CALIB: { ...BASE_PHYSICS, borderColor: ['rgba(6,182,212,0.2)', 'rgba(244,63,94,0.3)', 'rgba(6,182,212,0.2)'], transition: { duration: 8, repeat: Infinity } },
    LEARN: { ...BASE_PHYSICS, borderColor: ['rgba(6,182,212,0.3)', 'rgba(167,139,250,0.4)', 'rgba(6,182,212,0.3)'], transition: { duration: 4, repeat: Infinity, ease: "linear" } },
    SECURE: { ...BASE_PHYSICS, borderRadius: "10%" },
    FRAGMENT: { ...BASE_PHYSICS, opacity: [1, 0.2, 1], transition: { duration: 0.1, repeat: Infinity } },
    NULL: { ...BASE_PHYSICS, backgroundColor: "#000000", borderColor: "#000000", shadow: "none", opacity: 1 },

    // SYSTEM
    SPOOL: { ...BASE_PHYSICS },
    RECONFIG: { ...BASE_PHYSICS, borderRadius: ["50%", "10%", "50%"], rotate: [0, 180, 360], transition: { duration: 3, repeat: Infinity } },
    COMPRESS: { ...BASE_PHYSICS, scaleY: [1, 0.4, 1], scaleX: [1, 1.2, 1], transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" } },
    SAG: { ...BASE_PHYSICS, opacity: [0.5, 0.3, 0.5], scale: 0.9, transition: { duration: 2, repeat: Infinity } },
    ABERRATION: { ...BASE_PHYSICS },
    HALT: { ...BASE_PHYSICS, scaleY: 0.05, scaleX: 1.2, borderRadius: "2px", backgroundColor: "#ef4444", borderColor: "#ef4444" },
    SEVER: { ...BASE_PHYSICS, backgroundColor: "transparent", borderWidth: "2px", borderColor: "#6b7280", opacity: 0.5 },
    PURGE: { ...BASE_PHYSICS, scale: [1, 0], opacity: [1, 0], transition: { duration: 2, ease: "circIn" } },
  };

  return (
    <div className="relative group">
      <TransitionFX key={transitionType + Date.now().toString()} type={transitionType} />
      
      {/* Tactical Crosshairs */}
      <AnimatePresence>
        {['ACQUIRE', 'TRACK', 'GATE', 'STATION', 'ALARM'].includes(mode) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 pointer-events-none">
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[160%] h-[1px] bg-cyan-900/30" />
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1px] h-[160%] bg-cyan-900/30" />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        className={`relative w-36 h-36 rounded-full backdrop-blur-md flex items-center justify-center transition-colors duration-300 border ${getModeStyles()}`}
        variants={variants}
        animate={mode}
      >
        {/* Core Nucleus */}
        {!['SWEEP', 'GATE', 'VEIL', 'JAM', 'INTAKE', 'SPOOL', 'SECURE', 'NULL', 'RECONFIG', 'HALT', 'SYNC', 'FUSE', 'BEACON', 'ALARM'].includes(mode) && (
          <motion.div 
            className={`rounded-full ${mode === 'TRACK' ? 'w-2 h-2 bg-rose-500 shadow-[0_0_20px_#f43f5e]' : 'w-12 h-12 bg-cyan-500/20 blur-sm'}`}
            animate={mode === 'LURK' ? { scale: [1, 1.1, 1], opacity: [0.2, 0.5, 0.2] } : {}}
            transition={{ duration: 5, repeat: Infinity }}
          />
        )}

        {/* State Visuals */}
        {mode === 'SWEEP' && <SweepVisual />}
        {mode === 'STATION' && <StationVisual />}
        {mode === 'SENSE' && <SenseVisual />}
        {mode === 'JAM' && <JamVisual />}
        {mode === 'TRACK' && <TrackVisual />}
        {mode === 'SPOOL' && <SpoolVisual />}
        {mode === 'INTAKE' && <IntakeVisual />}
        {mode === 'COALESCE' && <CoalesceVisual />}
        {mode === 'ABERRATION' && <AberrationVisual />}
        {mode === 'ALARM' && <AlarmVisual />}
        {mode === 'SECURE' && <SecureVisual />}
        {mode === 'FRAGMENT' && <FragmentVisual />}
        {mode === 'SYNC' && <SyncVisual />}
        {mode === 'FUSE' && <FuseVisual />}
        {mode === 'ACQUIRE' && <AcquireVisual />}
        {mode === 'GATE' && <GateVisual />}
        {mode === 'BEACON' && <BeaconVisual />}
        {mode === 'VEIL' && <div className="absolute inset-0 rounded-full opacity-40 mix-blend-overlay" style={{ backgroundImage: 'url("https://grainy-gradients.vercel.app/noise.svg")' }} />}
        
        {mode === 'LEARN' && (
          <motion.div 
             className="absolute inset-4 border-2 border-dashed border-cyan-500/30 rounded-full"
             animate={{ rotate: 360 }}
             transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          />
        )}

        {/* Specular Highlight */}
        {mode !== 'NULL' && <div className="absolute top-6 left-8 w-10 h-5 bg-white/10 blur-md rounded-full -rotate-45 pointer-events-none" />}
      </motion.div>
    </div>
  );
};

// --- APP SHELL ---

export default function Dispositions() {
  const [activeState, setActiveState] = useState(CEW_STATES.find(s => s.id === 'STATION')!);
  const [prevCategory, setPrevCategory] = useState('PASSIVE');
  const [transitionType, setTransitionType] = useState<string | null>(null);

  const handleStateChange = (newState: typeof CEW_STATES[0]) => {
    if (newState.id === activeState.id) return;
    const newCategory = getCategory(newState.id);
    let type = null;
    
    if (newCategory === 'KINETIC' && prevCategory !== 'KINETIC') type = 'HARD_LOCK';
    else if (newCategory === 'OBSCURE' && prevCategory !== 'OBSCURE') type = 'DIFFRACTION';
    else if (newCategory === 'SYSTEM') type = 'ERROR';
    else if (prevCategory === 'PASSIVE' && newCategory === 'ACTIVE') type = 'IGNITION';
    else if (prevCategory === 'ACTIVE' && newCategory === 'PASSIVE') type = 'DAMPEN';

    setTransitionType(type);
    setPrevCategory(newCategory);
    setActiveState(newState);
    setTimeout(() => setTransitionType(null), 200);
  };

  return (
    <div className="min-h-screen bg-[#020405] text-cyan-500 font-mono selection:bg-cyan-900 selection:text-white flex overflow-hidden">
      
      {/* LEFT: Command & Control */}
      <div className="w-80 border-r border-white/10 bg-[#05070a] flex flex-col z-10">
        <div className="p-5 border-b border-white/10 bg-black/20">
          <div className="flex items-center gap-2 mb-1">
             <div className={`w-2 h-2 rounded-full animate-pulse ${getCategory(activeState.id) === 'KINETIC' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
             <h1 className="text-xs font-bold tracking-[0.2em] text-cyan-100">CEW EMITTER</h1>
          </div>
          <p className="text-[9px] text-gray-500 uppercase">SYS.01 // {getCategory(activeState.id)}</p>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-px">
          {Object.keys(CATEGORIES).map(cat => (
            <div key={cat} className="mb-4">
              <div className="px-4 py-2 text-[9px] text-gray-600 font-bold tracking-widest opacity-50 sticky top-0 bg-[#05070a] z-10 border-b border-white/5">{cat}</div>
              {CEW_STATES.filter(s => getCategory(s.id) === cat).map((state) => {
                const Icon = state.icon;
                const isActive = activeState.id === state.id;
                return (
                  <button
                    key={state.id}
                    onClick={() => handleStateChange(state)}
                    className={`w-full text-left px-4 py-2 flex items-center gap-3 transition-all duration-200 border-l-2
                      ${isActive 
                        ? 'bg-cyan-950/20 text-cyan-100 border-cyan-500' 
                        : 'hover:bg-white/5 text-gray-500 border-transparent hover:border-gray-700'
                      }`}
                  >
                    <Icon size={14} className={isActive ? 'text-cyan-400' : 'opacity-50'} />
                    <span className="text-[10px] font-bold tracking-widest">{state.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT: Visualization Plane */}
      <div className="flex-1 relative flex flex-col">
        <div className="absolute inset-0 pointer-events-none opacity-10" style={{ backgroundImage: 'linear-gradient(#155e75 1px, transparent 1px), linear-gradient(90deg, #155e75 1px, transparent 1px)', backgroundSize: '50px 50px' }} />

        <div className="flex-1 flex flex-col items-center justify-center relative z-0">
          <Emitter mode={activeState.id} transitionType={transitionType} />
          
          <div className="mt-12 flex flex-col items-center gap-2 opacity-50">
            <div className="text-[9px] tracking-[0.3em] text-cyan-700">CURRENT DISPOSITION</div>
            <div className="text-xl font-bold tracking-widest text-cyan-100">{activeState.label}</div>
          </div>
        </div>

        {/* BOTTOM: Data readout */}
        <div className="h-40 border-t border-white/10 bg-[#030406]/90 backdrop-blur p-6 flex gap-10">
          <div className="flex-1 max-w-md">
            <h3 className="text-[9px] text-gray-500 uppercase tracking-widest mb-2">Tactical Definition</h3>
            <AnimatePresence mode="wait">
              <motion.p key={activeState.id} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 5 }} className="text-sm text-cyan-100/80 leading-relaxed font-light">
                {activeState.desc}
              </motion.p>
            </AnimatePresence>
          </div>
          <div className="w-px bg-white/10 mx-4" />
          <div className="w-48 space-y-3">
             <div className="flex justify-between text-[9px] text-gray-400"><span>EMS SPECTRUM</span><span className="text-cyan-400">KU-BAND</span></div>
             <div className="w-full h-px bg-white/10" />
             <div className="flex justify-between text-[9px] text-gray-400"><span>MODE CAT</span><span className={getCategory(activeState.id) === 'KINETIC' ? "text-rose-400" : "text-emerald-400"}>{getCategory(activeState.id)}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
