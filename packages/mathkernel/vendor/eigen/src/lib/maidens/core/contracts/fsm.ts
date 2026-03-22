export type TransitionMap<TState extends string> = Readonly<
  Record<TState, readonly TState[]>
>;

/**
 * Runtime-contract core utility:
 * Typed adjacency legality check for FSM transition maps.
 */
export const isLegalTransition = <TState extends string>(
  transitions: TransitionMap<TState>,
  from: TState,
  to: TState
): boolean => transitions[from].includes(to);

/**
 * Runtime-contract core utility:
 * Generic Mermaid state diagram rendering for transition maps.
 */
export const toMermaid = <TState extends string>(
  transitions: TransitionMap<TState>,
  states: readonly TState[]
): string => {
  const lines: string[] = ['stateDiagram-v2'];

  for (const from of states) {
    const outs = transitions[from];
    if (outs.length === 0) {
      lines.push(`  state ${from}`);
      continue;
    }

    for (const to of outs) {
      lines.push(`  ${from} --> ${to}`);
    }
  }

  return `${lines.join('\n')}\n`;
};
