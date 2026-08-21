import { CopilotKit } from '@copilotkit/react-core';
import type { ReactNode } from 'react';
import { a0Bridge } from '../contracts/a0';

/**
 * CopilotKit is the AG-UI surface. Mastra is consumed via A0.
 * When A0 has not bound a runtime URL, the host does not invent a model
 * fallback — the Ask well stays empty and local fixture cards still work.
 */
export function CopilotHost({ children }: { children: ReactNode }) {
  const url = a0Bridge.aguiUrl;
  if (!url || a0Bridge.mastra === 'empty') {
    return <>{children}</>;
  }
  return (
    <CopilotKit runtimeUrl={url} showDevConsole={false}>
      {children}
    </CopilotKit>
  );
}

export function MastraWell() {
  return (
    <section className="well" aria-label="Mastra AG-UI well">
      <p className="well-kicker">Mastra / CopilotKit stream</p>
      <h2>Empty well</h2>
      <p>
        A0 has not bound a Mastra runtime. Local fixture advice still works. This app will not
        silently pick another model.
      </p>
    </section>
  );
}
