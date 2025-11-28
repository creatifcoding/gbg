"use client"

import { useState, useEffect } from "react"
import { HolonetCanvas } from "./tldraw/holonet-canvas"
import { Tactical } from "./tactical/tactical-ui"
import { Crosshair, Settings, Terminal, User, Wifi, Zap } from "lucide-react"

export function HolonetLayout() {
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false)
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("COCKPIT")

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setCmdOpen((prev) => !prev)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault()
        setSettingsOpen((prev) => !prev)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const navTabs = ["COCKPIT", "STREAM", "LIBRARY", "BIO_EXPLOITS", "KSP-G MATRIX"]

  return (
    <div className="h-screen w-screen bg-neutral-950 text-neutral-400 font-mono flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-10 border-b border-neutral-800 flex items-center justify-between px-4 bg-black z-20 shrink-0">
        <div className="flex items-center gap-6">
          <button onClick={() => setLeftDrawerOpen(true)} className="p-1 hover:bg-neutral-900 transition-colors">
            <User size={14} className="text-neutral-600 hover:text-white" />
          </button>

          <div className="flex items-center gap-2">
            <Crosshair className="text-white" size={16} />
            <span className="text-[12px] text-white font-bold tracking-tight uppercase">TACTICAL_UI_KIT</span>
          </div>

          <nav className="hidden md:flex items-center gap-6 ml-4">
            {navTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-[10px] uppercase tracking-widest transition-colors ${
                  activeTab === tab ? "text-white" : "text-neutral-600 hover:text-neutral-400"
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex gap-2">
          <Tactical.Button size="xs" variant="outline" onClick={() => setCmdOpen(true)}>
            <Terminal size={10} /> CMD
          </Tactical.Button>
          <Tactical.Button size="xs" variant="ghost" onClick={() => setSettingsOpen(true)}>
            <Settings size={10} />
          </Tactical.Button>
          <Tactical.Button size="xs" variant="tactical" onClick={() => setRightDrawerOpen(true)}>
            <Zap size={10} /> ACTIONS
          </Tactical.Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Main canvas */}
        <main className="flex-1 relative">
          <div
            className="absolute inset-0 opacity-[0.015] pointer-events-none"
            style={{
              backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
              backgroundSize: "40px 40px",
            }}
          />
          <HolonetCanvas className="absolute inset-0" />
        </main>
      </div>

      <Tactical.StatusFooter status="connected" message="Canvas Ready" />

      <Tactical.LeftDrawer open={leftDrawerOpen} onClose={() => setLeftDrawerOpen(false)}>
        <Tactical.Drawer.Header title="ENTITY ANALYTICS" onClose={() => setLeftDrawerOpen(false)} />
        <Tactical.Drawer.Content className="space-y-6">
          <Tactical.Card label="AGENT DETAILS">
            <div className="space-y-4">
              <div className="w-full aspect-square border border-neutral-800 flex items-center justify-center">
                <User size={48} className="text-neutral-800" />
              </div>
              <div className="space-y-3 pt-2">
                <div>
                  <Tactical.LabelSmall>ID</Tactical.LabelSmall>
                  <Tactical.ID>009X3312</Tactical.ID>
                </div>
                <div>
                  <Tactical.LabelSmall>STATUS</Tactical.LabelSmall>
                  <div className="mt-1">
                    <Tactical.Badge variant="success">ACTIVE</Tactical.Badge>
                  </div>
                </div>
              </div>
            </div>
          </Tactical.Card>

          <Tactical.Drawer.Section title="METRICS">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Tactical.LabelSmall>Threat Level</Tactical.LabelSmall>
                <Tactical.Badge variant="critical">HIGH</Tactical.Badge>
              </div>
              <div className="flex justify-between items-center">
                <Tactical.LabelSmall>Signal Strength</Tactical.LabelSmall>
                <Tactical.Body>87%</Tactical.Body>
              </div>
              <div className="flex justify-between items-center">
                <Tactical.LabelSmall>Last Contact</Tactical.LabelSmall>
                <Tactical.Body>2m ago</Tactical.Body>
              </div>
            </div>
          </Tactical.Drawer.Section>
        </Tactical.Drawer.Content>
        <Tactical.Drawer.Footer>
          <Tactical.Stat value={62} unit="RPM" />
        </Tactical.Drawer.Footer>
      </Tactical.LeftDrawer>

      <Tactical.RightDrawer open={rightDrawerOpen} onClose={() => setRightDrawerOpen(false)}>
        <Tactical.Drawer.Header title="ACTIONS" onClose={() => setRightDrawerOpen(false)} />
        <Tactical.Drawer.Content className="space-y-4">
          <Tactical.Drawer.Section title="QUICK ACTIONS">
            <div className="space-y-2">
              <Tactical.Button variant="tactical" size="sm" className="w-full justify-start">
                <Zap size={10} /> Deploy Countermeasure
              </Tactical.Button>
              <Tactical.Button variant="tactical" size="sm" className="w-full justify-start">
                <Wifi size={10} /> Scan Frequency
              </Tactical.Button>
              <Tactical.Button variant="tactical" size="sm" className="w-full justify-start">
                <Crosshair size={10} /> Lock Target
              </Tactical.Button>
            </div>
          </Tactical.Drawer.Section>

          <Tactical.Separator />

          <Tactical.Drawer.Section title="LIVE OPERATIONS">
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Tactical.MissionCard key={i} code="Omega" description="Track high-value target in Eastern Europe." />
              ))}
            </div>
          </Tactical.Drawer.Section>
        </Tactical.Drawer.Content>
        <Tactical.Drawer.Footer>
          <div className="flex justify-between items-center">
            <Tactical.Badge variant="live">LIVE</Tactical.Badge>
            <Tactical.LabelSmall>3 Active Ops</Tactical.LabelSmall>
          </div>
        </Tactical.Drawer.Footer>
      </Tactical.RightDrawer>

      {/* Command Bar */}
      <Tactical.CommandBar open={cmdOpen} onClose={() => setCmdOpen(false)} />

      {/* Settings Modal */}
      <Tactical.Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="SETTINGS">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Tactical.Label>Dark Mode</Tactical.Label>
            <Tactical.Switch checked={true} onCheckedChange={() => {}} />
          </div>
          <Tactical.Separator />
          <div className="flex items-center justify-between">
            <Tactical.Label>Sound Effects</Tactical.Label>
            <Tactical.Switch checked={false} onCheckedChange={() => {}} />
          </div>
          <Tactical.Separator />
          <div className="flex items-center justify-between">
            <Tactical.Label>Animations</Tactical.Label>
            <Tactical.Switch checked={true} onCheckedChange={() => {}} />
          </div>
          <Tactical.Separator />
          <div className="space-y-2">
            <Tactical.Label>Log Duration (ms)</Tactical.Label>
            <Tactical.Input type="number" defaultValue="3000" />
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <Tactical.Button variant="ghost" size="sm" onClick={() => setSettingsOpen(false)}>
              Cancel
            </Tactical.Button>
            <Tactical.Button variant="primary" size="sm" onClick={() => setSettingsOpen(false)}>
              Save
            </Tactical.Button>
          </div>
        </div>
      </Tactical.Modal>
    </div>
  )
}
