import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';

const customStyles = {
  pulseAnimation: {
    animation: 'pulse-bg 2s infinite'
  },
  glitchAnimation: {
    animation: 'glitch 0.3s infinite'
  },
  slideAnimation: {
    animation: 'slide 2s linear infinite'
  },
  fastPulse: {
    animation: 'pulse-bg 0.5s infinite'
  },
  veryFastPulse: {
    animation: 'pulse-bg 0.2s infinite'
  }
};

const Button = ({ children, onClick, variant = 'default', className = '' }) => {
  const baseStyle = {
    background: variant === 'emergency' ? '#ff0000' : variant === 'emergency-alt' ? 'white' : 'transparent',
    border: '3px solid #ff0000',
    color: variant === 'emergency-alt' ? 'red' : variant === 'emergency' ? 'white' : '#ff0000',
    padding: '12px 24px',
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    fontWeight: 700,
    fontSize: '12px',
    textTransform: 'uppercase',
    cursor: 'pointer',
    transition: 'all 0.2s',
    borderRadius: 0,
    boxShadow: '4px 4px 0px rgba(255,0,0,1)'
  };

  return (
    <button 
      style={variant === 'emergency' ? { ...baseStyle, ...customStyles.fastPulse } : baseStyle}
      onClick={onClick}
      className={className}
    >
      {children}
    </button>
  );
};

const Panel = ({ title, subtitle, children, headerBg = '#ff0000' }) => {
  return (
    <div style={{ 
      border: '3px solid #ff0000', 
      background: '#ffffff', 
      position: 'relative', 
      overflow: 'hidden', 
      display: 'flex', 
      flexDirection: 'column' 
    }}>
      <div style={{ 
        borderBottom: '3px solid #ff0000', 
        padding: '10px 20px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        background: headerBg, 
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
        }}>
          {title}
        </span>
        {subtitle && <span style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '10px', color: 'white' }}>{subtitle}</span>}
      </div>
      <div style={{ padding: '20px', flex: 1, overflow: 'auto' }}>
        {children}
      </div>
    </div>
  );
};

const TelemetryBar = ({ label, value }) => {
  return (
    <div>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        fontFamily: "'Courier New', Courier, monospace", 
        textTransform: 'uppercase', 
        fontSize: '10px', 
        fontWeight: 900, 
        textDecoration: 'underline', 
        color: '#ff0000' 
      }}>
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div style={{ 
        height: '16px', 
        background: 'white', 
        border: '2px solid #ff0000', 
        width: '100%', 
        marginTop: '5px' 
      }}>
        <div style={{ 
          height: '100%', 
          background: 'repeating-linear-gradient(45deg, #ff0000, #ff0000 10px, #fff 10px, #fff 20px)', 
          width: `${value}%`,
          ...customStyles.slideAnimation
        }}></div>
      </div>
    </div>
  );
};

const EquipmentCard = ({ category, status, statusLabel }) => {
  return (
    <div style={{ border: '2px solid #ff0000', padding: '20px', background: '#fff0f0' }}>
      <div style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '9px', color: '#880000' }}>
        {category}
      </div>
      <div style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '11px', color: '#ff0000' }}>
        {status}
      </div>
      <div style={{ 
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", 
        fontSize: '10px', 
        padding: '4px 8px', 
        border: '1px solid #ff0000', 
        display: 'inline-block', 
        background: '#ff0000', 
        color: 'white', 
        fontWeight: 700, 
        marginTop: '8px', 
        textTransform: 'uppercase' 
      }}>
        {statusLabel}
      </div>
    </div>
  );
};

const LogEntry = ({ timestamp, message, critical = false }) => {
  return (
    <div style={{ 
      fontFamily: "'Courier New', Courier, monospace", 
      fontSize: '11px', 
      marginBottom: '10px', 
      padding: '4px', 
      borderBottom: '1px solid #ff0000', 
      background: critical ? 'black' : '#fff0f0',
      color: critical ? 'white' : '#ff0000',
      fontWeight: critical ? 'normal' : 900,
      textDecoration: critical ? 'none' : 'underline'
    }}>
      <span>{timestamp}</span> <span>{message}</span>
    </div>
  );
};

const Header = ({ activeNav = 'Deployments' }) => {
  return (
    <header style={{ 
      borderBottom: '3px solid #ff0000', 
      paddingBottom: '30px', 
      marginBottom: '20px' 
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '30px', 
        borderBottom: '1px solid #ff0000', 
        paddingBottom: '20px' 
      }}>
        <div style={{ 
          fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", 
          fontWeight: 900, 
          fontSize: '24px', 
          letterSpacing: '-0.04em', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px',
          color: '#ff0000'
        }}>
          <div style={{ 
            width: '24px', 
            height: '24px', 
            background: '#ff0000', 
            borderRadius: '50%' 
          }}></div>
          HAVOC // EMERGENCY_OS
        </div>
        <nav style={{ 
          display: 'flex', 
          gap: '30px', 
          fontFamily: "'Courier New', Courier, monospace", 
          textTransform: 'uppercase', 
          fontWeight: 600, 
          letterSpacing: '-0.02em' 
        }}>
          <Link 
            to="/briefing" 
            style={{ 
              color: activeNav === 'Briefing' ? '#ffffff' : '#880000', 
              textDecoration: 'none', 
              fontSize: '14px', 
              fontWeight: 700, 
              transition: 'all 0.2s',
              background: activeNav === 'Briefing' ? '#ff0000' : 'transparent',
              padding: activeNav === 'Briefing' ? '0 5px' : '0'
            }}
          >
            Briefing
          </Link>
          <Link 
            to="/" 
            style={{ 
              color: activeNav === 'Deployments' ? '#ffffff' : '#880000', 
              textDecoration: 'none', 
              fontSize: '14px', 
              fontWeight: 700, 
              transition: 'all 0.2s',
              background: activeNav === 'Deployments' ? '#ff0000' : 'transparent',
              padding: activeNav === 'Deployments' ? '0 5px' : '0'
            }}
          >
            Deployments
          </Link>
          <Link 
            to="/intel" 
            style={{ 
              color: activeNav === 'Intel' ? '#ffffff' : '#880000', 
              textDecoration: 'none', 
              fontSize: '14px', 
              fontWeight: 700, 
              transition: 'all 0.2s',
              background: activeNav === 'Intel' ? '#ff0000' : 'transparent',
              padding: activeNav === 'Intel' ? '0 5px' : '0'
            }}
          >
            Intel
          </Link>
          <Link 
            to="/settings" 
            style={{ 
              color: activeNav === 'Settings' ? '#ffffff' : '#880000', 
              textDecoration: 'none', 
              fontSize: '14px', 
              fontWeight: 700, 
              transition: 'all 0.2s',
              background: activeNav === 'Settings' ? '#ff0000' : 'transparent',
              padding: activeNav === 'Settings' ? '0 5px' : '0'
            }}
          >
            Settings
          </Link>
        </nav>
        <div style={{ 
          fontFamily: "'Courier New', Courier, monospace", 
          fontSize: '11px', 
          color: '#ff0000' 
        }}>
          CRITICAL_FAILURE <span style={{ color: '#ff0000', ...customStyles.fastPulse }}>●</span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ 
            color: '#ff0000', 
            fontWeight: 700, 
            fontSize: '12px', 
            marginBottom: '10px',
            fontFamily: "'Courier New', Courier, monospace", 
            textTransform: 'uppercase', 
            fontWeight: 600, 
            letterSpacing: '-0.02em'
          }}>
            SYSTEM_ALERT / SECTOR 04 / TX-99 / CRITICAL
          </div>
          <h1 style={{ 
            fontSize: '80px', 
            fontWeight: 900, 
            letterSpacing: '-0.06em', 
            lineHeight: '0.85', 
            textTransform: 'uppercase', 
            marginTop: '10px',
            color: '#ff0000',
            ...customStyles.glitchAnimation
          }}>
            Unit <span style={{ color: '#ff0000', fontWeight: 900 }}>TX-99</span> <span style={{ fontWeight: 300, fontSize: '0.5em', color: '#880000' }}>[LOST_CONTACT]</span>
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '20px' }}>
          <Button variant="emergency">FORCED SHUTDOWN</Button>
          <Button variant="emergency-alt">INITIATE SELF-DESTRUCT</Button>
        </div>
      </div>
    </header>
  );
};

const DeploymentsPage = () => {
  return (
    <>
      <Header activeNav="Deployments" />

      <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr 350px', gap: '20px' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Panel title="SYSTEM BREACH Vitals">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <TelemetryBar label="Power Core" value={3} />
              <TelemetryBar label="Structural Integrity" value={12} />
              <TelemetryBar label="Thermal Overflow" value={99} />
            </div>
          </Panel>

          <Panel title="Hardware Failures">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              <EquipmentCard category="OPTICS" status="OFFLINE" statusLabel="ERROR" />
              <EquipmentCard category="WEAPON" status="JAMMED" statusLabel="DISABLED" />
              <EquipmentCard category="LOCO" status="RUPTURED" statusLabel="FATAL" />
              <EquipmentCard category="COMMS" status="NO_SIGNAL" statusLabel="TIMEOUT" />
            </div>
          </Panel>
        </div>

        <Panel title="LAST KNOWN COORDINATES" subtitle="SIGNAL LOST..." headerBg="black">
          <div style={{ 
            width: '100%', 
            height: '100%', 
            minHeight: '300px', 
            backgroundColor: '#fffafa', 
            backgroundImage: 'linear-gradient(rgba(255,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,0,0,0.1) 1px, transparent 1px)', 
            backgroundSize: '50px 50px', 
            position: 'relative', 
            borderBottom: '3px solid #ff0000',
            marginTop: '-20px',
            marginLeft: '-20px',
            marginRight: '-20px',
            marginBottom: '-20px'
          }}>
            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 'calc(100% - 50px)' }} viewBox="0 0 100 100" preserveAspectRatio="none">
              <polyline points="70,30 80,20 90,10" fill="none" stroke="red" strokeWidth="4"></polyline>
            </svg>
            
            <div style={{ position: 'absolute', top: '30%', left: '70%' }}>
              <div style={{ 
                width: '30px', 
                height: '30px', 
                border: '4px solid red', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                ...customStyles.veryFastPulse
              }}>
                <div style={{ width: '10px', height: '10px', background: 'red' }}></div>
              </div>
              <div style={{ 
                position: 'absolute', 
                top: '35px', 
                left: '-20px', 
                fontSize: '12px', 
                whiteSpace: 'nowrap',
                fontFamily: "'Courier New', Courier, monospace",
                fontWeight: 900,
                textDecoration: 'underline',
                color: '#ff0000'
              }}>
                IMPACT SITE?
              </div>
            </div>

            <div style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              width: '100%', 
              height: '100%', 
              background: 'repeating-linear-gradient(0deg, rgba(255,0,0,0.05), rgba(255,0,0,0.05) 1px, transparent 1px, transparent 2px)', 
              backgroundSize: '100% 4px', 
              pointerEvents: 'none' 
            }}></div>

            <div style={{ 
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              borderTop: '3px solid #ff0000',
              padding: '10px 20px',
              background: 'red',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '10px', color: 'white' }}>
                LAT: [NULL] / LONG: [NULL]
              </div>
              <div style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '10px', color: 'white', fontWeight: 900 }}>
                CONNECTION_FAILED_RETRYING...
              </div>
            </div>
          </div>
        </Panel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Panel title="ERROR LOGS [INTERNAL]">
            <LogEntry timestamp="14:05:01" message="FATAL ERROR: Memory corruption detected." />
            <LogEntry timestamp="14:04:45" message="CORE_MELTDOWN: Cooling system failure." />
            <LogEntry timestamp="14:04:30" message="OVERRIDE ATTEMPT BY UNKNOWN_SOURCE" critical={true} />
            <LogEntry timestamp="14:04:12" message="Signal jamming detected in Sector 04-A." />
          </Panel>

          <Panel title="DIAGNOSTIC HISTORY">
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse', 
              fontFamily: "'Courier New', Courier, monospace", 
              fontSize: '12px',
              marginTop: '-20px'
            }}>
              <tbody>
                <tr>
                  <td style={{ padding: '10px', borderBottom: '1px solid #ff0000', color: '#ff0000', fontWeight: 600 }}>
                    MEM_TEST
                  </td>
                  <td style={{ 
                    padding: '10px', 
                    borderBottom: '1px solid #ff0000', 
                    color: '#ff0000', 
                    fontWeight: 900,
                    textDecoration: 'underline'
                  }}>
                    FAILED
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '10px', borderBottom: '1px solid #ff0000', color: '#ff0000', fontWeight: 600 }}>
                    COMMS_LINK
                  </td>
                  <td style={{ 
                    padding: '10px', 
                    borderBottom: '1px solid #ff0000', 
                    color: '#ff0000', 
                    fontWeight: 900,
                    textDecoration: 'underline'
                  }}>
                    DROP
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '10px', borderBottom: '1px solid #ff0000', color: '#ff0000', fontWeight: 600 }}>
                    UNIT_SYNC
                  </td>
                  <td style={{ 
                    padding: '10px', 
                    borderBottom: '1px solid #ff0000', 
                    color: '#ff0000', 
                    fontWeight: 900,
                    textDecoration: 'underline'
                  }}>
                    LOST
                  </td>
                </tr>
              </tbody>
            </table>
          </Panel>
        </div>
      </div>

      <div style={{ 
        marginTop: '60px', 
        borderTop: '3px solid red', 
        paddingTop: '20px', 
        fontSize: '12px', 
        background: 'red', 
        color: 'white', 
        padding: '10px',
        fontFamily: "'Courier New', Courier, monospace",
        display: 'flex',
        justifyContent: 'space-between'
      }}>
        <span>EMERGENCY PROTOCOL 00-A ACTIVE</span>
        <span>AUTHORIZED ACCESS ONLY // SYSTEM_IN_DANGER</span>
      </div>
    </>
  );
};

const App = () => {
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse-bg {
        0% { background-color: #1a0000; }
        50% { background-color: #330000; }
        100% { background-color: #1a0000; }
      }

      @keyframes glitch {
        0% { transform: translate(0); }
        20% { transform: translate(-2px, 2px); }
        40% { transform: translate(-2px, -2px); }
        60% { transform: translate(2px, 2px); }
        80% { transform: translate(2px, -2px); }
        100% { transform: translate(0); }
      }

      @keyframes slide {
        from { background-position: 0 0; }
        to { background-position: 40px 0; }
      }

      body {
        margin: 0;
        padding: 0;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  return (
    <Router basename="/">
      <div style={{ 
        backgroundColor: '#1a0000', 
        color: '#ff0000', 
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", 
        fontSize: '14px', 
        lineHeight: 1.4, 
        WebkitFontSmoothing: 'antialiased', 
        minHeight: '100vh', 
        display: 'flex', 
        justifyContent: 'center', 
        padding: '40px',
        ...customStyles.pulseAnimation
      }}>
        <div style={{ 
          background: '#ffffff', 
          maxWidth: '1400px', 
          width: '100%', 
          padding: '60px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '30px', 
          boxShadow: '0 0 100px rgba(255,0,0,0.4)', 
          border: '3px solid #ff0000', 
          position: 'relative' 
        }}>
          <div style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            height: '8px', 
            background: 'repeating-linear-gradient(90deg, #ff0000, #ff0000 20px, #000 20px, #000 40px)', 
            zIndex: 100 
          }}></div>
          
          <Routes>
            <Route path="/" element={<DeploymentsPage />} />
            <Route path="/briefing" element={<DeploymentsPage />} />
            <Route path="/intel" element={<DeploymentsPage />} />
            <Route path="/settings" element={<DeploymentsPage />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
};

export default App;