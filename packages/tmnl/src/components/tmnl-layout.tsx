import { useState, useEffect } from 'react';
import { TmnlCanvas } from './tldraw/tmnl-canvas';
import { Tmnl } from './tactical/tmnl-ui';
import { Crosshair, Settings, Terminal, User, Wifi, Zap } from 'lucide-react';

export function TmnlLayout() {
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('COCKPIT');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setSettingsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navTabs = [
    'COCKPIT',
    'STREAM',
    'LIBRARY',
    'BIO_EXPLOITS',
    'KSP-G MATRIX',
  ];

  return (
    <div className="h-screen w-screen bg-neutral-950 text-neutral-400 font-mono flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-10 border-b border-neutral-800 flex items-center justify-between px-4 bg-black z-20 shrink-0">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setLeftDrawerOpen(true)}
            className="p-1 hover:bg-neutral-900 transition-colors"
          >
            <User size={14} className="text-neutral-600 hover:text-white" />
          </button>

          <div className="flex items-center gap-2">
            <Crosshair className="text-white" size={16} />
            <span className="text-[12px] text-white font-bold tracking-tight uppercase">
              TMNL_UI_KIT
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 ml-4">
            {navTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`tmnl-type-nav ${
                  activeTab === tab
                    ? 'tmnl-type-nav-active'
                    : ''
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex gap-2">
          <Tmnl.Button
            size="xs"
            variant="outline"
            onClick={() => setCmdOpen(true)}
          >
            <Terminal size={10} /> CMD
          </Tmnl.Button>
          <Tmnl.Button
            size="xs"
            variant="ghost"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings size={10} />
          </Tmnl.Button>
          <Tmnl.Button
            size="xs"
            variant="tmnl"
            onClick={() => setRightDrawerOpen(true)}
          >
            <Zap size={10} /> ACTIONS
          </Tmnl.Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Main canvas */}
        <main className="flex-1 relative">
          <div
            className="absolute inset-0 opacity-[0.015] pointer-events-none"
            style={{
              backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
              backgroundSize: '40px 40px',
            }}
          />
          <TmnlCanvas className="absolute inset-0" />
        </main>
      </div>

      <Tmnl.StatusFooter status="connected" message="Canvas Ready" />

      <Tmnl.LeftDrawer
        open={leftDrawerOpen}
        onClose={() => setLeftDrawerOpen(false)}
      >
        <Tmnl.Drawer.Header
          title="ENTITY ANALYTICS"
          onClose={() => setLeftDrawerOpen(false)}
        />
        <Tmnl.Drawer.Content className="space-y-6">
          <Tmnl.Card label="AGENT DETAILS">
            <div className="space-y-4">
              <div className="w-full aspect-square border border-neutral-800 flex items-center justify-center">
                <User size={48} className="text-neutral-800" />
              </div>
              <div className="space-y-3 pt-2">
                <div>
                  <Tmnl.LabelSmall>ID</Tmnl.LabelSmall>
                  <Tmnl.ID>009X3312</Tmnl.ID>
                </div>
                <div>
                  <Tmnl.LabelSmall>STATUS</Tmnl.LabelSmall>
                  <div className="mt-1">
                    <Tmnl.Badge variant="success">ACTIVE</Tmnl.Badge>
                  </div>
                </div>
              </div>
            </div>
          </Tmnl.Card>

          <Tmnl.Drawer.Section title="METRICS">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Tmnl.LabelSmall>Threat Level</Tmnl.LabelSmall>
                <Tmnl.Badge variant="critical">HIGH</Tmnl.Badge>
              </div>
              <div className="flex justify-between items-center">
                <Tmnl.LabelSmall>Signal Strength</Tmnl.LabelSmall>
                <Tmnl.Body>87%</Tmnl.Body>
              </div>
              <div className="flex justify-between items-center">
                <Tmnl.LabelSmall>Last Contact</Tmnl.LabelSmall>
                <Tmnl.Body>2m ago</Tmnl.Body>
              </div>
            </div>
          </Tmnl.Drawer.Section>
        </Tmnl.Drawer.Content>
        <Tmnl.Drawer.Footer>
          <Tmnl.Stat value={62} unit="RPM" />
        </Tmnl.Drawer.Footer>
      </Tmnl.LeftDrawer>

      <Tmnl.RightDrawer
        open={rightDrawerOpen}
        onClose={() => setRightDrawerOpen(false)}
      >
        <Tmnl.Drawer.Header
          title="ACTIONS"
          onClose={() => setRightDrawerOpen(false)}
        />
        <Tmnl.Drawer.Content className="space-y-4">
          <Tmnl.Drawer.Section title="QUICK ACTIONS">
            <div className="space-y-2">
              <Tmnl.Button
                variant="tmnl"
                size="sm"
                className="w-full justify-start"
              >
                <Zap size={10} /> Deploy Countermeasure
              </Tmnl.Button>
              <Tmnl.Button
                variant="tmnl"
                size="sm"
                className="w-full justify-start"
              >
                <Wifi size={10} /> Scan Frequency
              </Tmnl.Button>
              <Tmnl.Button
                variant="tmnl"
                size="sm"
                className="w-full justify-start"
              >
                <Crosshair size={10} /> Lock Target
              </Tmnl.Button>
            </div>
          </Tmnl.Drawer.Section>

          <Tmnl.Separator />

          <Tmnl.Drawer.Section title="LIVE OPERATIONS">
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Tmnl.MissionCard
                  key={i}
                  code="Omega"
                  description="Track high-value target in Eastern Europe."
                />
              ))}
            </div>
          </Tmnl.Drawer.Section>
        </Tmnl.Drawer.Content>
        <Tmnl.Drawer.Footer>
          <div className="flex justify-between items-center">
            <Tmnl.Badge variant="live">LIVE</Tmnl.Badge>
            <Tmnl.LabelSmall>3 Active Ops</Tmnl.LabelSmall>
          </div>
        </Tmnl.Drawer.Footer>
      </Tmnl.RightDrawer>

      {/* Command Bar */}
      <Tmnl.CommandBar open={cmdOpen} onClose={() => setCmdOpen(false)} />

      {/* Settings Modal */}
      <Tmnl.Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="SETTINGS"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Tmnl.Label>Dark Mode</Tmnl.Label>
            <Tmnl.Switch checked={true} onCheckedChange={() => {}} />
          </div>
          <Tmnl.Separator />
          <div className="flex items-center justify-between">
            <Tmnl.Label>Sound Effects</Tmnl.Label>
            <Tmnl.Switch checked={false} onCheckedChange={() => {}} />
          </div>
          <Tmnl.Separator />
          <div className="flex items-center justify-between">
            <Tmnl.Label>Animations</Tmnl.Label>
            <Tmnl.Switch checked={true} onCheckedChange={() => {}} />
          </div>
          <Tmnl.Separator />
          <div className="space-y-2">
            <Tmnl.Label>Log Duration (ms)</Tmnl.Label>
            <Tmnl.Input type="number" defaultValue="3000" />
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <Tmnl.Button
              variant="ghost"
              size="sm"
              onClick={() => setSettingsOpen(false)}
            >
              Cancel
            </Tmnl.Button>
            <Tmnl.Button
              variant="primary"
              size="sm"
              onClick={() => setSettingsOpen(false)}
            >
              Save
            </Tmnl.Button>
          </div>
        </div>
      </Tmnl.Modal>
    </div>
  );
}
