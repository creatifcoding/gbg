import React, { useState, useEffect } from 'react';

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
    padding: '40px',
    margin: 0
  }
};

const Button = ({ children, onClick, ...props }) => (
  <button
    onClick={onClick}
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
      boxShadow: '4px 4px 0px rgba(0,0,0,1)'
    }}
    onMouseDown={(e) => {
      e.currentTarget.style.boxShadow = 'none';
      e.currentTarget.style.transform = 'translate(4px, 4px)';
    }}
    onMouseUp={(e) => {
      e.currentTarget.style.boxShadow = '4px 4px 0px rgba(0,0,0,1)';
      e.currentTarget.style.transform = 'translate(0, 0)';
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = 'var(--text-main)';
      e.currentTarget.style.color = 'var(--surface)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'transparent';
      e.currentTarget.style.color = 'var(--text-main)';
      e.currentTarget.style.boxShadow = '4px 4px 0px rgba(0,0,0,1)';
      e.currentTarget.style.transform = 'translate(0, 0)';
    }}
    {...props}
  >
    {children}
  </button>
);

const NavItem = ({ children, active, onClick }) => (
  <a
    href="#"
    onClick={(e) => {
      e.preventDefault();
      onClick && onClick();
    }}
    style={{
      color: active ? 'var(--text-inv)' : 'var(--text-muted)',
      textDecoration: 'none',
      fontSize: '14px',
      fontWeight: '700',
      transition: 'all 0.2s',
      background: active ? 'var(--text-main)' : 'transparent',
      padding: active ? '0 5px' : '0'
    }}
    onMouseEnter={(e) => {
      if (!active) {
        e.currentTarget.style.color = 'var(--text-inv)';
        e.currentTarget.style.background = 'var(--text-main)';
        e.currentTarget.style.padding = '0 5px';
      }
    }}
    onMouseLeave={(e) => {
      if (!active) {
        e.currentTarget.style.color = 'var(--text-muted)';
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.padding = '0';
      }
    }}
  >
    {children}
  </a>
);

const TabButton = ({ children, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      padding: 'var(--space-m) var(--space-l)',
      border: 'none',
      borderRight: 'var(--border-w) solid var(--border)',
      background: active ? 'var(--text-main)' : 'transparent',
      color: active ? 'var(--surface)' : 'var(--text-main)',
      fontFamily: 'var(--font-mono)',
      fontWeight: '900',
      fontSize: '13px',
      textTransform: 'uppercase',
      cursor: 'pointer',
      transition: 'background 0.2s'
    }}
    onMouseEnter={(e) => {
      if (!active) {
        e.currentTarget.style.background = '#ddd';
      }
    }}
    onMouseLeave={(e) => {
      if (!active) {
        e.currentTarget.style.background = 'transparent';
      }
    }}
  >
    {children}
  </button>
);

const Panel = ({ title, subtitle, children }) => (
  <div style={{
    border: 'var(--border-w) solid var(--border)',
    background: 'var(--surface)',
    width: '100%',
    display: 'flex',
    flexDirection: 'column'
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
      }}>{title}</span>
      {subtitle && <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '10px',
        color: '#ccc'
      }}>{subtitle}</span>}
    </div>
    {children}
  </div>
);

const TelemetryBar = ({ label, value, critical }) => (
  <div>
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      fontFamily: 'var(--font-mono)',
      textTransform: 'uppercase'
    }}>
      <span>{label}</span>
      <span>{value}%</span>
    </div>
    <div style={{
      height: '24px',
      background: 'white',
      border: '3px solid black',
      width: '100%',
      marginTop: '10px'
    }}>
      <div style={{
        height: '100%',
        width: `${value}%`,
        background: critical ? 'repeating-linear-gradient(45deg, #000, #000 5px, #fff 5px, #fff 10px)' : 'black'
      }}></div>
    </div>
  </div>
);

const EquipmentCard = ({ category, name, status }) => (
  <div style={{
    border: '2px solid var(--border)',
    padding: 'var(--space-l)',
    background: 'var(--surface)',
    boxShadow: '6px 6px 0 rgba(0,0,0,1)'
  }}>
    <div style={{
      fontFamily: 'var(--font-mono)',
      color: 'var(--text-muted)',
      fontSize: '10px'
    }}>{category}</div>
    <div style={{
      fontFamily: 'var(--font-mono)',
      fontSize: '14px'
    }}>{name}</div>
    <div style={{
      fontSize: '10px',
      padding: '4px 8px',
      background: 'black',
      color: 'white',
      fontWeight: '700',
      display: 'inline-block',
      marginTop: '10px'
    }}>{status}</div>
  </div>
);

const App = () => {
  const [activeTab, setActiveTab] = useState('pos');

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  return (
    <div style={customStyles.root}>
      <div style={customStyles.body}>
        <div style={{
          background: 'var(--surface)',
          maxWidth: '1400px',
          width: '100%',
          padding: 'var(--space-xl)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0',
          boxShadow: '0 20px 50px rgba(0,0,0,0.1)',
          border: 'var(--border-w) solid var(--border)',
          minHeight: '800px'
        }}>
          <header style={{
            borderBottom: 'var(--border-w) solid var(--border)',
            paddingBottom: 'var(--space-l)'
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
              <nav style={{
                display: 'flex',
                gap: 'var(--space-l)',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase'
              }}>
                <NavItem>Briefing</NavItem>
                <NavItem active>Deployments</NavItem>
                <NavItem>Intel</NavItem>
                <NavItem>Settings</NavItem>
              </nav>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--text-muted)'
              }}>
                UNIT_SYNC.ACTIVE <span style={{ color: 'var(--accent)' }}>●</span>
              </div>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end'
            }}>
              <div>
                <div style={{
                  color: 'var(--text-main)',
                  fontWeight: '700',
                  fontSize: '12px',
                  marginBottom: 'var(--space-s)',
                  opacity: '0.5',
                  fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase'
                }}>Deployments / Sector 04 / TX-99</div>
                <h1 style={{
                  fontSize: '60px',
                  fontWeight: '900',
                  letterSpacing: '-0.06em',
                  lineHeight: '0.85',
                  textTransform: 'uppercase',
                  marginTop: 'var(--space-s)'
                }}>
                  Unit <span style={{ color: 'black', fontWeight: '900' }}>TX-99</span> <span style={{ fontWeight: '300', fontSize: '0.5em', color: 'var(--text-muted)' }}>[TITAN-CLASS]</span>
                </h1>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-s)' }}>
                <Button>Diagnostic</Button>
                <Button>Emergency Recall</Button>
              </div>
            </div>
          </header>

          <div style={{
            display: 'flex',
            borderBottom: 'var(--border-w) solid var(--border)',
            background: 'var(--surface-highlight)',
            fontFamily: 'var(--font-mono)'
          }}>
            <TabButton active={activeTab === 'pos'} onClick={() => setActiveTab('pos')}>01. Position</TabButton>
            <TabButton active={activeTab === 'telemetry'} onClick={() => setActiveTab('telemetry')}>02. Telemetry</TabButton>
            <TabButton active={activeTab === 'hardware'} onClick={() => setActiveTab('hardware')}>03. Hardware</TabButton>
            <TabButton active={activeTab === 'logs'} onClick={() => setActiveTab('logs')}>04. Comms & History</TabButton>
          </div>

          {activeTab === 'pos' && (
            <div style={{
              flex: 1,
              display: 'flex',
              padding: 'var(--space-l) 0'
            }}>
              <Panel title="Local Positioning // Sector 04-A" subtitle="TRACKING: ON">
                <div style={{
                  width: '100%',
                  height: '500px',
                  backgroundColor: '#fff',
                  backgroundImage: 'linear-gradient(#eee 1px, transparent 1px), linear-gradient(90deg, #eee 1px, transparent 1px)',
                  backgroundSize: '50px 50px',
                  position: 'relative',
                  borderBottom: 'var(--border-w) solid var(--border)'
                }}>
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
                    <polyline
                      points="20,80 35,75 40,60 65,45 70,30"
                      fill="none"
                      stroke="black"
                      strokeWidth="2"
                      strokeDasharray="5,5"
                    />
                  </svg>
                  <div style={{ position: 'absolute', top: '30%', left: '70%' }}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      background: 'black',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <div style={{
                        width: '6px',
                        height: '6px',
                        background: 'white',
                        borderRadius: '50%'
                      }}></div>
                    </div>
                    <div style={{
                      position: 'absolute',
                      top: '-25px',
                      left: '25px',
                      color: 'black',
                      background: 'white',
                      border: '1px solid black',
                      padding: '2px 4px',
                      fontSize: '10px',
                      whiteSpace: 'nowrap',
                      fontWeight: 'bold',
                      fontFamily: 'var(--font-mono)'
                    }}>TX-99 (CURRENT)</div>
                  </div>
                </div>
                <div style={{
                  borderTop: 'none',
                  background: '#f4f4f4',
                  color: 'black',
                  padding: 'var(--space-s) var(--space-m)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px'
                  }}>LAT: 34.0522 N / LONG: 118.2437 W</div>
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    fontWeight: '900'
                  }}>INTERCEPT IN: 04m 12s</div>
                </div>
              </Panel>
            </div>
          )}

          {activeTab === 'telemetry' && (
            <div style={{
              flex: 1,
              display: 'flex',
              padding: 'var(--space-l) 0'
            }}>
              <Panel title="Vital Telemetry Systems">
                <div style={{
                  padding: 'var(--space-l)',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-m)'
                }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '40px'
                  }}>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-m)'
                    }}>
                      <TelemetryBar label="Power Core" value={24} critical />
                      <TelemetryBar label="Structural Integrity" value={88} />
                    </div>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-m)'
                    }}>
                      <TelemetryBar label="CPU Load" value={94} />
                      <div>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontFamily: 'var(--font-mono)',
                          textTransform: 'uppercase'
                        }}>
                          <span>Signal Strength</span>
                          <span>-84 dBm</span>
                        </div>
                        <div style={{
                          height: '24px',
                          background: 'white',
                          border: '3px solid black',
                          width: '100%',
                          marginTop: '10px'
                        }}>
                          <div style={{
                            height: '100%',
                            width: '40%',
                            background: 'black'
                          }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Panel>
            </div>
          )}

          {activeTab === 'hardware' && (
            <div style={{
              flex: 1,
              display: 'flex',
              padding: 'var(--space-l) 0'
            }}>
              <Panel title="Hardware Module Status">
                <div style={{
                  padding: 'var(--space-l)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 'var(--space-m)'
                }}>
                  <EquipmentCard category="OPTICS" name="MK-IV LENS" status="NOMINAL" />
                  <EquipmentCard category="WEAPON" name="ARC-REAPER" status="OVERHEAT" />
                  <EquipmentCard category="LOCO" name="HYDRAULIC" status="NOMINAL" />
                  <EquipmentCard category="COMMS" name="ENCRYPT-X" status="NOMINAL" />
                </div>
              </Panel>
            </div>
          )}

          {activeTab === 'logs' && (
            <div style={{
              flex: 1,
              display: 'flex',
              padding: 'var(--space-l) 0'
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 'var(--space-l)',
                width: '100%'
              }}>
                <Panel title="Communication Logs">
                  <div style={{ padding: 'var(--space-l)' }}>
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '13px',
                      padding: 'var(--space-m) 0',
                      borderBottom: '1px solid #ddd'
                    }}>
                      <span>14:02:11</span> Engage unit at perimeter.
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '13px',
                      padding: 'var(--space-m) 0',
                      borderBottom: '1px solid #ddd'
                    }}>
                      <span>14:01:45</span> Target acquired: REBEL_ALPHA.
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '13px',
                      padding: 'var(--space-m) 0',
                      borderBottom: '1px solid #ddd'
                    }}>
                      <span>13:58:20</span> <span style={{
                        color: 'var(--text-main)',
                        fontWeight: '900',
                        textDecoration: 'underline'
                      }}>Alert: Power core threshold.</span>
                    </div>
                  </div>
                </Panel>
                <Panel title="Mission History">
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '14px'
                  }}>
                    <thead>
                      <tr>
                        <th style={{
                          textAlign: 'left',
                          padding: 'var(--space-m)',
                          borderBottom: 'var(--border-w) solid var(--border)',
                          background: '#f4f4f4',
                          fontWeight: '900'
                        }}>Op ID</th>
                        <th style={{
                          textAlign: 'left',
                          padding: 'var(--space-m)',
                          borderBottom: 'var(--border-w) solid var(--border)',
                          background: '#f4f4f4',
                          fontWeight: '900'
                        }}>Result</th>
                        <th style={{
                          textAlign: 'left',
                          padding: 'var(--space-m)',
                          borderBottom: 'var(--border-w) solid var(--border)',
                          background: '#f4f4f4',
                          fontWeight: '900'
                        }}>K/D</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{
                          padding: 'var(--space-m)',
                          borderBottom: '1px solid #ccc',
                          fontWeight: '600'
                        }}>OP_GHOST</td>
                        <td style={{
                          padding: 'var(--space-m)',
                          borderBottom: '1px solid #ccc',
                          fontWeight: '900'
                        }}>SUCCESS</td>
                        <td style={{
                          padding: 'var(--space-m)',
                          borderBottom: '1px solid #ccc',
                          fontWeight: '600'
                        }}>12/0</td>
                      </tr>
                      <tr>
                        <td style={{
                          padding: 'var(--space-m)',
                          borderBottom: '1px solid #ccc',
                          fontWeight: '600'
                        }}>OP_VOID</td>
                        <td style={{
                          padding: 'var(--space-m)',
                          borderBottom: '1px solid #ccc',
                          fontWeight: '900'
                        }}>SUCCESS</td>
                        <td style={{
                          padding: 'var(--space-m)',
                          borderBottom: '1px solid #ccc',
                          fontWeight: '600'
                        }}>04/1</td>
                      </tr>
                      <tr>
                        <td style={{
                          padding: 'var(--space-m)',
                          borderBottom: '1px solid #ccc',
                          fontWeight: '600'
                        }}>OP_HAVOC</td>
                        <td style={{
                          padding: 'var(--space-m)',
                          borderBottom: '1px solid #ccc',
                          fontWeight: '900'
                        }}>FAILED</td>
                        <td style={{
                          padding: 'var(--space-m)',
                          borderBottom: '1px solid #ccc',
                          fontWeight: '600'
                        }}>00/1</td>
                      </tr>
                    </tbody>
                  </table>
                </Panel>
              </div>
            </div>
          )}

          <div style={{
            borderTop: 'var(--border-w) solid black',
            paddingTop: 'var(--space-m)',
            fontSize: '12px',
            fontWeight: '700',
            marginTop: 'auto',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            display: 'flex',
            justifyContent: 'space-between'
          }}>
            <span>HAVOC SYSTEMS INC.</span>
            <span>ENCRYPTION: AES-512-V2 // UNIT_ID: TX-99-BETA</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;