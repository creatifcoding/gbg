import React, { useState, useEffect } from 'react';

const customStyles = {
  root: {
    '--bg-app': '#050505',
    '--bg-panel': '#0a0a0a',
    '--bg-active': '#111111',
    '--border-dim': '#222222',
    '--border-mid': '#333333',
    '--border-bright': '#444444',
    '--text-main': '#e0e0e0',
    '--text-muted': '#666666',
    '--text-dim': '#444444',
    '--accent-teal': '#2A9D8F',
    '--accent-teal-dim': '#1a4f49',
    '--accent-red': '#C0392B',
    '--accent-red-dim': '#4a1a1a',
    '--accent-amber': '#D4AC0D',
    '--font-stack': "'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace",
    '--space-unit': '4px'
  }
};

const TreeItem = ({ icon, text, active, onClick }) => (
  <div 
    className={`tree-item ${active ? 'active' : ''}`}
    onClick={onClick}
    style={{
      padding: '8px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      cursor: 'pointer',
      borderBottom: '1px solid var(--border-dim)',
      transition: 'background 0.1s',
      borderLeft: active ? '2px solid var(--accent-teal)' : 'none',
      background: active ? 'var(--bg-active)' : 'transparent'
    }}
  >
    <div style={{
      width: '12px',
      height: '12px',
      border: '1px solid var(--text-muted)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '8px'
    }}>
      {icon}
    </div>
    <span style={{ color: active ? 'var(--text-main)' : 'var(--text-muted)' }}>{text}</span>
  </div>
);

const StatusModule = ({ letter, state, label }) => {
  const getStateClass = () => {
    if (state === 'active') return 'active';
    if (state === 'alert') return 'alert';
    return '';
  };

  return (
    <div style={{
      background: 'var(--bg-panel)',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px'
    }}>
      <div className={`circle-gauge ${getStateClass()}`} style={{
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        border: `2px solid ${state === 'active' ? 'var(--accent-teal)' : state === 'alert' ? 'var(--accent-red)' : 'var(--border-mid)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: '700',
        color: state === 'active' ? 'var(--accent-teal)' : state === 'alert' ? 'var(--accent-red)' : 'var(--text-muted)',
        boxShadow: state === 'active' ? '0 0 10px rgba(42, 157, 143, 0.2)' : 'none'
      }}>
        {letter}
      </div>
      <div style={{
        fontSize: '10px',
        color: 'var(--text-muted)',
        textTransform: 'uppercase'
      }}>
        {label}
      </div>
    </div>
  );
};

const LogEntry = ({ time, message, type }) => (
  <div style={{
    marginBottom: '8px',
    display: 'flex',
    gap: '12px'
  }}>
    <span style={{ color: 'var(--text-dim)', minWidth: '60px' }}>{time}</span>
    <span style={{
      color: type === 'highlight' ? 'var(--accent-amber)' : type === 'error' ? 'var(--accent-red)' : 'var(--text-muted)',
      background: type === 'highlight' ? 'rgba(212, 172, 13, 0.1)' : 'transparent',
      padding: type === 'highlight' ? '0 4px' : '0'
    }}>
      {message}
    </span>
  </div>
);

const App = () => {
  const [activeDirectory, setActiveDirectory] = useState(0);
  const [activeNav, setActiveNav] = useState('Monitor');
  const [cursorVisible, setCursorVisible] = useState(true);

  useEffect(() => {
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      body {
        background-color: var(--bg-app);
        color: var(--text-main);
        font-family: var(--font-stack);
        font-size: 13px;
        line-height: 1.4;
        -webkit-font-smoothing: antialiased;
      }

      .tree-item:hover {
        background: var(--bg-active) !important;
      }

      .bar {
        transition: height 0.5s;
      }

      .bar:hover {
        background: var(--accent-teal) !important;
      }

      .bar::before {
        content: '';
        position: absolute;
        top: -1px;
        left: 0;
        right: 0;
        height: 1px;
        background: var(--text-muted);
      }

      tr:hover td {
        background: var(--bg-active);
      }

      @keyframes blink {
        50% { opacity: 0; }
      }

      .log-cursor {
        display: inline-block;
        width: 8px;
        height: 14px;
        background: var(--accent-teal);
        animation: blink 1s step-end infinite;
        vertical-align: middle;
      }

      .nav-item {
        transition: color 0.2s;
      }

      .nav-item:hover {
        color: var(--text-main);
      }
    `;
    document.head.appendChild(styleEl);

    const interval = setInterval(() => {
      setCursorVisible(prev => !prev);
    }, 500);

    return () => {
      document.head.removeChild(styleEl);
      clearInterval(interval);
    };
  }, []);

  const directories = [
    { id: 0, name: 'production-api-v1', icon: '+' },
    { id: 1, name: 'staging-cluster-alpha', icon: ' ' },
    { id: 2, name: 'dev-sandbox-04', icon: ' ' },
    { id: 3, name: 'database-shard-01', icon: ' ' }
  ];

  const transactions = [
    { id: '#09A1', endpoint: '/api/v1/user/auth', latency: '24ms', status: '200 OK', statusColor: 'teal' },
    { id: '#09A2', endpoint: '/api/v1/data/sync', latency: '142ms', status: '200 OK', statusColor: 'teal' },
    { id: '#09A3', endpoint: '/api/v1/webhook', latency: '89ms', status: '202 ACC', statusColor: 'teal' },
    { id: '#09A4', endpoint: '/internal/health', latency: '4ms', status: '200 OK', statusColor: 'teal' },
    { id: '#09A5', endpoint: '/api/v1/admin', latency: '--', status: '403 FORBIDDEN', statusColor: 'red' }
  ];

  const logs = [
    { time: '10:42:01', message: 'Initializing Drive 40 on port 8000', type: 'normal' },
    { time: '10:42:03', message: 'Sequencing Data Overlay... ', type: 'normal', append: 'Done' },
    { time: '10:42:05', message: 'Indexing Directory Structure Present', type: 'highlight' },
    { time: '10:42:08', message: 'Memory Indexing on Drive F:/ using TOS code', type: 'normal' },
    { time: '10:42:09', message: 'Warning: Variable reduced on sector 7', type: 'error' },
    { time: '10:42:12', message: 'Protection Law A742403B via auth #44210', type: 'normal' },
    { time: '10:42:15', message: 'Awaiting input ', type: 'normal', cursor: true }
  ];

  const barHeights = [20, 35, 45, 30, 60, 80, 55, 40, 25, 15, 30, 45];

  return (
    <div style={customStyles.root}>
      <div style={{
        display: 'grid',
        gridTemplateRows: '40px 1fr 24px',
        height: '100vh',
        width: '100%'
      }}>
        {/* Top Bar */}
        <header style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          borderBottom: '1px solid var(--border-mid)',
          background: 'var(--bg-app)',
          zIndex: 10
        }}>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
            <div style={{
              fontWeight: '700',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              <span style={{ display: 'block', width: '8px', height: '8px', background: 'var(--accent-teal)' }}></span>
              SYS.CMD // V.0.9
            </div>
            {['Monitor', 'Deployments', 'Logs'].map(item => (
              <div
                key={item}
                className="nav-item"
                onClick={() => setActiveNav(item)}
                style={{
                  color: activeNav === item ? 'var(--text-main)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                {item}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
            <div style={{
              fontSize: '10px',
              padding: '2px 6px',
              color: 'var(--accent-teal)',
              background: 'var(--accent-teal-dim)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              System Online
            </div>
            <div style={{
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-muted)'
            }}>
              REC 007 -- 0009
            </div>
          </div>
        </header>

        {/* Workspace */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '260px 1fr 320px',
          overflow: 'hidden'
        }}>
          {/* Left Panel - Directory */}
          <div style={{
            borderRight: '1px solid var(--border-mid)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: 'var(--bg-panel)',
            position: 'relative'
          }}>
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-mid)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '11px',
              color: 'var(--text-muted)',
              background: 'var(--bg-app)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              <span>Directory</span>
              <span>IDX-01</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
              {directories.map(dir => (
                <TreeItem
                  key={dir.id}
                  icon={dir.icon}
                  text={dir.name}
                  active={activeDirectory === dir.id}
                  onClick={() => setActiveDirectory(dir.id)}
                />
              ))}
              <div style={{ marginTop: '24px', padding: '0 16px' }}>
                <div style={{ padding: '0', border: 'none' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '10px',
                    color: 'var(--text-muted)'
                  }}>
                    <span>LOAD BALANCE</span>
                    <span>60%</span>
                  </div>
                  <div style={{
                    height: '2px',
                    background: 'var(--border-mid)',
                    width: '100%',
                    position: 'relative',
                    margin: '10px 0'
                  }}>
                    <div style={{
                      height: '100%',
                      background: 'var(--text-main)',
                      width: '60%'
                    }}></div>
                    <div style={{
                      width: '8px',
                      height: '12px',
                      background: 'var(--text-main)',
                      position: 'absolute',
                      top: '-5px',
                      left: '60%'
                    }}></div>
                  </div>
                </div>
              </div>
            </div>
            <div style={{
              position: 'absolute',
              width: '8px',
              height: '8px',
              border: '1px solid var(--text-dim)',
              borderRight: 'none',
              borderBottom: 'none',
              top: 0,
              left: 0,
              pointerEvents: 'none'
            }}></div>
          </div>

          {/* Center Panel */}
          <div style={{
            background: 'var(--bg-app)',
            display: 'grid',
            gridTemplateRows: '240px 1fr'
          }}>
            {/* Hero Block */}
            <div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                height: '40px',
                borderBottom: '1px solid var(--border-mid)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 16px',
                  fontWeight: '700',
                  fontSize: '14px',
                  letterSpacing: '0.1em',
                  background: 'var(--accent-teal-dim)',
                  color: 'var(--accent-teal)',
                  borderRight: '1px solid var(--bg-app)',
                  textTransform: 'uppercase'
                }}>
                  DEPLOYMENT ACTIVE
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 16px',
                  fontWeight: '700',
                  fontSize: '14px',
                  letterSpacing: '0.1em',
                  background: 'var(--accent-red-dim)',
                  color: 'var(--accent-red)',
                  justifyContent: 'flex-end',
                  textTransform: 'uppercase'
                }}>
                  ERR_RATE 0.01%
                </div>
              </div>

              {/* Chart */}
              <div style={{
                padding: '24px',
                position: 'relative',
                borderBottom: '1px solid var(--border-mid)',
                height: '200px'
              }}>
                <div style={{
                  backgroundImage: 'linear-gradient(var(--border-dim) 1px, transparent 1px), linear-gradient(90deg, var(--border-dim) 1px, transparent 1px)',
                  backgroundSize: '40px 40px',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  opacity: 0.3,
                  zIndex: 0
                }}></div>
                <div style={{
                  position: 'relative',
                  zIndex: 1,
                  height: '100%',
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: '8px'
                }}>
                  {barHeights.map((height, idx) => (
                    <div
                      key={idx}
                      className="bar"
                      style={{
                        flex: 1,
                        background: idx === 5 ? 'var(--accent-teal)' : 'var(--border-mid)',
                        height: `${height}%`,
                        position: 'relative'
                      }}
                    ></div>
                  ))}
                </div>
                <div style={{
                  position: 'absolute',
                  bottom: '8px',
                  left: '24px',
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Throughput [req/s]
                </div>
              </div>
            </div>

            {/* Table */}
            <div>
              <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border-mid)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '11px',
                color: 'var(--text-muted)',
                background: 'var(--bg-panel)',
                borderTop: '1px solid var(--border-mid)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                <span>Recent Transactions</span>
                <span>LIVE VIEW</span>
              </div>
              <div style={{ overflow: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '12px'
                }}>
                  <thead>
                    <tr>
                      <th style={{
                        textAlign: 'left',
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border-mid)',
                        color: 'var(--text-muted)',
                        fontWeight: '400',
                        fontSize: '10px',
                        textTransform: 'uppercase'
                      }}>ID</th>
                      <th style={{
                        textAlign: 'left',
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border-mid)',
                        color: 'var(--text-muted)',
                        fontWeight: '400',
                        fontSize: '10px',
                        textTransform: 'uppercase'
                      }}>Endpoint</th>
                      <th style={{
                        textAlign: 'left',
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border-mid)',
                        color: 'var(--text-muted)',
                        fontWeight: '400',
                        fontSize: '10px',
                        textTransform: 'uppercase'
                      }}>Latency</th>
                      <th style={{
                        textAlign: 'left',
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border-mid)',
                        color: 'var(--text-muted)',
                        fontWeight: '400',
                        fontSize: '10px',
                        textTransform: 'uppercase'
                      }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(tx => (
                      <tr key={tx.id}>
                        <td style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid var(--border-dim)',
                          fontFamily: 'var(--font-stack)',
                          color: 'var(--accent-teal)'
                        }}>{tx.id}</td>
                        <td style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid var(--border-dim)'
                        }}>{tx.endpoint}</td>
                        <td style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid var(--border-dim)'
                        }}>{tx.latency}</td>
                        <td style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid var(--border-dim)',
                          color: tx.statusColor === 'teal' ? 'var(--accent-teal)' : 'var(--accent-red)'
                        }}>{tx.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Panel - Terminal */}
          <div style={{
            background: 'var(--bg-app)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-mid)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '11px',
              color: 'var(--text-muted)',
              background: 'var(--bg-app)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              <span>System Status</span>
              <span>REFRESH: AUTO</span>
            </div>

            {/* Status Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1px',
              background: 'var(--border-mid)',
              borderBottom: '1px solid var(--border-mid)',
              marginBottom: '1px'
            }}>
              <StatusModule letter="M" state="active" label="Memory" />
              <StatusModule letter="P" state="normal" label="Process" />
              <StatusModule letter="B" state="alert" label="Bandwidth" />
              <StatusModule letter="K" state="normal" label="Kernel" />
            </div>

            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-mid)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '11px',
              color: 'var(--text-muted)',
              borderTop: '1px solid var(--border-mid)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              <span>Terminal Output</span>
            </div>

            {/* Logs */}
            <div style={{
              padding: '16px',
              fontSize: '11px',
              color: 'var(--text-muted)',
              flex: 1,
              overflowY: 'auto'
            }}>
              {logs.map((log, idx) => (
                <LogEntry
                  key={idx}
                  time={log.time}
                  message={
                    <>
                      {log.message}
                      {log.append && <span style={{ color: 'var(--accent-teal)' }}>{log.append}</span>}
                      {log.cursor && <span className="log-cursor"></span>}
                    </>
                  }
                  type={log.type}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer style={{
          borderTop: '1px solid var(--border-mid)',
          background: 'var(--bg-app)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 16px',
          fontSize: '10px',
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          <div>Status: Rendering</div>
          <div>Latency: 12ms</div>
        </footer>
      </div>
    </div>
  );
};

export default App;