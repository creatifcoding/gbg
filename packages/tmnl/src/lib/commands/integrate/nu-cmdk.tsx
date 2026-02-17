import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

const customStyles = {
  body: {
    fontFamily: "'JetBrains Mono', monospace",
    backgroundColor: '#000000',
    color: '#e5e7eb',
    WebkitFontSmoothing: 'antialiased'
  }
};

const CommandItem = ({ icon, title, subtitle, badge, status, shortcut, isActive, onClick }) => {
  const [hover, setHover] = useState(false);

  return (
    <div
      className={`cmd-item ${isActive ? 'active' : ''} group flex items-center justify-between px-2 py-1.5 rounded-sm cursor-pointer`}
      style={{
        position: 'relative',
        transition: 'all 0.1s ease',
        borderLeft: '2px solid transparent',
        backgroundColor: isActive ? '#111113' : hover ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
        borderLeftColor: isActive ? '#06b6d4' : 'transparent'
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex items-center justify-center w-7 h-7 rounded ${icon.bgColor} ${icon.textColor} border ${icon.borderColor} ${isActive ? 'icon-highlight' : ''}`}
          style={isActive ? { color: '#22d3ee' } : {}}
        >
          {icon.type === 'svg' ? (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d={icon.path}></path>
            </svg>
          ) : (
            <span className="text-[10px] font-bold">{icon.text}</span>
          )}
        </div>
        <div className="flex flex-col" style={{ lineHeight: 1.15 }}>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-medium ${isActive ? 'text-highlight' : 'text-gray-400 group-hover:text-gray-200'}`}
              style={isActive ? { color: '#22d3ee' } : {}}
            >
              {title}
            </span>
            {badge && (
              <span className={`px-1 py-0 rounded-[1px] ${badge.bgColor} text-[8px] font-bold ${badge.textColor} border ${badge.borderColor}`}>
                {badge.text}
              </span>
            )}
          </div>
          {subtitle && (
            <div className="flex items-center gap-1.5">
              {Array.isArray(subtitle) ? (
                subtitle.map((sub, idx) => (
                  <span key={idx} className={`text-[9px] ${sub.color}`}>
                    {sub.text}
                  </span>
                ))
              ) : (
                <span className="text-[9px] text-gray-600">{subtitle}</span>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {status && <span className="text-[9px] text-cyan-700 font-mono">{status}</span>}
        {shortcut && (
          <div className="flex items-center gap-1">
            {Array.isArray(shortcut) ? (
              shortcut.map((key, idx) => (
                <kbd
                  key={idx}
                  className="h-4 px-1 text-[9px] text-gray-400 bg-[#18181b] border border-[#27272a] rounded flex items-center justify-center"
                >
                  {key}
                </kbd>
              ))
            ) : (
              <kbd className="h-4 px-1 flex items-center justify-center text-[9px] text-gray-400 bg-[#18181b] border border-[#27272a] rounded">
                {shortcut}
              </kbd>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const App = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [activeItem, setActiveItem] = useState(0);

  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      body {
        font-family: 'JetBrains Mono', monospace;
        background-color: #000000;
        color: #e5e7eb;
        -webkit-font-smoothing: antialiased;
        margin: 0;
      }
      
      .custom-scrollbar::-webkit-scrollbar {
        width: 3px;
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background: #09090b;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #27272a;
        border-radius: 2px;
      }

      .tag-outline {
        box-shadow: 0 0 0 1px rgba(63, 63, 70, 0.4);
      }

      .scrollbar-hide::-webkit-scrollbar {
        display: none;
      }
      .scrollbar-hide {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
    `;
    document.head.appendChild(styleElement);

    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&family=Inter:wght@400;500;600&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    return () => {
      document.head.removeChild(styleElement);
      document.head.removeChild(link);
    };
  }, []);

  const tabs = ['All', 'Pipelines', 'Entities', 'Actions'];

  const commandItems = [
    {
      section: 'Suggested',
      items: [
        {
          icon: {
            type: 'svg',
            path: 'M13 10V3L4 14h7v7l9-11h-7z',
            bgColor: 'bg-cyan-500/10',
            textColor: 'text-cyan-400',
            borderColor: 'border-cyan-500/20'
          },
          title: 'Run Remediation Pipeline',
          subtitle: [
            { text: 'V-4821-A', color: 'text-gray-500' },
            { text: 'Active', color: 'text-cyan-600' }
          ],
          status: 'Running...',
          shortcut: '↵'
        },
        {
          icon: {
            type: 'svg',
            path: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
            bgColor: 'bg-[#18181b]',
            textColor: 'text-gray-400',
            borderColor: 'border-[#27272a]'
          },
          title: 'View Datagrid Testbed',
          subtitle: 'Monitoring • Variants',
          shortcut: ['G', 'T']
        }
      ]
    },
    {
      section: 'Entities',
      items: [
        {
          icon: {
            type: 'text',
            text: 'V',
            bgColor: 'bg-amber-900/10',
            textColor: 'text-amber-500',
            borderColor: 'border-amber-900/20'
          },
          title: 'V-4821-A Intake Valve',
          subtitle: 'Sector 4 • Pressure Drift',
          badge: {
            text: 'WARN',
            bgColor: 'bg-amber-900/20',
            textColor: 'text-amber-500',
            borderColor: 'border-amber-900/30'
          },
          status: 'Needs Review'
        },
        {
          icon: {
            type: 'svg',
            path: 'M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z',
            bgColor: 'bg-[#18181b]',
            textColor: 'text-gray-400',
            borderColor: 'border-[#27272a]'
          },
          title: 'Add New Row',
          subtitle: 'Grid Operations',
          shortcut: '⌘N'
        },
        {
          icon: {
            type: 'svg',
            path: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4',
            bgColor: 'bg-[#18181b]',
            textColor: 'text-gray-400',
            borderColor: 'border-[#27272a]'
          },
          title: 'Filter Tasks',
          subtitle: 'View Settings',
          shortcut: 'F'
        }
      ]
    }
  ];

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setSearchQuery('');
    }
  };

  return (
    <Router basename="/">
      <div className="w-full h-screen flex items-center justify-center bg-black/50 p-4" style={customStyles.body}>
        <div className="w-full max-w-[600px] bg-[#09090b] border border-[#27272a] rounded shadow-2xl flex flex-col overflow-hidden max-h-[480px]">
          <div className="flex flex-col border-b border-[#27272a]">
            <div className="px-3 pt-2 pb-0.5 flex items-center gap-1.5 text-[9px] text-gray-500 uppercase tracking-widest font-semibold select-none">
              <span>System</span>
              <span className="text-gray-700">/</span>
              <span>Data Grid</span>
              <span className="text-gray-700">/</span>
              <span className="text-cyan-500">Global Search</span>
            </div>

            <div className="flex items-center px-3 pb-2 pt-0.5 gap-2.5 transition-shadow">
              <div className="text-gray-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
              </div>
              <input
                type="text"
                placeholder="Type a command..."
                className="w-full bg-transparent text-gray-200 text-xs placeholder-[#3f3f46] outline-none h-7 font-medium"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <kbd className="inline-flex items-center h-4 px-1 text-[9px] font-medium text-gray-500 bg-[#18181b] border border-[#27272a] rounded tag-outline">
                ESC
              </kbd>
            </div>

            <div className="flex items-center px-3 gap-3 overflow-x-auto scrollbar-hide border-t border-[#18181b]">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  className={`py-1.5 text-[10px] font-medium ${
                    activeTab === tab
                      ? 'text-cyan-400 border-b-2 border-cyan-500'
                      : 'text-gray-500 hover:text-gray-300 border-b-2 border-transparent'
                  }`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5 space-y-0.5">
            {commandItems.map((section, sectionIdx) => (
              <div key={sectionIdx}>
                <div className="px-1.5 pt-1.5 pb-0.5 text-[9px] font-bold text-gray-600 uppercase tracking-widest flex items-center justify-between">
                  <span>{section.section}</span>
                </div>
                {section.items.map((item, itemIdx) => {
                  const globalIdx = sectionIdx * 10 + itemIdx;
                  return (
                    <CommandItem
                      key={itemIdx}
                      {...item}
                      isActive={activeItem === globalIdx}
                      onClick={() => setActiveItem(globalIdx)}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          <div className="px-3 py-2 bg-[#0a0a0a] border-t border-[#27272a] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-[9px] font-medium text-gray-500">
                <span>Nav</span>
                <span className="text-gray-700">|</span>
                <span>Select</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#18181b] border border-[#27272a]">
                <div className="w-1 h-1 rounded-full bg-emerald-500"></div>
                <span className="text-[9px] font-mono text-gray-500">ON</span>
              </div>
              <span className="text-[9px] text-gray-700 font-mono">v2.4.0</span>
            </div>
          </div>
        </div>
      </div>
    </Router>
  );
};

export default App;