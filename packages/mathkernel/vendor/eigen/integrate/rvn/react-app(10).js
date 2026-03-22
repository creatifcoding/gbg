import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';

const customStyles = {
  root: {
    '--bg': '#e6e6e6',
    '--surface': '#ffffff',
    '--surface-highlight': '#f0f0f0',
    '--border': '#000000',
    '--text-main': '#000000',
    '--text-inv': '#ffffff',
    '--text-muted': '#666666',
    '--accent': '#000000',
    '--font-sans': "'Helvetica Neue', Helvetica, Arial, sans-serif",
    '--font-mono': "'Courier New', Courier, monospace",
    '--space-xs': '4px',
    '--space-s': '10px',
    '--space-m': '20px',
    '--space-l': '30px',
    '--space-xl': '60px',
    '--border-w': '3px'
  },
  body: {
    backgroundColor: 'var(--bg)',
    color: 'var(--text-main)',
    fontFamily: 'var(--font-sans)',
    fontSize: '14px',
    lineHeight: '1.4',
    WebkitFontSmoothing: 'antialiased',
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    padding: '40px'
  },
  blueprintArea: {
    backgroundColor: '#f8f8f8',
    backgroundImage: 'linear-gradient(#ddd 1px, transparent 1px), linear-gradient(90deg, #ddd 1px, transparent 1px)',
    backgroundSize: '20px 20px',
    border: '1px solid #000',
    position: 'relative',
    overflow: 'hidden',
    minHeight: '500px'
  }
};

const Button = ({ children, onClick, style, className = '' }) => {
  const [isActive, setIsActive] = useState(false);

  return (
    <button
      className={`btn ${className}`}
      onClick={onClick}
      onMouseDown={() => setIsActive(true)}
      onMouseUp={() => setIsActive(false)}
      onMouseLeave={() => setIsActive(false)}
      style={{
        background: 'transparent',
        border: 'var(--border-w) solid var(--border)',
        color: 'var(--text-main)',
        padding: '12px 24px',
        fontFamily: 'var(--font-sans)',
        fontWeight: '700',
        fontSize: '12px',
        textTransform: 'uppercase',
        cursor: 'pointer',
        transition: 'all 0.2s',
        borderRadius: '0',
        boxShadow: isActive ? 'none' : '4px 4px 0px rgba(0,0,0,1)',
        transform: isActive ? 'translate(4px, 4px)' : 'translate(0, 0)',
        ...style
      }}
    >
      {children}
    </button>
  );
};

const NavItem = ({ to, children, active = false }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Link
      to={to}
      className="nav-item"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        color: isHovered || active ? 'var(--text-inv)' : 'var(--text-muted)',
        textDecoration: 'none',
        fontSize: '14px',
        fontWeight: '700',
        transition: 'all 0.2s',
        background: isHovered || active ? 'var(--text-main)' : 'transparent',
        padding: isHovered || active ? '0 5px' : '0'
      }}
    >
      {children}
    </Link>
  );
};

const Panel = ({ title, subtitle, children, style }) => {
  return (
    <div className="panel" style={{
      border: 'var(--border-w) solid var(--border)',
      background: 'var(--surface)',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      ...style
    }}>
      <div style={{
        borderBottom: 'var(--border-w) solid var(--border)',
        padding: 'var(--space-s) var(--space-m)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--text-main)',
        color: 'var(--surface)'
      }}>
        <span style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: '700',
          fontSize: '14px',
          textTransform: 'uppercase',
          color: 'white'
        }}>
          {title}
        </span>
        {subtitle && (
          <span className="mono" style={{ fontSize: '10px' }}>
            {subtitle}
          </span>
        )}
      </div>
      <div style={{ padding: 'var(--space-m)', flex: 1 }}>
        {children}
      </div>
    </div>
  );
};

const DiagnosticsPage = () => {
  const [techNote, setTechNote] = useState(`RE: CORE INSTABILITY
Unit TX-99 is showing repeated power surges in Sector 04. Recommend grounding the primary Reaper capacitor. 

Thermal signatures are exceeding safety margins by 12%. Do not deploy in high-temp zones.

- Technician K. J. (ID: 884)`);

  const handleRunFullSuite = () => {
    alert('Running full diagnostic suite...');
  };

  const handleReturnToLive = () => {
    alert('Returning to live view...');
  };

  const handleCommitNote = () => {
    alert('Note committed to maintenance log');
  };

  const testResults = [
    {
      moduleId: 'CPU_CORE_01',
      description: 'Instruction cycle validation',
      voltage: '1.25V',
      latency: '0.2ms',
      status: 'PASS',
      pass: true
    },
    {
      moduleId: 'PWR_DIST_B',
      description: 'Load balancing stress test',
      voltage: '48.0V',
      latency: '4.5ms',
      status: 'FAIL: UNSTABLE',
      pass: false
    },
    {
      moduleId: 'COMMS_ARRAY',
      description: 'Sub-space encryption handshake',
      voltage: '5.00V',
      latency: '122ms',
      status: 'PASS',
      pass: true
    },
    {
      moduleId: 'OPTIC_V3',
      description: 'Thermal imaging calibration',
      voltage: '3.30V',
      latency: '0.8ms',
      status: 'PASS',
      pass: true
    }
  ];

  const maintenanceHistory = [
    {
      date: '2024.05.12',
      type: 'Field Repair',
      note: 'Replaced hydraulic seal in right kinetic joint. Pressure normalized. Partial cooling fluid refill.'
    },
    {
      date: '2024.04.30',
      type: 'Software Patch',
      note: 'Firmware update v9.2.1 applied. Patched targeting logic bug in low-light environments.'
    },
    {
      date: '2024.03.15',
      type: 'Overhaul',
      note: 'Full chassis integrity check. Arc-reactor shielding reinforced with lead-titanium alloy.'
    }
  ];

  return (
    <>
      <header style={{
        borderBottom: 'var(--border-w) solid var(--border)',
        paddingBottom: 'var(--space-l)',
        marginBottom: 'var(--space-m)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-l)',
          borderBottom: '1px solid #ccc',
          paddingBottom: 'var(--space-m)'
        }}>
          <div style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: '900',
            fontSize: '24px',
            letterSpacing: '-0.04em',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-s)'
          }}>
            <div style={{
              width: '24px',
              height: '24px',
              background: 'var(--text-main)',
              borderRadius: '50%'
            }}></div>
            HAVOC // OS
          </div>
          <nav className="mono" style={{
            display: 'flex',
            gap: 'var(--space-l)',
            textTransform: 'uppercase'
          }}>
            <NavItem to="/briefing">Briefing</NavItem>
            <NavItem to="/deployments" active>Deployments</NavItem>
            <NavItem to="/intel">Intel</NavItem>
            <NavItem to="/settings">Settings</NavItem>
          </nav>
          <div className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            MAINT_MODE.ACTIVE <span style={{ color: 'var(--accent)' }}>●</span>
          </div>
        </div>

        <div>
          <div>
            <div className="mono" style={{
              color: 'var(--text-main)',
              fontWeight: '700',
              fontSize: '12px',
              marginBottom: 'var(--space-s)',
              opacity: '0.5',
              textTransform: 'uppercase'
            }}>
              Deployments / TX-99 / Diagnostics
            </div>
            <h1 style={{
              fontSize: '80px',
              fontWeight: '900',
              letterSpacing: '-0.06em',
              lineHeight: '0.85',
              textTransform: 'uppercase',
              marginTop: 'var(--space-s)'
            }}>
              Unit <span style={{ color: 'var(--accent)' }}>TX-99</span> <span style={{ fontWeight: '300', fontSize: '0.5em', color: 'var(--text-muted)' }}>[DIAGNOSTIC]</span>
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-s)', marginTop: 'var(--space-m)' }}>
            <Button onClick={handleRunFullSuite}>Run Full Suite</Button>
            <Button onClick={handleReturnToLive} style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
              Return to Live
            </Button>
          </div>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 'var(--space-m)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-m)' }}>
          <Panel title="Component Schematics // Internal Frame 0-A" subtitle="RENDER: WIREFRAME_V4">
            <div style={customStyles.blueprintArea}>
              <svg viewBox="0 0 800 500" style={{
                width: '100%',
                height: '100%',
                stroke: '#000',
                fill: 'none',
                strokeWidth: '1.5'
              }}>
                <rect x="350" y="100" width="100" height="150"></rect>
                <circle cx="400" cy="70" r="30"></circle>
                <line x1="350" y1="120" x2="280" y2="250"></line>
                <line x1="450" y1="120" x2="520" y2="250"></line>
                <line x1="370" y1="250" x2="350" y2="450"></line>
                <line x1="430" y1="250" x2="450" y2="450"></line>
                <path d="M400,100 L400,200 M350,150 L450,150" strokeDasharray="4,2"></path>
              </svg>

              <div style={{
                width: '10px',
                height: '10px',
                background: '#000',
                position: 'absolute',
                borderRadius: '50%',
                top: '70px',
                left: '400px'
              }}></div>
              <div style={{
                position: 'absolute',
                border: '1px solid #000',
                background: '#fff',
                padding: '4px 8px',
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                fontWeight: '900',
                boxShadow: '3px 3px 0 #000',
                top: '40px',
                left: '440px'
              }}>
                PRIMARY SENSOR ARRAY [TX-01]
              </div>

              <div style={{
                width: '10px',
                height: '10px',
                background: '#000',
                position: 'absolute',
                borderRadius: '50%',
                top: '170px',
                left: '400px'
              }}></div>
              <div style={{
                position: 'absolute',
                border: '1px solid #000',
                background: '#fff',
                padding: '4px 8px',
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                fontWeight: '900',
                boxShadow: '3px 3px 0 #000',
                top: '170px',
                left: '460px'
              }}>
                ARC-REACTOR CORE // LEAK DETECTED
              </div>

              <div style={{
                width: '10px',
                height: '10px',
                background: '#000',
                position: 'absolute',
                borderRadius: '50%',
                top: '180px',
                left: '510px'
              }}></div>
              <div style={{
                position: 'absolute',
                border: '1px solid #000',
                background: '#fff',
                padding: '4px 8px',
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                fontWeight: '900',
                boxShadow: '3px 3px 0 #000',
                top: '220px',
                left: '540px'
              }}>
                REAPER COIL [OVERHEAT_SIG]
              </div>

              <div style={{
                width: '10px',
                height: '10px',
                background: '#000',
                position: 'absolute',
                borderRadius: '50%',
                top: '350px',
                left: '360px'
              }}></div>
              <div style={{
                position: 'absolute',
                border: '1px solid #000',
                background: '#fff',
                padding: '4px 8px',
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                fontWeight: '900',
                boxShadow: '3px 3px 0 #000',
                top: '380px',
                left: '240px'
              }}>
                HYDRAULIC ACTUATOR [NOMINAL]
              </div>

              <div style={{
                position: 'absolute',
                bottom: '10px',
                left: '10px',
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                opacity: '0.5'
              }}>
                TX-99 CHASSIS REV 12.4 // LAYER: 03_HARDWARE
              </div>
            </div>
          </Panel>

          <Panel title="System Test Results">
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px'
            }}>
              <thead>
                <tr>
                  <th style={{
                    textAlign: 'left',
                    background: '#f4f4f4',
                    padding: '8px',
                    borderBottom: '2px solid #000',
                    textTransform: 'uppercase'
                  }}>Module ID</th>
                  <th style={{
                    textAlign: 'left',
                    background: '#f4f4f4',
                    padding: '8px',
                    borderBottom: '2px solid #000',
                    textTransform: 'uppercase'
                  }}>Test Description</th>
                  <th style={{
                    textAlign: 'left',
                    background: '#f4f4f4',
                    padding: '8px',
                    borderBottom: '2px solid #000',
                    textTransform: 'uppercase'
                  }}>Voltage</th>
                  <th style={{
                    textAlign: 'left',
                    background: '#f4f4f4',
                    padding: '8px',
                    borderBottom: '2px solid #000',
                    textTransform: 'uppercase'
                  }}>Latency</th>
                  <th style={{
                    textAlign: 'left',
                    background: '#f4f4f4',
                    padding: '8px',
                    borderBottom: '2px solid #000',
                    textTransform: 'uppercase'
                  }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {testResults.map((test, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{test.moduleId}</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{test.description}</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{test.voltage}</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{test.latency}</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                      <span style={test.pass ? {
                        color: '#000',
                        fontWeight: '900',
                        background: '#e0ffe0',
                        padding: '2px 4px',
                        border: '1px solid #000'
                      } : {
                        color: '#fff',
                        background: '#000',
                        padding: '2px 4px'
                      }}>
                        {test.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-m)' }}>
          <Panel title="Maintenance History" style={{ flex: 1 }}>
            {maintenanceHistory.map((entry, idx) => (
              <div key={idx} style={{
                borderBottom: idx < maintenanceHistory.length - 1 ? '1px solid #000' : 'none',
                paddingBottom: '10px',
                marginBottom: '10px'
              }}>
                <div className="mono" style={{
                  fontSize: '11px',
                  marginBottom: '4px',
                  textTransform: 'uppercase'
                }}>
                  {entry.date} // {entry.type}
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  padding: 'var(--space-s)',
                  borderLeft: '4px solid #000',
                  background: '#f9f9f9',
                  marginBottom: 'var(--space-s)'
                }}>
                  {entry.note}
                </div>
              </div>
            ))}
          </Panel>

          <Panel title="Technician Notes" style={{ height: '300px' }}>
            <textarea
              value={techNote}
              onChange={(e) => setTechNote(e.target.value)}
              style={{
                width: '100%',
                height: '180px',
                border: '1px solid #000',
                padding: '10px',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                resize: 'none'
              }}
            />
            <Button onClick={handleCommitNote} style={{ width: '100%', marginTop: '10px', fontSize: '10px' }}>
              Commit Note
            </Button>
          </Panel>
        </div>
      </div>

      <div className="mono" style={{
        marginTop: 'var(--space-xl)',
        borderTop: '1px solid var(--border)',
        paddingTop: 'var(--space-m)',
        fontSize: '10px',
        color: 'var(--text-muted)',
        display: 'flex',
        justifyContent: 'space-between'
      }}>
        <span>HAVOC SYSTEMS INC. // MAINTENANCE DIVISION</span>
        <span>PROTO: DIAG_STMT_33 // SESSION: 0x442A99</span>
      </div>
    </>
  );
};

const PlaceholderPage = ({ title }) => {
  return (
    <div style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>
      <h1 style={{ fontSize: '48px', fontWeight: '900', marginBottom: 'var(--space-m)' }}>
        {title}
      </h1>
      <p style={{ fontSize: '18px', color: 'var(--text-muted)' }}>
        This page is under construction
      </p>
      <Link to="/deployments">
        <Button style={{ marginTop: 'var(--space-l)' }}>Return to Deployments</Button>
      </Link>
    </div>
  );
};

const App = () => {
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      ::-webkit-scrollbar { width: 0px; }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  return (
    <Router basename="/">
      <div style={{ ...customStyles.root, ...customStyles.body }}>
        <div style={{
          background: 'var(--surface)',
          maxWidth: '1400px',
          width: '100%',
          padding: 'var(--space-xl)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-l)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.1)',
          border: 'var(--border-w) solid var(--border)'
        }}>
          <Routes>
            <Route path="/" element={<DiagnosticsPage />} />
            <Route path="/deployments" element={<DiagnosticsPage />} />
            <Route path="/briefing" element={<PlaceholderPage title="Briefing" />} />
            <Route path="/intel" element={<PlaceholderPage title="Intel" />} />
            <Route path="/settings" element={<PlaceholderPage title="Settings" />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
};

export default App;