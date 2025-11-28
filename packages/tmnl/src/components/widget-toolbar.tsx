import { Tmnl } from "@/components/tactical/tmnl-ui"
import { FileText, Terminal, BarChart3, SlidersHorizontal, StickyNote, X, Settings } from "lucide-react"

interface WidgetToolbarProps {
  position: { x: number; y: number }
  onSpawn: (type: string) => void
  onClose: () => void
}

export function WidgetToolbar({ position, onSpawn, onClose }: WidgetToolbarProps) {
  const widgets = [
    { type: "notes", icon: StickyNote, label: "Note" },
    { type: "textEditor", icon: FileText, label: "Text Editor" },
    { type: "terminal", icon: Terminal, label: "Terminal" },
    { type: "chartWidget", icon: BarChart3, label: "Chart" },
    { type: "parameterSetter", icon: SlidersHorizontal, label: "Controller" },
    { type: "settings", icon: Settings, label: "Settings" },
  ]

  return (
    <div
      className="fixed z-50 bg-black border border-neutral-800 p-2 shadow-lg"
      style={{ left: position.x, top: position.y }}
    >
      <div className="flex items-center justify-between mb-2">
        <Tmnl.Label>Spawn Widget</Tmnl.Label>
        <Tmnl.Button
          variant="ghost"
          size="icon"
          onClick={onClose}
        >
          <X size={10} />
        </Tmnl.Button>
      </div>
      <div className="grid grid-cols-1 gap-1">
        {widgets.map(({ type, icon: Icon, label }) => (
          <Tmnl.Button
            key={type}
            variant="ghost"
            size="sm"
            onClick={() => onSpawn(type)}
            className="flex justify-start items-center gap-2"
          >
            <Icon size={10} />
            {label}
          </Tmnl.Button>
        ))}
      </div>
    </div>
  )
}
