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
  }
};

const StatusDot = ({ status }) => {
  const dotClass = status === 'ALERT' ? 'status-dot alert' : 
                   status === 'NOMINAL' ? 'status-dot active' : 
                   'status-dot offline';
  return <span className={dotClass}></span>;
};

const TelemetryBar = ({ percentage }) => {
  const isCritical = percentage < 30;
  const fillClass = isCritical ? 'telemetry-fill critical' : 'telemetry-fill';
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div className="telemetry-mini">
        <div className={fillClass} style={{ width: `${percentage}%` }}></div>
      </div>
      <span style={{ fontSize: '10px' }}>{percentage}%</span>
    </div>
  );
};

const IconButton = ({ children, onClick, style, title }) => {
  return (
    <button 
      className="btn-icon" 
      onClick={onClick}
      style={style}
      title={title}
    >
      {children}
    </button>
  );
};

const NavLink = ({ to, active, children }) => {
  const className = active ? 'nav-link active mono' : 'nav-link mono';
  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  );
};

const Sidebar = ({ activeNav, setActiveNav, activeOnlyFilter, setActiveOnlyFilter, criticalOnlyFilter, setCriticalOnlyFilter }) => {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon"></div>
        HAVOC // OS
      </div>

      <div className="nav-group">
        <div className="nav-label uppercase mono">Core Navigation</div>
        <NavLink to="/briefing" active={activeNav === 'briefing'}>BRIEFING</NavLink>
        <NavLink to="/" active={activeNav === 'deployments'}>DEPLOYMENTS</NavLink>
        <NavLink to="/intel" active={activeNav === 'intel'}>INTEL</NavLink>
      </div>

      <div className="filter-section nav-group">
        <div className="nav-label uppercase mono">Sector Filters</div>
        <a href="#" className="nav-link mono">SECTOR_04 <span>07</span></a>
        <a href="#" className="nav-link mono">SECTOR_01 <span>01</span></a>
        <a href="#" className="nav-link mono">GLOBAL <span>08</span></a>
      </div>

      <div className="filter-section nav-group">
        <div className="nav-label uppercase mono">Mission Status</div>
        <label className="flex items-center gap-s mono" style={{ fontSize: '11px', padding: '4px 12px', opacity: 0.7, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            checked={activeOnlyFilter}
            onChange={(e) => setActiveOnlyFilter(e.target.checked)}
          /> ACTIVE_ONLY
        </label>
        <label className="flex items-center gap-s mono" style={{ fontSize: '11px', padding: '4px 12px', opacity: 0.7, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input 
            type="checkbox"
            checked={criticalOnlyFilter}
            onChange={(e) => setCriticalOnlyFilter(e.target.checked)}
          /> CRITICAL_ONLY
        </label>
      </div>
    </aside>
  );
};

const Header = () => {
  return (
    <header className="header-bar">
      <div>
        <div className="mono uppercase" style={{ fontSize: '10px', opacity: 0.5 }}>System / Fleet / Table_View</div>
        <h1 className="page-title uppercase">Fleet <span style={{ fontWeight: 300 }}>Deployments</span></h1>
      </div>
      <div className="mono" style={{ textAlign: 'right' }}>
        <div style={{ fontSize: '14px', fontWeight: 900 }}>S04_COMMAND</div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>CONNECTED // SYNC_OK</div>
      </div>
    </header>
  );
};

const DataTable = ({ units, onInfoClick }) => {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Unit_ID</th>
          <th>Status</th>
          <th>Power_Core</th>
          <th>Sector_Loc</th>
          <th>Current_Mission</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody className="mono">
        {units.map((unit, index) => (
          <tr key={unit.id} style={{ opacity: unit.status === 'OFFLINE' ? 0.5 : 1 }}>
            <td>{unit.id}</td>
            <td>
              <StatusDot status={unit.status} />
              {unit.status}
            </td>
            <td>
              <TelemetryBar percentage={unit.power} />
            </td>
            <td>{unit.sector}</td>
            <td>{unit.mission}</td>
            <td>
              <IconButton 
                onClick={() => onInfoClick(unit)}
                style={{ 
                  width: '24px', 
                  height: '24px', 
                  boxShadow: '1px 1px 0 #000', 
                  borderWidth: '1px', 
                  fontSize: '10px' 
                }}
              >
                i
              </IconButton>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const Footer = ({ totalUnits, onlineUnits, criticalUnits }) => {
  return (
    <footer className="footer-strip mono">
      <div>HAVOC SYSTEMS INC. // CORE_MGR_V4</div>
      <div>TOTAL_UNITS: {String(totalUnits).padStart(2, '0')} // ONLINE: {String(onlineUnits).padStart(2, '0')} // CRITICAL: {String(criticalUnits).padStart(2, '0')}</div>
    </footer>
  );
};

const ActionRail = ({ onDeploy, onSync, onBroadcast, onEmergencyStop }) => {
  return (
    <aside className="action-rail">
      <div className="mono uppercase" style={{ fontSize: '9px', marginBottom: '10px' }}>Deploy</div>
      <IconButton onClick={onDeploy} title="Deploy Unit">+</IconButton>
      <IconButton onClick={onSync} title="Quick Sync">S</IconButton>
      <IconButton onClick={onBroadcast} title="Broadcast">B</IconButton>
      <div style={{ flex: 1 }}></div>
      <IconButton 
        onClick={onEmergencyStop}
        title="Emergency Stop" 
        style={{ background: '#000', color: '#fff' }}
      >
        X
      </IconButton>
    </aside>
  );
};

const Modal = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={onClose}
    >
      <div 
        style={{
          background: 'var(--surface)',
          border: 'var(--border-w) solid var(--border)',
          padding: 'var(--space-l)',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

const DeploymentsPage = () => {
  const [units, setUnits] = useState([
    { id: 'TX-99', status: 'ALERT', power: 24, sector: 'S04-ALPHA', mission: 'INTERCEPT' },
    { id: 'TX-87', status: 'NOMINAL', power: 92, sector: 'S04-DELTA', mission: 'PATROL' },
    { id: 'TX-102', status: 'NOMINAL', power: 78, sector: 'S04-GAMMA', mission: 'SURVEIL' },
    { id: 'TX-44', status: 'NOMINAL', power: 55, sector: 'S01-BASE', mission: 'RECHARGE' },
    { id: 'TX-22', status: 'OFFLINE', power: 0, sector: 'UNKNOWN', mission: 'NONE' }
  ]);

  const [activeNav, setActiveNav] = useState('deployments');
  const [activeOnlyFilter, setActiveOnlyFilter] = useState(true);
  const [criticalOnlyFilter, setCriticalOnlyFilter] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const filteredUnits = units.filter(unit => {
    if (activeOnlyFilter && unit.status === 'OFFLINE') return false;
    if (criticalOnlyFilter && unit.status !== 'ALERT') return false;
    return true;
  });

  const onlineUnits = units.filter(u => u.status !== 'OFFLINE').length;
  const criticalUnits = units.filter(u => u.status === 'ALERT').length;

  const handleInfoClick = (unit) => {
    setSelectedUnit(unit);
    setShowModal(true);
  };

  const handleDeploy = () => {
    alert('Deploy Unit functionality');
  };

  const handleSync = () => {
    alert('Quick Sync initiated');
  };

  const handleBroadcast = () => {
    alert('Broadcast message');
  };

  const handleEmergencyStop = () => {
    if (window.confirm('Are you sure you want to initiate EMERGENCY STOP?')) {
      alert('Emergency Stop activated');
    }
  };

  return (
    <>
      <Sidebar 
        activeNav={activeNav}
        setActiveNav={setActiveNav}
        activeOnlyFilter={activeOnlyFilter}
        setActiveOnlyFilter={setActiveOnlyFilter}
        criticalOnlyFilter={criticalOnlyFilter}
        setCriticalOnlyFilter={setCriticalOnlyFilter}
      />
      
      <main className="main-viewport">
        <Header />
        
        <div className="data-container">
          <DataTable units={filteredUnits} onInfoClick={handleInfoClick} />
        </div>

        <Footer 
          totalUnits={units.length}
          onlineUnits={onlineUnits}
          criticalUnits={criticalUnits}
        />
      </main>

      <ActionRail 
        onDeploy={handleDeploy}
        onSync={handleSync}
        onBroadcast={handleBroadcast}
        onEmergencyStop={handleEmergencyStop}
      />

      <Modal isOpen={showModal} onClose={() => setShowModal(false)}>
        {selectedUnit && (
          <div className="mono">
            <h2 className="uppercase" style={{ fontSize: '24px', fontWeight: 900, marginBottom: '20px' }}>
              Unit Details: {selectedUnit.id}
            </h2>
            <div style={{ display: 'grid', gap: '12px' }}>
              <div><strong>Status:</strong> {selectedUnit.status}</div>
              <div><strong>Power Core:</strong> {selectedUnit.power}%</div>
              <div><strong>Sector Location:</strong> {selectedUnit.sector}</div>
              <div><strong>Current Mission:</strong> {selectedUnit.mission}</div>
            </div>
            <button 
              className="btn-icon" 
              onClick={() => setShowModal(false)}
              style={{ 
                marginTop: '20px',
                width: 'auto',
                padding: '10px 20px'
              }}
            >
              CLOSE
            </button>
          </div>
        )}
      </Modal>
    </>
  );
};

const BriefingPage = () => {
  const [activeNav] = useState('briefing');
  const [activeOnlyFilter, setActiveOnlyFilter] = useState(true);
  const [criticalOnlyFilter, setCriticalOnlyFilter] = useState(false);

  return (
    <>
      <Sidebar 
        activeNav={activeNav}
        activeOnlyFilter={activeOnlyFilter}
        setActiveOnlyFilter={setActiveOnlyFilter}
        criticalOnlyFilter={criticalOnlyFilter}
        setCriticalOnlyFilter={setCriticalOnlyFilter}
      />
      
      <main className="main-viewport">
        <header className="header-bar">
          <div>
            <div className="mono uppercase" style={{ fontSize: '10px', opacity: 0.5 }}>System / Command / Briefing</div>
            <h1 className="page-title uppercase">Mission <span style={{ fontWeight: 300 }}>Briefing</span></h1>
          </div>
        </header>
        
        <div className="data-container">
          <div style={{ background: 'var(--surface)', border: 'var(--border-w) solid var(--border)', padding: 'var(--space-l)' }}>
            <h2 className="mono uppercase" style={{ fontSize: '18px', fontWeight: 900, marginBottom: '20px' }}>
              Current Operations Overview
            </h2>
            <div className="mono" style={{ lineHeight: 1.6 }}>
              <p style={{ marginBottom: '15px' }}>
                SECTOR_04 operations continue with elevated alert status. Unit TX-99 requires immediate attention due to critical power levels during INTERCEPT mission.
              </p>
              <p style={{ marginBottom: '15px' }}>
                All other units operating within nominal parameters. PATROL and SURVEIL missions proceeding as scheduled.
              </p>
              <p>
                SECTOR_01 base operations stable. Unit TX-44 completing recharge cycle.
              </p>
            </div>
          </div>
        </div>

        <Footer totalUnits={8} onlineUnits={7} criticalUnits={1} />
      </main>

      <ActionRail 
        onDeploy={() => alert('Deploy Unit')}
        onSync={() => alert('Quick Sync')}
        onBroadcast={() => alert('Broadcast')}
        onEmergencyStop={() => alert('Emergency Stop')}
      />
    </>
  );
};

const IntelPage = () => {
  const [activeNav] = useState('intel');
  const [activeOnlyFilter, setActiveOnlyFilter] = useState(true);
  const [criticalOnlyFilter, setCriticalOnlyFilter] = useState(false);

  return (
    <>
      <Sidebar 
        activeNav={activeNav}
        activeOnlyFilter={activeOnlyFilter}
        setActiveOnlyFilter={setActiveOnlyFilter}
        criticalOnlyFilter={criticalOnlyFilter}
        setCriticalOnlyFilter={setCriticalOnlyFilter}
      />
      
      <main className="main-viewport">
        <header className="header-bar">
          <div>
            <div className="mono uppercase" style={{ fontSize: '10px', opacity: 0.5 }}>System / Intelligence / Reports</div>
            <h1 className="page-title uppercase">Intel <span style={{ fontWeight: 300 }}>Reports</span></h1>
          </div>
        </header>
        
        <div className="data-container">
          <div style={{ background: 'var(--surface)', border: 'var(--border-w) solid var(--border)', padding: 'var(--space-l)' }}>
            <h2 className="mono uppercase" style={{ fontSize: '18px', fontWeight: 900, marginBottom: '20px' }}>
              Intelligence Summary
            </h2>
            <div className="mono" style={{ lineHeight: 1.6 }}>
              <div style={{ marginBottom: '20px' }}>
                <strong>SECTOR_04-ALPHA:</strong> Elevated threat detection. Recommend continued INTERCEPT protocols.
              </div>
              <div style={{ marginBottom: '20px' }}>
                <strong>SECTOR_04-DELTA:</strong> Routine PATROL operations. No anomalies detected.
              </div>
              <div style={{ marginBottom: '20px' }}>
                <strong>SECTOR_04-GAMMA:</strong> SURVEIL mission ongoing. Data collection within expected parameters.
              </div>
            </div>
          </div>
        </div>

        <Footer totalUnits={8} onlineUnits={7} criticalUnits={1} />
      </main>

      <ActionRail 
        onDeploy={() => alert('Deploy Unit')}
        onSync={() => alert('Quick Sync')}
        onBroadcast={() => alert('Broadcast')}
        onEmergencyStop={() => alert('Emergency Stop')}
      />
    </>
  );
};

const App = () => {
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; margin: 0; padding: 0; }

      body {
        background-color: var(--bg);
        color: var(--text-main);
        font-family: var(--font-sans);
        font-size: 13px;
        line-height: 1.2;
        -webkit-font-smoothing: antialiased;
        height: 100vh;
        display: flex;
        overflow: hidden;
      }

      #root {
        width: 100%;
        height: 100vh;
        display: flex;
      }

      .sidebar {
        width: 260px;
        background: var(--surface);
        border-right: var(--border-w) solid var(--border);
        display: flex;
        flex-direction: column;
        height: 100%;
        padding: var(--space-m);
        gap: var(--space-l);
      }

      .main-viewport {
        flex: 1;
        display: flex;
        flex-direction: column;
        background: var(--bg);
        height: 100%;
        overflow: hidden;
      }

      .action-rail {
        width: 80px;
        background: var(--surface);
        border-left: var(--border-w) solid var(--border);
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: var(--space-m) 0;
        gap: var(--space-m);
      }

      .mono { font-family: var(--font-mono); font-weight: 600; letter-spacing: -0.02em; }
      .uppercase { text-transform: uppercase; letter-spacing: 0.05em; }

      .brand {
        font-weight: 900;
        font-size: 18px;
        display: flex;
        align-items: center;
        gap: var(--space-s);
        margin-bottom: var(--space-s);
      }

      .brand-icon {
        width: 18px;
        height: 18px;
        background: var(--text-main);
      }

      .nav-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .nav-label {
        font-size: 10px;
        color: var(--text-muted);
        margin-bottom: var(--space-xs);
        font-weight: 900;
      }

      .nav-link {
        text-decoration: none;
        color: var(--text-main);
        font-weight: 700;
        padding: 8px 12px;
        border: 1px solid transparent;
        display: flex;
        justify-content: space-between;
      }

      .nav-link.active {
        background: var(--text-main);
        color: var(--surface);
      }

      .nav-link:hover:not(.active) {
        border-color: var(--border);
        background: var(--surface-highlight);
      }

      .filter-section {
        border-top: 1px solid #ccc;
        padding-top: var(--space-m);
      }

      .header-bar {
        background: var(--surface);
        padding: var(--space-m) var(--space-l);
        border-bottom: var(--border-w) solid var(--border);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .page-title {
        font-size: 32px;
        font-weight: 900;
        letter-spacing: -0.04em;
      }

      .data-container {
        flex: 1;
        padding: var(--space-m);
        overflow-y: auto;
      }

      .data-table {
        width: 100%;
        border-collapse: collapse;
        background: var(--surface);
        border: var(--border-w) solid var(--border);
      }

      .data-table th {
        background: var(--text-main);
        color: var(--surface);
        text-align: left;
        padding: 12px;
        font-size: 11px;
        text-transform: uppercase;
        font-weight: 900;
      }

      .data-table td {
        padding: 12px;
        border-bottom: 1px solid #ddd;
        vertical-align: middle;
      }

      .data-table tr:hover {
        background: var(--surface-highlight);
      }

      .telemetry-mini {
        width: 100px;
        height: 8px;
        background: #eee;
        border: 1px solid black;
        position: relative;
      }

      .telemetry-fill {
        height: 100%;
        background: black;
      }

      .telemetry-fill.critical {
        background: repeating-linear-gradient(45deg, #000, #000 3px, #fff 3px, #fff 6px);
      }

      .status-dot {
        width: 8px;
        height: 8px;
        display: inline-block;
        margin-right: 6px;
        border: 1px solid black;
      }

      .status-dot.active { background: #000; }
      .status-dot.alert { background: #fff; box-shadow: 0 0 0 1px inset #000; border: 2px solid #000; }
      .status-dot.offline { background: #ccc; }

      .btn-icon {
        width: 44px;
        height: 44px;
        border: var(--border-w) solid var(--border);
        background: var(--surface);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 900;
        box-shadow: 3px 3px 0 #000;
        transition: 0.1s;
      }

      .btn-icon:active {
        box-shadow: none;
        transform: translate(3px, 3px);
      }

      .btn-icon:hover {
        background: var(--text-main);
        color: var(--surface);
      }

      .footer-strip {
        background: var(--surface);
        border-top: var(--border-w) solid var(--border);
        padding: 8px var(--space-m);
        font-size: 10px;
        display: flex;
        justify-content: space-between;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  return (
    <Router basename="/">
      <div style={customStyles.root}>
        <Routes>
          <Route path="/" element={<DeploymentsPage />} />
          <Route path="/briefing" element={<BriefingPage />} />
          <Route path="/intel" element={<IntelPage />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;