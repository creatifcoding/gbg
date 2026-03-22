import React, { useState } from 'react';

// TODO[customStyles]:
const customStyles = {
  root: {
    '--bg-dark': '#050505',
    '--bg-card': '#0A0A0A',
    '--bg-hover': '#121212',
    '--border': '#1F1F1F',
    '--accent-green': '#00FF94',
    '--accent-blue': '#00E1FF',
    '--text-main': '#E5E5E5',
    '--text-dim': '#6B7280',
  },
};

const tasks = [
  {
    id: 'iso-shell-01',
    title: 'Hydrate shell bands',
    status: 'COMPLETED',
    progress: 100,
    details: {
      assignmentMode: '-',
      assignedAgentId: 'agt-alpha-09',
      claimedBy: 'system-worker-01',
      sessionId: 'sess-8829-x',
      nodeId: 'node-us-east-1a',
      toolCallId: 'tc-992837',
      toolName: 'shell_exec',
      lastSeq: '442',
      createdAt: '2023-10-24T08:00:00Z',
      updatedAt: '2023-10-24T08:00:15Z',
      'metadata.phase': 'init',
      'metadata.owner': 'root',
      'metadata.deliverable': 'core-bundle',
      'metadata.note': 'Optimization complete',
    },
  },
  {
    id: 'iso-msg-02',
    title: 'Attach message shell compounds',
    status: 'RUNNING',
    progress: 65,
    details: {
      assignmentMode: 'auto',
      assignedAgentId: 'agt-beta-12',
      claimedBy: 'system-worker-02',
      sessionId: 'sess-9912-y',
      nodeId: 'node-us-east-1b',
      toolCallId: 'tc-992838',
      toolName: 'msg_bus_attach',
      lastSeq: '102',
      createdAt: '2023-10-24T08:01:00Z',
      updatedAt: '2023-10-24T08:01:45Z',
      'metadata.phase': 'processing',
      'metadata.owner': 'service-bus',
      'metadata.deliverable': 'msg-queue',
      'metadata.note': 'High latency detected',
    },
  },
  {
    id: 'iso-trans-03',
    title: 'Finalize transport actions',
    status: 'QUEUED',
    progress: 0,
    details: {
      assignmentMode: '-',
      assignedAgentId: '-',
      claimedBy: '-',
      sessionId: '-',
      nodeId: '-',
      toolCallId: '-',
      toolName: '-',
      lastSeq: '-',
      createdAt: '-',
      updatedAt: '-',
      'metadata.phase': 'pending',
      'metadata.owner': '-',
      'metadata.deliverable': '-',
      'metadata.note': '-',
    },
  },
  {
    id: 'iso-sec-04',
    title: 'Security handshake protocol',
    status: 'QUEUED',
    progress: 0,
    details: {},
  },
  {
    id: 'iso-net-05',
    title: 'Network latency optimization check',
    status: 'FAILED',
    progress: 45,
    details: {
      assignmentMode: 'manual',
      error: 'Timeout exceeded (5000ms)',
    },
  },
];

// NOTE: I actually like this utility, it's possible that we have this accounted for in our code.
const getStatusColor = (status) => {
  switch (status) {
    case 'COMPLETED':
      return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    case 'RUNNING':
      return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20 status-glow-blue';
    case 'QUEUED':
      return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20';
    case 'FAILED':
      return 'text-red-400 bg-red-500/10 border-red-500/20';
    default:
      return 'text-zinc-400';
  }
};

// NOTE: The same for this utility, very nice, I'd like you to factor it into our code as well
const getStatusIcon = (status) => {
  switch (status) {
    case 'COMPLETED':
      return (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M5 13l4 4L19 7"
          ></path>
        </svg>
      );
    case 'RUNNING':
      return (
        <svg
          className="w-4 h-4 animate-spin"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          ></path>
        </svg>
      );
    case 'QUEUED':
      return (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          ></path>
        </svg>
      );
    case 'FAILED':
      return (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M6 18L18 6M6 6l12 12"
          ></path>
        </svg>
      );
  }
};

// TODO: We have a RvnInlineTaskRow. This is the loose mapping. Again its not as 1-to-1. Fill in the gaps. Componentize.
const TaskItem = ({ task, index, isExpanded, onToggle }) => {
  const [copied, setCopied] = useState(null);

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="group flex flex-col border border-zinc-800 bg-[#0A0A0A] rounded-md transition-all duration-200 hover:border-zinc-700 overflow-hidden">
      <div
        className="flex items-center gap-4 p-3 cursor-pointer select-none relative overflow-hidden"
        onClick={onToggle}
      >
        <div className="text-zinc-600 cursor-move hover:text-zinc-400">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 8h16M4 16h16"
            ></path>
          </svg>
        </div>
        <div className="flex-1 font-medium text-sm text-zinc-200 flex items-center gap-3">
          <span className="text-zinc-500 text-xs font-normal font-mono opacity-50">
            #{index + 1}
          </span>
          {task.title}
        </div>
        <div className="flex items-center gap-6">
          {task.status === 'RUNNING' && (
            <span className="text-xs font-mono text-cyan-400">
              {task.progress}%
            </span>
          )}
          <div
            className={`flex items-center gap-2 px-2.5 py-1 rounded text-[10px] font-bold tracking-wider border ${getStatusColor(
              task.status
            )}`}
          >
            {getStatusIcon(task.status)}
            {task.status}
          </div>
          <div
            className={`transform transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          >
            <svg
              className="w-4 h-4 text-zinc-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 9l-7 7-7-7"
              ></path>
            </svg>
          </div>
        </div>
        {task.status === 'RUNNING' && (
          <div className="absolute bottom-0 left-0 h-[2px] bg-cyan-900 w-full opacity-50">
            <div
              className="h-full bg-cyan-400 transition-all duration-1000"
              style={{
                width: `${task.progress}%`,
                backgroundImage:
                  'linear-gradient(45deg, rgba(255, 255, 255, 0.15) 25%, transparent 25%, transparent 50%, rgba(255, 255, 255, 0.15) 50%, rgba(255, 255, 255, 0.15) 75%, transparent 75%, transparent)',
                backgroundSize: '1rem 1rem',
                animation: 'progress-stripes 1s linear infinite',
              }}
            ></div>
          </div>
        )}
        {task.status === 'COMPLETED' && (
          <div className="absolute bottom-0 left-0 h-[1px] bg-emerald-500/30 w-full"></div>
        )}
      </div>

      <div
        className="bg-[#080808] border-t border-zinc-800/50 overflow-hidden transition-all duration-300"
        style={{
          display: 'grid',
          gridTemplateRows: isExpanded ? '1fr' : '0fr',
        }}
      >

              { /* Split. */ }
        <div style={{ overflow: 'hidden' }}>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-4 p-6 border-b border-zinc-900 border-dashed">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-zinc-500 uppercase font-bold">
                Task ID
              </span>
              <div className="font-mono text-sm text-white bg-zinc-900 px-2 py-1 rounded border border-zinc-800 w-fit">
                {task.id}
              </div>
            </div>
            <div className="flex flex-col gap-1 col-span-2">
              <span className="text-[10px] text-zinc-500 uppercase font-bold">
                Title
              </span>
              <div className="font-mono text-sm text-zinc-300">
                {task.title}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-zinc-500 uppercase font-bold">
                Status
              </span>
              <div
                className={`font-mono text-sm ${
                  task.status === 'COMPLETED'
                    ? 'text-emerald-400'
                    : task.status === 'RUNNING'
                    ? 'text-cyan-400'
                    : 'text-zinc-400'
                }`}
              >
                {task.status}
              </div>
            </div>

          { /* TODO: Need this, RvnInlineTaskExpandedRowProgressBar or something. All of the buttons are basically the same (until they're not) we ought to give ourselves a generic button that you offer up variants for the appearance and action logic. Obviously the action props aren't implemented quite yet, but as you can imagine, progress will be a Atom.subscribable from a task based atom..*// }
            <div className="flex flex-col gap-1">
              { /* e.g. split here. */ }
              <span className="text-[10px] text-zinc-500 uppercase font-bold">
                Progress
              </span>
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      task.status === 'RUNNING'
                        ? 'bg-cyan-400'
                        : 'bg-emerald-500'
                    }`}
                    style={{
                      width: `${task.progress}%`,
                      ...(task.status === 'RUNNING' && {
                        backgroundImage:
                          'linear-gradient(45deg, rgba(255, 255, 255, 0.15) 25%, transparent 25%, transparent 50%, rgba(255, 255, 255, 0.15) 50%, rgba(255, 255, 255, 0.15) 75%, transparent 75%, transparent)',
                        backgroundSize: '1rem 1rem',
                        animation: 'progress-stripes 1s linear infinite',
                      }),
                    }}
                  ></div>
                </div>
                <span className="text-xs text-zinc-400">{task.progress}%</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 p-6">
            {/* TODO: We have elite schema destructuring at home LOL. */}
            {Object.entries(task.details).map(([key, value]) => (
              <div
                key={key}
                className="kv-group flex flex-col gap-1 p-2 rounded hover:bg-zinc-800/30 transition-colors group/item relative"
              >
                <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wide flex justify-between">
                  {key.replace('metadata.', 'meta.')}
                </div>
                <div className="text-xs text-zinc-300 font-mono truncate flex items-center gap-2">
                  <span className="truncate" title={value}>
                    {value}
                  </span>
                  {value !== '-' && (
                    <button
                      className="copy-icon text-zinc-600 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(value, key);
                      }}
                      title="Copy"
                    >
                      {copied === key ? (
                        <svg
                          className="w-3 h-3 text-emerald-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M5 13l4 4L19 7"
                          ></path>
                        </svg>
                      ) : (
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          ></path>
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          { /* TODO: Need this, RvnInlineTaskExpandedRowToolbar or something. you get the idea. You can give it a better name. But this *// }
          <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-zinc-800/50 bg-[#070707]">

          { /* TODO: Need this, RvnInlineTaskRowExpandedToolbarButton or something. All of the buttons are basically the same (until they're not) we ought to give ourselves a generic button that you offer up variants for the appearance and action logic. Obviously the action props aren't implemented quite yet, but as you can imagine, it'll be an Atom operation..*// }
            <button className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors flex items-center gap-2">
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                ></path>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                ></path>
              </svg>
              View Logs
            </button>
            <button className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors flex items-center gap-2">
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                ></path>
              </svg>
              Retry
            </button>
            <button className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors flex items-center gap-2">
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                ></path>
              </svg>
              Abort
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const [expandedTasks, setExpandedTasks] = useState({ 'iso-shell-01': true });

  const toggleTask = (taskId) => {
    setExpandedTasks((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  return (
    <div
      className="w-full h-screen overflow-hidden flex flex-col items-center justify-center p-4 relative bg-[#050505] text-[#E5E5E5]"
      style={customStyles.root}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        
        body {
          font-family: 'JetBrains Mono', monospace;
        }

        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #050505; 
        }
        ::-webkit-scrollbar-thumb {
          background: #333; 
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #444; 
        }

        @keyframes progress-stripes {
          from { background-position: 1rem 0; }
          to { background-position: 0 0; }
        }

        .status-glow-blue {
          box-shadow: 0 0 10px rgba(0, 225, 255, 0.2);
          animation: pulse-blue 2s infinite;
        }

        @keyframes pulse-blue {
          0% { box-shadow: 0 0 0 0 rgba(0, 225, 255, 0.2); }
          70% { box-shadow: 0 0 0 6px rgba(0, 225, 255, 0); }
          100% { box-shadow: 0 0 0 0 rgba(0, 225, 255, 0); }
        }

        .scanline {
          background: linear-gradient(
            to bottom,
            rgba(255,255,255,0),
            rgba(255,255,255,0) 50%,
            rgba(0,0,0,0.1) 50%,
            rgba(0,0,0,0.1)
          );
          background-size: 100% 4px;
          pointer-events: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 50;
          opacity: 0.15;
        }
      `,
        }}
      />

      <div className="scanline"></div>

      {/* TODO: This is the part that is rife for the componentization. This is where I am seeing where we can split on e.g. the header band.*/}
      <div className="w-full max-w-7xl h-[90vh] flex flex-col bg-[#0A0A0A] border border-zinc-800 rounded-lg shadow-2xl overflow-hidden relative z-10">
        <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-[#0F0F0F]">
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
              <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
            </div>
            <div className="h-4 w-[1px] bg-zinc-700 mx-2"></div>
            <h1 className="text-sm font-semibold text-zinc-300 tracking-wide uppercase flex items-center gap-2">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                ></path>
              </svg>
              Task Runner <span className="text-zinc-600">v2.4.0</span>
            </h1>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2 text-zinc-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              System Online
            </div>
            <button className="px-3 py-1.5 hover:bg-zinc-800 rounded border border-transparent hover:border-zinc-700 transition-colors text-zinc-400 hover:text-white">
              Clear Logs
            </button>
            <button className="px-3 py-1.5 bg-zinc-100 text-zinc-900 rounded font-bold hover:bg-white transition-colors">
              + New Task
            </button>
          </div>
        </header>

        {/* TODO: Metrics band!! */}
        <div className="grid grid-cols-4 border-b border-zinc-800 divide-x divide-zinc-800 bg-[#0D0D0D]">
          <div className="px-6 py-3">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1">
              Total Tasks
            </div>
            <div className="text-xl font-medium text-white">12</div>
          </div>
          <div className="px-6 py-3">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1">
              Running
            </div>
            <div className="text-xl font-medium text-cyan-400">1</div>
          </div>
          <div className="px-6 py-3">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1">
              Completed
            </div>
            <div className="text-xl font-medium text-emerald-400">8</div>
          </div>
          <div className="px-6 py-3">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1">
              Success Rate
            </div>
            <div className="text-xl font-medium text-white">94%</div>
          </div>
        </div>

        {/* TODO: Inline Task Row. band!! */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#050505]">
          {/* NOTE: I would like to explicitly engineer this mapping function.
Currently we're doing some virtualized list rendering stuff, but, frankly, I don't think I fully  */}
          {tasks.map((task, index) => (
            <TaskItem
              key={task.id}
              task={task}
              index={index}
              isExpanded={expandedTasks[task.id]}
              onToggle={() => toggleTask(task.id)}
            />
          ))}
        </div>

        <div className="p-3 border-t border-zinc-800 bg-[#0A0A0A] flex items-center gap-2 text-sm text-zinc-400">
          <span className="text-emerald-500">❯</span>
          <input
            type="text"
            placeholder="Type a command to filter or execute..."
            className="bg-transparent border-none outline-none flex-1 text-zinc-300 placeholder-zinc-600 font-mono h-full py-1"
          />
          <div className="flex gap-2 text-[10px] text-zinc-600 font-bold">
            <span className="px-1.5 py-0.5 border border-zinc-800 rounded">
              ESC
            </span>
            <span className="px-1.5 py-0.5 border border-zinc-800 rounded">
              CTRL+C
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
