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

const Button = ({ children, onClick, style, className = '' }) => (
  <button 
    className={`btn ${className}`}
    onClick={onClick}
    style={{
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
      boxShadow: '4px 4px 0px rgba(0,0,0,1)',
      ...style
    }}
  >
    {children}
  </button>
);

const UnitCard = ({ unit, onViewProfile }) => {
  const getStatusStyle = (status) => {
    if (status === 'ALERT') return { background: '#fff', color: '#000', borderWidth: '2px' };
    if (status === 'NOMINAL') return { background: '#000', color: '#fff' };
    if (status === 'OFFLINE') return { background: '#eee', color: '#999' };
    return {};
  };

  const isCritical = unit.powerCore < 30;
  const isOffline = unit.status === 'OFFLINE';

  return (
    <div className="unit-card" style={{
      border: '2px solid #000000',
      padding: '20px',
      background: '#ffffff',
      boxShadow: '6px 6px 0 rgba(0,0,0,1)',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    }}>
      <div className="unit-header flex justify-between items-center" style={{
        borderBottom: '1px solid #ddd',
        paddingBottom: '10px',
        marginBottom: '10px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div className="mono" style={{ fontSize: '16px', fontFamily: "'Courier New', Courier, monospace", fontWeight: 600 }}>{unit.name}</div>
        <div className="status-badge" style={{
          fontSize: '10px',
          padding: '2px 6px',
          border: '1px solid black',
          fontWeight: 900,
          textTransform: 'uppercase',
          ...getStatusStyle(unit.status)
        }}>{unit.status}</div>
      </div>
      <div className="flex-col gap-s" style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '10px',
        opacity: isOffline ? 0.5 : 1
      }}>
        <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="stat-label" style={{ fontSize: '9px', color: '#666666', textTransform: 'uppercase' }}>Power Core</span>
          <span className="stat-value" style={{ fontSize: '12px', fontWeight: 700, fontFamily: "'Courier New', Courier, monospace" }}>{unit.powerCore}%</span>
        </div>
        <div className="telemetry-bar" style={{ height: '12px', background: 'white', border: '2px solid black', width: '100%' }}>
          <div className="telemetry-fill" style={{
            height: '100%',
            width: `${unit.powerCore}%`,
            background: isCritical ? 'repeating-linear-gradient(45deg, #000, #000 5px, #fff 5px, #fff 10px)' : '#000'
          }}></div>
        </div>
        <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '5px' }}>
          <div>
            <div className="stat-label" style={{ fontSize: '9px', color: '#666666', textTransform: 'uppercase' }}>Location</div>
            <div className="stat-value" style={{ fontSize: '12px', fontWeight: 700, fontFamily: "'Courier New', Courier, monospace" }}>{unit.location}</div>
          </div>
          <div>
            <div className="stat-label" style={{ fontSize: '9px', color: '#666666', textTransform: 'uppercase' }}>Mission</div>
            <div className="stat-value" style={{ fontSize: '12px', fontWeight: 700, fontFamily: "'Courier New', Courier, monospace" }}>{unit.mission}</div>
          </div>
        </div>
      </div>
      <Button 
        onClick={() => onViewProfile(unit)}
        style={{ marginTop: '10px', padding: '8px', fontSize: '10px' }}
      >
        {isOffline ? 'Initiate Boot' : 'View Profile'}
      </Button>
    </div>
  );
};

const FleetOverview = () => {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState('Deployments');
  const [selectedUnit, setSelectedUnit] = useState(null);

  const units = [
    { name: 'TX-99', status: 'ALERT', powerCore: 24, location: 'S04-ALPHA', mission: 'INTERCEPT' },
    { name: 'TX-87', status: 'NOMINAL', powerCore: 92, location: 'S04-DELTA', mission: 'PATROL' },
    { name: 'TX-102', status: 'NOMINAL', powerCore: 78, location: 'S04-GAMMA', mission: 'SURVEIL' },
    { name: 'TX-44', status: 'NOMINAL', powerCore: 55, location: 'S01-BASE', mission: 'RECHARGE' },
    { name: 'TX-110', status: 'NOMINAL', powerCore: 81, location: 'S04-EPS', mission: 'ESCORT' },
    { name: 'TX-22', status: 'OFFLINE', powerCore: 0, location: 'UNKNOWN', mission: 'NONE' }
  ];

  const onlineUnits = units.filter(u => u.status !== 'OFFLINE').length;
  const criticalUnits = units.filter(u => u.powerCore < 30 && u.status !== 'OFFLINE').length;

  const handleViewProfile = (unit) => {
    setSelectedUnit(unit);
  };

  const handleDeployReinforcements = () => {
    alert('Deploy Reinforcements initiated');
  };

  return (
    <div style={{
      backgroundColor: '#e6e6e6',
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      padding: '40px',
      ...customStyles.root
    }}>
      <div className="layout-container" style={{
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
        <header style={{
          borderBottom: '3px solid #000000',
          paddingBottom: '30px',
          marginBottom: '20px'
        }}>
          <div className="nav-bar" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '30px',
            borderBottom: '1px solid #ccc',
            paddingBottom: '20px'
          }}>
            <div className="brand" style={{
              fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
              fontWeight: 900,
              fontSize: '24px',
              letterSpacing: '-0.04em',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <div className="brand-icon" style={{
                width: '24px',
                height: '24px',
                background: '#000000',
                borderRadius: '50%'
              }}></div>
              HAVOC // OS
            </div>
            <nav className="top-nav mono uppercase" style={{
              display: 'flex',
              gap: '30px',
              fontFamily: "'Courier New', Courier, monospace",
              fontWeight: 600,
              textTransform: 'uppercase'
            }}>
              {['Briefing', 'Deployments', 'Intel', 'Settings'].map(item => (
                <a
                  key={item}
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveNav(item);
                  }}
                  style={{
                    color: activeNav === item ? '#ffffff' : '#666666',
                    textDecoration: 'none',
                    fontSize: '14px',
                    fontWeight: 700,
                    transition: 'all 0.2s',
                    background: activeNav === item ? '#000000' : 'transparent',
                    padding: activeNav === item ? '0 5px' : '0'
                  }}
                >
                  {item}
                </a>
              ))}
            </nav>
            <div className="mono" style={{
              fontSize: '11px',
              color: '#666666',
              fontFamily: "'Courier New', Courier, monospace"
            }}>
              FLEET_SYNC.STABLE <span style={{ color: '#000000' }}>●</span>
            </div>
          </div>

          <div className="page-header" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end'
          }}>
            <div>
              <div className="breadcrumbs mono uppercase" style={{
                color: '#000000',
                fontWeight: 700,
                fontSize: '12px',
                marginBottom: '10px',
                opacity: 0.5,
                fontFamily: "'Courier New', Courier, monospace",
                textTransform: 'uppercase'
              }}>
                Deployments / Global Fleet / Overview
              </div>
              <h1 className="page-title uppercase" style={{
                fontSize: '80px',
                fontWeight: 900,
                letterSpacing: '-0.06em',
                lineHeight: 0.85,
                textTransform: 'uppercase',
                marginTop: '10px'
              }}>
                Fleet <span style={{ color: '#000000' }}>Active</span> <span style={{ fontWeight: 300, fontSize: '0.5em', color: '#666666' }}>[SECTOR_04]</span>
              </h1>
            </div>
            <div className="page-actions">
              <Button onClick={handleDeployReinforcements}>Deploy Reinforcements</Button>
            </div>
          </div>
        </header>

        <div className="panel" style={{
          border: '3px solid #000000',
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div className="panel-header" style={{
            borderBottom: '3px solid #000000',
            padding: '10px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#000000',
            color: '#ffffff'
          }}>
            <span className="panel-title" style={{
              fontWeight: 700,
              fontSize: '14px',
              textTransform: 'uppercase'
            }}>Active Unit Deployment Matrix</span>
            <span className="mono" style={{
              fontSize: '10px',
              color: '#ccc',
              fontFamily: "'Courier New', Courier, monospace"
            }}>
              TOTAL_UNITS: {units.length.toString().padStart(2, '0')} // ONLINE: {onlineUnits.toString().padStart(2, '0')} // CRITICAL: {criticalUnits.toString().padStart(2, '0')}
            </span>
          </div>
          
          <div className="unit-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '20px',
            padding: '20px'
          }}>
            {units.map(unit => (
              <UnitCard key={unit.name} unit={unit} onViewProfile={handleViewProfile} />
            ))}
          </div>
        </div>

        <div className="footer-bar mono" style={{
          marginTop: 'auto',
          borderTop: '3px solid black',
          paddingTop: '30px',
          fontSize: '10px',
          color: '#000000',
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: "'Courier New', Courier, monospace"
        }}>
          <span>HAVOC SYSTEMS INC. // FLEET_MANAGEMENT_V4</span>
          <span>ENCRYPTION: AES-512-V2 // SESSION: ADMIN_01</span>
        </div>
      </div>

      {selectedUnit && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setSelectedUnit(null)}>
          <div style={{
            background: '#ffffff',
            border: '3px solid #000000',
            padding: '40px',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '10px 10px 0 rgba(0,0,0,1)'
          }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{
              fontSize: '32px',
              fontWeight: 900,
              marginBottom: '20px',
              fontFamily: "'Courier New', Courier, monospace"
            }}>Unit Profile: {selectedUnit.name}</h2>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ marginBottom: '10px' }}>
                <strong>Status:</strong> {selectedUnit.status}
              </div>
              <div style={{ marginBottom: '10px' }}>
                <strong>Power Core:</strong> {selectedUnit.powerCore}%
              </div>
              <div style={{ marginBottom: '10px' }}>
                <strong>Location:</strong> {selectedUnit.location}
              </div>
              <div style={{ marginBottom: '10px' }}>
                <strong>Mission:</strong> {selectedUnit.mission}
              </div>
            </div>
            <Button onClick={() => setSelectedUnit(null)}>Close</Button>
          </div>
        </div>
      )}
    </div>
  );
};

const App = () => {
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
        font-size: 14px;
        line-height: 1.4;
        -webkit-font-smoothing: antialiased;
      }
      .btn:active { 
        box-shadow: none !important; 
        transform: translate(4px, 4px) !important; 
      }
      .btn:hover { 
        background: #000000 !important; 
        color: #ffffff !important; 
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  return (
    <Router basename="/">
      <Routes>
        <Route path="/" element={<FleetOverview />} />
      </Routes>
    </Router>
  );
};

export default App;