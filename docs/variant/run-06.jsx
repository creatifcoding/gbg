import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';

// --- SPECIMEN DATA ---
const specimens = [
  {
    id: 'OD-2394',
    title: 'Odontodactylus scyllarus',
    class: 'Stomatopoda',
    description: 'Dactyl club mechanics & structural characterization. Primary focus on impact dissipation through anisotropic architectural scaling.',
    longDescription: 'Odontodactylus scyllarus dactyl club exhibits extreme impact resistance via highly ordered helicoidal chitin architecture. Assessing for ceramic composite biomimicry.',
    status: 'WORKING',
    statusColor: 'emerald',
    gps: '-14.23, 143.51',
    tags: ['kinematics', 'materials', 'marine'],
    metrics: {
      mass: '42.80',
      impactVelocity: '23.4',
      peakForce: '1.50',
      cAxisModulus: '85.2',
      helicoidalPitch: '15.5°'
    },
    context: {
      depth: '-12.4',
      salinity: '35.2',
      temp: '24.8',
      substrate: 'Coral Rubble'
    },
    logEntries: [
      { text: 'Loading morphology dataset...', status: 'ok' },
      { text: 'Initializing finite element stress tensor array...', status: 'ok' },
      { text: 'Mapping helicoidal chitin fibers to volumetric grid...', status: 'info' },
      { text: 'Progress: [||||||||--] 82%', status: 'indent' },
      { text: 'Progress: [|||||||||-] 94%', status: 'indent' },
      { text: 'Mapping complete.', status: 'info' },
      { text: 'Executing impact simulation (1.5kN impulse)...', status: 'success' },
      { text: 'Tracking energy dissipation through herringbone layers...', status: 'info' },
      { text: 'WARN: Micro-fracture threshold approached at L-4 interface.', status: 'warning' },
      { text: 'Recalibrating toughness metrics based on crack deflection.', status: 'info' },
      { text: 'Awaiting manual verification of Bouligand structure integrity.', status: 'cursor' }
    ],
    breadcrumb: ['Catalog', 'Arthropoda', 'OD-2394']
  },
  {
    id: 'PX-1102',
    title: 'Uncharacterized Mycelial Network',
    class: 'Mycelium',
    description: 'Rapid structural stiffening under localized mechanical stress. Suspected non-Newtonian fluid dynamics within hyphae.',
    longDescription: 'Uncharacterized mycelial network exhibiting rapid structural stiffening under localized mechanical stress. Suspected non-Newtonian fluid dynamics within hyphae.',
    status: 'RAW',
    statusColor: 'amber',
    gps: 'unknown',
    tags: ['mycology', 'rheology', 'stress-resp'],
    metrics: {
      mass: '12.40',
      impactVelocity: '0.8',
      peakForce: '0.45',
      cAxisModulus: '4.2',
      helicoidalPitch: 'N/A'
    },
    context: {
      depth: '-0.5',
      salinity: '0.0',
      temp: '18.2',
      substrate: 'Decaying Wood'
    },
    logEntries: [
      { text: 'Detecting unknown substrate elasticity...', status: 'ok' },
      { text: 'Analyzing hyphal network growth rate...', status: 'ok' },
      { text: 'WARN: Fluid dynamics model failed to converge.', status: 'warning' },
      { text: 'Awaiting further sample collection.', status: 'cursor' }
    ],
    breadcrumb: ['Catalog', 'Fungi', 'PX-1102']
  },
  {
    id: 'AV-092',
    title: 'Strigiformes Primary Feather',
    class: 'Aves',
    description: 'Micro-serrations recorded during silent flight approach. Acoustic dampening profiles archived for fluid dynamic modeling.',
    longDescription: 'Strigiformes primary feather leading edge micro-serrations recorded during silent flight approach. Acoustic dampening profiles archived for fluid dynamic modeling.',
    status: 'FILED',
    statusColor: 'cyan',
    gps: '45.12, -122.98',
    tags: ['acoustics', 'aero', 'avian'],
    metrics: {
      mass: '0.02',
      impactVelocity: 'N/A',
      peakForce: 'N/A',
      cAxisModulus: 'N/A',
      helicoidalPitch: 'N/A'
    },
    context: {
      depth: 'N/A',
      salinity: 'N/A',
      temp: '12.5',
      substrate: 'Forest Canopy'
    },
    logEntries: [
      { text: 'Archiving acoustic dampening profile...', status: 'ok' },
      { text: 'Filed under Category A-04: Avian Morphology.', status: 'info' },
      { text: 'Data integrity verified.', status: 'success' }
    ],
    breadcrumb: ['Catalog', 'Aves', 'AV-092']
  },
  {
    id: 'AR-7734',
    title: 'Nephila clavipes Dragline Silk',
    class: 'Arachnida',
    description: 'Sample degraded post-extraction. Tensile strength readings compromised by uncontrolled humidity exposure during transit protocols.',
    longDescription: 'Nephila clavipes dragline silk sample degraded post-extraction. Tensile strength readings compromised by uncontrolled humidity exposure during transit protocols.',
    status: 'DEAD',
    statusColor: 'rose',
    gps: 'unknown',
    tags: ['polymer', 'tensile', 'corrupt'],
    metrics: {
      mass: 'N/A',
      impactVelocity: 'N/A',
      peakForce: 'N/A',
      cAxisModulus: 'N/A',
      helicoidalPitch: 'N/A'
    },
    context: {
      depth: 'N/A',
      salinity: 'N/A',
      temp: 'N/A',
      substrate: 'N/A'
    },
    logEntries: [
      { text: 'ERROR: Integrity check failed.', status: 'warning' },
      { text: 'Humidity exposure detected during transit.', status: 'warning' },
      { text: 'Sample marked as CORRUPT.', status: 'warning' }
    ],
    breadcrumb: ['Catalog', 'Arachnida', 'AR-7734']
  }
];

// --- STYLE INJECTION ---
const StyleInjector = () => {
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&family=JetBrains+Mono:wght@100;400;500&display=swap');
      body {
        font-family: 'Inter', sans-serif;
        background-color: #000000;
        color: #d4d4d8;
      }
      .font-mono {
        font-family: 'JetBrains Mono', monospace;
      }
      .custom-scrollbar::-webkit-scrollbar {
        width: 4px;
        height: 4px;
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background: #000000;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #1f1f22;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: #3f3f46;
      }
      .scanlines {
        position: relative;
      }
      .scanlines::before {
        content: " ";
        display: block;
        position: absolute;
        top: 0;
        left: 0;
        bottom: 0;
        right: 0;
        background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
        z-index: 50;
        background-size: 100% 2px, 3px 100%;
        pointer-events: none;
      }
      @keyframes blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0; }
      }
      .cursor-blink {
        animation: blink 1s step-end infinite;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);
  return null;
};

// --- REUSABLE COMPONENTS ---

const StatusBadge = ({ status, color }) => {
  const colorMap = {
    emerald: 'text-emerald-500 border-emerald-900/40 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]',
    amber: 'text-amber-500 border-amber-900/40 bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]',
    cyan: 'text-cyan-500 border-cyan-900/40 bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.4)]',
    rose: 'text-rose-500 border-rose-900/40 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]'
  };

  const isAnimated = color === 'emerald';

  return (
    <div className={`absolute top-2 right-2 flex items-center gap-1.5 bg-black text-[9px] font-mono px-2 py-1 uppercase tracking-wider border shadow-[0_2px_8px_rgba(0,0,0,0.8)] ${colorMap[color] || colorMap.emerald}`}>
      <div className={`w-1.5 h-1.5 rounded-none ${isAnimated ? 'animate-pulse' : ''}`} />
      {status}
    </div>
  );
};

const SpecimenCard = ({ data, isSelected, onClick }) => {
  const isWorking = data.status === 'WORKING';
  const baseOpacity = isWorking ? 'opacity-100' : (data.status === 'DEAD' ? 'opacity-60 hover:opacity-100' : 'opacity-80 hover:opacity-100');
  const bgColor = isWorking ? 'bg-[#0a0a0a] border-zinc-600' : (data.status === 'DEAD' ? 'bg-[#050505] border-zinc-900 hover:border-zinc-800' : 'bg-[#080808] border-zinc-800 hover:border-zinc-700');
  const textColor = isWorking ? 'text-zinc-300' : 'text-zinc-400 group-hover:text-zinc-300';
  const tagBg = isWorking ? 'bg-zinc-900' : 'bg-zinc-900/50';
  const tagBorder = isWorking ? 'border-zinc-800' : 'border-zinc-800/50';
  const tagText = isWorking ? 'text-zinc-400' : 'text-zinc-500';
  const idColor = isWorking ? 'text-zinc-500' : 'text-zinc-600';
  const gpsColor = isWorking ? 'text-zinc-600' : 'text-zinc-700';

  return (
    <article 
      onClick={onClick}
      className={`${bgColor} ${baseOpacity} transition-all cursor-pointer group relative ${isSelected ? 'ring-1 ring-inset ring-zinc-500' : ''}`}
    >
      <div className="h-32 w-full bg-zinc-900 relative overflow-hidden">
        {isWorking ? (
          <>
            <div className="absolute inset-0 bg-[#111] opacity-50" />
            <div className="absolute top-1/2 left-1/2 w-8 h-8 -ml-4 -mt-4 border border-zinc-800/50 rounded-full flex items-center justify-center pointer-events-none">
              <div className="w-1 h-1 bg-zinc-700/50 rounded-full" />
            </div>
          </>
        ) : data.status === 'DEAD' ? (
          <>
            <div className="absolute inset-0 bg-zinc-950" />
            <div className="absolute inset-0 flex items-center justify-center">
              <i className="ph ph-warning-circle text-zinc-800 text-3xl" />
            </div>
          </>
        ) : (
          <>
            <div className={`absolute inset-0 ${data.status === 'FILED' ? 'bg-[#0f0f11]' : 'bg-[#0a0a0a]'}`} />
            {data.status === 'RAW' && (
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSJub25lIi8+CjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz4KPC9zdmc+')]" />
            )}
            {data.status === 'FILED' && (
              <div className="absolute top-1/2 left-0 w-full h-[1px] bg-zinc-800/30" />
            )}
          </>
        )}
        <StatusBadge status={data.status} color={data.statusColor} />
      </div>

      <div className="p-4 flex flex-col gap-3">
        <p className={`text-[13px] leading-snug font-medium line-clamp-3 ${textColor}`}>
          {data.longDescription}
        </p>
        <div className="flex gap-1.5 font-mono text-[9px] uppercase tracking-wider">
          {data.tags.map(tag => (
            <span key={tag} className={`${tagBg} ${tagText} px-1.5 py-0.5 border ${tagBorder}`}>
              {tag}
            </span>
          ))}
        </div>
        <div className="flex justify-between items-end text-[10px] font-mono mt-1 border-t border-zinc-900 pt-3">
          <span className={idColor}>ID: {data.id}</span>
          <span className={gpsColor}>{data.gps}</span>
        </div>
      </div>
    </article>
  );
};

const DetailView = ({ specimen }) => {
  if (!specimen) return (
    <div className="flex items-center justify-center h-full text-zinc-600 font-mono text-sm">
      Select a specimen from the catalog to view details.
    </div>
  );

  const logColor = (status) => {
    switch (status) {
      case 'ok': return 'text-zinc-400';
      case 'success': return 'text-emerald-500';
      case 'warning': return 'text-amber-500';
      case 'indent': return 'text-zinc-400 pl-4';
      default: return 'text-zinc-500';
    }
  };

  return (
    <div className="flex-1 flex flex-col relative bg-black scanlines">
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '64px 64px' }} />
      
      <header className="h-14 border-b border-zinc-900 flex items-center px-8 justify-between font-mono text-xs z-10 bg-black/80 backdrop-blur-sm">
        <nav className="flex items-center gap-3 text-zinc-600 uppercase tracking-widest">
          {specimen.breadcrumb.map((item, idx) => (
            <React.Fragment key={idx}>
              <span className={`hover:text-zinc-300 cursor-pointer transition-colors ${idx === specimen.breadcrumb.length - 1 ? `text-${specimen.statusColor}-500 border-b border-${specimen.statusColor}-500/30 pb-0.5` : ''}`}>
                {item}
              </span>
              {idx < specimen.breadcrumb.length - 1 && <span>/</span>}
            </React.Fragment>
          ))}
        </nav>
        <div className="flex gap-6">
          <button className="text-zinc-500 hover:text-zinc-300 flex items-center gap-2 transition-colors">
            <i className="ph ph-sliders-horizontal text-sm" />
            <span className="uppercase tracking-widest text-[10px]">Adjust Parameters</span>
          </button>
          <button className="text-zinc-500 hover:text-zinc-300 flex items-center gap-2 transition-colors">
            <i className="ph ph-export text-sm" />
            <span className="uppercase tracking-widest text-[10px]">Export Dataset</span>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-10 z-10 custom-scrollbar">
        <div className="max-w-6xl mx-auto space-y-12 pb-20">
          <header className="space-y-4">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-light text-zinc-100 tracking-tight">{specimen.title}</h1>
              <span className="bg-zinc-900 border border-zinc-700 text-zinc-400 font-mono text-[10px] px-2 py-1 uppercase tracking-widest">
                Class: {specimen.class}
              </span>
            </div>
            <p className="font-mono text-zinc-500 text-sm max-w-2xl leading-relaxed">
              {specimen.description}
            </p>
          </header>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            <div className="xl:col-span-8 space-y-6">
              <figure className="aspect-[16/9] bg-[#050505] border border-zinc-800 relative group overflow-hidden">
                <div className="absolute inset-0 bg-[#0a0a0a]" />
                <div className="absolute bottom-6 left-6 font-mono text-[10px] text-zinc-500 bg-black px-2 py-1 border border-zinc-900 z-10 uppercase tracking-widest">
                  CAM_04 // RAW_FRAME_893.DNG
                </div>
                <div className="absolute bottom-6 right-6 flex flex-col items-end gap-1 z-10">
                  <div className="w-24 h-[1px] bg-zinc-500 flex justify-between">
                    <div className="w-[1px] h-2 bg-zinc-500 -mt-1" />
                    <div className="w-[1px] h-2 bg-zinc-500 -mt-1" />
                  </div>
                  <span className="font-mono text-[10px] text-zinc-500">10 mm</span>
                </div>
                <div className="absolute inset-0 pointer-events-none opacity-20">
                  <div className="absolute top-1/2 left-0 w-full h-[1px] bg-emerald-500" />
                  <div className="absolute left-1/2 top-0 w-[1px] h-full bg-emerald-500" />
                  <div className="absolute top-1/2 left-1/2 w-16 h-16 -ml-8 -mt-8 border border-emerald-500 rounded-none" />
                </div>
              </figure>

              <div className="grid grid-cols-3 gap-6">
                <div className="aspect-square border border-zinc-900 bg-[#030303] p-3 flex flex-col">
                  <header className="flex justify-between items-center mb-3">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">SEM_SCAN_01</span>
                    <i className="ph ph-scan text-zinc-700" />
                  </header>
                  <div className="flex-1 bg-zinc-950 border border-zinc-900 relative">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-800 to-black opacity-30" />
                  </div>
                </div>

                <div className="aspect-square border border-zinc-900 bg-[#030303] p-3 flex flex-col">
                  <header className="flex justify-between items-center mb-3">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">CT_SLICE_Y</span>
                    <i className="ph ph-stack text-zinc-700" />
                  </header>
                  <div className="flex-1 bg-zinc-950 border border-zinc-900 relative flex items-center justify-center">
                    <div className="w-3/4 h-3/4 border-[0.5px] border-emerald-900/30 rounded-full flex items-center justify-center">
                      <div className="w-2/3 h-2/3 border-[0.5px] border-emerald-900/50 rounded-full flex items-center justify-center">
                        <div className="w-1/3 h-1/3 border-[0.5px] border-emerald-900/80 rounded-full bg-emerald-950/20" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="aspect-square border border-zinc-900 bg-[#030303] p-3 flex flex-col">
                  <header className="flex justify-between items-center mb-3">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">SPECTRA_XYZ</span>
                    <i className="ph ph-chart-line text-zinc-700" />
                  </header>
                  <div className="flex-1 relative border-l border-b border-zinc-800 ml-2 mb-2">
                    <svg className="absolute inset-0 w-full h-full p-2" preserveAspectRatio="none" viewBox="0 0 100 100">
                      <line x1="0" y1="25" x2="100" y2="25" stroke="#111" strokeWidth="0.5" />
                      <line x1="0" y1="50" x2="100" y2="50" stroke="#111" strokeWidth="0.5" />
                      <line x1="0" y1="75" x2="100" y2="75" stroke="#111" strokeWidth="0.5" />
                      <polyline fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinejoin="bevel" points="0,95 15,85 25,30 35,10 45,40 55,70 70,85 100,90" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <div className="xl:col-span-4 space-y-6">
              <div className="border border-zinc-800 bg-[#050505] p-5">
                <h3 className="font-mono text-zinc-500 uppercase tracking-widest text-[10px] mb-4 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-zinc-700" />
                  Morphological Metrics
                </h3>
                <dl className="space-y-3 font-mono text-xs">
                  <div className="flex justify-between border-b border-zinc-900 pb-2">
                    <dt className="text-zinc-600">Specimen Mass</dt>
                    <dd className="text-zinc-300">{specimen.metrics.mass} <span className="text-zinc-600">g</span></dd>
                  </div>
                  <div className="flex justify-between border-b border-zinc-900 pb-2">
                    <dt className="text-zinc-600">Impact Velocity (Peak)</dt>
                    <dd className="text-zinc-300">{specimen.metrics.impactVelocity} <span className="text-zinc-600">m/s</span></dd>
                  </div>
                  <div className="flex justify-between border-b border-zinc-900 pb-2">
                    <dt className="text-zinc-600">Peak Force Generated</dt>
                    <dd className="text-zinc-300">{specimen.metrics.peakForce} <span className="text-zinc-600">kN</span></dd>
                  </div>
                  <div className="flex justify-between border-b border-zinc-900 pb-2">
                    <dt className="text-zinc-600">C-Axis Modulus</dt>
                    <dd className="text-zinc-300">{specimen.metrics.cAxisModulus} <span className="text-zinc-600">GPa</span></dd>
                  </div>
                  <div className="flex justify-between pt-1">
                    <dt className="text-zinc-600">Helicoidal Pitch Angle</dt>
                    <dd className="text-zinc-300 text-emerald-500">{specimen.metrics.helicoidalPitch}</dd>
                  </div>
                </dl>
              </div>

              <div className="border border-zinc-800 bg-[#050505] p-5">
                <h3 className="font-mono text-zinc-500 uppercase tracking-widest text-[10px] mb-4 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-zinc-700" />
                  Collection Context
                </h3>
                <dl className="grid grid-cols-2 gap-4 font-mono text-xs">
                  <div>
                    <dt className="text-zinc-600 mb-1">Depth</dt>
                    <dd className="text-zinc-300">{specimen.context.depth} <span className="text-zinc-600">m</span></dd>
                  </div>
                  <div>
                    <dt className="text-zinc-600 mb-1">Salinity</dt>
                    <dd className="text-zinc-300">{specimen.context.salinity} <span className="text-zinc-600">ppt</span></dd>
                  </div>
                  <div>
                    <dt className="text-zinc-600 mb-1">Temp (In-situ)</dt>
                    <dd className="text-zinc-300">{specimen.context.temp} <span className="text-zinc-600">°C</span></dd>
                  </div>
                  <div>
                    <dt className="text-zinc-600 mb-1">Substrate</dt>
                    <dd className="text-zinc-300 uppercase">{specimen.context.substrate}</dd>
                  </div>
                </dl>
              </div>

              <div className="border border-zinc-800 bg-black p-5 h-64 flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 w-4 h-4 border-l border-b border-zinc-800 bg-[#050505]" />
                <h3 className="font-mono text-zinc-600 uppercase tracking-widest text-[10px] mb-4 flex justify-between items-center border-b border-zinc-900 pb-2">
                  <span>Sys_Log // Live Compute</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500/20 border border-emerald-500 animate-pulse" />
                </h3>
                <div className="flex-1 font-mono text-[10px] text-zinc-500 space-y-1.5 leading-relaxed overflow-y-auto custom-scrollbar flex flex-col justify-end pb-2">
                  {specimen.logEntries.map((entry, idx) => (
                    <div key={idx} className={logColor(entry.status)}>
                      {entry.status === 'cursor' ? (
                        <span className="text-zinc-300">&gt; {entry.text}<span className="cursor-blink">_</span></span>
                      ) : (
                        <span>&gt; {entry.text}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- MAIN PAGE COMPONENT ---

const LabPage = () => {
  const [selectedId, setSelectedId] = useState('OD-2394');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const selectedSpecimen = specimens.find(s => s.id === selectedId);

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-black selection:bg-cyan-900/50 selection:text-cyan-100 antialiased">
      <aside className="w-[380px] flex flex-col border-r border-zinc-900 bg-[#030303] flex-shrink-0 z-20 shadow-[4px_0_24px_rgba(0,0,0,0.8)]">
        <header className="h-14 border-b border-zinc-900 flex items-center px-5 justify-between font-mono text-xs uppercase tracking-widest bg-black">
          <div className="flex items-center gap-2 text-zinc-400">
            <i className="ph ph-hexagon text-zinc-500" />
            <span className="text-zinc-300 font-medium tracking-[0.2em]">SPECIMEN_DB</span>
          </div>
          <span className="text-zinc-600">SYS.09</span>
        </header>

        <div className="p-4 border-b border-zinc-900 bg-[#050505]">
          <div 
            onClick={() => setIsModalOpen(true)}
            className="border border-dashed border-zinc-800 bg-[#0a0a0a] hover:bg-[#111111] hover:border-zinc-600 transition-colors cursor-pointer h-24 flex flex-col items-center justify-center text-center gap-1.5 group relative overflow-hidden"
          >
            <i className="ph ph-download-simple text-xl text-zinc-600 group-hover:text-zinc-400" />
            <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest group-hover:text-zinc-300">Intake Drop Zone</span>
            <div className="absolute top-1 left-1 w-2 h-2 border-t border-l border-zinc-700 opacity-50" />
            <div className="absolute top-1 right-1 w-2 h-2 border-t border-r border-zinc-700 opacity-50" />
            <div className="absolute bottom-1 left-1 w-2 h-2 border-b border-l border-zinc-700 opacity-50" />
            <div className="absolute bottom-1 right-1 w-2 h-2 border-b border-r border-zinc-700 opacity-50" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[#020202]">
          {specimens.map(specimen => (
            <SpecimenCard 
              key={specimen.id}
              data={specimen}
              isSelected={selectedId === specimen.id}
              onClick={() => setSelectedId(specimen.id)}
            />
          ))}
        </div>
      </aside>

      <DetailView specimen={selectedSpecimen} />

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0a0a0a] border border-zinc-700 p-8 w-full max-w-md relative shadow-[0_0_40px_rgba(0,0,0,1)]">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <i className="ph ph-x text-lg" />
            </button>
            <h2 className="text-zinc-300 font-mono text-sm uppercase tracking-widest mb-6 border-b border-zinc-800 pb-2">
              New Intake Protocol
            </h2>
            <div className="border-2 border-dashed border-zinc-800 rounded-sm h-48 flex flex-col items-center justify-center gap-4 hover:border-zinc-600 hover:bg-[#111] transition-colors cursor-pointer">
              <i className="ph ph-upload-simple text-3xl text-zinc-700" />
              <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">Drop Files Here</span>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-zinc-800 text-zinc-500 font-mono text-[10px] uppercase tracking-widest hover:border-zinc-600 hover:text-zinc-300 transition-colors"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-emerald-950/30 border border-emerald-900/40 text-emerald-500 font-mono text-[10px] uppercase tracking-widest hover:bg-emerald-950/50 transition-colors">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- APP COMPONENT ---

const App = () => {
  return (
    <Router>
      <StyleInjector />
      <Routes>
        <Route path="*" element={<LabPage />} />
      </Routes>
    </Router>
  );
};

export default App;