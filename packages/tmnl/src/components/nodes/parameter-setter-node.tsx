import { memo, useState } from "react"
import { Handle, Position, type NodeProps } from "reactflow"
import type { ParameterSetterNodeData, ParameterConfig } from "@/lib/types"
import { ChevronDown, Link2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { TmnlSlider } from "@/components/ui/tmnl-slider"
import { TmnlFader } from "@/components/ui/tmnl-fader"
import { TmnlKnob } from "@/components/ui/tmnl-knob"

const renderParameterControl = (
  key: string,
  config: ParameterConfig,
  currentValue: any,
  allParams: Record<string, any>,
  onChange: (key: string, value: any) => void,
) => {
  if (config.hidden) return null

  switch (config.type) {
    case "range":
      const ControlComponent =
        {
          slider: TmnlSlider,
          fader: TmnlFader,
          knob: TmnlKnob,
        }[config.control || "slider"] || TmnlSlider

      return (
        <div className="space-y-1 flex flex-col items-center">
          <label className="text-xs font-medium text-green-300 flex justify-between w-full">
            <span>{config.label}</span>
            <span className="font-mono" style={{ color: allParams.lineColor }}>
              {currentValue}
            </span>
          </label>
          <ControlComponent
            min={config.min}
            max={config.max}
            step={config.step}
            value={currentValue}
            onChange={(newValue: number) => onChange(key, newValue)}
            thumbColor={allParams.lineColor}
            ariaLabel={config.label}
          />
        </div>
      )
    case "color":
      return (
        <div className="space-y-2">
          <label className="text-xs font-medium text-green-300">{config.label}</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={currentValue}
              onChange={(e) => onChange(key, e.target.value)}
              className="w-8 h-8 p-0 border-none rounded cursor-pointer bg-transparent"
            />
            <input
              type="text"
              value={currentValue}
              onChange={(e) => onChange(key, e.target.value)}
              className="flex-1 px-2 py-1 text-xs bg-gray-900 border border-green-400/30 rounded text-green-300"
            />
          </div>
        </div>
      )
    case "boolean":
      return (
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-green-300">{config.label}</label>
          <button
            onClick={() => onChange(key, !currentValue)}
            className={cn(
              "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out",
              currentValue ? "bg-green-600" : "bg-gray-600",
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                currentValue ? "translate-x-4" : "translate-x-0",
              )}
            />
          </button>
        </div>
      )
    default:
      return null
  }
}

function ParameterSetterNode({ data, id }: NodeProps<ParameterSetterNodeData>) {
  const [isExpanded, setIsExpanded] = useState(true)
  const isConnected = !!data.connectedComponentId

  return (
    <div
      className={cn(
        "min-w-[240px] bg-gray-900/80 backdrop-blur-md border-2 rounded-lg shadow-lg",
        isConnected ? "border-purple-500 shadow-purple-500/20" : "border-green-400/30",
      )}
    >
      <div className="relative h-10 flex items-center px-3">
        <h3 className="font-bold text-green-400 text-sm">{data.title}</h3>
        {isConnected && <span className="ml-auto mr-8 text-xs font-mono text-purple-400 animate-pulse">LINKED</span>}
        <button
          onClick={() => setIsExpanded((p) => !p)}
          className="absolute top-1/2 -translate-y-1/2 right-2 w-6 h-6 flex items-center justify-center"
        >
          <ChevronDown className={cn("w-4 h-4 text-green-400 transition-transform", isExpanded && "rotate-180")} />
        </button>
      </div>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300",
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="px-3 pb-3">
            {isConnected && data.componentMetadata ? (
              <div className="space-y-3">
                {Object.entries(data.componentMetadata.parameters).map(([key, config]) => (
                  <div key={key}>
                    {renderParameterControl(
                      key,
                      config,
                      data.componentMetadata?.parameters[key].value,
                      data.componentMetadata?.parameters,
                      (paramKey, value) =>
                        data.onParameterChange(id, paramKey, value, data.componentMetadata?.parameters || {}),
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-green-600 py-4 flex flex-col items-center gap-2 font-mono text-xs">
                <Link2 className="w-5 h-5" />
                <span>Awaiting Link...</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-gray-900 !border-2 !border-purple-500" />
    </div>
  )
}

export default memo(ParameterSetterNode)