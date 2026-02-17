import { useEffect } from 'react';
import type { ChartSeries, ChartSpec } from '@/lib/charting/v2';
import { useChartActions } from './useChartActions';

export const useAutoChart = (spec: ChartSpec, initialData?: ChartSeries) => {
  const actions = useChartActions(spec);
  const { create, mount, dispose, containerRef, state, setData } = actions;

  useEffect(() => {
    let active = true;

    const start = async () => {
      await create();
      if (!active) return;
      await mount(containerRef.current);
    };

    void start();

    return () => {
      active = false;
      void dispose();
    };
  }, [containerRef, create, dispose, mount]);

  useEffect(() => {
    if (state === 'READY' && initialData) {
      void setData(initialData);
    }
  }, [initialData, setData, state]);

  return actions;
};
