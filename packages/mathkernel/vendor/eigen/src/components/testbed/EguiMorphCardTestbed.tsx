/**
 * egui MorphCard Testbed
 *
 * @module testbed/EguiMorphCardTestbed
 */

import { useCallback, useRef } from 'react';
import { DynamicIslandCard, defaultTransitionStrategy } from '@/lib/morph-card';
import {
  EGUI_PANEL_TYPE,
  EguiEventBridge,
  eguiCounterAtom,
  eguiEventLogAtom,
  type EguiCanvasApi,
  useEguiAtomValue,
} from '@/lib/egui';
import { usePanelRegistry } from '@/lib/floating/PanelRegistry';
import { Button, SectionLabel, TestCard, TestbedHeader } from './shared';

const EGUI_CARD_SIZES = {
  compact: { width: 320, height: 180 },
  expanded: { width: 620, height: 420 },
  full: { width: 820, height: 560 },
};

function EguiMorphCardTestbedInner() {
  const { openPanel } = usePanelRegistry();
  const apiRef = useRef<EguiCanvasApi | null>(null);
  const events = useEguiAtomValue(eguiEventLogAtom);
  const counter = useEguiAtomValue(eguiCounterAtom);

  const handleReady = useCallback((api: EguiCanvasApi) => {
    apiRef.current = api;
  }, []);

  const handleIncrement = useCallback(() => {
    apiRef.current?.sendCommand({ _tag: 'Increment' });
  }, []);

  const handleReset = useCallback(() => {
    apiRef.current?.sendCommand({ _tag: 'Reset' });
  }, []);

  const handleDetach = useCallback(() => {
    openPanel(EGUI_PANEL_TYPE);
  }, [openPanel]);

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-8 py-10">
        <TestbedHeader
          title="egui MorphCard"
          subtitle="WASM-rendered egui canvas mounted inside DynamicIslandCard transitions. React owns layout; egui owns pixels."
        />

        <SectionLabel>Dynamic Island + egui Canvas</SectionLabel>

        <TestCard
          title="MorphCard Canvas"
          description="Build the wasm bundle, then switch tabs to see size morphing + reticle feedback."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={handleIncrement} variant="primary">
                Increment
              </Button>
              <Button onClick={handleReset}>Reset</Button>
              <Button onClick={handleDetach} variant="ghost">
                Detach
              </Button>
              <div
                className="rounded border border-neutral-800 bg-neutral-900/80 px-2 py-1 text-neutral-300"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                Counter:{' '}
                <span className="font-mono text-neutral-100">{counter}</span>
              </div>
            </div>
          }
        >
          <div className="flex flex-col gap-6">
            <DynamicIslandCard
              cardId="egui-morph-card"
              initialSizeKey="expanded"
              stateMachineConfig={{ sizes: EGUI_CARD_SIZES, reticle: 'grid' }}
              transitionStrategy={defaultTransitionStrategy}
              config={{ reticle: 'grid', borderIntensity: 0.7 }}
              dynamicSize={false}
              scrollable={false}
            >
              <DynamicIslandCard.View
                id="egui"
                label="Canvas"
                sizeKey="expanded"
                reticle="grid"
              >
                <div className="h-[360px] w-full">
                  <EguiEventBridge onReady={handleReady} />
                </div>
              </DynamicIslandCard.View>
              <DynamicIslandCard.View
                id="notes"
                label="Notes"
                sizeKey="compact"
                reticle="brackets"
              >
                <div
                  className="space-y-3 text-neutral-300"
                  style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
                >
                  <p>
                    egui renders into a single WebGL canvas via eframe
                    WebRunner. React owns the card layout and transitions; egui
                    owns all UI inside the canvas.
                  </p>
                  <p>
                    Build the wasm bundle with{' '}
                    <code>bun run egui:wasm:build</code> to generate
                    <code>/public/egui</code> assets.
                  </p>
                  <div>
                    <div
                      className="mb-2 font-mono uppercase text-neutral-400"
                      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                    >
                      Recent Events
                    </div>
                    <div
                      className="rounded border border-neutral-800 bg-neutral-900/60 p-3"
                      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                    >
                      {events.length === 0 ? (
                        <div className="text-neutral-500">No events yet.</div>
                      ) : (
                        <ul className="space-y-1 text-neutral-300">
                          {events
                            .slice(0, 6)
                            .map(
                              (
                                event: { _tag: string; value?: number },
                                index: number
                              ) => (
                                <li key={`${event._tag}-${index}`}>
                                  {event._tag === 'CounterChanged'
                                    ? `CounterChanged → ${event.value}`
                                    : event._tag}
                                </li>
                              )
                            )}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              </DynamicIslandCard.View>
            </DynamicIslandCard>
          </div>
        </TestCard>
      </div>
    </div>
  );
}

export function EguiMorphCardTestbed() {
  return <EguiMorphCardTestbedInner />;
}

export default EguiMorphCardTestbed;
