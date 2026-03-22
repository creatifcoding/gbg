import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';

const styles = {
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

const StatusIndicator = ({ status }) => {
  const statusStyle = {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    display: 'inline-block',
    marginRight: '6px',
    ...(status === 'active' && {
      background: '#0f0',
      boxShadow: '0 0 5px #0f0'
    }),
    ...(status === 'warning' && {
      background: '#000',
      border: '1px solid #fff',
      outline: '1px solid #000'
    }),
    ...(status === 'offline' && {
      background: '#666'
    })
  };
  return <span style={statusStyle}></span>;
};

const TelemetryBar = ({ value, warning }) => {
  const barStyle = {
    height: '6px',
    background: '#eee',
    border: '1px solid black',
    width: '100%',
    marginTop: '4px',
    marginBottom: '8px'
  };
  const fillStyle = {
    height: '100%',
    width: `${value}%`,
    background: warning ? 'repeating-linear-gradient(45deg, #000, #000 3px, #fff 3px, #fff 6px)' : 'black'
  };
  return (
    <div style={barStyle}>
      <div style={fillStyle}></div>
    </div>
  );
};

const UnitCard = ({ unit, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const cardStyle = {
    border: '2px solid var(--border)',
    padding: 'var(--space-m)',
    background: 'var(--surface)',
    boxShadow: isHovered ? '6px 6px 0 rgba(0,0,0,0.2)' : '4px 4px 0 rgba(0,0,0,0.1)',
    transition: 'transform 0.1s, box-shadow 0.1s',
    cursor: 'pointer',
    transform: isHovered ? 'translate(-2px, -2px)' : 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-s)'
  };

  return (
    <div 
      style={cardStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase', fontSize: '16px' }}>
          {unit.name}
        </span>
        <div style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase', fontSize: '10px' }}>
          {unit.class}
        </div>
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
        <StatusIndicator status={unit.statusType} /> {unit.status}
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '9px' }}>
          <span>CORE</span>
          <span>{unit.core}%</span>
        </div>
        <TelemetryBar value={unit.core} warning={unit.core < 30} />
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '9px' }}>
          <span>INTG</span>
          <span>{unit.integrity}%</span>
        </div>
        <TelemetryBar value={unit.integrity} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '10px', marginTop: '5px', borderTop: '1px solid #eee', paddingTop: '5px' }}>
        <span>LOC: {unit.location}</span>
        <span style={{ color: 'var(--text-main)', fontWeight: '900', textDecoration: 'underline' }}>
          VIEW PROFILE →
        </span>
      </div>
    </div>
  );
};

const FilterTag = ({ label, active, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const tagStyle = {
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    padding: '4px 10px',
    border: active ? '1px solid black' : '1px solid #ccc',
    cursor: 'pointer',
    background: active ? 'black' : (isHovered ? '#f0f0f0' : 'transparent'),
    color: active ? 'white' : 'black',
    transition: 'all 0.2s'
  };

  return (
    <div 
      style={tagStyle}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {label}
    </div>
  );
};

const Button = ({ children, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isActive, setIsActive] = useState(false);

  const buttonStyle = {
    background: isHovered ? 'var(--text-main)' : 'transparent',
    border: 'var(--border-w) solid var(--border)',
    color: isHovered ? 'var(--surface)' : 'var(--text-main)',
    padding: '12px 24px',
    fontFamily: 'var(--font-sans)',
    fontWeight: '700',
    fontSize: '12px',
    textTransform: 'uppercase',
    cursor: 'pointer',
    transition: 'all 0.2s',
    borderRadius: '0',
    boxShadow: isActive ? 'none' : '4px 4px 0px rgba(0,0,0,1)',
    transform: isActive ? 'translate(4px, 4px)' : 'none'
  };

  return (
    <button
      style={buttonStyle}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={() => setIsActive(true)}
      onMouseUp={() => setIsActive(false)}
    >
      {children}
    </button>
  );
};

const NavItem = ({ href, active, children }) => {
  const [isHovered, setIsHovered] = useState(false);

  const linkStyle = {
    color: (isHovered || active) ? 'var(--text-inv)' : 'var(--text-muted)',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: '700',
    transition: 'all 0.2s',
    background: (isHovered || active) ? 'var(--text-main)' : 'transparent',
    padding: (isHovered || active) ? '0 5px' : '0'
  };

  return (
    <Link
      to={href}
      style={linkStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
    </Link>
  );
};

const HomePage = () => {
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedUnit, setSelectedUnit] = useState(null);

  const unitsData = {
    sector04: [
      { name: 'TX-99', class: 'Titan-Class', status: 'CRITICAL POWER', statusType: 'warning', core: 24, integrity: 88, location: '34.05 N' },
      { name: 'RX-12', class: 'Scout-Class', status: 'NOMINAL', statusType: 'active', core: 92, integrity: 100, location: '34.02 N' },
      { name: 'BX-04', class: 'Heavy-Class', status: 'ENGAGING TARGET', statusType: 'active', core: 65, integrity: 72, location: '34.09 N' }
    ],
    sector09: [
      { name: 'VX-81', class: 'Titan-Class', status: 'OFFLINE / RECHARGING', statusType: 'offline', core: 4, integrity: 95, location: '38.11 N' },
      { name: 'AX-01', class: 'Scout-Class', status: 'PATROLLING', statusType: 'active', core: 78, integrity: 100, location: '38.05 N' }
    ]
  };

  const filters = [
    { id: 'all', label: 'All Sectors [42]' },
    { id: 'sector04', label: 'Sector 04 [12]' },
    { id: 'sector09', label: 'Sector 09 [08]' },
    { id: 'alert', label: 'High Alert [03]' },
    { id: 'recharge', label: 'Recharging [05]' }
  ];

  const handleUnitClick = (unit) => {
    setSelectedUnit(unit);
  };

  return (
    <div style={{ ...styles.root, backgroundColor: 'var(--bg)', color: 'var(--text-main)', fontFamily: 'var(--font-sans)', fontSize: '14px', lineHeight: '1.4', minHeight: '100vh', display: 'flex', justifyContent: 'center', padding: '40px' }}>
      <div style={{ background: 'var(--surface)', maxWidth: '1400px', width: '100%', padding: 'var(--space-xl)', display: 'flex', flexDirection: 'column', gap: 'var(--space-l)', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', border: 'var(--border-w) solid var(--border)' }}>
        
        <header style={{ borderBottom: 'var(--border-w) solid var(--border)', paddingBottom: 'var(--space-l)', marginBottom: 'var(--space-m)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-l)', borderBottom: '1px solid #ccc', paddingBottom: 'var(--space-m)' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontWeight: '900', fontSize: '24px', letterSpacing: '-0.04em', display: 'flex', alignItems: 'center', gap: 'var(--space-s)' }}>
              <div style={{ width: '24px', height: '24px', background: 'var(--text-main)', borderRadius: '50%' }}></div>
              HAVOC // OS
            </div>
            <nav style={{ display: 'flex', gap: 'var(--space-l)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
              <NavItem href="/">Briefing</NavItem>
              <NavItem href="/" active>Deployments</NavItem>
              <NavItem href="/">Intel</NavItem>
              <NavItem href="/">Settings</NavItem>
            </nav>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
              NETWORK.GLOBAL <span style={{ color: 'var(--accent)' }}>●</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ color: 'var(--text-main)', fontWeight: '700', fontSize: '12px', marginBottom: 'var(--space-s)', opacity: '0.5', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
                System / Active Units
              </div>
              <h1 style={{ fontSize: '80px', fontWeight: '900', letterSpacing: '-0.06em', lineHeight: '0.85', textTransform: 'uppercase', marginTop: 'var(--space-s)' }}>
                Fleet <span style={{ color: 'var(--accent)' }}>Status</span>
              </h1>
            </div>
            <div style={{ display: 'flex', gap: '15px' }}>
              <Button onClick={() => alert('Global Scan initiated')}>Global Scan</Button>
              <Button onClick={() => alert('Batch Command opened')}>Batch Command</Button>
            </div>
          </div>
        </header>

        <div style={{ display: 'flex', gap: 'var(--space-m)', borderBottom: '1px solid #ccc', paddingBottom: 'var(--space-m)', marginBottom: 'var(--space-m)', textTransform: 'uppercase' }}>
          {filters.map(filter => (
            <FilterTag
              key={filter.id}
              label={filter.label}
              active={activeFilter === filter.id}
              onClick={() => setActiveFilter(filter.id)}
            />
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-m)' }}>
          
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: '900', fontSize: '16px', background: '#f4f4f4', padding: 'var(--space-s) var(--space-m)', borderBottom: '2px solid black', marginTop: 'var(--space-m)', display: 'flex', justifyContent: 'space-between' }}>
              <span>SECTOR 04 // HARBOR DISTRICT</span>
              <span style={{ color: 'var(--text-muted)' }}>8 ACTIVE / 2 WARNING / 2 IDLE</span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-m)', padding: 'var(--space-m)' }}>
              {unitsData.sector04.map((unit, idx) => (
                <UnitCard key={idx} unit={unit} onClick={() => handleUnitClick(unit)} />
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: '900', fontSize: '16px', background: '#f4f4f4', padding: 'var(--space-s) var(--space-m)', borderBottom: '2px solid black', marginTop: 'var(--space-m)', display: 'flex', justifyContent: 'space-between' }}>
              <span>SECTOR 09 // INDUSTRIAL RIM</span>
              <span style={{ color: 'var(--text-muted)' }}>5 ACTIVE / 3 OFFLINE</span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-m)', padding: 'var(--space-m)' }}>
              {unitsData.sector09.map((unit, idx) => (
                <UnitCard key={idx} unit={unit} onClick={() => handleUnitClick(unit)} />
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 'var(--space-xl)', borderTop: 'var(--border-w) solid black', paddingTop: 'var(--space-m)', fontSize: '10px', fontWeight: '700', color: 'black', fontFamily: 'var(--font-mono)', display: 'flex', justifyContent: 'space-between' }}>
          <span>HAVOC SYSTEMS INC. // FLEET MANAGEMENT</span>
          <span>TOTAL ACTIVE UNITS: 42 // UPLINK: STABLE</span>
        </div>

      </div>
    </div>
  );
};

const App = () => {
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { -webkit-font-smoothing: antialiased; }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  return (
    <Router basename="/">
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>
    </Router>
  );
};

export default App;