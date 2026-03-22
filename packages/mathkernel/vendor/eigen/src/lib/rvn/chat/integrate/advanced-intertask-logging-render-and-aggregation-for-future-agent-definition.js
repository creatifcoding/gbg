import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

const customStyles = {
  stripeBackground: {
    backgroundImage: 'linear-gradient(45deg, rgba(255, 255, 255, 0.05) 25%, transparent 25%, transparent 50%, rgba(255, 255, 255, 0.05) 50%, rgba(255, 255, 255, 0.05) 75%, transparent 75%, transparent)',
    backgroundSize: '40px 40px'
  }
};

const TaskItem = ({ task, isExpanded, onToggle }) => {
  const getStatusColor = (status) => {
    switch(status) {
      case 'completed': return 'text-[#10B981]';
      case 'running': return 'text-blue-400';
      case 'queued': return 'text-[#F59E0B]';
      case 'failed': return 'text-[#EF4444]';
      default: return 'text-[#64748B]';
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'completed':
        return <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>;
      case 'running':
        return <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>;
      case 'queued':
        return <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>;
      case 'failed':
        return <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>;
      default:
        return null;
    }
  };

  const getBorderClass = (status) => {
    switch(status) {
      case 'running': return 'border-blue-500/20';
      case 'failed': return 'border-terminal-border';
      default: return 'border-terminal-border';
    }
  };

  const getHoverBorderClass = (status) => {
    switch(status) {
      case 'running': return 'hover:border-blue-500/40';
      case 'failed': return 'hover:border-red-500/30';
      default: return 'hover:border-terminal-muted';
    }
  };

  const getHeaderBgClass = (status) => {
    switch(status) {
      case 'running': return 'from-blue-950/20 to-transparent hover:from-blue-900/20';
      default: return 'from-terminal-card to-transparent hover:from-white/5';
    }
  };

  const getContentBgClass = (status) => {
    switch(status) {
      case 'running': return 'bg-[#020203] border-t border-blue-500/20';
      case 'failed': return 'bg-red-950/10 border-t border-red-900/20';
      default: return 'bg-[#020203] border-t border-terminal-border/50';
    }
  };

  return (
    <div className={`task-item ${isExpanded ? 'expanded' : ''} group bg-terminal-card border ${getBorderClass(task.status)} rounded-lg overflow-hidden transition-all duration-300 ${getHoverBorderClass(task.status)} ${task.status === 'completed' ? 'shadow-lg shadow-black/40' : ''} ${task.status === 'running' ? 'relative shadow-lg shadow-blue-900/10' : ''}`}>
      {task.status === 'running' && (
        <div className="absolute bottom-0 left-0 h-[2px] bg-blue-500/50 w-3/4 animate-pulse-glow z-10"></div>
      )}
      
      <div className={`flex items-center justify-between p-4 cursor-pointer select-none bg-gradient-to-r ${getHeaderBgClass(task.status)} transition-all`} onClick={onToggle}>
        <div className="flex items-center gap-4">
          <div className="text-terminal-muted hover:text-white cursor-grab active:cursor-grabbing p-1 rounded hover:bg-white/5">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>
          </div>
          <div className="flex flex-col">
            <span className={`font-semibold tracking-wide ${task.status === 'queued' ? 'text-terminal-muted' : 'text-white'}`}>{task.title}</span>
            {task.subtitle && (
              <span className={`text-xs font-normal mt-0.5 font-mono ${task.status === 'running' ? 'text-blue-400/70' : 'text-terminal-muted opacity-0 group-hover:opacity-100 transition-opacity'}`}>{task.subtitle}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end gap-1">
            <div className={`flex items-center gap-2 ${getStatusColor(task.status)}`}>
              {getStatusIcon(task.status)}
              <span className="text-xs font-bold tracking-wider">{task.status.toUpperCase()}</span>
            </div>
            {task.duration && (
              <span className="text-[10px] text-terminal-muted">{task.duration}</span>
            )}
          </div>
          <svg className={`chevron text-terminal-muted transition-transform duration-300 w-5 h-5 ${isExpanded ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>
      </div>

      <div className={`task-content ${getContentBgClass(task.status)}`} style={{
        transition: 'max-height 0.3s ease-in-out, opacity 0.3s ease-in-out, padding 0.3s ease',
        maxHeight: isExpanded ? '800px' : '0',
        opacity: isExpanded ? '1' : '0',
        overflow: 'hidden'
      }}>
        <div className="p-6 space-y-6">
          {task.content}
        </div>
      </div>
    </div>
  );
};

const TaskManager = () => {
  const [expandedTasks, setExpandedTasks] = useState({ 'task-1': true });
  const [liveOpacity, setLiveOpacity] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveOpacity(Math.random() > 0.5 ? 1 : 0.5);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleTask = (taskId) => {
    setExpandedTasks(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

  const tasks = [
    {
      id: 'task-1',
      title: 'Hydrate shell bands',
      subtitle: 'ID: iso-shell-01',
      status: 'completed',
      duration: '142ms',
      content: (
        <>
          <div className="details-grid text-xs" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.5rem' }}>
            <div className="space-y-1">
              <span className="text-terminal-muted block">taskId</span>
              <div className="flex items-center gap-2 group/copy">
                <span className="text-terminal-text font-medium">iso-shell-01</span>
                <button className="opacity-0 group-hover/copy:opacity-100 text-terminal-muted hover:text-white transition-opacity" title="Copy ID">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-terminal-muted block">title</span>
              <span className="text-terminal-text">Hydrate shell bands</span>
            </div>
            <div className="space-y-1">
              <span className="text-terminal-muted block">status</span>
              <span className="text-terminal-success bg-terminal-success/10 px-2 py-0.5 rounded border border-terminal-success/20 inline-block">completed</span>
            </div>
            <div className="space-y-1">
              <span className="text-terminal-muted block">progress</span>
              <span className="text-terminal-text">100%</span>
            </div>
            <div className="space-y-1">
              <span className="text-terminal-muted block">assignmentMode</span>
              <span className="text-terminal-text">auto-distribution</span>
            </div>
            <div className="space-y-1">
              <span className="text-terminal-muted block">assignedAgentId</span>
              <span className="text-terminal-text" style={{ color: '#A5B4FC' }}>agent-xc-99</span>
            </div>
            <div className="space-y-1">
              <span className="text-terminal-muted block">claimedBy</span>
              <span className="text-terminal-text">worker-node-04</span>
            </div>
            <div className="space-y-1">
              <span className="text-terminal-muted block">sessionId</span>
              <span className="text-terminal-text" style={{ color: '#A5B4FC' }}>sess-8829-ax</span>
            </div>
            <div className="space-y-1">
              <span className="text-terminal-muted block">nodeId</span>
              <span className="text-terminal-text">node-cluster-alpha</span>
            </div>
            <div className="space-y-1">
              <span className="text-terminal-muted block">toolCallId</span>
              <span className="text-terminal-text text-terminal-muted">-</span>
            </div>
            <div className="space-y-1">
              <span className="text-terminal-muted block">toolName</span>
              <span className="text-terminal-text text-terminal-muted">-</span>
            </div>
            <div className="space-y-1">
              <span className="text-terminal-muted block">lastSeq</span>
              <span className="text-terminal-text">42</span>
            </div>
            <div className="space-y-1">
              <span className="text-terminal-muted block">createdAt</span>
              <span className="text-terminal-text">2023-10-24T10:00:01Z</span>
            </div>
            <div className="space-y-1">
              <span className="text-terminal-muted block">updatedAt</span>
              <span className="text-terminal-text">2023-10-24T10:00:05Z</span>
            </div>
            <div className="space-y-1">
              <span className="text-terminal-muted block">metadata.phase</span>
              <span className="text-terminal-text text-blue-300">init_sequence</span>
            </div>
            <div className="space-y-1">
              <span className="text-terminal-muted block">metadata.owner</span>
              <span className="text-terminal-text">system</span>
            </div>
          </div>

          <div className="pt-4 border-t border-terminal-border/30">
            <span className="text-xs text-terminal-muted mb-2 block">Dependencies</span>
            <div className="flex gap-2">
              <span className="px-2 py-1 rounded bg-terminal-border/50 text-xs text-terminal-muted border border-terminal-border">None</span>
            </div>
          </div>

          <div className="pt-2">
            <div className="flex justify-between text-[10px] text-terminal-muted mb-1.5 font-mono uppercase">
              <span>Execution Progress</span>
              <span>Done</span>
            </div>
            <div className="h-2.5 w-full bg-terminal-border rounded-full overflow-hidden relative">
              <div className="absolute inset-0 bg-terminal-success w-full opacity-80" style={customStyles.stripeBackground}></div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-terminal-border/30">
            <button className="px-3 py-1.5 text-xs text-terminal-muted hover:text-white border border-transparent hover:border-terminal-muted rounded transition-all">View Logs</button>
            <button className="px-3 py-1.5 text-xs bg-terminal-border/50 hover:bg-terminal-border text-white border border-terminal-border rounded transition-all flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38"></path></svg>
              Rerun Task
            </button>
          </div>
        </>
      )
    },
    {
      id: 'task-2',
      title: 'Attach message shell compounds',
      subtitle: 'Processing node-18...',
      status: 'running',
      duration: '00:12',
      content: (
        { /* TODO: This is about where the actual log component can live. I want you to pour over this, and find bounds such that you can create this into a sub compound component for the logs. I'd like you to use motion.dev to make it all dope and choreographed. Most of all, you can actually utilize the logging and overlay stuff you find per the conductor testbed, but tailored for the needs of a per task ingestion and rendering system. we'll figure out a way to make a AgentTaskService that will go ahead and define that will have about 2 levels of services deps (e.g. the logging) then the AgentTask will use this in it's methods w/ this magicery. one aspect of this AgentTaskService is the logging service.*/ }
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-terminal-muted">Real-time Logs</span>
            <div className="flex gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" style={{ opacity: liveOpacity }}></span>
              <span className="text-[10px] text-terminal-muted uppercase">Live</span>
            </div>
          </div>
            { /* TODO: Will need a task log ingestion renderer. We need to figure out emit logs and read from a particular sink. I am thinking that we'll have agents sync logs over NATS and let this component manage the NATS subscription. We can use microservices that we hot-deploy to manage all the subjects/streams concerning a task.*/ }
          <div className="bg-black rounded p-3 font-mono text-xs text-gray-400 h-32 overflow-hidden border border-terminal-border">
            <div className="space-y-1">
              <p><span className="text-blue-500">[10:02:14]</span> Initiating handshake with node-18</p>
              <p><span className="text-blue-500">[10:02:15]</span> <span className="text-yellow-500">WARN</span> Latency spike detected (120ms)</p>
              <p><span className="text-blue-500">[10:02:15]</span> Compounding message shell fragments...</p>
              <p><span className="text-blue-500">[10:02:16]</span> Verifying checksums [====================] 100%</p>
              <p><span className="text-blue-500">[10:02:18]</span> Attaching payload stream...</p>
              <p className="animate-pulse">_</p>
            </div>
          </div>

          <div className="pt-6">
            <div className="flex justify-between text-[10px] text-terminal-muted mb-1.5 font-mono uppercase">
              <span>Processing</span>
              <span>75%</span>
            </div>
            <div className="h-2.5 w-full bg-terminal-border rounded-full overflow-hidden relative">
              <div className="absolute inset-0 bg-blue-500 w-[75%] animate-stripe-flow" style={customStyles.stripeBackground}></div>
            </div>
          </div>

            { /* I like this, but it actually needs to be a polymorphic button that changes over to the correct state accordingly. Wired and ready with a derived family atom, ofcourse*/ }
          <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-terminal-border/30">
            <button className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/30 rounded transition-all">Stop Execution</button>
          </div>
        </>
      )
    },
    {
      id: 'task-3',
      title: 'Finalize transport actions',
      status: 'queued',
      content: (
        <>
          <div className="details-grid text-xs opacity-60" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.5rem' }}>
            <div className="space-y-1">
              <span className="text-terminal-muted block">taskId</span>
              <span className="text-terminal-text">iso-trans-02</span>
            </div>
            <div className="space-y-1">
              <span className="text-terminal-muted block">scheduledFor</span>
              <span className="text-terminal-text">Immediately after <span className="text-blue-400">iso-shell-01</span></span>
            </div>
            <div className="space-y-1">
              <span className="text-terminal-muted block">priority</span>
              <span className="text-terminal-warning">High</span>
            </div>
          </div>
          <div className="mt-6 p-3 bg-terminal-warning/5 border border-terminal-warning/20 rounded flex items-start gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-terminal-warning mt-0.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            <p className="text-xs text-terminal-muted">This task is waiting for resource allocation in cluster <span className="text-white">US-EAST-2</span>.</p>
          </div>
          <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-terminal-border/30">
            <button className="px-3 py-1.5 text-xs text-terminal-muted hover:text-white border border-transparent hover:border-terminal-muted rounded transition-all">Cancel Task</button>
            <button className="px-3 py-1.5 text-xs bg-terminal-border/50 hover:bg-terminal-border text-white border border-terminal-border rounded transition-all">Prioritize</button>
          </div>
        </>
      )
    },
    {
      id: 'task-4',
      title: 'Sync cluster metadata',
      status: 'failed',
      duration: 'Retried 3x',
      content: (
        <>
          <div className="bg-red-950/30 border border-red-500/20 rounded p-4 mb-4">
            <div className="flex items-start gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 mt-0.5 shrink-0"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-red-400">Error Code: E_CONN_REFUSED</p>
                <p className="text-xs text-red-200/70">The remote host refused the connection on port 443. This usually indicates a firewall configuration issue or the service is down.</p>
              </div>
            </div>
          </div>

          <div className="details-grid text-xs mb-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.5rem' }}>
            <div className="space-y-1">
              <span className="text-terminal-muted block">lastAttempt</span>
              <span className="text-terminal-text">2023-10-24T10:05:00Z</span>
            </div>
            <div className="space-y-1">
              <span className="text-terminal-muted block">node</span>
              <span className="text-terminal-text">worker-us-west-1</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-terminal-border/30">
            <button className="px-3 py-1.5 text-xs text-terminal-muted hover:text-white border border-transparent hover:border-terminal-muted rounded transition-all">Ignore</button>
            <button className="px-3 py-1.5 text-xs bg-terminal-accent hover:bg-blue-600 text-white rounded transition-all shadow shadow-blue-900/20">Retry Task</button>
          </div>
        </>
      )
    }
  ];

  return (
    <div className="h-screen w-full overflow-hidden flex flex-col font-mono text-sm antialiased selection:bg-terminal-accent selection:text-white" style={{ backgroundColor: '#050507', color: '#E2E8F0' }}>
      <header className="h-16 border-b border-terminal-border bg-terminal-card/50 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-20">
        <div className="flex items-center gap-4">
          <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
          <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
          <div className="h-6 w-px bg-terminal-border mx-2"></div>
          <h1 className="font-semibold text-terminal-text tracking-tight flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-terminal-accent"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
            ORCHESTRATOR::CONSOLE
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-terminal-bg border border-terminal-border rounded px-3 py-1.5 gap-2 group focus-within:border-terminal-accent transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-terminal-muted group-focus-within:text-terminal-text"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" placeholder="Filter by taskId..." className="bg-transparent border-none outline-none text-xs w-48 placeholder-terminal-muted text-terminal-text" />
            <span className="text-[10px] text-terminal-muted border border-terminal-border px-1 rounded">⌘K</span>
          </div>

          <button className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-terminal-text bg-terminal-border/50 hover:bg-terminal-border rounded transition-colors border border-transparent hover:border-terminal-muted">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            Logs
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-terminal-accent hover:bg-blue-600 rounded transition-colors shadow-lg shadow-blue-900/20">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            Run Batch
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6" style={{
        scrollbarWidth: 'thin',
        scrollbarColor: '#1F2430 #0A0C10'
      }}>
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-terminal-card border border-terminal-border p-4 rounded-lg flex flex-col justify-between hover:border-terminal-muted transition-colors cursor-default group">
              <span className="text-terminal-muted text-xs uppercase tracking-wider font-semibold">Total Tasks</span>
              <div className="flex items-end justify-between mt-2">
                <span className="text-2xl font-bold text-white group-hover:text-terminal-accent transition-colors">124</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-terminal-muted mb-1"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
              </div>
            </div>
            <div className="bg-terminal-card border border-terminal-border p-4 rounded-lg flex flex-col justify-between hover:border-terminal-success transition-colors cursor-default group">
              <span className="text-terminal-muted text-xs uppercase tracking-wider font-semibold">Completed</span>
              <div className="flex items-end justify-between mt-2">
                <span className="text-2xl font-bold text-terminal-success">98</span>
                <div className="h-1.5 w-12 bg-gray-800 rounded-full overflow-hidden mb-2">
                  <div className="h-full bg-terminal-success w-[80%]"></div>
                </div>
              </div>
            </div>
            <div className="bg-terminal-card border border-terminal-border p-4 rounded-lg flex flex-col justify-between hover:border-blue-400 transition-colors cursor-default group">
              <span className="text-terminal-muted text-xs uppercase tracking-wider font-semibold">Active</span>
              <div className="flex items-end justify-between mt-2">
                <span className="text-2xl font-bold text-blue-400">12</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400 mb-1 animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
              </div>
            </div>
            <div className="bg-terminal-card border border-terminal-border p-4 rounded-lg flex flex-col justify-between hover:border-terminal-warning transition-colors cursor-default group">
              <span className="text-terminal-muted text-xs uppercase tracking-wider font-semibold">Queued</span>
              <div className="flex items-end justify-between mt-2">
                <span className="text-2xl font-bold text-terminal-warning">14</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-terminal-warning mb-1"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {tasks.map(task => (
              <TaskItem
                key={task.id}
                task={task}
                isExpanded={expandedTasks[task.id] || false}
                onToggle={() => toggleTask(task.id)}
              />
            ))}
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-8 flex justify-between text-[10px] text-terminal-muted uppercase tracking-wider font-semibold">
          <span>System Status: Operational</span>
          <span>v2.4.0-rc1</span>
        </div>
      </main>
    </div>
  );
};

const App = () => {
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');
      
      * {
        font-family: 'JetBrains Mono', monospace;
      }
      
      @keyframes stripe-flow {
        0% { background-position: 0 0; }
        100% { background-position: 40px 0; }
      }
      
      @keyframes pulse-glow {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      
      .animate-stripe-flow {
        animation: stripe-flow 2s linear infinite;
      }
      
      .animate-pulse-glow {
        animation: pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  return (
    <Router basename="/">
      <Routes>
        <Route path="/" element={<TaskManager />} />
      </Routes>
    </Router>
  );
};

export default App;
