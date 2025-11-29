import type React from 'react';

import {
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
  type TLBaseShape,
  type TLResizeInfo,
  resizeBox,
  stopEventPropagation,
  useEditor,
} from 'tldraw';
import { useState, useRef, useCallback } from 'react';
import { ChevronDown, Link2, Activity, FileText, Terminal, Sliders, Unlink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type EntityMetadata, type ParameterConfig, ChartMetadataTemplate, normalizeParameters } from '@/lib/types';
import { Tmnl } from '@/components/tactical/tmnl-ui';

// ============================================
// CHART WIDGET SHAPE
// Implements IControllable interface contract
// ============================================
export type ChartWidgetShape = TLBaseShape<
  "chart-widget",
  {
    w: number
    h: number
    entityId: string
    metadata: EntityMetadata
    parameters: Record<string, any>
    chartData: number[]
  }
>

export class ChartWidgetShapeUtil extends BaseBoxShapeUtil<ChartWidgetShape> {
  static override type = "chart-widget" as const
  static override props = {
    w: T.number,
    h: T.number,
    entityId: T.string,
    metadata: T.any,
    parameters: T.any,
    chartData: T.arrayOf(T.number),
  }

  override canResize() {
    return true
  }
  override canEdit() {
    return false
  }

  getDefaultProps(): ChartWidgetShape["props"] {
    const entityId = `chart-${Date.now()}`
    return {
      w: 200,
      h: 140,
      entityId,
      metadata: ChartMetadataTemplate,
      parameters: normalizeParameters(ChartMetadataTemplate),
      chartData: [],
    }
  }

  override onResize(shape: ChartWidgetShape, info: TLResizeInfo<ChartWidgetShape>) {
    return resizeBox(shape, info)
  }

  override component(shape: ChartWidgetShape) {
    const { chartData, parameters, metadata } = shape.props
    const { lineColor, barSpacing, amplitude } = parameters
    const maxValue = amplitude || 100

    return (
      <HTMLContainer id={shape.id} style={{ width: "100%", height: "100%", pointerEvents: "all" }}>
        <div className="w-full h-full bg-black border border-neutral-800 flex flex-col overflow-hidden group">
          {/* Header */}
          <div className="h-5 flex-shrink-0 flex items-center px-2 border-b border-neutral-800 bg-neutral-900/30">
            <Activity size={10} className="text-neutral-600 mr-1.5" />
            <span className="text-[8px] font-mono uppercase tracking-widest text-neutral-500 group-hover:text-white transition-colors">
              {metadata.name}
            </span>
            <div className="ml-auto flex items-center gap-1">
              <span className="text-[7px] font-mono text-neutral-600 uppercase">Live</span>
              <div className="w-1.5 h-1.5 bg-red-500 animate-pulse" />
            </div>
          </div>

          {/* Chart Area */}
          <div className="flex-1 p-1.5 min-h-0">
            <div className="w-full h-full bg-neutral-950 border border-neutral-900 flex items-end overflow-hidden relative">
              {/* Corner decorations */}
              <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-neutral-700" />
              <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-neutral-700" />

              {chartData.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-[7px] font-mono uppercase text-neutral-700 tracking-widest">
                    AWAITING SIGNAL
                  </span>
                </div>
              ) : (
                chartData.map((value, i) => (
                  <div
                    key={i}
                    className="transition-all duration-100"
                    style={{
                      height: `${Math.min(100, (value / maxValue) * 100)}%`,
                      backgroundColor: lineColor,
                      flex: 1,
                      minWidth: 2,
                      marginRight: barSpacing,
                      opacity: 0.85,
                      boxShadow: `0 0 4px ${lineColor}40`,
                    }}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </HTMLContainer>
    )
  }

  override indicator(shape: ChartWidgetShape) {
    return <rect x={0} y={0} width={shape.props.w} height={shape.props.h} />
  }
}

// ============================================
// CONTROLLER WIDGET SHAPE
// Implements IController interface contract
// ============================================
export type ControllerWidgetShape = TLBaseShape<
  "controller-widget",
  {
    w: number
    h: number
    controllerId: string
    visitorId: string
    targetId: string | null
    targetMetadata: EntityMetadata | null
    isExpanded: boolean
  }
>

function ControllerComponent({ shape }: { shape: ControllerWidgetShape }) {
  const editor = useEditor()
  const { controllerId, targetId, targetMetadata, isExpanded } = shape.props
  const isConnected = !!targetId

  const handleParameterChange = useCallback(
    (key: string, value: any) => {
      if (!targetId || !targetMetadata) return

      // Get target shape and update its parameters
      const targetShape = editor.getShape(targetId as any) as ChartWidgetShape | undefined
      if (!targetShape || targetShape.type !== "chart-widget") return

      const currentParams = { ...targetShape.props.parameters }
      currentParams[key] = value

      // Handle syncGlow special case
      if (key === "syncGlow" && value) {
        currentParams.glowColor = currentParams.lineColor
      }
      if (key === "lineColor" && currentParams.syncGlow) {
        currentParams.glowColor = value
      }

      // Update target chart
      editor.updateShape<ChartWidgetShape>({
        id: targetId as any,
        type: "chart-widget",
        props: { parameters: currentParams },
      })

      // Update local metadata to reflect changes
      const updatedMeta = JSON.parse(JSON.stringify(targetMetadata))
      Object.keys(updatedMeta.parameters).forEach((k) => {
        updatedMeta.parameters[k].value = currentParams[k]
      })
      if (key === "syncGlow") {
        updatedMeta.parameters.glowColor.hidden = value
      }

      editor.updateShape<ControllerWidgetShape>({
        id: shape.id,
        type: "controller-widget",
        props: { targetMetadata: updatedMeta },
      })
    },
    [editor, shape.id, targetId, targetMetadata],
  )

  const handleUnlink = useCallback(() => {
    editor.updateShape<ControllerWidgetShape>({
      id: shape.id,
      type: "controller-widget",
      props: { targetId: null, targetMetadata: null },
    })
  }, [editor, shape.id])

  const toggleExpanded = useCallback(() => {
    editor.updateShape<ControllerWidgetShape>({
      id: shape.id,
      type: "controller-widget",
      props: { isExpanded: !isExpanded },
    })
  }, [editor, shape.id, isExpanded])

  const renderControl = (key: string, config: ParameterConfig) => {
    if (config.hidden) return null
    const currentValue = config.value ?? config.defaultValue

    switch (config.type) {
      case "range":
        if (config.control === "knob") {
          return (
            <div key={key} onPointerDown={stopEventPropagation}>
              <Tmnl.Controller.Knob
                value={currentValue}
                min={config.min}
                max={config.max}
                onChange={(v) => handleParameterChange(key, v)}
                label={config.label}
                size={32}
              />
            </div>
          )
        } else if (config.control === "fader") {
          return (
            <div key={key} onPointerDown={stopEventPropagation}>
              <Tmnl.Controller.Fader
                value={currentValue}
                min={config.min}
                max={config.max}
                step={config.step}
                onChange={(v) => handleParameterChange(key, v)}
                label={config.label}
                height={50}
              />
            </div>
          )
        }
        return (
          <div key={key} className="w-full" onPointerDown={stopEventPropagation}>
            <Tmnl.Controller.Slider
              value={currentValue}
              min={config.min}
              max={config.max}
              step={config.step}
              onChange={(v) => handleParameterChange(key, v)}
              label={config.label}
            />
          </div>
        )

      case "color":
        return (
          <div key={key} className="flex items-center gap-1.5" onPointerDown={stopEventPropagation}>
            <span className="text-[7px] font-mono uppercase text-neutral-500">{config.label}</span>
            <input
              type="color"
              value={currentValue}
              onChange={(e) => handleParameterChange(key, e.target.value)}
              className="w-4 h-4 p-0 border border-neutral-700 bg-black cursor-pointer"
            />
          </div>
        )

      case "boolean":
        return (
          <div key={key} className="flex items-center gap-1.5" onPointerDown={stopEventPropagation}>
            <span className="text-[7px] font-mono uppercase text-neutral-500">{config.label}</span>
            <button
              onClick={() => handleParameterChange(key, !currentValue)}
              className={cn(
                "w-6 h-3 border border-neutral-700 flex items-center p-0.5 transition-colors",
                currentValue ? "bg-neutral-700" : "bg-black",
              )}
            >
              <div
                className={cn("w-2 h-2 transition-all", currentValue ? "bg-white translate-x-2.5" : "bg-neutral-600")}
              />
            </button>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div
      className={cn(
        "w-full h-full bg-black border flex flex-col overflow-hidden",
        isConnected ? "border-white" : "border-neutral-800",
      )}
    >
      {/* Header */}
      <div
        className="h-5 flex-shrink-0 flex items-center px-2 border-b border-neutral-800 bg-neutral-900/30 cursor-pointer select-none"
        onPointerDown={stopEventPropagation}
        onClick={toggleExpanded}
      >
        <Sliders size={10} className="text-neutral-600 mr-1.5" />
        <span className="text-[8px] font-mono uppercase tracking-widest text-neutral-500">CONTROLLER</span>
        {isConnected && (
          <>
            <span className="ml-1.5 text-[7px] font-mono text-white animate-pulse">LINKED</span>
            <button
              className="ml-1 p-0.5 hover:bg-neutral-800 transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                handleUnlink()
              }}
            >
              <Unlink size={8} className="text-neutral-500 hover:text-red-400" />
            </button>
          </>
        )}
        <ChevronDown
          className={cn("w-3 h-3 text-neutral-600 ml-auto transition-transform", isExpanded && "rotate-180")}
        />
      </div>

      {/* Controls */}
      {isExpanded && (
        <div className="flex-1 p-2 overflow-auto">
          {isConnected && targetMetadata ? (
            <div className="flex flex-wrap gap-2 justify-center">
              {Object.entries(targetMetadata.parameters).map(([key, config]) => renderControl(key, config))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-neutral-700 gap-1">
              <Link2 className="w-4 h-4" />
              <span className="text-[7px] font-mono uppercase tracking-widest text-center">
                SELECT BOTH
                <br />
                TO LINK
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export class ControllerWidgetShapeUtil extends BaseBoxShapeUtil<ControllerWidgetShape> {
  static override type = "controller-widget" as const
  static override props = {
    w: T.number,
    h: T.number,
    controllerId: T.string,
    visitorId: T.string,
    targetId: T.string.nullable(),
    targetMetadata: T.any.nullable(),
    isExpanded: T.boolean,
  }

  override canResize() {
    return true
  }
  override canEdit() {
    return false
  }

  getDefaultProps(): ControllerWidgetShape["props"] {
    const id = `controller-${Date.now()}`
    return {
      w: 200,
      h: 180,
      controllerId: id,
      visitorId: `controller-${id}`,
      targetId: null,
      targetMetadata: null,
      isExpanded: true,
    }
  }

  override onResize(shape: ControllerWidgetShape, info: TLResizeInfo<ControllerWidgetShape>) {
    return resizeBox(shape, info)
  }

  override component(shape: ControllerWidgetShape) {
    return (
      <HTMLContainer id={shape.id} style={{ width: "100%", height: "100%", pointerEvents: "all" }}>
        <ControllerComponent shape={shape} />
      </HTMLContainer>
    )
  }

  override indicator(shape: ControllerWidgetShape) {
    return <rect x={0} y={0} width={shape.props.w} height={shape.props.h} />
  }
}

// ============================================
// NOTES WIDGET SHAPE
// ============================================
export type NotesWidgetShape = TLBaseShape<
  "notes-widget",
  {
    w: number
    h: number
    title: string
    content: string
  }
>

export class NotesWidgetShapeUtil extends BaseBoxShapeUtil<NotesWidgetShape> {
  static override type = "notes-widget" as const
  static override props = {
    w: T.number,
    h: T.number,
    title: T.string,
    content: T.string,
  }

  override canResize() {
    return true
  }
  override canEdit() {
    return true
  }

  getDefaultProps(): NotesWidgetShape["props"] {
    return { w: 180, h: 120, title: "NOTE_001", content: "" }
  }

  override onResize(shape: NotesWidgetShape, info: TLResizeInfo<NotesWidgetShape>) {
    return resizeBox(shape, info)
  }

  override component(shape: NotesWidgetShape) {
    const { title, content } = shape.props
    const isEditing = this.editor.getEditingShapeId() === shape.id

    return (
      <HTMLContainer id={shape.id} style={{ width: "100%", height: "100%", pointerEvents: "all" }}>
        <div className="w-full h-full bg-black border border-neutral-800 flex flex-col overflow-hidden group">
          <div className="h-5 flex-shrink-0 flex items-center px-2 border-b border-neutral-800 bg-neutral-900/30">
            <FileText size={10} className="text-neutral-600 mr-1.5" />
            <span className="text-[8px] font-mono uppercase tracking-widest text-neutral-500 group-hover:text-white transition-colors">
              {title}
            </span>
          </div>
          <div className="flex-1 p-1.5 min-h-0">
            {isEditing ? (
              <textarea
                className="w-full h-full bg-neutral-950 border border-neutral-900 p-1.5 text-[9px] font-mono text-neutral-300 resize-none focus:outline-none focus:border-neutral-700"
                defaultValue={content}
                autoFocus
                onPointerDown={stopEventPropagation}
                onChange={(e) => {
                  this.editor.updateShape<NotesWidgetShape>({
                    id: shape.id,
                    type: "notes-widget",
                    props: { content: e.target.value },
                  })
                }}
              />
            ) : (
              <div className="w-full h-full bg-neutral-950 border border-neutral-900 p-1.5 text-[9px] font-mono text-neutral-400 overflow-auto whitespace-pre-wrap">
                {content || <span className="text-neutral-700 uppercase">Double-click to edit...</span>}
              </div>
            )}
          </div>
        </div>
      </HTMLContainer>
    )
  }

  override indicator(shape: NotesWidgetShape) {
    return <rect x={0} y={0} width={shape.props.w} height={shape.props.h} />
  }
}

// ============================================
// TERMINAL WIDGET SHAPE
// ============================================
export type TerminalWidgetShape = TLBaseShape<
  "terminal-widget",
  {
    w: number
    h: number
    history: string[]
  }
>

function TerminalComponent({ shape, isEditing }: { shape: TerminalWidgetShape; isEditing: boolean }) {
  const [input, setInput] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const editor = useEditor()
  const { history } = shape.props

  const handleCommand = useCallback(
    (cmd: string) => {
      const trimmed = cmd.trim().toLowerCase()
      let response = `> ${cmd}`

      if (trimmed === "help") {
        response += "\n  COMMANDS: help, clear, status, time, echo <msg>"
      } else if (trimmed === "clear") {
        editor.updateShape<TerminalWidgetShape>({
          id: shape.id,
          type: "terminal-widget",
          props: { history: [] },
        })
        return
      } else if (trimmed === "status") {
        response += "\n  SYSTEM: OPERATIONAL"
        response += "\n  UPTIME: " + Math.floor(performance.now() / 1000) + "s"
      } else if (trimmed === "time") {
        response += `\n  ${new Date().toLocaleTimeString()}`
      } else if (trimmed.startsWith("echo ")) {
        response += `\n  ${cmd.slice(5)}`
      } else if (trimmed) {
        response += `\n  UNKNOWN COMMAND: ${trimmed}`
      }

      editor.updateShape<TerminalWidgetShape>({
        id: shape.id,
        type: "terminal-widget",
        props: { history: [...history, response] },
      })
    },
    [editor, shape.id, history],
  )

  return (
    <div className="w-full h-full bg-black border border-neutral-800 flex flex-col overflow-hidden group">
      <div className="h-5 flex-shrink-0 flex items-center px-2 border-b border-neutral-800 bg-neutral-900/30">
        <Terminal size={10} className="text-neutral-600 mr-1.5" />
        <span className="text-[8px] font-mono uppercase tracking-widest text-neutral-500 group-hover:text-white transition-colors">
          TERMINAL
        </span>
        <div className="ml-auto w-1.5 h-1.5 bg-red-500 animate-pulse" />
      </div>
      <div className="flex-1 p-1.5 min-h-0 overflow-auto bg-neutral-950 font-mono">
        {history.map((line, i) => (
          <div key={i} className="text-[8px] text-neutral-400 whitespace-pre-wrap leading-relaxed">
            {line}
          </div>
        ))}
      </div>
      {isEditing && (
        <div
          className="h-5 flex items-center px-1.5 border-t border-neutral-800 bg-black"
          onPointerDown={stopEventPropagation}
        >
          <span className="text-[8px] font-mono text-neutral-600 mr-1">&gt;</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleCommand(input)
                setInput("")
              }
            }}
            className="flex-1 bg-transparent text-[8px] font-mono text-white outline-none"
            autoFocus
          />
        </div>
      )}
    </div>
  )
}

export class TerminalWidgetShapeUtil extends BaseBoxShapeUtil<TerminalWidgetShape> {
  static override type = "terminal-widget" as const
  static override props = {
    w: T.number,
    h: T.number,
    history: T.arrayOf(T.string),
  }

  override canResize() {
    return true
  }
  override canEdit() {
    return true
  }

  getDefaultProps(): TerminalWidgetShape["props"] {
    return {
      w: 220,
      h: 150,
      history: ["TACTICAL_TERMINAL v2.1", "Type 'help' for commands."],
    }
  }

  override onResize(shape: TerminalWidgetShape, info: TLResizeInfo<TerminalWidgetShape>) {
    return resizeBox(shape, info)
  }

  override component(shape: TerminalWidgetShape) {
    const isEditing = this.editor.getEditingShapeId() === shape.id
    return (
      <HTMLContainer id={shape.id} style={{ width: "100%", height: "100%", pointerEvents: "all" }}>
        <TerminalComponent shape={shape} isEditing={isEditing} />
      </HTMLContainer>
    )
  }

  override indicator(shape: TerminalWidgetShape) {
    return <rect x={0} y={0} width={shape.props.w} height={shape.props.h} />
  }
}

// ============================================
// DATA GRID WIDGET (ag-grid integration)
// ============================================
export { DataGridWidgetShapeUtil, type DataGridWidgetShape, type DataGridRow } from './data-grid-shape';

// ============================================
// EXPORT ALL SHAPE UTILS
// ============================================
import { DataGridWidgetShapeUtil } from './data-grid-shape';

export const tmnlShapeUtils = [
  ChartWidgetShapeUtil,
  ControllerWidgetShapeUtil,
  NotesWidgetShapeUtil,
  TerminalWidgetShapeUtil,
  DataGridWidgetShapeUtil,
]
