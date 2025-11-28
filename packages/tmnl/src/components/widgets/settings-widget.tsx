import type { NodeProps } from "reactflow"
import type { SettingsData } from "@/lib/types"
import { Settings } from "lucide-react"

export function SettingsWidget({ data }: NodeProps<SettingsData>) {
  const { settings, onSettingsChange } = data

  return (
    <div className="bg-gray-900 border border-green-400/30 rounded-lg p-4 min-w-[300px] shadow-lg shadow-green-400/10">
      <div className="text-green-400 font-mono text-lg mb-4 flex items-center gap-2">
        <Settings className="w-5 h-5 animate-spin" style={{ animationDuration: "10s" }} />
        Global Settings
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-green-300 flex justify-between">
            <span>Log Text Duration</span>
            <span className="font-mono text-green-400">{settings.logDuration}s</span>
          </label>
          <input
            type="range"
            min={1}
            max={10}
            step={0.5}
            value={settings.logDuration}
            onChange={(e) => onSettingsChange({ ...settings, logDuration: Number(e.target.value) })}
            className="w-full themed-slider"
          />
        </div>
      </div>
      <div className="text-xs text-center text-green-700 mt-4">
        Press{" "}
        <kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">
          Cmd/Ctrl
        </kbd>{" "}
        +{" "}
        <kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">
          ,
        </kbd>{" "}
        to toggle.
      </div>
    </div>
  )
}