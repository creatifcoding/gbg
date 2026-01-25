import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { decodeEguiEvents, encodeEguiCommand } from '../bridge';
import type { EguiCommand, EguiEvent } from '../schemas';
import {
  DEFAULT_EGUI_BASE_PATH,
  loadEguiWasmModule,
  type EguiWebHandle,
} from '../wasm/loader';

type EguiStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface EguiCanvasApi {
  sendCommand: (command: EguiCommand) => void;
  drainEvents: () => readonly EguiEvent[];
}

export interface EguiCanvasProps {
  className?: string;
  canvasClassName?: string;
  basePath?: string;
  pollIntervalMs?: number;
  autoDestroy?: boolean;
  onReady?: (api: EguiCanvasApi) => void;
  onEvents?: (events: readonly EguiEvent[]) => void;
}

export function EguiCanvas({
  className,
  canvasClassName,
  basePath = DEFAULT_EGUI_BASE_PATH,
  pollIntervalMs = 500,
  autoDestroy = false,
  onReady,
  onEvents,
}: EguiCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handleRef = useRef<EguiWebHandle | null>(null);
  const apiRef = useRef<EguiCanvasApi | null>(null);
  const [status, setStatus] = useState<EguiStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [eventMode, setEventMode] = useState<'none' | 'push' | 'poll'>('none');
  const onEventsRef = useRef<typeof onEvents>(onEvents);
  const destroyedRef = useRef(false);
  const eventModeRef = useRef(eventMode);
  const callbackAttachedRef = useRef(false);
  useEffect(() => {
    onEventsRef.current = onEvents;
  }, [onEvents]);
  useEffect(() => {
    eventModeRef.current = eventMode;
  }, [eventMode]);
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const pixelRatio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(rect.width * pixelRatio));
    const height = Math.max(1, Math.floor(rect.height * pixelRatio));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }, []);
  const focusCanvas = useCallback(() => {
    canvasRef.current?.focus();
  }, []);

  const drainEvents = useCallback((): readonly EguiEvent[] => {
    try {
      const raw = handleRef.current?.drain_events?.();
      if (!raw) return [];
      return decodeEguiEvents(raw);
    } catch {
      return [];
    }
  }, []);

  const sendCommand = useCallback(
    (command: EguiCommand) => {
      const encoded = encodeEguiCommand(command);
      try {
        handleRef.current?.send_command?.(encoded);
        if (eventModeRef.current === 'poll') {
          const events = drainEvents();
          if (events.length > 0) {
            onEventsRef.current?.(events);
          }
        }
      } catch {
        // ignore command errors when wasm is not ready
      }
    },
    [drainEvents]
  );

  const handleEventPayload = useCallback((raw: unknown) => {
    if (!onEventsRef.current) return;
    try {
      const events = decodeEguiEvents(raw);
      if (events.length > 0) {
        onEventsRef.current(events);
      }
    } catch {
      return;
    }
  }, []);

  const attachEventCallback = useCallback(() => {
    const handle = handleRef.current;
    if (!handle?.set_event_callback) return false;
    if (!onEventsRef.current) return false;
    if (callbackAttachedRef.current) return true;
    try {
      handle.set_event_callback(handleEventPayload);
      callbackAttachedRef.current = true;
      return true;
    } catch {
      return false;
    }
  }, [handleEventPayload]);

  const teardownHandle = useCallback(() => {
    if (destroyedRef.current) return;
    destroyedRef.current = true;
    try {
      handleRef.current?.clear_event_callback?.();
    } catch {
      // ignore cleanup errors
    }
    if (autoDestroy) {
      try {
        handleRef.current?.destroy?.();
      } catch {
        // ignore wasm teardown errors
      }
    }
  }, [autoDestroy]);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      if (!canvasRef.current) return;
      setStatus('loading');
      setError(null);

      try {
        const module = await loadEguiWasmModule(basePath);
        await module.default();
        if (cancelled || !canvasRef.current) return;
        resizeCanvas();
        const handle = new module.WebHandle();
        handleRef.current = handle;
        await handle.start(canvasRef.current);
        if (!cancelled) {
          const api = { sendCommand, drainEvents };
          apiRef.current = api;
          onReady?.(api);
          const hasPush = attachEventCallback();
          if (onEventsRef.current) {
            setEventMode(hasPush ? 'push' : 'poll');
          } else {
            setEventMode('none');
          }
          setStatus('ready');
          focusCanvas();
        }
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setError(
          err instanceof Error ? err.message : 'Failed to start egui wasm'
        );
      }
    };

    void boot();

    return () => {
      cancelled = true;
      teardownHandle();
      handleRef.current = null;
      apiRef.current = null;
    };
  }, [
    attachEventCallback,
    basePath,
    drainEvents,
    focusCanvas,
    onReady,
    resizeCanvas,
    sendCommand,
    teardownHandle,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    resizeCanvas();

    const observer = new ResizeObserver(() => resizeCanvas());
    observer.observe(canvas);

    return () => observer.disconnect();
  }, [resizeCanvas]);

  useEffect(() => {
    if (!onEvents) {
      setEventMode('none');
      callbackAttachedRef.current = false;
      try {
        handleRef.current?.clear_event_callback?.();
      } catch {
        // ignore cleanup errors
      }
      return;
    }
    if (status !== 'ready') return;

    const hasPush = attachEventCallback();
    setEventMode(hasPush ? 'push' : 'poll');
  }, [attachEventCallback, onEvents, status]);

  useEffect(() => {
    if (!onEvents) return;
    if (status !== 'ready') return;
    if (eventMode !== 'poll') return;

    const interval = window.setInterval(() => {
      const events = apiRef.current?.drainEvents() ?? [];
      if (events.length > 0) {
        onEvents(events);
      }
    }, pollIntervalMs);

    return () => window.clearInterval(interval);
  }, [eventMode, onEvents, pollIntervalMs, status]);

  return (
    <div
      className={cn(
        'relative h-full w-full overflow-hidden rounded-md border border-neutral-800 bg-neutral-950 pointer-events-auto',
        className
      )}
    >
      <canvas
        ref={canvasRef}
        tabIndex={0}
        onPointerDown={focusCanvas}
        className={cn(
          'h-full w-full outline-none pointer-events-auto',
          canvasClassName
        )}
        style={{ touchAction: 'none' }}
      />
      {status !== 'ready' ? (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/80">
          <div
            className="text-center text-neutral-300"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {status === 'loading'
              ? 'Booting egui wasm...'
              : 'egui wasm not available'}
            <div
              className="mt-2 text-neutral-500"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              {error ??
                'Run `bun run egui:wasm:build` to generate /public/egui.'}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
