import React, { useState, useEffect } from 'react';

const fontItemsData = [
  { id: 1, name: '- INTER_DISPLAY_V4.VAR', updated: 'UPDATED: 13.03.02 / 12.30 AM' },
  { id: 2, name: '- HELVETICA_NOW_MICRO', updated: 'UPDATED: 12.03.02 / 09.15 AM' },
  { id: 3, name: '- JETBRAINS_MONO_NL', updated: 'UPDATED: 10.03.02 / 04.20 PM' },
  { id: 4, name: '- GT_AMERICA_EXPANDED', updated: 'UPDATED: 08.03.02 / 11.00 AM' },
  { id: 5, name: '- FAVORIT_PRO_M', updated: 'UPDATED: 05.03.02 / 02.45 PM' },
  { id: 6, name: '- SOHNE_BREIT_KRAFTIG', updated: 'UPDATED: 01.03.02 / 10.10 AM' },
  { id: 7, name: '- SOHNE_BREIT_KRAFTIG', updated: 'UPDATED: 01.03.02 / 10.10 AM' },
  { id: 8, name: '- SOHNE_BREIT_KRAFTIG', updated: 'UPDATED: 01.03.02 / 10.10 AM' }
];

const navItems = ['DASHBOARD', 'CATALOG', 'ANALYTICS', 'LICENSES', 'EXPORT'];

const glyphs = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'a', 'b', 'c', 'd', 'e', 'f'];

const waterfallSizes = [
  { size: 32, text: 'Hamburgefonstiv' },
  { size: 24, text: 'Hamburgefonstiv' },
  { size: 18, text: 'Hamburgefonstiv' },
  { size: 14, text: 'Hamburgefonstiv' },
  { size: 10, text: 'Hamburgefonstiv', opacity: 0.7 }
];

const FontItem = ({ font, isActive, onClick }) => {
  const itemStyle = {
    padding: '12px',
    borderBottom: '1px solid #333',
    cursor: 'pointer',
    transition: 'background 0.1s',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    background: isActive ? '#222' : 'transparent',
    borderLeft: isActive ? '3px solid #fff' : 'none'
  };

  const hoverStyle = {
    background: '#1a1a1a'
  };

  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      style={isHovered && !isActive ? { ...itemStyle, ...hoverStyle } : itemStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      <div style={{ fontSize: '12px', fontWeight: 'bold' }}>{font.name}</div>
      <div style={{ fontSize: '9px', color: '#999', fontFamily: '"Courier New", monospace' }}>
        {font.updated}
      </div>
    </div>
  );
};

const NavItem = ({ label, isActive, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  const itemStyle = {
    cursor: 'pointer',
    opacity: isActive ? 1 : 0.7,
    textDecoration: isActive || isHovered ? 'underline' : 'none'
  };

  return (
    <div
      style={itemStyle}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {label}
    </div>
  );
};

const Dropdown = ({ label, value, options, onChange, isDark = false }) => {
  const dropdownStyle = {
    background: isDark ? '#999999' : '#fff',
    color: isDark ? '#fff' : '#000',
    border: isDark ? 'none' : '1px solid #000',
    padding: '4px 8px',
    fontFamily: 'inherit',
    fontSize: '10px',
    width: '120px',
    display: 'flex',
    justifyContent: 'space-between',
    cursor: 'pointer'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <span style={{ fontSize: '9px', opacity: 0.8 }}>{label}</span>
      <div style={dropdownStyle}>
        {value} <span style={{ fontSize: '8px' }}>▼</span>
      </div>
    </div>
  );
};

const GlyphCell = ({ glyph }) => {
  const [isHovered, setIsHovered] = useState(false);

  const cellStyle = {
    aspectRatio: '1',
    background: isHovered ? '#fff' : '#eee',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    cursor: 'pointer',
    outline: isHovered ? '1px solid #000' : 'none',
    zIndex: isHovered ? 1 : 0
  };

  return (
    <div
      style={cellStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {glyph}
    </div>
  );
};

const App = () => {
  const [activeNavItem, setActiveNavItem] = useState('DASHBOARD');
  const [activeFontId, setActiveFontId] = useState(1);
  const [previewText, setPreviewText] = useState('The quick brown fox jumps over');
  const [weight, setWeight] = useState('REGULAR');
  const [size, setSize] = useState('48 PT');
  const [tracking, setTracking] = useState('-0.02');
  const [exportFormat, setExportFormat] = useState('WOFF2');
  const [subset, setSubset] = useState('LATIN_EXT');

  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      * {
        box-sizing: border-box;
        scrollbar-width: none;
      }
      
      ::-webkit-scrollbar { 
        width: 8px; 
        background: #000; 
      }
      
      ::-webkit-scrollbar-thumb { 
        background: #666; 
        border: 1px solid #000; 
      }
    `;
    document.head.appendChild(styleElement);
    return () => document.head.removeChild(styleElement);
  }, []);

  const rootStyle = {
    margin: 0,
    padding: '20px',
    backgroundColor: '#ffffff',
    fontFamily: '"Verdana", "Arial", sans-serif',
    fontSize: '11px',
    color: '#000000',
    height: '100vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  };

  const mainInterfaceStyle = {
    display: 'grid',
    gridTemplateColumns: '280px 1fr 300px',
    gridTemplateRows: 'auto 1fr auto',
    gap: 0,
    height: '100%',
    border: '2px solid #000000',
    background: '#e0e0e0',
    position: 'relative'
  };

  const crosshairStyle = {
    position: 'absolute',
    width: '9px',
    height: '9px',
    zIndex: 10
  };

  const crosshairBeforeAfter = {
    before: {
      position: 'absolute',
      top: '4px',
      left: 0,
      width: '9px',
      height: '1px',
      background: '#000'
    },
    after: {
      position: 'absolute',
      top: 0,
      left: '4px',
      width: '1px',
      height: '9px',
      background: '#000'
    }
  };

  const Crosshair = ({ position }) => {
    const positions = {
      tl: { top: '-5px', left: '-5px' },
      tr: { top: '-5px', right: '-5px' },
      bl: { bottom: '-5px', left: '-5px' },
      br: { bottom: '-5px', right: '-5px' }
    };

    return (
      <div style={{ ...crosshairStyle, ...positions[position] }}>
        <div style={crosshairBeforeAfter.before}></div>
        <div style={crosshairBeforeAfter.after}></div>
      </div>
    );
  };

  const brandTabStyle = {
    position: 'absolute',
    top: '-22px',
    left: '-2px',
    background: '#e0e0e0',
    border: '2px solid #000000',
    borderBottom: 'none',
    padding: '4px 24px 4px 12px',
    clipPath: 'polygon(0 0, 85% 0, 100% 100%, 0% 100%)',
    width: '160px',
    height: '24px',
    display: 'flex',
    alignItems: 'center'
  };

  const headerBarStyle = {
    gridColumn: '1 / -1',
    background: '#e0e0e0',
    borderBottom: '2px solid #000000',
    padding: '8px 12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    position: 'relative'
  };

  const navStripStyle = {
    background: '#050505',
    color: '#ffffff',
    width: '100%',
    padding: '6px 12px',
    display: 'flex',
    gap: '16px',
    fontSize: '10px',
    letterSpacing: '1px',
    marginTop: '12px'
  };

  const sidebarStyle = {
    background: '#050505',
    color: '#ffffff',
    borderRight: '2px solid #000000',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative'
  };

  const panelHeaderStyle = {
    padding: '8px 12px',
    borderBottom: '1px solid #555',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  };

  const fontListStyle = {
    overflowY: 'auto',
    flex: 1
  };

  const previewAreaStyle = {
    background: '#dcdcdc',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    backgroundImage: 'linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)',
    backgroundSize: '20px 20px'
  };

  const previewToolbarStyle = {
    padding: '12px',
    borderBottom: '1px solid #000000',
    display: 'flex',
    gap: '20px',
    alignItems: 'center',
    background: '#e0e0e0'
  };

  const dashedInputStyle = {
    background: 'transparent',
    border: 'none',
    borderBottom: '2px dashed #000',
    fontFamily: 'inherit',
    fontSize: '24px',
    width: '100%',
    padding: '20px',
    outline: 'none'
  };

  const glyphGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(40px, 1fr))',
    padding: '20px',
    gap: '1px',
    background: '#ccc',
    border: '1px solid #999',
    margin: '20px'
  };

  const metaPanelStyle = {
    background: '#999999',
    borderLeft: '2px solid #000000',
    padding: 0,
    display: 'flex',
    flexDirection: 'column'
  };

  const metaSectionStyle = {
    padding: '16px',
    borderBottom: '1px dashed #444'
  };

  const statusBarStyle = {
    gridColumn: '1 / -1',
    borderTop: '2px solid #000000',
    background: '#fff',
    padding: '4px 8px',
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '9px',
    textTransform: 'uppercase'
  };

  return (
    <div style={rootStyle}>
      <div style={mainInterfaceStyle}>
        <Crosshair position="tl" />
        <Crosshair position="tr" />
        <Crosshair position="bl" />
        <Crosshair position="br" />

        <div style={brandTabStyle}>
          <span style={{ textTransform: 'uppercase', fontSize: '10px', letterSpacing: '1px', fontWeight: 900 }}>
            RAVENWORK
          </span>
          <span style={{ fontSize: '9px', opacity: 0.8, marginLeft: '8px', marginTop: '2px' }}>
            v 3.0
          </span>
        </div>

        <header style={headerBarStyle}>
          <div style={{ width: '100%' }}>
            <div style={{ fontSize: '9px', opacity: 0.8, textAlign: 'right', marginBottom: '4px' }}>
              e 10.00.06.03.76
            </div>
            <nav style={navStripStyle}>
              {navItems.map((item, index) => (
                <React.Fragment key={item}>
                  <NavItem
                    label={item}
                    isActive={activeNavItem === item}
                    onClick={() => setActiveNavItem(item)}
                  />
                  {index < navItems.length - 1 && <div>/</div>}
                </React.Fragment>
              ))}
            </nav>
          </div>
        </header>

        <aside style={sidebarStyle}>
          <div style={panelHeaderStyle}>
            <span style={{ textTransform: 'uppercase', fontSize: '10px', letterSpacing: '1px', fontWeight: 'bold' }}>
              + ACTIVE REPO +
            </span>
            <span style={{ fontSize: '9px', opacity: 0.8 }}>[24 ITEMS]</span>
          </div>
          <div style={fontListStyle}>
            {fontItemsData.map(font => (
              <FontItem
                key={font.id}
                font={font}
                isActive={activeFontId === font.id}
                onClick={() => setActiveFontId(font.id)}
              />
            ))}
          </div>
          <div style={{ ...panelHeaderStyle, marginTop: 'auto', borderTop: '1px solid #555' }}>
            <span style={{ fontSize: '9px', opacity: 0.8 }}>SYNC STATUS: ONLINE</span>
            <div style={{ width: '8px', height: '8px', background: '#0f0' }}></div>
          </div>
        </aside>

        <main style={previewAreaStyle}>
          <div style={previewToolbarStyle}>
            <Dropdown label="WEIGHT" value={weight} isDark={true} />
            <Dropdown label="SIZE" value={size} isDark={true} />
            <Dropdown label="TRACKING" value={tracking} isDark={true} />
            <div style={{ flex: 1 }}></div>
            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'right' }}>
              <span style={{ fontSize: '9px', opacity: 0.8 }}>RENDER_ENGINE</span>
              <span style={{ textTransform: 'uppercase', fontSize: '10px', letterSpacing: '1px', fontWeight: 'bold' }}>
                WEBGL_2.0
              </span>
            </div>
          </div>

          <div style={{ padding: '40px', flex: 1, overflow: 'hidden' }}>
            <input
              type="text"
              style={dashedInputStyle}
              value={previewText}
              onChange={(e) => setPreviewText(e.target.value)}
              spellCheck="false"
            />

            <div style={{ marginTop: '40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <div style={{ textTransform: 'uppercase', fontSize: '10px', letterSpacing: '1px', fontWeight: 'bold', marginBottom: '10px', borderBottom: '1px solid #000', paddingBottom: '4px' }}>
                  GLYPH MAP (LATIN-1)
                </div>
                <div style={glyphGridStyle}>
                  {glyphs.map((glyph, index) => (
                    <GlyphCell key={index} glyph={glyph} />
                  ))}
                </div>
              </div>

              <div>
                <div style={{ textTransform: 'uppercase', fontSize: '10px', letterSpacing: '1px', fontWeight: 'bold', marginBottom: '10px', borderBottom: '1px solid #000', paddingBottom: '4px' }}>
                  WATERFALL
                </div>
                {waterfallSizes.map((item, index) => (
                  <div key={index} style={{ fontSize: `${item.size}px`, marginBottom: '8px', opacity: item.opacity || 1 }}>
                    {item.text}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ position: 'absolute', bottom: '20px', right: '20px', background: '#fff', border: '1px solid #000', padding: '10px' }}>
            <div style={{ fontSize: '9px', opacity: 0.8 }}>MEMORY USAGE</div>
            <div style={{ fontFamily: '"Courier New", monospace', fontSize: '12px' }}>12.4 MB</div>
          </div>
        </main>

        <aside style={metaPanelStyle}>
          <div style={metaSectionStyle}>
            <span style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              + font_properties +
            </span>
            <div style={{ fontSize: '9px', opacity: 0.8, lineHeight: 1.4 }}>
              This font file contains 542 glyphs and supports 32 languages.
              Format: OpenType (CFF)
            </div>
          </div>

          <div style={metaSectionStyle}>
            <span style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              + metrics +
            </span>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontFamily: '"Courier New", monospace' }}>
              <span>UPM</span><span>1000</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontFamily: '"Courier New", monospace' }}>
              <span>ASCENDER</span><span>800</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontFamily: '"Courier New", monospace' }}>
              <span>DESCENDER</span><span>-200</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontFamily: '"Courier New", monospace' }}>
              <span>X-HEIGHT</span><span>520</span>
            </div>

            <div style={{ height: '100px', border: '1px solid #666', marginTop: '10px', background: '#888', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: '4px', left: '4px', color: '#fff', fontSize: '9px', opacity: 0.8 }}>
                HISTOGRAM
              </div>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%', borderTop: '1px solid #fff', background: 'rgba(255,255,255,0.1)' }}></div>
            </div>
          </div>

          <div style={metaSectionStyle}>
            <span style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              + quick_actions +
            </span>

            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '9px', opacity: 0.8, marginBottom: '2px' }}>EXPORT FORMAT</div>
              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', background: '#fff', color: '#000', border: '1px solid #000', padding: '4px 8px', fontSize: '10px', cursor: 'pointer' }}>
                {exportFormat} <span style={{ fontSize: '8px' }}>▼</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: '9px', opacity: 0.8, marginBottom: '2px' }}>SUBSET</div>
              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', background: '#fff', color: '#000', border: '1px solid #000', padding: '4px 8px', fontSize: '10px', cursor: 'pointer' }}>
                {subset} <span style={{ fontSize: '8px' }}>▼</span>
              </div>
            </div>
            <button style={{ marginTop: '16px', width: '100%', background: '#050505', color: '#fff', border: 'none', padding: '8px', fontFamily: 'inherit', cursor: 'pointer' }}>
              COMPILE_BUILD
            </button>
          </div>

          <div style={{ marginTop: 'auto', padding: '12px', borderTop: '1px dashed #444', opacity: 0.5, fontSize: '9px' }}>
            ID: 56835-156001<br />
            Ravenwork System
          </div>
        </aside>

        <footer style={statusBarStyle}>
          <div>
            <span style={{ marginRight: '12px' }}>Ø</span>
            Best view 1920x1080 reso
          </div>
          <div>
            copyright by ravenwork | 2002-2024
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;