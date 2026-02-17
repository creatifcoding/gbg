import { Atom } from '@effect-atom/atom';
import { HashMap, Option } from 'effect';
import { chartInstancesAtom, chartSpecsAtom, chartStatesAtom } from './state';
import { toChartMapKey } from '../keys';

export const chartSpecFamily = Atom.family((id: string) =>
  Atom.make((get) =>
    Option.getOrNull(HashMap.get(get(chartSpecsAtom), toChartMapKey(id)))
  )
);

export const chartStateFamily = Atom.family((id: string) =>
  Atom.make((get) =>
    Option.getOrElse(HashMap.get(get(chartStatesAtom), toChartMapKey(id)), () =>
      'UNINITIALIZED' as const
    )
  )
);

export const chartInstanceFamily = Atom.family((id: string) =>
  Atom.make((get) =>
    Option.getOrNull(HashMap.get(get(chartInstancesAtom), toChartMapKey(id)))
  )
);
