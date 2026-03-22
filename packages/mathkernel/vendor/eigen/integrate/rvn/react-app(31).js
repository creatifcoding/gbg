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
    '--border-w': '3px',
  }
};

const ThreatMarker = ({ label, style }) => (
  <div
    style={{
      position: 'absolute',
      width: '20px',
      height: '20px',
      background: 'black',
      color: 'white',
      fontFamily: 'var(--font-mono)',
      fontSize: '10px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: '900',
      ...style
    }}
  >
    {label}
  </div>
);

const DeploymentZone = ({ children, style }) => (
  <div
    style={{
      position: 'absolute',
      border: '2px dashed black',
      background: 'rgba(0,0,0,0.05)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      ...style
    }}
  >
    {children}
  </div>
);

const ObjectiveItem = ({ id, text, completed }) => (
  <div
    style={{
      borderLeft: `4px solid ${completed ? '#666' : 'black'}`,
      paddingLeft: 'var(--space-m)',
      marginBottom: 'var(--space-m)',
    }}
  >
    <div
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        color: 'var(--text-muted)',
      }}
    >
      {id}
    </div>
    <div
      style={{
        fontWeight: '700',
        fontSize: '16px',
        textTransform: 'uppercase',
        color: completed ? 'var(--text-muted)' : 'inherit',
      }}
    >
      {text}
    </div>
  </div>
);

const ThreatStat = ({ label, value, isLast }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '8px 0',
      borderBottom: isLast ? 'none' : '1px solid #eee',
      fontFamily: 'var(--font-mono)',
      fontSize: '12px',
    }}
  >
    <span>{label}</span>
    <span style={{ fontWeight: '900' }}>{value}</span>
  </div>
);

const ParameterTag = ({ children }) => (
  <div
    style={{
      display: 'inline-block',
      border: '1px solid black',
      padding: '4px 8px',
      margin: '0 4px 4px 0',
      fontSize: '10px',
      fontWeight: '700',
      textTransform: 'uppercase',
    }}
  >
    {children}
  </div>
);

const Panel = ({ title, subtitle, children, footer }) => (
  <div
    style={{
      border: 'var(--border-w) solid var(--border)',
      background: 'var(--surface)',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
    }}
  >
    <div
      style={{
        borderBottom: 'var(--border-w) solid var(--border)',
        padding: 'var(--space-s) var(--space-m)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--text-main)',
        color: 'var(--surface)',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: '700',
          fontSize: '14px',
          textTransform: 'uppercase',
          color: 'white',
        }}
      >
        {title}
      </span>
      {subtitle && (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            color: '#ccc',
          }}
        >
          {subtitle}
        </span>
      )}
    </div>
    <div style={{ padding: 'var(--space-m)', flex: 1 }}>{children}</div>
    {footer && (
      <div
        style={{
          borderTop: '1px solid var(--border)',
          padding: 'var(--space-s) var(--space-m)',
          background: 'white',
          color: 'black',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        {footer}
      </div>
    )}
  </div>
);

const Button = ({ children, primary, onClick }) => {
  const [isActive, setIsActive] = useState(false);

  return (
    <button
      style={{
        background: primary ? 'black' : 'transparent',
        border: 'var(--border-w) solid var(--border)',
        color: primary ? 'white' : 'var(--text-main)',
        padding: '12px 24px',
        fontFamily: 'var(--font-sans)',
        fontWeight: '700',
        fontSize: '12px',
        textTransform: 'uppercase',
        cursor: 'pointer',
        transition: 'all 0.2s',
        borderRadius: '0',
        boxShadow: isActive ? 'none' : '4px 4px 0px rgba(0,0,0,1)',
        transform: isActive ? 'translate(4px, 4px)' : 'none',
      }}
      onMouseDown={() => setIsActive(true)}
      onMouseUp={() => setIsActive(false)}
      onMouseLeave={() => setIsActive(false)}
      onClick={onClick}
    >
      {children}
    </button>
  );
};

const NavItem = ({ children, active, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault();
        onClick && onClick();
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        color: isHovered || active ? 'var(--text-inv)' : 'var(--text-muted)',
        textDecoration: 'none',
        fontSize: '14px',
        fontWeight: '700',
        transition: 'all 0.2s',
        background: isHovered || active ? 'var(--text-main)' : 'transparent',
        padding: isHovered || active ? '0 5px' : '0',
      }}
    >
      {children}
    </a>
  );
};

const App = () => {
  const [activeNav, setActiveNav] = useState('Briefing');

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
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
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  return (
    <div style={customStyles.root}>
      <div
        style={{
          background: 'var(--surface)',
          maxWidth: '1400px',
          width: '100%',
          padding: 'var(--space-xl)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-l)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.1)',
          border: 'var(--border-w) solid var(--border)',
        }}
      >
        <header
          style={{
            borderBottom: 'var(--border-w) solid var(--border)',
            paddingBottom: 'var(--space-l)',
            marginBottom: 'var(--space-m)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--space-l)',
              borderBottom: '1px solid #ccc',
              paddingBottom: 'var(--space-m)',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: '900',
                fontSize: '24px',
                letterSpacing: '-0.04em',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-s)',
              }}
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  background: 'var(--text-main)',
                  borderRadius: '50%',
                }}
              ></div>
              HAVOC // OS
            </div>
            <nav
              style={{
                display: 'flex',
                gap: 'var(--space-l)',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
              }}
            >
              <NavItem active={activeNav === 'Briefing'} onClick={() => setActiveNav('Briefing')}>
                Briefing
              </NavItem>
              <NavItem active={activeNav === 'Deployments'} onClick={() => setActiveNav('Deployments')}>
                Deployments
              </NavItem>
              <NavItem active={activeNav === 'Intel'} onClick={() => setActiveNav('Intel')}>
                Intel
              </NavItem>
              <NavItem active={activeNav === 'Settings'} onClick={() => setActiveNav('Settings')}>
                Settings
              </NavItem>
            </nav>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--text-muted)',
              }}
            >
              MISSION_PREP.READY <span style={{ color: 'var(--accent)' }}>●</span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div
                style={{
                  color: 'var(--text-main)',
                  fontWeight: '700',
                  fontSize: '12px',
                  marginBottom: 'var(--space-s)',
                  opacity: '0.5',
                  fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase',
                }}
              >
                Intel / Briefings / Sector 09
              </div>
              <h1
                style={{
                  fontSize: '80px',
                  fontWeight: '900',
                  letterSpacing: '-0.06em',
                  lineHeight: '0.85',
                  textTransform: 'uppercase',
                  marginTop: 'var(--space-s)',
                }}
              >
                Op <span style={{ color: 'var(--accent)' }}>Sledgehammer</span>
              </h1>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-m)' }}>
              <Button>View Satellite</Button>
              <Button primary>Deploy Unit TX-99</Button>
            </div>
          </div>
        </header>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '400px 1fr',
            gap: 'var(--space-m)',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-m)',
            }}
          >
            <Panel title="Mission Objectives" subtitle="PRIORITY: ALPHA">
              <ObjectiveItem id="OBJ_01" text="Secure Comms Array Delta" />
              <ObjectiveItem id="OBJ_02" text="Neutralize Rebel Uplink" />
              <ObjectiveItem id="OBJ_03" text="Extract Local Data Core" completed />
            </Panel>

            <Panel title="Threat Assessment">
              <ThreatStat label="Hostile Density" value="HIGH" />
              <ThreatStat label="Electronic Warfare" value="MODERATE" />
              <ThreatStat label="Artillery Range" value="IN_BOUNDS" />
              <ThreatStat label="Reinforcement ETA" value="08:00 MIN" isLast />
            </Panel>

            <Panel title="Mission Parameters">
              <ParameterTag>Rules of Engagement: Level 4</ParameterTag>
              <ParameterTag>Stealth: Optional</ParameterTag>
              <ParameterTag>Recall: Manual Only</ParameterTag>
              <ParameterTag>Sync: High Bandwidth</ParameterTag>
              <ParameterTag>Collateral: Permitted</ParameterTag>
            </Panel>
          </div>

          <Panel
            title="Tactical Overlay // Sector 09-Z"
            subtitle="GRID: 44.2 // 12.9"
            footer={
              <>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                  }}
                >
                  WIND: 12km/h W // VISIBILITY: 88%
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                  }}
                >
                  ESTIMATED ENGAGEMENT: 22.4 MIN
                </div>
              </>
            }
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                minHeight: '450px',
                backgroundColor: '#fff',
                backgroundImage:
                  'linear-gradient(#eee 1px, transparent 1px), linear-gradient(90deg, #eee 1px, transparent 1px)',
                backgroundSize: '50px 50px',
                position: 'relative',
                borderBottom: 'var(--border-w) solid var(--border)',
                overflow: 'hidden',
                padding: '0',
                margin: 'calc(var(--space-m) * -1)',
                marginBottom: '0',
              }}
            >
              <DeploymentZone
                style={{
                  top: '70%',
                  left: '10%',
                  width: '150px',
                  height: '100px',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '9px',
                    fontWeight: '900',
                  }}
                >
                  DZ_ALPHA
                </span>
              </DeploymentZone>

              <ThreatMarker label="T1" style={{ top: '20%', left: '50%' }} />
              <ThreatMarker label="T1" style={{ top: '25%', left: '55%' }} />
              <ThreatMarker label="T2" style={{ top: '40%', left: '80%' }} />

              <div
                style={{
                  position: 'absolute',
                  top: '35%',
                  left: '45%',
                  border: '3px solid black',
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    background: 'black',
                  }}
                ></div>
              </div>
              <div
                style={{
                  position: 'absolute',
                  top: '35%',
                  left: '48%',
                  marginLeft: '25px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  fontWeight: '900',
                  background: 'white',
                  padding: '2px 4px',
                  border: '1px solid black',
                }}
              >
                PRIMARY_ARRAY
              </div>

              <div
                style={{
                  position: 'absolute',
                  bottom: '20px',
                  left: '20px',
                  background: 'white',
                  border: '2px solid black',
                  padding: '10px',
                  fontFamily: 'var(--font-mono)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-s)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-s)',
                    fontSize: '10px',
                  }}
                >
                  <div
                    style={{
                      width: '12px',
                      height: '12px',
                      background: 'black',
                    }}
                  ></div>{' '}
                  HOSTILE_UNIT
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-s)',
                    fontSize: '10px',
                  }}
                >
                  <div
                    style={{
                      width: '12px',
                      height: '12px',
                      border: '2px dashed black',
                    }}
                  ></div>{' '}
                  DEPLOY_ZONE
                </div>
              </div>

              <div
                style={{
                  position: 'absolute',
                  top: '0',
                  left: '0',
                  width: '20px',
                  height: '20px',
                  borderTop: '3px solid black',
                  borderLeft: '3px solid black',
                }}
              ></div>
              <div
                style={{
                  position: 'absolute',
                  top: '0',
                  right: '0',
                  width: '20px',
                  height: '20px',
                  borderTop: '3px solid black',
                  borderRight: '3px solid black',
                }}
              ></div>
              <div
                style={{
                  position: 'absolute',
                  bottom: '0',
                  left: '0',
                  width: '20px',
                  height: '20px',
                  borderBottom: '3px solid black',
                  borderLeft: '3px solid black',
                }}
              ></div>
              <div
                style={{
                  position: 'absolute',
                  bottom: '0',
                  right: '0',
                  width: '20px',
                  height: '20px',
                  borderBottom: '3px solid black',
                  borderRight: '3px solid black',
                }}
              ></div>
            </div>
          </Panel>
        </div>

        <div
          style={{
            borderTop: 'var(--border-w) solid black',
            paddingTop: 'var(--space-m)',
            fontSize: '12px',
            fontWeight: '700',
            color: 'black',
            fontFamily: 'var(--font-mono)',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>HAVOC SYSTEMS INC. // MISSION_ID: SH-449-TX</span>
          <span>AUTHORIZATION: LEVEL_7_OVERRIDE_ENABLED</span>
        </div>
      </div>
    </div>
  );
};

export default App;