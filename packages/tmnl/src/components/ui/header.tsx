/**
 * @file Header.tsx
 * @description Renders the top header bar of the application.
 * It is now mobile-responsive, hiding text labels on smaller screens.
 *
 * AI Adaptation Notes:
 * - Responsive classes (`hidden md:inline`) are used to adapt the UI for mobile.
 *   This is a standard Tailwind CSS practice.
 */
"use client"

import { PanelLeft, PanelRight, Save, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"

interface HeaderProps {
  onToggleSidebar: () => void
  onToggleDrawer: () => void
}

export function Header({ onToggleSidebar, onToggleDrawer }: HeaderProps) {
  const toolbarActions = [
    { icon: Save, label: "Save State" },
    { icon: Upload, label: "Load State" },
  ]

  return (
    <header className="h-14 flex items-center justify-between px-2 md:px-4 border-b border-green-400/20 bg-gray-900/50 backdrop-blur-sm z-20 flex-shrink-0">
      <div className="flex items-center gap-2 md:gap-4">
        <Button variant="ghost" size="icon" onClick={onToggleSidebar} className="text-green-400 hover:bg-green-400/10">
          <PanelLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg md:text-xl font-bold text-green-400" style={{ textShadow: "0 0 5px #00ff41" }}>
          Holonet Terminal
        </h1>
      </div>
      <div className="flex items-center gap-1 md:gap-2">
        {toolbarActions.map((action) => (
          <Button
            key={action.label}
            variant="ghost"
            size="sm"
            className="text-green-400 hover:bg-green-400/10"
            title={action.label}
          >
            <action.icon className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">{action.label}</span>
          </Button>
        ))}
        <Button variant="ghost" size="icon" onClick={onToggleDrawer} className="text-green-400 hover:bg-green-400/10">
          <PanelRight className="h-5 w-5" />
        </Button>
      </div>
    </header>
  )
}
