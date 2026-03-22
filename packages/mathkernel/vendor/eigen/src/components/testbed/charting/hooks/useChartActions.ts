import { useCallback, useRef } from 'react';
import { useAtomSet, useAtomValue } from '@effect-atom/atom-react';
import type { ChartSeries, ChartSpec } from '@/lib/charting/v2';
import { chartOps, chartStateFamily } from '@/lib/charting/v2';
import { useExitRunner } from './useExitRunner';

export const useChartActions = (spec: ChartSpec) => {
  const state = useAtomValue(chartStateFamily(spec.id));
  const createOp = useAtomSet(chartOps.create, { mode: 'promiseExit' });
  const mountOp = useAtomSet(chartOps.mount, { mode: 'promiseExit' });
  const unmountOp = useAtomSet(chartOps.unmount, { mode: 'promiseExit' });
  const disposeOp = useAtomSet(chartOps.dispose, { mode: 'promiseExit' });
  const setDataOp = useAtomSet(chartOps.setData, { mode: 'promiseExit' });
  const appendDataOp = useAtomSet(chartOps.appendData, { mode: 'promiseExit' });
  const clearDataOp = useAtomSet(chartOps.clearData, { mode: 'promiseExit' });
  const { error, run } = useExitRunner(spec.id);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const create = useCallback(
    () => run(createOp(spec), 'create'),
    [createOp, run, spec]
  );
  const mount = useCallback(
    (container: HTMLElement | null) =>
      container ? run(mountOp({ id: spec.id, container }), 'mount') : null,
    [mountOp, run, spec.id]
  );
  const unmount = useCallback(
    () => run(unmountOp(spec.id), 'unmount'),
    [run, unmountOp, spec.id]
  );
  const dispose = useCallback(
    () => run(disposeOp(spec.id), 'dispose'),
    [disposeOp, run, spec.id]
  );
  const setData = useCallback(
    (data: ChartSeries) => run(setDataOp({ id: spec.id, data }), 'setData'),
    [run, setDataOp, spec.id]
  );
  const appendData = useCallback(
    (data: ChartSeries) =>
      run(appendDataOp({ id: spec.id, data }), 'appendData'),
    [appendDataOp, run, spec.id]
  );
  const clearData = useCallback(
    () => run(clearDataOp(spec.id), 'clearData'),
    [clearDataOp, run, spec.id]
  );

  return {
    state,
    error,
    containerRef,
    create,
    mount,
    unmount,
    dispose,
    setData,
    appendData,
    clearData,
  } as const;
};
