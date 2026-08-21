import { Component, type ComponentType, type ReactNode, useEffect, useState } from 'react';
import { a0Bridge } from '../contracts/a0';

type CopilotKitComponent = ComponentType<{
  runtimeUrl?: string;
  showDevConsole: boolean;
  children?: ReactNode;
}>;

type DegradeProps = {
  readonly children: ReactNode;
  readonly fallback: ReactNode;
};

class CopilotDegrade extends Component<DegradeProps, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function CopilotHost({ children }: { children: ReactNode }) {
  const bind = a0Bridge.agui;
  const [Kit, setKit] = useState<CopilotKitComponent | null>(null);

  useEffect(() => {
    if (bind.kind === 'empty') return;
    let cancelled = false;
    void import('@copilotkit/react-core')
      .then((mod) => {
        if (!cancelled) setKit(() => mod.CopilotKit as CopilotKitComponent);
      })
      .catch(() => {
        /* jsdom and a missing chunk both degrade to offline Ask chrome */
      });
    return () => {
      cancelled = true;
    };
  }, [bind.kind]);

  switch (bind.kind) {
    case 'empty':
      return <>{children}</>;
    case 'http':
      return Kit ? (
        <CopilotDegrade fallback={children}>
          <Kit runtimeUrl={bind.runtimeUrl} showDevConsole={false}>
            {children}
          </Kit>
        </CopilotDegrade>
      ) : (
        <>{children}</>
      );
    case 'local':
      return Kit ? (
        <CopilotDegrade fallback={children}>
          <Kit showDevConsole={false}>{children}</Kit>
        </CopilotDegrade>
      ) : (
        <>{children}</>
      );
    default: {
      const _exhaustive: never = bind;
      return _exhaustive;
    }
  }
}

export function MastraWell() {
  const bind = a0Bridge.agui;
  switch (bind.kind) {
    case 'empty':
      return (
        <section className="well" aria-label="Mastra AG-UI well">
          <p className="well-kicker">Mastra / CopilotKit stream</p>
          <h2>Empty well</h2>
          <p>
            No Mastra or AG-UI bind exists. Local fixture advice still works. This app will not
            silently pick another model.
          </p>
        </section>
      );
    case 'local':
      return (
        <section className="well" aria-label="Mastra AG-UI well">
          <p className="well-kicker">Mastra / CopilotKit stream</p>
          <h2>Bound locally</h2>
          <p>
            CopilotKit is bound in-process. Offline Ask chrome still works. No remote runtime URL.
            This is not an empty well.
          </p>
        </section>
      );
    case 'http':
      return (
        <section className="well" aria-label="Mastra AG-UI well">
          <p className="well-kicker">Mastra / CopilotKit stream</p>
          <h2>Bound to A0 HTTP runtime</h2>
          <p>{bind.runtimeUrl}</p>
        </section>
      );
    default: {
      const _exhaustive: never = bind;
      return _exhaustive;
    }
  }
}
