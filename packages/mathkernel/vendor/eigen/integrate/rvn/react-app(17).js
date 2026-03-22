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
    padding: '40px',
    margin: 0
  },
  layoutContainer: {
    background: 'var(--surface)',
    maxWidth: '1400px',
    width: '100%',
    padding: 'var(--space-xl)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-l)',
    boxShadow: '0 20px 50px rgba(0,0,0,0.1)',
    border: 'var(--border-w) solid var(--border)'
  },
  mono: {
    fontFamily: 'var(--font-mono)',
    fontWeight: 600,
    letterSpacing: '-0.02em'
  },
  uppercase: {
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  textMuted: {
    color: 'var(--text-muted)'
  },
  header: {
    borderBottom: 'var(--border-w) solid var(--border)',
    paddingBottom: 'var(--space-l)',
    marginBottom: 'var(--space-m)'
  },
  navBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 'var(--space-l)',
    borderBottom: '1px solid #ccc',
    paddingBottom: 'var(--space-m)'
  },
  brand: {
    fontFamily: 'var(--font-sans)',
    fontWeight: 900,
    fontSize: '24px',
    letterSpacing: '-0.04em',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-s)'
  },
  brandIcon: {
    width: '24px',
    height: '24px',
    background: 'var(--text-main)',
    borderRadius: '50%'
  },
  topNav: {
    display: 'flex',
    gap: 'var(--space-l)'
  },
  navItem: {
    color: 'var(--text-muted)',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 700,
    transition: 'all 0.2s',
    cursor: 'pointer'
  },
  navItemActive: {
    color: 'var(--text-inv)',
    background: 'var(--text-main)',
    padding: '0 5px'
  },
  pageTitle: {
    fontSize: '80px',
    fontWeight: 900,
    letterSpacing: '-0.06em',
    lineHeight: '0.85',
    textTransform: 'uppercase',
    marginTop: 'var(--space-s)'
  },
  breadcrumbs: {
    color: 'var(--text-main)',
    fontWeight: 700,
    fontSize: '12px',
    marginBottom: 'var(--space-s)',
    opacity: 0.5
  },
  btn: {
    background: 'transparent',
    border: 'var(--border-w) solid var(--border)',
    color: 'var(--text-main)',
    padding: '12px 24px',
    fontFamily: 'var(--font-sans)',
    fontWeight: 700,
    fontSize: '12px',
    textTransform: 'uppercase',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '4px 4px 0px rgba(0,0,0,1)'
  },
  btnPrimary: {
    background: 'black',
    color: 'white'
  },
  panel: {
    border: 'var(--border-w) solid var(--border)',
    background: 'var(--surface)',
    display: 'flex',
    flexDirection: 'column'
  },
  panelHeader: {
    borderBottom: 'var(--border-w) solid var(--border)',
    padding: 'var(--space-s) var(--space-m)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'var(--text-main)',
    color: 'var(--surface)'
  },
  panelTitle: {
    fontFamily: 'var(--font-sans)',
    fontWeight: 700,
    fontSize: '14px',
    textTransform: 'uppercase',
    color: 'white'
  },
  panelContent: {
    padding: 'var(--space-m)',
    flex: 1
  },
  objectiveItem: {
    borderLeft: '4px solid var(--border)',
    padding: 'var(--space-s) var(--space-m)',
    marginBottom: 'var(--space-s)',
    background: 'var(--surface-highlight)'
  },
  threatMeter: {
    height: '40px',
    background: '#eee',
    border: '2px solid black',
    position: 'relative',
    overflow: 'hidden',
    margin: 'var(--space-s) 0'
  },
  threatFill: {
    height: '100%',
    background: 'repeating-linear-gradient(45deg, #000, #000 10px, #333 10px, #333 20px)'
  },
  unitSelectCard: {
    border: '2px solid var(--border)',
    padding: 'var(--space-s)',
    cursor: 'pointer',
    transition: '0.2s'
  },
  unitSelectCardSelected: {
    background: 'var(--text-main)',
    color: 'white'
  },
  unitSelectCardDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed'
  },
  intelImage: {
    width: '100%',
    height: '200px',
    background: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontFamily: 'var(--font-mono)',
    border: '2px solid black',
    position: 'relative',
    fontSize: '10px',
    opacity: 0.5
  }
};

const Button = ({ children, onClick, primary, style, onMouseDown, onMouseUp }) => {
  const [isPressed, setIsPressed] = useState(false);

  const handleMouseDown = () => {
    setIsPressed(true);
    if (onMouseDown) onMouseDown();
  };

  const handleMouseUp = () => {
    setIsPressed(false);
    if (onMouseUp) onMouseUp();
  };

  const buttonStyle = {
    ...customStyles.btn,
    ...(primary ? customStyles.btnPrimary : {}),
    ...(isPressed ? { boxShadow: 'none', transform: 'translate(4px, 4px)' } : {}),
    ...style
  };

  return (
    <button
      style={buttonStyle}
      onClick={onClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {children}
    </button>
  );
};

const Header = ({ activeNav, setActiveNav }) => {
  return (
    <header style={customStyles.header}>
      <div style={customStyles.navBar}>
        <div style={customStyles.brand}>
          <div style={customStyles.brandIcon}></div>
          HAVOC // OS
        </div>
        <nav style={{ ...customStyles.topNav, ...customStyles.mono, ...customStyles.uppercase }}>
          <span
            style={{
              ...customStyles.navItem,
              ...(activeNav === 'briefing' ? customStyles.navItemActive : {})
            }}
            onClick={() => setActiveNav('briefing')}
          >
            Briefing
          </span>
          <span
            style={{
              ...customStyles.navItem,
              ...(activeNav === 'deployments' ? customStyles.navItemActive : {})
            }}
            onClick={() => setActiveNav('deployments')}
          >
            Deployments
          </span>
          <span
            style={{
              ...customStyles.navItem,
              ...(activeNav === 'intel' ? customStyles.navItemActive : {})
            }}
            onClick={() => setActiveNav('intel')}
          >
            Intel
          </span>
          <span
            style={{
              ...customStyles.navItem,
              ...(activeNav === 'settings' ? customStyles.navItemActive : {})
            }}
            onClick={() => setActiveNav('settings')}
          >
            Settings
          </span>
        </nav>
        <div style={{ ...customStyles.mono, fontSize: '11px', color: 'var(--text-muted)' }}>
          PRE_FLIGHT.READY <span style={{ color: 'var(--accent)' }}>●</span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ ...customStyles.breadcrumbs, ...customStyles.mono, ...customStyles.uppercase }}>
            Operations / Sector 09 / IRON_CURTAIN
          </div>
          <h1 style={customStyles.pageTitle}>
            Op <span style={{ color: 'var(--accent)' }}>Iron</span>{' '}
            <span style={{ fontWeight: 300, fontSize: '0.5em', color: 'var(--text-muted)' }}>[CURTAIN]</span>
          </h1>
        </div>
        <div>
          <Button primary onClick={() => alert('Deployment initiated!')}>
            Initiate Deployment
          </Button>
        </div>
      </div>
    </header>
  );
};

const ObjectiveItem = ({ number, title, description }) => {
  return (
    <div style={customStyles.objectiveItem}>
      <div style={{ ...customStyles.mono, ...customStyles.uppercase, fontSize: '12px', marginBottom: '4px' }}>
        {number}. {title}
      </div>
      <p style={{ ...customStyles.textMuted, fontSize: '13px' }}>{description}</p>
    </div>
  );
};

const UnitCard = ({ code, className, status, isSelected, isDisabled, onClick }) => {
  const cardStyle = {
    ...customStyles.unitSelectCard,
    ...(isSelected ? customStyles.unitSelectCardSelected : {}),
    ...(isDisabled ? customStyles.unitSelectCardDisabled : {})
  };

  return (
    <div style={cardStyle} onClick={!isDisabled ? onClick : undefined}>
      <div style={{ ...customStyles.mono, fontSize: '11px' }}>{code}</div>
      <div style={{ ...customStyles.textMuted, fontSize: '10px' }}>{className}</div>
      <div style={{ marginTop: '10px', fontSize: '10px', ...customStyles.mono }}>
        {status}
      </div>
    </div>
  );
};

const BriefingPage = () => {
  const [selectedUnit, setSelectedUnit] = useState('TX-99');
  const [activeNav, setActiveNav] = useState('briefing');

  return (
    <div style={{ ...customStyles.body, ...customStyles.root }}>
      <div style={customStyles.layoutContainer}>
        <Header activeNav={activeNav} setActiveNav={setActiveNav} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 'var(--space-m)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-m)' }}>
            <div style={customStyles.panel}>
              <div style={customStyles.panelHeader}>
                <span style={customStyles.panelTitle}>Primary Objectives</span>
                <span style={{ ...customStyles.mono, fontSize: '10px', color: '#ccc' }}>PRIORITY: ALPHA</span>
              </div>
              <div style={{ ...customStyles.panelContent, display: 'flex', flexDirection: 'column', gap: 'var(--space-s)' }}>
                <ObjectiveItem
                  number="01"
                  title="Infiltrate Sub-Level 4"
                  description="Bypass biometric security gates at the North-East perimeter. Silence all local alarms before entry."
                />
                <ObjectiveItem
                  number="02"
                  title="Data Extraction"
                  description="Locate the central mainframe and initiate Havoc-Link. Retrieve encrypted manifests 09-X through 12-Z."
                />
                <ObjectiveItem
                  number="03"
                  title="Scuttle Infrastructure"
                  description="Plant thermal charges on primary cooling pipes to ensure total facility failure upon extraction."
                />
              </div>
            </div>

            <div style={customStyles.panel}>
              <div style={customStyles.panelHeader}>
                <span style={customStyles.panelTitle}>Unit Selection</span>
              </div>
              <div style={customStyles.panelContent}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-m)' }}>
                  <UnitCard
                    code="TX-99"
                    className="TITAN-CLASS"
                    status={
                      <>
                        PWR: 100%
                        <br />
                        AMMO: MAX
                      </>
                    }
                    isSelected={selectedUnit === 'TX-99'}
                    onClick={() => setSelectedUnit('TX-99')}
                  />
                  <UnitCard
                    code="SX-22"
                    className="SCOUT-CLASS"
                    status={
                      <>
                        PWR: 88%
                        <br />
                        AMMO: MAX
                      </>
                    }
                    isSelected={selectedUnit === 'SX-22'}
                    onClick={() => setSelectedUnit('SX-22')}
                  />
                  <UnitCard
                    code="RX-01"
                    className="REPAIR-CLASS"
                    status="IN MAINTENANCE"
                    isDisabled
                  />
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-m)' }}>
            <div style={customStyles.panel}>
              <div style={customStyles.panelHeader}>
                <span style={customStyles.panelTitle}>Target Intel</span>
              </div>
              <div style={customStyles.panelContent}>
                <div style={customStyles.intelImage}>CLASSIFIED // VISUAL_DATA</div>
                <div style={{ marginTop: 'var(--space-m)' }}>
                  <div style={{ ...customStyles.mono, ...customStyles.uppercase, fontSize: '10px', color: 'var(--text-muted)' }}>
                    Location
                  </div>
                  <div style={{ ...customStyles.mono, fontSize: '14px', marginBottom: 'var(--space-s)' }}>
                    GRID_REF: 44.2 // -12.8
                  </div>

                  <div style={{ ...customStyles.mono, ...customStyles.uppercase, fontSize: '10px', color: 'var(--text-muted)' }}>
                    Environmental Factors
                  </div>
                  <div style={{ ...customStyles.mono, fontSize: '12px' }}>
                    High Humidity, Heavy Fog, Corrosive Rain.
                  </div>
                </div>
              </div>
            </div>

            <div style={customStyles.panel}>
              <div style={customStyles.panelHeader}>
                <span style={customStyles.panelTitle}>Threat Assessment</span>
              </div>
              <div style={customStyles.panelContent}>
                <div style={{ display: 'flex', justifyContent: 'space-between', ...customStyles.mono, ...customStyles.uppercase, fontSize: '10px' }}>
                  <span>Risk Level</span>
                  <span>Extreme</span>
                </div>
                <div style={customStyles.threatMeter}>
                  <div style={{ ...customStyles.threatFill, width: '82%' }}></div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-s)', marginTop: 'var(--space-s)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', ...customStyles.mono, fontSize: '11px' }}>
                    <span style={customStyles.textMuted}>AA Defense:</span>
                    <span>ACTIVE</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', ...customStyles.mono, fontSize: '11px' }}>
                    <span style={customStyles.textMuted}>Reinforcements:</span>
                    <span>3 MIN ETA</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', ...customStyles.mono, fontSize: '11px' }}>
                    <span style={customStyles.textMuted}>Electronic Warfare:</span>
                    <span>SEVERE</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 'var(--space-xl)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-m)', fontSize: '10px', ...customStyles.mono, ...customStyles.textMuted, display: 'flex', justifyContent: 'space-between' }}>
          <span>HAVOC SYSTEMS INC.</span>
          <span>DEPLOYMENT_CODE: 0x8892_V_CURTAIN // MISSION_READY</span>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <Router basename="/">
      <Routes>
        <Route path="/" element={<BriefingPage />} />
      </Routes>
    </Router>
  );
};

export default App;