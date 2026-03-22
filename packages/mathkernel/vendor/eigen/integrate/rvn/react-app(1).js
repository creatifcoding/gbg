import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';

const customStyles = {
  ':root': {
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
  }
};

const TelemetryBar = ({ label, value, isCritical = false }) => {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'Courier New', Courier, monospace", textTransform: 'uppercase', fontSize: '10px', fontWeight: 600 }}>
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div style={{ height: '16px', background: 'white', border: '2px solid black', width: '100%', marginTop: '5px' }}>
        <div style={{
          height: '100%',
          width: value,
          background: isCritical ? 'repeating-linear-gradient(45deg, #000, #000 5px, #fff 5px, #fff 10px)' : 'black'
        }}></div>
      </div>
    </div>
  );
};

const EquipmentCard = ({ category, name, status, statusColor }) => {
  return (
    <div style={{ border: '2px solid #000000', padding: '20px', background: '#ffffff', boxShadow: '4px 4px 0 rgba(0,0,0,0.1)' }}>
      <div style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '9px', color: '#666666' }}>{category}</div>
      <div style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '11px', fontWeight: 600 }}>{name}</div>
      <div style={{
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
        fontSize: '10px',
        padding: '4px 8px',
        border: '1px solid #000000',
        display: 'inline-block',
        background: 'black',
        color: 'white',
        fontWeight: 700,
        marginTop: '8px',
        textTransform: 'uppercase'
      }}>{status}</div>
    </div>
  );
};

const LogEntry = ({ timestamp, message, isAlert = false }) => {
  return (
    <div style={{
      fontFamily: "'Courier New', Courier, monospace",
      fontSize: '11px',
      marginBottom: '10px',
      paddingBottom: '10px',
      borderBottom: '1px solid #ddd',
      fontWeight: 600
    }}>
      <span style={{ color: '#000000', fontWeight: 700, marginRight: '10px' }}>{timestamp}</span>
      <span style={isAlert ? { color: 'white', background: 'black', padding: '0 4px', fontWeight: 'bold' } : {}}>{message}</span>
    </div>
  );
};

const App = () => {
  const [activeNav, setActiveNav] = useState('Deployments');

  useEffect(() => {
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      ::-webkit-scrollbar { width: 0px; height: 0px; }
      .crosshair-corner {
        position: absolute;
        border-style: solid;
        border-color: black;
        border-width: 3px;
        width: 20px;
        height: 20px;
      }
      .crosshair-corner.top-left {
        top: 10px;
        left: 10px;
        border-right: none;
        border-bottom: none;
      }
      .crosshair-corner.top-right {
        top: 10px;
        right: 10px;
        border-left: none;
        border-bottom: none;
      }
      .crosshair-corner.bottom-left {
        bottom: 10px;
        left: 10px;
        border-right: none;
        border-top: none;
      }
      .crosshair-corner.bottom-right {
        bottom: 10px;
        right: 10px;
        border-left: none;
        border-top: none;
      }
    `;
    document.head.appendChild(styleEl);
    return () => document.head.removeChild(styleEl);
  }, []);

  return (
    <Router basename="/">
      <div style={{ 
        backgroundColor: '#e6e6e6', 
        color: '#000000', 
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
        fontSize: '14px',
        lineHeight: 1.4,
        WebkitFontSmoothing: 'antialiased',
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        padding: '40px'
      }}>
        <div style={{
          background: '#ffffff',
          maxWidth: '1400px',
          width: '100%',
          padding: '60px',
          display: 'flex',
          flexDirection: 'column',
          gap: '30px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.1)',
          border: '3px solid #000000'
        }}>
          <header style={{ borderBottom: '3px solid #000000', paddingBottom: '30px', marginBottom: '20px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '30px',
              borderBottom: '1px solid #ccc',
              paddingBottom: '20px'
            }}>
              <div style={{
                fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                fontWeight: 900,
                fontSize: '24px',
                letterSpacing: '-0.04em',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  background: '#000000',
                  borderRadius: '50%'
                }}></div>
                HAVOC // OS
              </div>
              <nav style={{ display: 'flex', gap: '30px', fontFamily: "'Courier New', Courier, monospace", textTransform: 'uppercase', fontWeight: 600, letterSpacing: '-0.02em' }}>
                {['Briefing', 'Deployments', 'Intel', 'Settings'].map(item => (
                  <a
                    key={item}
                    href="#"
                    onClick={(e) => { e.preventDefault(); setActiveNav(item); }}
                    style={{
                      color: activeNav === item ? 'white' : '#666666',
                      background: activeNav === item ? '#000000' : 'transparent',
                      padding: activeNav === item ? '0 5px' : '0',
                      textDecoration: 'none',
                      fontSize: '14px',
                      fontWeight: 700,
                      transition: 'all 0.2s'
                    }}
                  >
                    {item}
                  </a>
                ))}
              </nav>
              <div style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '11px', color: '#666666', fontWeight: 600 }}>
                UNIT_SYNC.ACTIVE <span style={{ color: '#000000' }}>●</span>
              </div>
            </div>

            <div>
              <div>
                <div style={{ 
                  color: '#000000', 
                  fontWeight: 700, 
                  fontSize: '12px', 
                  marginBottom: '10px', 
                  opacity: 0.5,
                  fontFamily: "'Courier New', Courier, monospace",
                  textTransform: 'uppercase',
                  letterSpacing: '-0.02em'
                }}>
                  Deployments / Sector 04 / TX-99
                </div>
                <h1 style={{
                  fontSize: '80px',
                  fontWeight: 900,
                  letterSpacing: '-0.06em',
                  lineHeight: 0.85,
                  textTransform: 'uppercase',
                  marginTop: '10px'
                }}>
                  Unit <span style={{ color: 'black', fontWeight: 900 }}>TX-99</span>{' '}
                  <span style={{ fontWeight: 300, fontSize: '0.5em', color: '#666666' }}>[TITAN-CLASS]</span>
                </h1>
              </div>
              <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                <button style={{
                  background: 'transparent',
                  border: '3px solid #000000',
                  color: '#000000',
                  padding: '12px 24px',
                  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                  fontWeight: 700,
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  borderRadius: 0,
                  boxShadow: '4px 4px 0px rgba(0,0,0,1)'
                }}>
                  Diagnostic
                </button>
                <button style={{
                  background: 'transparent',
                  border: '3px solid black',
                  color: 'black',
                  padding: '12px 24px',
                  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                  fontWeight: 700,
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  borderRadius: 0,
                  boxShadow: '4px 4px 0px rgba(0,0,0,1)'
                }}>
                  Emergency Recall
                </button>
              </div>
            </div>
          </header>

          <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr 350px', gap: '30px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ border: '3px solid #000000', background: '#ffffff', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{
                  borderBottom: '3px solid #000000',
                  padding: '10px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#000000',
                  color: '#ffffff'
                }}>
                  <span style={{
                    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                    fontWeight: 700,
                    fontSize: '14px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: 'white'
                  }}>Vital Telemetry</span>
                </div>
                <div style={{ padding: '20px', flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <TelemetryBar label="Power Core" value="24%" isCritical={true} />
                  <TelemetryBar label="Structural Integrity" value="88%" />
                  <TelemetryBar label="CPU Load" value="94%" />
                  <TelemetryBar label="Signal Strength" value="-84 dBm" />
                </div>
              </div>

              <div style={{ border: '3px solid #000000', background: '#ffffff', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{
                  borderBottom: '3px solid #000000',
                  padding: '10px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#000000',
                  color: '#ffffff'
                }}>
                  <span style={{
                    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                    fontWeight: 700,
                    fontSize: '14px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: 'white'
                  }}>Hardware Status</span>
                </div>
                <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  <EquipmentCard category="OPTICS" name="MK-IV LENS" status="NOMINAL" />
                  <EquipmentCard category="WEAPON" name="ARC-REAPER" status="OVERHEAT" />
                  <EquipmentCard category="LOCO" name="HYDRAULIC" status="NOMINAL" />
                  <EquipmentCard category="COMMS" name="ENCRYPT-X" status="NOMINAL" />
                </div>
              </div>
            </div>

            <div style={{ border: '3px solid #000000', background: '#ffffff', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{
                borderBottom: '3px solid #000000',
                padding: '10px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#000000',
                color: '#ffffff'
              }}>
                <span style={{
                  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                  fontWeight: 700,
                  fontSize: '14px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.02em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'white'
                }}>Local Positioning // Sector 04-A</span>
                <span style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '10px', color: '#ccc', fontWeight: 600 }}>TRACKING: ON</span>
              </div>
              <div style={{
                width: '100%',
                height: '100%',
                minHeight: '300px',
                backgroundColor: '#fff',
                backgroundImage: 'linear-gradient(#eee 1px, transparent 1px), linear-gradient(90deg, #eee 1px, transparent 1px)',
                backgroundSize: '50px 50px',
                position: 'relative',
                borderBottom: '3px solid #000000'
              }}>
                <svg style={{ position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none' }} viewBox="0 0 100 100" preserveAspectRatio="none">
                  <polyline points="20,80 35,75 40,60 65,45 70,30" fill="none" stroke="black" strokeOpacity="1" strokeWidth="2" strokeDasharray="5,5"></polyline>
                </svg>
                
                <div style={{ position: 'absolute', top: '30%', left: '70%' }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    border: '3px solid black',
                    background: 'black',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <div style={{ width: '4px', height: '4px', background: 'white', borderRadius: '50%' }}></div>
                  </div>
                  <div style={{
                    position: 'absolute',
                    top: '-20px',
                    left: '15px',
                    color: 'black',
                    fontSize: '10px',
                    whiteSpace: 'nowrap',
                    fontWeight: 900,
                    fontFamily: "'Courier New', Courier, monospace",
                    background: 'white',
                    padding: '2px 4px',
                    border: '1px solid black'
                  }}>
                    TX-99 (CURRENT)
                  </div>
                </div>

                <div style={{ position: 'absolute', bottom: '16px', right: '16px', textAlign: 'right', fontFamily: "'Courier New', Courier, monospace", fontWeight: 600 }}>
                  <div style={{ fontSize: '9px', color: '#666666' }}>HEADING: 042° NNE</div>
                  <div style={{ fontSize: '9px', color: '#666666' }}>VELOCITY: 1.2 m/s</div>
                </div>

                <div className="crosshair-corner top-left"></div>
                <div className="crosshair-corner top-right"></div>
                <div className="crosshair-corner bottom-left"></div>
                <div className="crosshair-corner bottom-right"></div>
              </div>
              <div style={{
                borderTop: '1px solid #000000',
                padding: '10px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#000000',
                color: '#ffffff'
              }}>
                <div style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '10px', fontWeight: 600, color: 'white' }}>LAT: 34.0522 N / LONG: 118.2437 W</div>
                <div style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '10px', color: 'white', fontWeight: 600 }}>INTERCEPT IN: 04m 12s</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ border: '3px solid #000000', background: '#ffffff', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{
                  borderBottom: '3px solid #000000',
                  padding: '10px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#000000',
                  color: '#ffffff'
                }}>
                  <span style={{
                    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                    fontWeight: 700,
                    fontSize: '14px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: 'white'
                  }}>Communication Logs</span>
                </div>
                <div style={{ padding: '20px', flex: 1, overflow: 'auto' }}>
                  <LogEntry timestamp="14:02:11" message="Engaging hostile unit at perimeter." />
                  <LogEntry timestamp="14:01:45" message="Target acquired. Identification: REBEL_ALPHA." />
                  <LogEntry timestamp="13:58:20" message="System Alert: Power core below threshold." isAlert={true} />
                  <LogEntry timestamp="13:55:00" message="Sector 04 reached. Initiating scan." />
                  <LogEntry timestamp="13:40:12" message="Deployment confirmed. Uplink stable." />
                </div>
              </div>

              <div style={{ border: '3px solid #000000', background: '#ffffff', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{
                  borderBottom: '3px solid #000000',
                  padding: '10px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#000000',
                  color: '#ffffff'
                }}>
                  <span style={{
                    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                    fontWeight: 700,
                    fontSize: '14px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: 'white'
                  }}>Mission History</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Courier New', Courier, monospace", fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', color: '#000000', padding: '10px', borderBottom: '3px solid #000000', fontWeight: 900, textTransform: 'uppercase', fontSize: '12px', background: '#f4f4f4' }}>Op ID</th>
                      <th style={{ textAlign: 'left', color: '#000000', padding: '10px', borderBottom: '3px solid #000000', fontWeight: 900, textTransform: 'uppercase', fontSize: '12px', background: '#f4f4f4' }}>Result</th>
                      <th style={{ textAlign: 'left', color: '#000000', padding: '10px', borderBottom: '3px solid #000000', fontWeight: 900, textTransform: 'uppercase', fontSize: '12px', background: '#f4f4f4' }}>K/D</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '10px', borderBottom: '1px solid #ccc', color: 'black', fontWeight: 600 }}>OP_GHOST</td>
                      <td style={{ padding: '10px', borderBottom: '1px solid #ccc', color: 'black', fontWeight: 600 }}>SUCCESS</td>
                      <td style={{ padding: '10px', borderBottom: '1px solid #ccc', color: 'black', fontWeight: 600 }}>12/0</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '10px', borderBottom: '1px solid #ccc', color: 'black', fontWeight: 600 }}>OP_VOID</td>
                      <td style={{ padding: '10px', borderBottom: '1px solid #ccc', color: 'black', fontWeight: 600 }}>SUCCESS</td>
                      <td style={{ padding: '10px', borderBottom: '1px solid #ccc', color: 'black', fontWeight: 600 }}>04/1</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '10px', borderBottom: '1px solid #ccc', color: 'black', fontWeight: 600 }}>OP_HAVOC</td>
                      <td style={{ padding: '10px', borderBottom: '1px solid #ccc', color: 'black', fontWeight: 600 }}>FAILED</td>
                      <td style={{ padding: '10px', borderBottom: '1px solid #ccc', color: 'black', fontWeight: 600 }}>00/1</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div style={{
            marginTop: '60px',
            borderTop: '3px solid black',
            paddingTop: '30px',
            fontSize: '12px',
            fontWeight: 700,
            color: 'black',
            fontFamily: "'Courier New', Courier, monospace",
            display: 'flex',
            justifyContent: 'space-between'
          }}>
            <span>HAVOC SYSTEMS INC.</span>
            <span>ENCRYPTION: AES-512-V2 // UNIT_ID: TX-99-BETA</span>
          </div>
        </div>
      </div>
    </Router>
  );
};

export default App;