import { useCallback, useState } from 'react';
import { Cause, Effect, Exit } from 'effect';

export type ExitPromise = Promise<Exit.Exit<unknown, unknown>>;

export type ErrorState = {
  context: string;
  message: string;
};

export const useExitRunner = (scope: string) => {
  const [error, setError] = useState<ErrorState | null>(null);

  const run = useCallback(
    async (promise: ExitPromise, action?: string) => {
      const exit = await promise;
      if (Exit.isFailure(exit)) {
        const message = Cause.pretty(exit.cause);
        const context = action ? `${scope}:${action}` : scope;
        setError({ context, message });
        Effect.runFork(Effect.logError(`[ChartingTestbed] ${context}\n${message}`));
        return null;
      }
      setError(null);
      return exit.value;
    },
    [scope]
  );

  return { error, run } as const;
};
