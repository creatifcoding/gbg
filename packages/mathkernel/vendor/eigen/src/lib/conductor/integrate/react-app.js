import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

const customStyles = {
  bgBase: '#f4f4f0',
  bgPanel: '#ffffff',
  borderPrimary: '#121212',
  accentOrange: '#ea580c',
  accentTan: '#fdf6e3',
  textTan: '#8b7d5b',
};

const StatusIndicator = ({ status, label }) => {
  const isConnecting = status === 'connecting';
  const isIdle = status === 'idle';

  return (
    <div className="havoc-border px-3 py-1.5 flex items-center gap-2 bg-white group cursor-default">
      {isConnecting ? (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
        </span>
      ) : (
        <div className="w-2 h-2 border border-gray-400"></div>
      )}
      <span className={`text-xs font-bold uppercase tracking-wide transition-colors ${isConnecting ? 'text-orange-700 group-hover:text-orange-600' : 'text-gray-800'}`}>
        {label}
      </span>
    </div>
  );
};

const CommandButton = ({ children, active, onClick }) => (
  <button
    onClick={onClick}
    className={`px-4 py-1.5 havoc-border text-xs font-bold hover:bg-black hover:text-white transition-all uppercase tracking-tight ${
      active ? 'text-gray-800 bg-gray-100' : 'text-gray-600'
    }`}
  >
    {children}
  </button>
);

const MessageBubble = ({ type, time, children, label }) => {
  const isSystem = type === 'system';
  const isUser = type === 'user';
  const isAgent = type === 'agent';

  return (
    <div className="flex gap-5 group">
      <div className="w-10 flex flex-col items-center pt-1">
        {isSystem && (
          <>
            <div className="w-3 h-3 bg-gray-300 rotate-45 mb-2 group-hover:bg-gray-400 transition-colors"></div>
            <div className="w-px h-full bg-gray-200 group-hover:bg-gray-300"></div>
          </>
        )}
        {isUser && (
          <div className="w-8 h-8 havoc-border bg-white flex items-center justify-center mb-2 shadow-[2px_2px_0px_0px_#000]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        )}
        {isAgent && (
          <div className="w-8 h-8 bg-black flex items-center justify-center mb-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)]">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>
      <div className="flex-1 max-w-4xl">
        <div className="flex items-center gap-3 mb-2">
          {label && <span className="text-[10px] font-bold text-black bg-gray-200 px-1">{label}</span>}
          <span className="text-[10px] font-bold text-gray-400 tracking-wider">{time}</span>
        </div>
        {children}
      </div>
    </div>
  );
};

const AnalysisCard = () => (
  <div className="havoc-border bg-white w-full max-w-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] overflow-hidden">
    <div className="bg-gray-100 border-b-2 border-black px-4 py-2 flex justify-between items-center">
      <span className="text-xs font-bold uppercase flex items-center gap-2">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        Analysis: Sector 4
      </span>
      <span className="text-[10px] font-bold text-orange-600 border border-orange-200 bg-orange-50 px-2 py-0.5">⚠️ VARIANCE DETECTED</span>
    </div>
    <div className="p-5">
      <p className="text-xs text-gray-600 mb-4 font-mono">Telemetry indicates pressure fluctuation exceeding normal operating parameters (+15%).</p>
      <div className="grid grid-cols-2 gap-4 text-xs mb-4">
        <div className="bg-gray-50 border border-gray-200 p-3">
          <div className="text-gray-400 mb-1">Target Pressure</div>
          <div className="font-bold text-base">2,100 PSI</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 p-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-8 h-8 bg-orange-100 -mr-4 -mt-4 rotate-45"></div>
          <div className="text-orange-800 mb-1">Current Reading</div>
          <div className="font-bold text-base text-orange-700">2,415 PSI</div>
        </div>
      </div>
      <div className="flex gap-2">
        <button className="text-[10px] font-bold uppercase border border-black px-3 py-1 hover:bg-black hover:text-white transition-colors">View Logs</button>
        <button className="text-[10px] font-bold uppercase border border-black px-3 py-1 hover:bg-black hover:text-white transition-colors">Override Safety</button>
      </div>
    </div>
  </div>
);

const HomePage = () => {
  const [messageInput, setMessageInput] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('None');
  const [activeMode, setActiveMode] = useState('ai');

  return (
    <div className="w-full h-full bg-white havoc-border havoc-shadow flex flex-col relative overflow-hidden">
      <header className="h-20 havoc-border border-x-0 border-t-0 bg-white flex items-center justify-between px-6 shrink-0 z-30">
        <div className="flex items-center gap-8">
          <div>
            <h1 className="text-xl font-bold tracking-tighter uppercase havoc-font leading-none">COP ASSISTANT</h1>
            <div className="text-[10px] text-gray-400 font-bold tracking-[0.2em] uppercase mt-1">Havoc // System L2</div>
          </div>
          <div className="flex items-center gap-3">
            <StatusIndicator status="connecting" label="Connecting" />
            <StatusIndicator status="idle" label="Idle" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="havoc-btn bg-black text-white px-5 py-2 text-xs font-bold uppercase havoc-border border-black hover:bg-gray-800 shadow-[2px_2px_0px_0px_#666]">
            Collapse L2
          </button>
          <button className="havoc-btn bg-white text-black px-5 py-2 text-xs font-bold uppercase havoc-border hover:bg-gray-50 shadow-[2px_2px_0px_0px_#000]">
            Reset Session
          </button>
          <button className="havoc-btn w-10 h-10 flex items-center justify-center bg-white text-black havoc-border hover:bg-gray-50 shadow-[2px_2px_0px_0px_#000]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="relative ml-2">
            <button className="havoc-btn flex items-center justify-between gap-6 bg-white text-black px-4 py-2 text-xs font-bold uppercase havoc-border min-w-[180px] hover:bg-gray-50 shadow-[2px_2px_0px_0px_#000]">
              <span className="text-gray-400">Agent: {selectedAgent}</span>
              <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="h-14 havoc-border-b bg-white flex items-center px-6 gap-3 shrink-0 z-20">
        <CommandButton onClick={() => {}}>
          /status
        </CommandButton>
        <CommandButton onClick={() => {}}>
          /alarm
        </CommandButton>
        <CommandButton active onClick={() => {}}>
          @WO-4821
        </CommandButton>
        <div className="flex-1"></div>
        <div className="flex items-center gap-2 opacity-50">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-[10px] uppercase font-bold tracking-widest">Sys_Monitor_Active</span>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto bg-[#f8f8f6] relative flex flex-col min-h-0">
        <div className="absolute inset-0 pattern-grid pointer-events-none"></div>
        <div className="p-6 md:p-10 space-y-8 flex-1 flex flex-col justify-end">
          <div className="flex-1"></div>
          
          <MessageBubble type="system" time="SYSTEM • 09:14:02">
            <div className="font-mono text-sm text-gray-600 leading-relaxed bg-transparent">
              &gt; Connection established with Node Cluster Alpha.<br />
              &gt; Retrieving telemetry data... <span className="text-green-600 font-bold">[COMPLETE]</span>
            </div>
          </MessageBubble>

          <MessageBubble type="user" time="OPERATOR • 09:15:45">
            <div className="havoc-border bg-white p-4 inline-block shadow-[4px_4px_0px_0px_#00000010]">
              <p className="text-sm font-medium">Analyze pressure variance in Sector 4 intake valves. Reference @WO-4821.</p>
            </div>
          </MessageBubble>

          <MessageBubble type="agent" time="09:15:48" label="AI AGENT">
            <AnalysisCard />
          </MessageBubble>

          <div className="havoc-border bg-[#FDF6E3] p-4 flex flex-col md:flex-row items-start md:items-center gap-4 text-[#8B7D5B] shadow-[4px_4px_0px_0px_rgba(139,125,91,0.2)]">
            <div className="font-bold text-sm tracking-widest text-[#5c5238] border-b-2 border-[#5c5238] pb-1 md:pb-0 md:border-b-0">S2</div>
            <div className="hidden md:block w-px h-5 bg-[#8B7D5B] opacity-50"></div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm font-medium">Connection lost — live stream interrupted. Draft is preserved for this node.</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-gray-400 py-2 pl-1">
            <div className="w-2 h-2 border border-gray-400 rotate-45 bg-white"></div>
            <span className="text-xs md:text-sm font-mono italic">No new messages. Use /commands or @mentions.</span>
          </div>
        </div>
      </main>

      <footer className="h-auto min-h-[280px] bg-white border-t-[3px] border-black flex flex-col shrink-0 z-30 relative">
        <div className="flex-1 relative group bg-white">
          <textarea
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            className="w-full h-full p-6 md:p-8 resize-none outline-none font-mono text-base md:text-lg bg-transparent placeholder-gray-300 text-black leading-relaxed"
            placeholder="Ask about work orders, alarms, sensors..."
          />
          <div className="absolute top-0 right-0 w-8 h-8 border-b-2 border-l-2 border-gray-100 pointer-events-none"></div>
        </div>

        <div className="h-16 md:h-20 border-t-[2px] border-black flex items-center justify-between px-4 md:px-6 bg-white shrink-0">
          <div className="flex items-center gap-2 md:gap-3 overflow-x-auto no-scrollbar mask-gradient pr-4">
            <button
              onClick={() => setActiveMode('terminal')}
              className={`havoc-btn h-10 px-4 border-2 border-black font-bold text-xs uppercase whitespace-nowrap shadow-[2px_2px_0px_0px_#ccc] ${
                activeMode === 'terminal' ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'
              }`}
            >
              Terminal
            </button>
            <button
              onClick={() => setActiveMode('ai')}
              className={`havoc-btn h-10 px-4 border-2 border-black font-bold text-xs uppercase whitespace-nowrap ${
                activeMode === 'ai' ? 'bg-black text-white shadow-[2px_2px_0px_0px_#666]' : 'bg-white hover:bg-gray-100 shadow-[2px_2px_0px_0px_#ccc]'
              }`}
            >
              AI
            </button>
            <button className="havoc-btn h-10 px-4 border-2 border-black font-bold text-xs uppercase bg-white hover:bg-gray-100 flex items-center gap-2 whitespace-nowrap shadow-[2px_2px_0px_0px_#ccc]">
              <div className="w-2 h-2 bg-gray-400 rotate-45"></div> MED
            </button>
            <div className="w-px h-8 bg-gray-300 mx-2 hidden md:block"></div>
            <button className="havoc-btn h-10 px-4 border-2 border-gray-300 font-bold text-xs hover:border-black hover:bg-gray-50 text-gray-500 hover:text-black transition-colors whitespace-nowrap border-dashed">
              /cmd
            </button>
            <button className="havoc-btn h-10 px-4 border-2 border-gray-300 font-bold text-xs hover:border-black hover:bg-gray-50 text-gray-500 hover:text-black transition-colors whitespace-nowrap border-dashed">
              @entity
            </button>
            <button className="havoc-btn w-10 h-10 border-2 border-black flex items-center justify-center hover:bg-gray-100 shadow-[2px_2px_0px_0px_#ccc]">
              <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-4 pl-4 border-l-2 border-transparent md:border-gray-100 flex-shrink-0">
            <button className="havoc-btn px-4 md:px-6 py-2.5 border-2 border-black bg-white font-bold text-xs uppercase hover:bg-red-50 hover:text-red-600 hover:border-red-600 transition-colors whitespace-nowrap hidden sm:block">
              Reconnect
            </button>
            <button className="havoc-btn px-6 md:px-8 py-2.5 border-2 border-black bg-[#C4C4C4] font-bold text-xs uppercase text-white hover:bg-black hover:text-white transition-colors whitespace-nowrap shadow-[2px_2px_0px_0px_#999]">
              Send
            </button>
          </div>
        </div>
      </footer>

      <div className="absolute top-0 left-0 w-4 h-4 border-r-2 border-b-2 border-black bg-white z-50"></div>
      <div className="absolute top-0 right-0 w-4 h-4 border-l-2 border-b-2 border-black bg-white z-50"></div>
      <div className="absolute bottom-0 left-0 w-4 h-4 border-r-2 border-t-2 border-black bg-white z-50"></div>
      <div className="absolute bottom-0 right-0 w-4 h-4 border-l-2 border-t-2 border-black bg-white z-50"></div>
    </div>
  );
};

const App = () => {
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      :root {
        --bg-base: #f4f4f0;
        --bg-panel: #ffffff;
        --border-primary: #121212;
        --accent-orange: #ea580c;
        --accent-tan: #fdf6e3;
        --text-tan: #8b7d5b;
      }

      body {
        font-family: 'Space Mono', monospace;
        background-color: #dcdcdc;
        background-image: 
          linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px);
        background-size: 24px 24px;
        color: #121212;
        margin: 0;
        padding: 0;
      }

      .havoc-font {
        font-family: 'JetBrains Mono', monospace;
      }

      .havoc-border {
        border: 2px solid var(--border-primary);
      }

      .havoc-border-b {
        border-bottom: 2px solid var(--border-primary);
      }

      .havoc-border-t {
        border-top: 2px solid var(--border-primary);
      }

      .havoc-shadow {
        box-shadow: 6px 6px 0px 0px var(--border-primary);
      }

      .havoc-shadow-sm {
        box-shadow: 3px 3px 0px 0px var(--border-primary);
      }

      .havoc-shadow-hover:hover {
        transform: translate(-2px, -2px);
        box-shadow: 6px 6px 0px 0px var(--border-primary);
      }

      .havoc-btn {
        position: relative;
        transition: all 0.15s ease;
      }

      .havoc-btn:active {
        transform: translate(2px, 2px);
        box-shadow: 0px 0px 0px 0px var(--border-primary);
      }

      ::-webkit-scrollbar {
        width: 10px;
      }
      ::-webkit-scrollbar-track {
        background: #e5e5e5;
        border-left: 2px solid #121212;
      }
      ::-webkit-scrollbar-thumb {
        background: #121212;
        border: 2px solid #e5e5e5;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: #333;
      }

      .pattern-grid {
        background-image: radial-gradient(#121212 1px, transparent 1px);
        background-size: 20px 20px;
        opacity: 0.05;
      }
    `;
    document.head.appendChild(style);

    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=JetBrains+Mono:wght@400;700&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);

    return () => {
      document.head.removeChild(style);
      document.head.removeChild(fontLink);
    };
  }, []);

  return (
    <Router basename="/">
      <div className="h-screen w-screen flex items-center justify-center p-4 md:p-8 overflow-hidden">
        <div className="w-full h-full max-w-[1400px] max-h-[1200px]">
          <Routes>
            <Route path="/" element={<HomePage />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
};

export default App;