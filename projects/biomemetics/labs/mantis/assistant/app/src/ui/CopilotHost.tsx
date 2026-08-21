import { type ComponentType, type ReactNode, useEffect, useState } from 'react';
import { a0Bridge } from '../contracts/a0';

type CopilotKitComponent = ComponentType<{
  runtimeUrl: string;
  showDevConsole: boolean;
  children?: ReactNode;
}>;

/**
 * CopilotKit is the AG-UI surface. Mastra is consumed via A0.
 * When A0 has not bound a runtime URL, CopilotKit stays unloaded and the Ask
 * well stays empty. No silent model fallback.
 */
export function CopilotHost({ children }: { children: ReactNode }) {
  const url = a0Bridge.aguiUrl;
  const [Kit, setKit] = useState<CopilotKitComponent | null>(null);

  useEffect(() => {
    if (!url || a0Bridge.mastra === 'empty') return;
    let cancelled = false;
    void import('@copilotkit/react-core').then((mod) => {
      if (!cancelled) setKit(() => mod.CopilotKit as CopilotKitComponent);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!Kit || !url) return <>{children}</>;
  return (
    <Kit runtimeUrl={url} showDevConsole={false}>
      {children}
    </Kit>
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
