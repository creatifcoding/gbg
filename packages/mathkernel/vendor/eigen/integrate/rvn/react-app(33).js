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
    height: '100vh',
    overflow: 'hidden',
    display: 'flex',
    padding: '20px',
    margin: 0
  },
  layoutContainer: {
    background: 'var(--surface)',
    width: '100%',
    maxWidth: '1600px',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: '380px 1fr',
    border: 'var(--border-w) solid var(--border)',
    boxShadow: '0 20px 50px rgba(0,0,0,0.1)',
    overflow: 'hidden'
  },
  sidebar: {
    borderRight: 'var(--border-w) solid var(--border)',
    background: 'var(--surface-highlight)',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    padding: 'var(--space-m)',
    gap: 'var(--space-m)'
  },
  sidebarHeader: {
    paddingBottom: 'var(--space-m)',
    borderBottom: '2px solid var(--border)'
  },
  brand: {
    fontWeight: 900,
    fontSize: '20px',
    letterSpacing: '-0.04em',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-s)',
    marginBottom: 'var(--space-m)'
  },
  brandIcon: {
    width: '20px',
    height: '20px',
    background: 'var(--text-main)',
    borderRadius: '50%'
  },
  mainContent: {
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    background: 'white'
  },
  topHeader: {
    padding: 'var(--space-m) var(--space-l)',
    borderBottom: 'var(--border-w) solid var(--border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end'
  },
  pageTitle: {
    fontSize: '48px',
    fontWeight: 900,
    letterSpacing: '-0.04em',
    lineHeight: 0.9,
    textTransform: 'uppercase'
  },
  mono: {
    fontFamily: 'var(--font-mono)',
    fontWeight: 600
  },
  uppercase: {
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  textMuted: {
    color: 'var(--text-muted)'
  },
  panel: {
    border: 'var(--border-w) solid var(--border)',
    background: 'var(--surface)',
    display: 'flex',
    flexDirection: 'column'
  },
  panelHeader: {
    background: 'var(--text-main)',
    color: 'var(--surface)',
    padding: 'var(--space-s) var(--space-m)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  panelTitle: {
    fontWeight: 700,
    fontSize: '12px',
    textTransform: 'uppercase'
  },
  panelContent: {
    padding: 'var(--space-m)'
  },
  telemetryBar: {
    height: '12px',
    background: 'white',
    border: '2px solid black',
    width: '100%',
    marginTop: '4px'
  },
  telemetryFill: {
    height: '100%',
    background: 'black'
  },
  telemetryFillCritical: {
    height: '100%',
    background: 'repeating-linear-gradient(45deg, #000, #000 5px, #fff 5px, #fff 10px)'
  },
  equipmentGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 'var(--space-s)'
  },
  equipmentCard: {
    border: '2px solid var(--border)',
    padding: 'var(--space-s)',
    background: 'white'
  },
  statusPill: {
    fontSize: '9px',
    padding: '2px 6px',
    background: 'black',
    color: 'white',
    display: 'inline-block',
    marginTop: '6px'
  },
  mapSection: {
    height: '500px',
    position: 'relative',
    borderBottom: 'var(--border-w) solid var(--border)'
  },
  mapContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#fff',
    backgroundImage: 'linear-gradient(#eee 1px, transparent 1px), linear-gradient(90deg, #eee 1px, transparent 1px)',
    backgroundSize: '40px 40px',
    position: 'relative'
  },
  logSection: {
    flex: 1,
    padding: 'var(--space-l)',
    display: 'grid',
    gridTemplateColumns: '1fr 300px',
    gap: 'var(--space-l)'
  },
  logEntry: {
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    paddingBottom: 'var(--space-s)',
    borderBottom: '1px solid #ddd',
    marginBottom: 'var(--space-s)'
  },
  btn: {
    background: 'transparent',
    border: 'var(--border-w) solid var(--border)',
    padding: '10px 20px',
    fontWeight: 700,
    fontSize: '11px',
    textTransform: 'uppercase',
    cursor: 'pointer',
    boxShadow: '4px 4px 0px #000'
  },
  btnPrimary: {
    background: 'black',
    color: 'white',
    border: 'var(--border-w) solid var(--border)',
    padding: '10px 20px',
    fontWeight: 700,
    fontSize: '11px',
    textTransform: 'uppercase',
    cursor: 'pointer',
    boxShadow: '4px 4px 0px #000'
  },
  dataTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: 'var(--font-mono)',
    fontSize: '11px'
  },
  navList: {
    listStyle: 'none',
    marginTop: 'var(--space-m)'
  },
  navLink: {
    display: 'block',
    padding: '12px',
    textDecoration: 'none',
    color: 'var(--text-main)',
    fontWeight: 700,
    fontSize: '13px',
    border: '1px solid transparent'
  },
  navLinkActive: {
    display: 'block',
    padding: '12px',
    textDecoration: 'none',
    color: 'white',
    fontWeight: 700,
    fontSize: '13px',
    background: 'black'
  }
};

const TelemetryBar = ({ label, value, critical }) => (
  <div>
    <div style={{ ...customStyles.mono, ...customStyles.uppercase, fontSize: '9px', display: 'flex', justifyContent: 'space-between' }}>
      <span>{label}</span>
      <span>{value}%</span>
    </div>
    <div style={customStyles.telemetryBar}>
      <div style={critical ? { ...customStyles.telemetryFillCritical, width: `${value}%` } : { ...customStyles.telemetryFill, width: `${value}%` }}></div>
    </div>
  </div>
);

const EquipmentCard = ({ category, model, status }) => (
  <div style={customStyles.equipmentCard}>
    <div style={{ ...customStyles.mono, fontSize: '8px', color: 'var(--text-muted)' }}>{category}</div>
    <div style={{ ...customStyles.mono, fontSize: '10px' }}>{model}</div>
    <div style={customStyles.statusPill}>{status}</div>
  </div>
);

const Sidebar = ({ activeNav, setActiveNav }) => {
  const navItems = ['Briefing', 'Deployments', 'Intel', 'Settings'];

  return (
    <aside style={customStyles.sidebar}>
      <div style={customStyles.sidebarHeader}>
        <div style={customStyles.brand}>
          <div style={customStyles.brandIcon}></div>
          HAVOC // OS
        </div>
        <nav style={customStyles.navList}>
          {navItems.map(item => (
            <a
              key={item}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setActiveNav(item);
              }}
              style={activeNav === item ? customStyles.navLinkActive : customStyles.navLink}
            >
              {item}
            </a>
          ))}
        </nav>
      </div>

      <div style={customStyles.panel}>
        <div style={customStyles.panelHeader}>
          <span style={customStyles.panelTitle}>Vital Telemetry</span>
        </div>
        <div style={{ ...customStyles.panelContent, display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <TelemetryBar label="Power Core" value={24} critical={true} />
          <TelemetryBar label="Integrity" value={88} />
          <TelemetryBar label="CPU Load" value={94} />
        </div>
      </div>

      <div style={customStyles.panel}>
        <div style={customStyles.panelHeader}>
          <span style={customStyles.panelTitle}>Hardware</span>
        </div>
        <div style={{ ...customStyles.panelContent, ...customStyles.equipmentGrid }}>
          <EquipmentCard category="OPTICS" model="MK-IV" status="NOMINAL" />
          <EquipmentCard category="WEAPON" model="ARC-R" status="HOT" />
          <EquipmentCard category="LOCO" model="HYDR" status="NOMINAL" />
          <EquipmentCard category="COMMS" model="ENC-X" status="NOMINAL" />
        </div>
      </div>

      <div style={{ ...customStyles.mono, fontSize: '10px', marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid #ccc' }}>
        <div>HAVOC SYSTEMS INC.</div>
        <div style={{ ...customStyles.textMuted, fontSize: '9px' }}>TX-99-BETA // AES-512</div>
      </div>
    </aside>
  );
};

const MapSection = () => (
  <section style={customStyles.mapSection}>
    <div style={customStyles.mapContainer}>
      <svg style={{ position: 'absolute', width: '100%', height: '100%' }} viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline points="20,80 35,75 40,60 65,45 70,30" fill="none" stroke="black" strokeWidth="0.5" strokeDasharray="2,2"></polyline>
      </svg>
      <div style={{ position: 'absolute', top: '30%', left: '70%' }}>
        <div style={{ width: '16px', height: '16px', background: 'black', borderRadius: '50%', border: '4px solid white' }}></div>
        <div style={{ ...customStyles.mono, position: 'absolute', top: '-20px', left: '20px', background: 'white', border: '1px solid black', padding: '2px 5px', fontSize: '10px', whiteSpace: 'nowrap', fontWeight: 900 }}>TX-99 (LOC)</div>
      </div>
      <div style={{ position: 'absolute', bottom: '20px', right: '20px', textAlign: 'right', ...customStyles.mono }}>
        <div style={{ fontSize: '10px', fontWeight: 900 }}>34.0522 N / 118.2437 W</div>
        <div style={{ fontSize: '10px', color: '#666' }}>INTERCEPT: 04m 12s</div>
      </div>
    </div>
  </section>
);

const LogEntry = ({ time, message, alert }) => (
  <div style={customStyles.logEntry}>
    {alert ? (
      <>
        <span style={{ ...customStyles.mono, background: 'black', color: 'white', padding: '0 4px', marginRight: '10px' }}>ALERT</span>
        {message}
      </>
    ) : (
      <>
        <span style={{ ...customStyles.mono, fontWeight: 900, marginRight: '10px' }}>{time}</span>
        {message}
      </>
    )}
  </div>
);

const DeploymentsPage = () => {
  const [showDiagnostic, setShowDiagnostic] = useState(false);

  return (
    <>
      <header style={customStyles.topHeader}>
        <div>
          <div style={{ ...customStyles.mono, ...customStyles.textMuted, ...customStyles.uppercase, fontSize: '10px', marginBottom: '5px' }}>Sector 04 / TX-99</div>
          <h1 style={customStyles.pageTitle}>Unit TX-99</h1>
        </div>
        <div style={{ display: 'flex', gap: '15px' }}>
          <button style={customStyles.btn} onClick={() => setShowDiagnostic(!showDiagnostic)}>Diagnostic</button>
          <button style={customStyles.btnPrimary}>Emergency Recall</button>
        </div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <MapSection />

        <section style={customStyles.logSection}>
          <div style={{ ...customStyles.panel, height: '300px' }}>
            <div style={customStyles.panelHeader}>
              <span style={customStyles.panelTitle}>Communication Logs</span>
            </div>
            <div style={{ ...customStyles.panelContent, overflowY: 'auto' }}>
              <LogEntry time="14:02" message="Engaging hostile unit at perimeter." />
              <LogEntry time="14:01" message="Target acquired. ID: REBEL_ALPHA." />
              <LogEntry alert={true} message="Power core below threshold." />
              <LogEntry time="13:55" message="Sector 04 reached. Initiating scan." />
            </div>
          </div>

          <div style={{ ...customStyles.panel, height: '300px' }}>
            <div style={customStyles.panelHeader}>
              <span style={customStyles.panelTitle}>Mission History</span>
            </div>
            <div style={customStyles.panelContent}>
              <table style={customStyles.dataTable}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px', borderBottom: '2px solid black', background: '#f4f4f4' }}>OP</th>
                    <th style={{ textAlign: 'left', padding: '8px', borderBottom: '2px solid black', background: '#f4f4f4' }}>RES</th>
                    <th style={{ textAlign: 'left', padding: '8px', borderBottom: '2px solid black', background: '#f4f4f4' }}>K/D</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>GHOST</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid #ddd', fontWeight: 900 }}>SUCC</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>12/0</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>VOID</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid #ddd', fontWeight: 900 }}>SUCC</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>04/1</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>HAVOC</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid #ddd', textDecoration: 'underline' }}>FAIL</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>00/1</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

const BriefingPage = () => (
  <>
    <header style={customStyles.topHeader}>
      <div>
        <div style={{ ...customStyles.mono, ...customStyles.textMuted, ...customStyles.uppercase, fontSize: '10px', marginBottom: '5px' }}>Mission Brief</div>
        <h1 style={customStyles.pageTitle}>Briefing</h1>
      </div>
    </header>
    <div style={{ padding: 'var(--space-l)', ...customStyles.mono }}>
      <p>Mission briefing content would appear here...</p>
    </div>
  </>
);

const IntelPage = () => (
  <>
    <header style={customStyles.topHeader}>
      <div>
        <div style={{ ...customStyles.mono, ...customStyles.textMuted, ...customStyles.uppercase, fontSize: '10px', marginBottom: '5px' }}>Intelligence</div>
        <h1 style={customStyles.pageTitle}>Intel</h1>
      </div>
    </header>
    <div style={{ padding: 'var(--space-l)', ...customStyles.mono }}>
      <p>Intelligence data would appear here...</p>
    </div>
  </>
);

const SettingsPage = () => (
  <>
    <header style={customStyles.topHeader}>
      <div>
        <div style={{ ...customStyles.mono, ...customStyles.textMuted, ...customStyles.uppercase, fontSize: '10px', marginBottom: '5px' }}>Configuration</div>
        <h1 style={customStyles.pageTitle}>Settings</h1>
      </div>
    </header>
    <div style={{ padding: 'var(--space-l)', ...customStyles.mono }}>
      <p>System settings would appear here...</p>
    </div>
  </>
);

const App = () => {
  const [activeNav, setActiveNav] = useState('Deployments');

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      body {
        margin: 0;
        padding: 0;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const renderPage = () => {
    switch(activeNav) {
      case 'Briefing':
        return <BriefingPage />;
      case 'Deployments':
        return <DeploymentsPage />;
      case 'Intel':
        return <IntelPage />;
      case 'Settings':
        return <SettingsPage />;
      default:
        return <DeploymentsPage />;
    }
  };

  return (
    <div style={{ ...customStyles.root, ...customStyles.body }}>
      <div style={customStyles.layoutContainer}>
        <Sidebar activeNav={activeNav} setActiveNav={setActiveNav} />
        <main style={customStyles.mainContent}>
          {renderPage()}
        </main>
      </div>
    </div>
  );
};

export default App;