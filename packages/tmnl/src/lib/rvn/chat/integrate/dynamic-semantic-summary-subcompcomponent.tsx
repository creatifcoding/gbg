import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

const TaskManager = () => {
  const [expandedTasks, setExpandedTasks] = useState({});

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/lucide@latest/dist/umd/lucide.js';
    script.onload = () => {
      if (window.lucide) {
        window.lucide.createIcons();
      }
    };
    document.body.appendChild(script);

    const style = document.createElement('style');
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');
      
      body {
        font-family: 'JetBrains Mono', monospace;
        background-color: #050505;
        color: #e5e7eb;
      }
      
      ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      ::-webkit-scrollbar-track {
        background: #0f1115; 
      }
      ::-webkit-scrollbar-thumb {
        background: #374151; 
        border-radius: 4px;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: #4b5563; 
      }

      @keyframes pulse-soft {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }
      .animate-pulse-soft {
        animation: pulse-soft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
      }

      @keyframes progress-stripe {
        0% { background-position: 1rem 0; }
        100% { background-position: 0 0; }
      }
      .progress-striped {
        background-image: linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent);
        background-size: 1rem 1rem;
        animation: progress-stripe 1s linear infinite;
      }

      .glass-panel {
        background: rgba(15, 17, 21, 0.8);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(55, 65, 81, 0.5);
      }

      .terminal-text-shadow {
        text-shadow: 0 0 2px rgba(0,0,0,0.5);
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.body.removeChild(script);
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  });

  const toggleDetails = (taskId) => {
    setExpandedTasks(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

  const TaskCard = ({ task }) => {
    const isExpanded = expandedTasks[task.id];
    const iconRotation = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';

    return (
      <div className={`group border ${task.borderColor} bg-[#0a0c10] rounded-lg overflow-hidden ${task.hoverBorder} transition-all duration-200 shadow-sm relative`}>
        {task.leftBorder && <div className={`absolute left-0 top-0 bottom-0 w-[2px] ${task.leftBorder}`}></div>}
        
        <div 
          className={`flex items-center p-3 cursor-pointer ${task.bgColor} hover:bg-[#161b22] transition-colors ${task.borderBottom ? 'border-b border-gray-800' : ''}`}
          onClick={() => toggleDetails(task.id)}
        >
          <div className={`mr-3 text-gray-600 group-hover:text-gray-400 cursor-grab active:cursor-grabbing ${task.paddingLeft || ''}`}>
            <i data-lucide="grip-vertical" className="w-4 h-4"></i>
          </div>
          
          <div className={`w-8 h-8 rounded ${task.iconBg} flex items-center justify-center mr-4 border ${task.iconBorder}`}>
            <i data-lucide={task.icon} className={`w-4 h-4 ${task.iconColor} ${task.iconSpin ? 'animate-spin' : ''}`}></i>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <span className={`text-sm font-semibold ${task.titleColor} truncate ${task.titleHover || ''} transition-colors`}>{task.title}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${task.badgeBorder} ${task.badgeColor}`}>{task.badge}</span>
            </div>
            <div className="flex items-center gap-4 mt-1">
              <div className="w-32 h-1 bg-gray-800 rounded-full overflow-hidden">
                <div className={`h-full ${task.progressBg} ${task.progressStripe || ''}`} style={{ width: task.progress }}></div>
              </div>
              <span className={`text-xs ${task.progressTextColor} ${task.progressPulse || ''}`}>{task.progressText}</span>
            </div>
          </div>

          <div className="flex items-center gap-6 px-4">
            <div className="text-right hidden sm:block">
              <div className={`text-[10px] ${task.timeLabel === 'Scheduled' ? 'text-gray-600' : 'text-gray-500'} uppercase tracking-wider`}>{task.timeLabel}</div>
              <div className={`text-xs ${task.timeLabel === 'Scheduled' ? 'text-gray-500' : 'text-gray-400'}`}>{task.time}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${task.statusBg} ${task.statusColor} border ${task.statusBorder} ${task.statusShadow || ''}`}>
                {task.status}
              </span>
              <i 
                data-lucide={isExpanded ? "chevron-up" : "chevron-down"} 
                className={`w-4 h-4 ${task.chevronColor} transition-transform duration-200`}
                style={{ transform: iconRotation }}
              ></i>
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className={`transition-all duration-300 ease-in-out ${task.detailsBorder || ''}`}>
            {task.detailsContent}
          </div>
        )}
      </div>
    );
  };

  const tasks = [
    {
      id: 'task-1',
      borderColor: 'border-gray-800',
      hoverBorder: 'hover:border-gray-700',
      bgColor: 'bg-[#0f1115]',
      borderBottom: true,
      icon: 'check',
      iconBg: 'bg-emerald-500/10',
      iconBorder: 'border-emerald-500/20',
      iconColor: 'text-emerald-400',
      title: 'Hydrate shell bands',
      titleColor: 'text-gray-200',
      badge: 'iso-shell-01',
      badgeBorder: 'border-gray-700',
      badgeColor: 'text-gray-500',
      progress: '100%',
      progressBg: 'bg-emerald-500',
      progressText: '100% • 420ms',
      progressTextColor: 'text-gray-500',
      timeLabel: 'Started',
      time: '10:42:01',
      status: 'COMPLETED',
      statusBg: 'bg-emerald-500/10',
      statusColor: 'text-emerald-400',
      statusBorder: 'border-emerald-500/20',
      chevronColor: 'text-gray-500',
      detailsContent: (
        <div className="p-5 bg-[#0a0c10]">
          <div className="flex gap-1 mb-6 h-1 w-full bg-gray-800/50 rounded-full overflow-hidden">
            <div className="w-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-y-6 gap-x-8 text-xs">
            <div className="space-y-4">
              <div className="group/field">
                <label className="block text-gray-500 mb-1 group-hover/field:text-indigo-400 transition-colors">taskId</label>
                <div className="flex items-center justify-between text-gray-300 font-medium bg-[#13161c] px-2 py-1.5 rounded border border-transparent hover:border-gray-700 transition-colors">
                  <span>iso-shell-01</span>
                  <button className="opacity-0 group-hover/field:opacity-100 text-gray-500 hover:text-white transition-opacity"><i data-lucide="copy" className="w-3 h-3"></i></button>
                </div>
              </div>
              <div className="group/field">
                <label className="block text-gray-500 mb-1 group-hover/field:text-indigo-400 transition-colors">assignmentMode</label>
                <div className="text-gray-400 italic">auto-distribution</div>
              </div>
              <div className="group/field">
                <label className="block text-gray-500 mb-1 group-hover/field:text-indigo-400 transition-colors">toolName</label>
                <div className="text-indigo-300">shell_exec_v2</div>
              </div>
              <div className="group/field">
                <label className="block text-gray-500 mb-1 group-hover/field:text-indigo-400 transition-colors">metadata.deliverable</label>
                <div className="text-gray-400">-</div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="group/field">
                <label className="block text-gray-500 mb-1 group-hover/field:text-indigo-400 transition-colors">title</label>
                <div className="text-gray-200">Hydrate shell bands</div>
              </div>
              <div className="group/field">
                <label className="block text-gray-500 mb-1 group-hover/field:text-indigo-400 transition-colors">assignedAgentId</label>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-[9px] border border-purple-500/30">A</div>
                  <span className="text-gray-300">agent-core-04</span>
                </div>
              </div>
              <div className="group/field">
                <label className="block text-gray-500 mb-1 group-hover/field:text-indigo-400 transition-colors">lastSeq</label>
                <div className="text-gray-300 font-mono">142</div>
              </div>
              <div className="group/field">
                <label className="block text-gray-500 mb-1 group-hover/field:text-indigo-400 transition-colors">metadata.note</label>
                <div className="text-gray-400 italic">Optimized payload</div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="group/field">
                <label className="block text-gray-500 mb-1 group-hover/field:text-indigo-400 transition-colors">status</label>
                <div className="text-emerald-400 font-semibold">completed</div>
              </div>
              <div className="group/field">
                <label className="block text-gray-500 mb-1 group-hover/field:text-indigo-400 transition-colors">claimedBy</label>
                <div className="text-gray-300">worker-node-12</div>
              </div>
              <div className="group/field">
                <label className="block text-gray-500 mb-1 group-hover/field:text-indigo-400 transition-colors">createdAt</label>
                <div className="text-gray-300">2023-10-24T10:42:01Z</div>
              </div>
              <div className="group/field">
                <label className="block text-gray-500 mb-1 group-hover/field:text-indigo-400 transition-colors">updatedAt</label>
                <div className="text-gray-300">2023-10-24T10:42:02Z</div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="group/field">
                <label className="block text-gray-500 mb-1 group-hover/field:text-indigo-400 transition-colors">progress</label>
                <div className="text-gray-200">100%</div>
              </div>
              <div className="group/field">
                <label className="block text-gray-500 mb-1 group-hover/field:text-indigo-400 transition-colors">sessionId</label>
                <div className="text-gray-300 font-mono text-[10px] tracking-tight">sess_89234jk234</div>
              </div>
              <div className="group/field">
                <label className="block text-gray-500 mb-1 group-hover/field:text-indigo-400 transition-colors">nodeId</label>
                <div className="text-gray-300">node-us-east-1a</div>
              </div>
              <div className="group/field">
                <label className="block text-gray-500 mb-1 group-hover/field:text-indigo-400 transition-colors">dependencies</label>
                <div className="text-gray-400 font-mono text-[10px]">[ ]</div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-gray-800 flex justify-between items-center">
            <div className="flex gap-2">
              <button className="px-3 py-1.5 rounded hover:bg-gray-800 text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-2">
                <i data-lucide="file-text" className="w-3 h-3"></i> View Logs
              </button>
              <button className="px-3 py-1.5 rounded hover:bg-gray-800 text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-2">
                <i data-lucide="code" className="w-3 h-3"></i> JSON Output
              </button>
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-xs text-gray-200 transition-colors border border-gray-700">
                Re-run Task
              </button>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'task-2',
      borderColor: 'border-blue-900/30',
      hoverBorder: 'hover:border-blue-800/50',
      leftBorder: 'bg-blue-500',
      bgColor: 'bg-[#0f1115]/50',
      paddingLeft: 'pl-1',
      icon: 'loader-2',
      iconSpin: true,
      iconBg: 'bg-blue-500/10',
      iconBorder: 'border-blue-500/20',
      iconColor: 'text-blue-400',
      title: 'Attach message shell compounds',
      titleColor: 'text-gray-200',
      badge: 'iso-shell-02',
      badgeBorder: 'border-gray-700',
      badgeColor: 'text-gray-500',
      progress: '45%',
      progressBg: 'bg-blue-500',
      progressStripe: 'progress-striped',
      progressText: '45% • Processing...',
      progressTextColor: 'text-blue-400',
      progressPulse: 'animate-pulse-soft',
      timeLabel: 'Started',
      time: '10:44:12',
      status: 'RUNNING',
      statusBg: 'bg-blue-500/10',
      statusColor: 'text-blue-400',
      statusBorder: 'border-blue-500/20',
      statusShadow: 'shadow-[0_0_10px_rgba(59,130,246,0.1)]',
      chevronColor: 'text-gray-500',
      detailsBorder: 'border-t border-gray-800',
      detailsContent: (
        <div className="p-5 bg-[#0a0c10]">
          <div className="flex items-center justify-center py-8 text-gray-500">
            <div className="flex flex-col items-center gap-2">
              <i data-lucide="loader" className="w-6 h-6 animate-spin text-blue-500"></i>
              <span className="text-xs">Live streaming logs...</span>
            </div>
          </div>
          
          <div className="font-mono text-xs text-gray-400 bg-black/50 p-4 rounded border border-gray-800/50 h-32 overflow-y-auto mb-4 font-normal">
            <div className="text-gray-500">[10:44:12] Initializing transport layer...</div>
            <div className="text-gray-500">[10:44:13] Handshake successful. Token: tk_99s8d</div>
            <div className="text-blue-400">[10:44:15] Attaching shell compound A...</div>
            <div className="text-blue-400">[10:44:16] Attaching shell compound B...</div>
            <div className="text-gray-300 animate-pulse">&gt; Waiting for acknowledgment...</div>
          </div>
          
          <div className="flex justify-end gap-2">
            <button className="px-3 py-1.5 rounded border border-red-900/50 text-red-400 hover:bg-red-900/20 text-xs transition-colors">Stop Process</button>
            <button className="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs transition-colors">View Details</button>
          </div>
        </div>
      )
    },
    {
      id: 'task-3',
      borderColor: 'border-gray-800',
      hoverBorder: 'hover:border-gray-600',
      bgColor: 'bg-[#0f1115]',
      icon: 'clock',
      iconBg: 'bg-gray-800',
      iconBorder: 'border-gray-700',
      iconColor: 'text-gray-400',
      title: 'Finalize transport actions',
      titleColor: 'text-gray-400',
      titleHover: 'group-hover:text-gray-300',
      badge: 'iso-shell-03',
      badgeBorder: 'border-gray-800',
      badgeColor: 'text-gray-600',
      progress: '0%',
      progressBg: 'bg-gray-500',
      progressText: 'Queued',
      progressTextColor: 'text-gray-600',
      timeLabel: 'Scheduled',
      time: 'Auto',
      status: 'QUEUED',
      statusBg: 'bg-gray-800',
      statusColor: 'text-gray-400',
      statusBorder: 'border-gray-700',
      chevronColor: 'text-gray-600',
      detailsBorder: 'border-t border-gray-800',
      detailsContent: (
        { /* TODO: I fuck with this view heavily. I want to greatly extnd it however, in particular, I desire to use it as a supplementary exploratory view on the row itself. Like a secondary detail view that's more for semantic and dynamic rendering per the task.*/ }
        <div className="p-5 bg-[#0a0c10]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <h4 className="text-gray-500 mb-2 uppercase text-[10px] font-bold">Dependencies</h4>
              <div className="bg-[#13161c] p-2 rounded border border-gray-800 text-gray-400">
                <div className="flex items-center gap-2 mb-1">
                  <i data-lucide="check" className="w-3 h-3 text-emerald-500"></i>
                  <span>iso-shell-01 (Completed)</span>
                </div>
                <div className="flex items-center gap-2">
                  <i data-lucide="loader" className="w-3 h-3 text-blue-500 animate-spin"></i>
                  <span className="text-blue-400">iso-shell-02 (Running)</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-gray-500 mb-2 uppercase text-[10px] font-bold">Configuration</h4>
              <div className="space-y-2">
                <div className="flex justify-between border-b border-gray-800 pb-1">
                  <span className="text-gray-500">Priority</span>
                  <span className="text-gray-300">Normal</span>
                </div>
                <div className="flex justify-between border-b border-gray-800 pb-1">
                  <span className="text-gray-500">Timeout</span>
                  <span className="text-gray-300">300s</span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline">Modify Configuration</button>
          </div>
        </div>
      )
    },
    {
      id: 'task-4',
      borderColor: 'border-gray-800',
      hoverBorder: 'hover:border-red-900/50',
      bgColor: 'bg-[#0f1115]',
      icon: 'x-circle',
      iconBg: 'bg-red-500/10',
      iconBorder: 'border-red-500/20',
      iconColor: 'text-red-400',
      title: 'Purge cache overflow',
      titleColor: 'text-gray-300',
      badge: 'iso-sys-99',
      badgeBorder: 'border-gray-700',
      badgeColor: 'text-gray-500',
      progress: '88%',
      progressBg: 'bg-red-500',
      progressText: 'Failed at 88%',
      progressTextColor: 'text-red-400',
      timeLabel: 'Ended',
      time: '10:38:55',
      status: 'FAILED',
      statusBg: 'bg-red-500/10',
      statusColor: 'text-red-400',
      statusBorder: 'border-red-500/20',
      chevronColor: 'text-gray-500',
      detailsBorder: 'border-t border-red-900/20',
      detailsContent: (
        <div className="p-5 bg-[#0a0c10]">
          <div className="bg-red-500/5 border border-red-500/10 rounded p-3 mb-4">
            <div className="flex items-start gap-3">
              <i data-lucide="alert-circle" className="w-4 h-4 text-red-500 mt-0.5"></i>
              <div>
                <h4 className="text-red-400 text-xs font-bold mb-1">Error: Timeout Exceeded</h4>
                <p className="text-gray-400 text-xs">The operation timed out waiting for write lock on /var/lib/cache. Lock held by pid 4829.</p>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button className="px-3 py-1.5 rounded hover:bg-gray-800 text-xs text-gray-400 hover:text-white transition-colors">
              View Stack Trace
            </button>
            <button className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white text-xs transition-colors shadow-sm shadow-red-900/20">
              Retry Operation
            </button>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="h-screen w-full overflow-hidden flex flex-col bg-[#050505]">
      <div className="flex-1 flex flex-col w-full max-w-[1600px] mx-auto p-6">
        <header className="flex items-center justify-between mb-8 px-2">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/30 rounded flex items-center justify-center">
              <i data-lucide="terminal" className="text-indigo-400 w-5 h-5"></i>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">Process Monitor</h1>
              <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> System Active</span>
                <span>•</span>
                <span>v2.4.1-alpha</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex bg-[#0f1115] border border-gray-800 rounded-md p-1">
              <button className="px-3 py-1.5 text-xs font-medium rounded bg-gray-800 text-white shadow-sm">All</button>
              <button className="px-3 py-1.5 text-xs font-medium rounded text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors">Running</button>
              <button className="px-3 py-1.5 text-xs font-medium rounded text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors">Failed</button>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded transition-colors shadow-[0_0_15px_rgba(79,70,229,0.3)]">
              <i data-lucide="play" className="w-3.5 h-3.5 fill-current"></i>
              Queue New Task
            </button>
          </div>
        </header>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="glass-panel rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider mb-1">Total Tasks</p>
              <p className="text-2xl font-bold text-white">24</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-gray-800/50 flex items-center justify-center">
              <i data-lucide="layers" className="text-gray-400 w-5 h-5"></i>
            </div>
          </div>
          <div className="glass-panel rounded-lg p-4 flex items-center justify-between border-l-2 border-l-emerald-500">
            <div>
              <p className="text-xs text-emerald-500/80 uppercase font-semibold tracking-wider mb-1">Completed</p>
              <p className="text-2xl font-bold text-emerald-400">18</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <i data-lucide="check-circle-2" className="text-emerald-400 w-5 h-5"></i>
            </div>
          </div>
          <div className="glass-panel rounded-lg p-4 flex items-center justify-between border-l-2 border-l-blue-500">
            <div>
              <p className="text-xs text-blue-500/80 uppercase font-semibold tracking-wider mb-1">Running</p>
              <p className="text-2xl font-bold text-blue-400">2</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
              <i data-lucide="loader-2" className="text-blue-400 w-5 h-5 animate-spin"></i>
            </div>
          </div>
          <div className="glass-panel rounded-lg p-4 flex items-center justify-between border-l-2 border-l-amber-500">
            <div>
              <p className="text-xs text-amber-500/80 uppercase font-semibold tracking-wider mb-1">Queued</p>
              <p className="text-2xl font-bold text-amber-400">4</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
              <i data-lucide="clock" className="text-amber-400 w-5 h-5"></i>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pb-20">
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} />
          ))}

          <div className="opacity-50 pointer-events-none group border border-gray-800 bg-[#0a0c10] rounded-lg overflow-hidden">
            <div className="flex items-center p-3">
              <div className="mr-3 text-gray-700"><i data-lucide="grip-vertical" className="w-4 h-4"></i></div>
              <div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center mr-4 border border-gray-700">
                <i data-lucide="check" className="w-4 h-4 text-gray-600"></i>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-500">Archive daily logs</span>
                </div>
              </div>
              <div className="px-4">
                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-800 text-gray-600 border border-gray-700">ARCHIVED</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <Router basename="/">
      <Routes>
        <Route path="/" element={<TaskManager />} />
      </Routes>
    </Router>
  );
};

export default App;
