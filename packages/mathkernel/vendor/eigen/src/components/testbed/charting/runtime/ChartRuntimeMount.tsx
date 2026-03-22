import { useAtomValue } from '@effect-atom/atom-react';
import {
  chartingRuntimeAtom,
  chartInstancesAtom,
  chartReleasesAtom,
  chartSpecsAtom,
  chartStateSubscriptionsAtom,
  chartStatesAtom,
} from '@/lib/charting/v2';

export function ChartRuntimeMount() {
  useAtomValue(chartingRuntimeAtom);
  useAtomValue(chartInstancesAtom);
  useAtomValue(chartSpecsAtom);
  useAtomValue(chartStatesAtom);
  useAtomValue(chartReleasesAtom);
  useAtomValue(chartStateSubscriptionsAtom);
  return null;
}
