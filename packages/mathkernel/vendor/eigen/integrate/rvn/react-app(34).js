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
  }
};

const App = () => {
  const [activeNav, setActiveNav] = useState('Deployments');
  const [powerCore, setPowerCore] = useState(24);
  const [structural, setStructural] = useState(88);
  const [cpuLoad, setCpuLoad] = useState(94);
  const [signal, setSignal] = useState(40);

  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        background-color: var(--bg);
        color: var(--text-main);
        font-family: var(--font-sans);
        font-size: 14px;
        line-height: 1.4;
        -webkit-font-smoothing: antialiased;
        min-height: 100vh;
        display: flex;
        justify-content: center;
        padding: 40px;
      }
    `;
    document.head.appendChild(styleElement);
    return () => document.head.removeChild(styleElement);
  }, []);

  const navItems = ['Briefing', 'Deployments', 'Intel', 'Settings'];

  const commLogs = [
    { time: '14:02', message: 'Engaging hostile unit.' },
    { time: '14:01', message: 'Target acquired: ALPHA.' },
    { time: '13:58', message: 'System Alert: Low Power.' }
  ];

  const missionHistory = [
    { id: 'GHOST', result: 'SUCCESS', kd: '12/0' },
    { id: 'VOID', result: 'SUCCESS', kd: '04/1' },
    { id: 'HAVOC', result: 'FAILED', kd: '00/1' }
  ];

  const equipmentStatus = [
    { name: 'OPTICS', status: 'NOMINAL' },
    { name: 'WEAPON', status: 'OVERHEAT' },
    { name: 'LOCO', status: 'NOMINAL' },
    { name: 'COMMS', status: 'NOMINAL' }
  ];

  const handleDiagnostic = () => {
    console.log('Running diagnostic...');
  };

  const handleRecall = () => {
    console.log('Recalling unit...');
  };

  return (
    <div style={customStyles.root}>
      <div style={{
        backgroundColor: 'var(--surface)',
        maxWidth: '1400px',
        width: '100%',
        padding: 'var(--space-xl)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-m)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.1)',
        border: 'var(--border-w) solid var(--border)'
      }}>
        <header style={{
          borderBottom: 'var(--border-w) solid var(--border)',
          paddingBottom: 'var(--space-m)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--space-m)'
          }}>
            <div style={{
              fontWeight: 900,
              fontSize: '24px',
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
              fontWeight: 600,
              letterSpacing: '-0.02em',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              {navItems.map(item => (
                <a
                  key={item}
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveNav(item);
                  }}
                  style={{
                    color: activeNav === item ? 'var(--text-inv)' : 'var(--text-muted)',
                    textDecoration: 'none',
                    fontSize: '14px',
                    fontWeight: 700,
                    transition: 'all 0.2s',
                    background: activeNav === item ? 'var(--text-main)' : 'transparent',
                    padding: activeNav === item ? '0 5px' : '0'
                  }}
                >
                  {item}
                </a>
              ))}
            </nav>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px'
            }}>
              UNIT_SYNC.ACTIVE ●
            </div>
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end'
          }}>
            <div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                fontSize: '12px',
                opacity: 0.6
              }}>
                Deployments / Sector 04 / TX-99
              </div>
              <h1 style={{
                fontSize: '48px',
                fontWeight: 900,
                textTransform: 'uppercase',
                lineHeight: 1,
                margin: 'var(--space-s) 0'
              }}>
                Unit TX-99 <span style={{ fontWeight: 300, fontSize: '0.5em' }}>[TITAN-CLASS]</span>
              </h1>
            </div>
            <div style={{
              display: 'flex',
              gap: '15px',
              marginBottom: '10px'
            }}>
              <button
                onClick={handleDiagnostic}
                style={{
                  background: 'transparent',
                  border: 'var(--border-w) solid var(--border)',
                  color: 'var(--text-main)',
                  padding: '8px 16px',
                  fontWeight: 700,
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  boxShadow: '4px 4px 0px black'
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'translate(4px, 4px)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.boxShadow = '4px 4px 0px black';
                  e.currentTarget.style.transform = 'translate(0, 0)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '4px 4px 0px black';
                  e.currentTarget.style.transform = 'translate(0, 0)';
                }}
              >
                Diagnostic
              </button>
              <button
                onClick={handleRecall}
                style={{
                  background: 'transparent',
                  border: 'var(--border-w) solid var(--border)',
                  color: 'var(--text-main)',
                  padding: '8px 16px',
                  fontWeight: 700,
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  boxShadow: '4px 4px 0px black'
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'translate(4px, 4px)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.boxShadow = '4px 4px 0px black';
                  e.currentTarget.style.transform = 'translate(0, 0)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '4px 4px 0px black';
                  e.currentTarget.style.transform = 'translate(0, 0)';
                }}
              >
                Recall
              </button>
            </div>
          </div>
        </header>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 'var(--space-m)',
          padding: 'var(--space-m)',
          background: 'var(--surface-highlight)',
          border: 'var(--border-w) solid var(--border)',
          marginBottom: 'var(--space-s)'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              fontSize: '10px',
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              <span>Power Core</span><span>{powerCore}%</span>
            </div>
            <div style={{ height: '12px', background: 'white', border: '2px solid black', width: '100%' }}>
              <div style={{
                height: '100%',
                width: `${powerCore}%`,
                background: powerCore < 30 ? 'repeating-linear-gradient(45deg, #000, #000 5px, #fff 5px, #fff 10px)' : '#000'
              }}></div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              fontSize: '10px',
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              <span>Structural</span><span>{structural}%</span>
            </div>
            <div style={{ height: '12px', background: 'white', border: '2px solid black', width: '100%' }}>
              <div style={{ height: '100%', width: `${structural}%`, background: '#000' }}></div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              fontSize: '10px',
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              <span>CPU Load</span><span>{cpuLoad}%</span>
            </div>
            <div style={{ height: '12px', background: 'white', border: '2px solid black', width: '100%' }}>
              <div style={{ height: '100%', width: `${cpuLoad}%`, background: '#000' }}></div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              fontSize: '10px',
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              <span>Signal</span><span>-84 dBm</span>
            </div>
            <div style={{ height: '12px', background: 'white', border: '2px solid black', width: '100%' }}>
              <div style={{ height: '100%', width: `${signal}%`, background: '#000' }}></div>
            </div>
          </div>
        </div>

        <div style={{
          height: '400px',
          width: '100%',
          position: 'relative',
          border: 'var(--border-w) solid var(--border)',
          backgroundColor: '#fff',
          backgroundImage: 'linear-gradient(#eee 1px, transparent 1px), linear-gradient(90deg, #eee 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }}>
          <div style={{
            position: 'absolute',
            width: '100%',
            zIndex: 10,
            background: 'rgba(0,0,0,0.8)',
            borderBottom: 'var(--border-w) solid var(--border)',
            padding: 'var(--space-s) var(--space-m)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{
              fontWeight: 700,
              textTransform: 'uppercase',
              fontSize: '13px',
              color: 'white'
            }}>
              Active Field Map // Sector 04-A
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'white'
            }}>
              LAT: 34.0522 N / LONG: 118.2437 W
            </span>
          </div>
          <svg style={{ position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none' }}>
            <polyline points="200,350 400,300 600,200 900,150" fill="none" stroke="black" strokeWidth="2" strokeDasharray="5,5" />
          </svg>
          <div style={{ position: 'absolute', top: '150px', left: '900px' }}>
            <div style={{
              width: '20px',
              height: '20px',
              background: 'black',
              borderRadius: '50%',
              border: '2px solid white'
            }}></div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              background: 'white',
              border: '1px solid black',
              padding: '2px 4px',
              fontSize: '10px',
              marginTop: '5px'
            }}>
              TX-99 CURRENT
            </div>
          </div>
          <div style={{
            position: 'absolute',
            width: '20px',
            height: '20px',
            border: '3px solid black',
            top: '10px',
            left: '10px',
            borderRight: 0,
            borderBottom: 0
          }}></div>
          <div style={{
            position: 'absolute',
            width: '20px',
            height: '20px',
            border: '3px solid black',
            top: '10px',
            right: '10px',
            borderLeft: 0,
            borderBottom: 0
          }}></div>
          <div style={{
            position: 'absolute',
            width: '20px',
            height: '20px',
            border: '3px solid black',
            bottom: '10px',
            left: '10px',
            borderRight: 0,
            borderTop: 0
          }}></div>
          <div style={{
            position: 'absolute',
            width: '20px',
            height: '20px',
            border: '3px solid black',
            bottom: '10px',
            right: '10px',
            borderLeft: 0,
            borderTop: 0
          }}></div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 'var(--space-m)'
        }}>
          <div style={{
            border: 'var(--border-w) solid var(--border)',
            background: 'var(--surface)',
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
                fontWeight: 700,
                textTransform: 'uppercase',
                fontSize: '13px',
                color: 'white'
              }}>
                Hardware
              </span>
            </div>
            <div style={{
              padding: 'var(--space-m)',
              flex: 1,
              overflow: 'auto',
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '8px'
            }}>
              {equipmentStatus.map((item, index) => (
                <div key={index} style={{
                  border: '2px solid var(--border)',
                  padding: '8px',
                  background: 'var(--surface)'
                }}>
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '8px'
                  }}>
                    {item.name}
                  </div>
                  <div style={{
                    fontSize: '9px',
                    padding: '2px 4px',
                    background: 'black',
                    color: 'white',
                    display: 'inline-block',
                    fontWeight: 700,
                    marginTop: '4px'
                  }}>
                    {item.status}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{
            border: 'var(--border-w) solid var(--border)',
            background: 'var(--surface)',
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
                fontWeight: 700,
                textTransform: 'uppercase',
                fontSize: '13px',
                color: 'white'
              }}>
                Comms Log
              </span>
            </div>
            <div style={{
              padding: 'var(--space-m)',
              flex: 1,
              overflow: 'auto',
              maxHeight: '150px'
            }}>
              {commLogs.map((log, index) => (
                <div key={index} style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  marginBottom: '6px',
                  paddingBottom: '4px',
                  borderBottom: '1px solid #ddd'
                }}>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{log.time}</span> {log.message}
                </div>
              ))}
            </div>
          </div>

          <div style={{
            border: 'var(--border-w) solid var(--border)',
            background: 'var(--surface)',
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
                fontWeight: 700,
                textTransform: 'uppercase',
                fontSize: '13px',
                color: 'white'
              }}>
                Mission History
              </span>
            </div>
            <div style={{
              padding: 'var(--space-m)',
              flex: 1,
              overflow: 'auto'
            }}>
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
                      padding: '4px 8px',
                      borderBottom: '2px solid var(--border)',
                      background: '#f4f4f4'
                    }}>ID</th>
                    <th style={{
                      textAlign: 'left',
                      padding: '4px 8px',
                      borderBottom: '2px solid var(--border)',
                      background: '#f4f4f4'
                    }}>RESULT</th>
                    <th style={{
                      textAlign: 'left',
                      padding: '4px 8px',
                      borderBottom: '2px solid var(--border)',
                      background: '#f4f4f4'
                    }}>K/D</th>
                  </tr>
                </thead>
                <tbody>
                  {missionHistory.map((mission, index) => (
                    <tr key={index}>
                      <td style={{
                        padding: '4px 8px',
                        borderBottom: '1px solid #ccc'
                      }}>{mission.id}</td>
                      <td style={{
                        padding: '4px 8px',
                        borderBottom: '1px solid #ccc'
                      }}>{mission.result}</td>
                      <td style={{
                        padding: '4px 8px',
                        borderBottom: '1px solid #ccc'
                      }}>{mission.kd}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style={{
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted)',
          marginTop: '20px',
          paddingTop: '10px',
          borderTop: '1px solid black',
          fontSize: '10px',
          display: 'flex',
          justifyContent: 'space-between'
        }}>
          <span>HAVOC SYSTEMS INC.</span>
          <span>ENCRYPTION: AES-512-V2 // UNIT_ID: TX-99-BETA</span>
        </div>
      </div>
    </div>
  );
};

export default App;