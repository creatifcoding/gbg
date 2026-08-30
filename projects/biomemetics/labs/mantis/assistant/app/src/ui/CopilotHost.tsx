import { Component, type ComponentType, type ReactNode, useEffect, useState } from 'react';
import { a0Bridge, type AguiBind } from '../contracts/a0';

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

function streamCaption(bind: AguiBind): string {
  switch (bind.kind) {
    case 'empty':
      return 'No AG-UI bind. Local guidance still works.';
    case 'local':
      return 'No remote runtime. No live model. Local guidance still works.';
    case 'http':
      return bind.runtimeUrl;
    default: {
      const _exhaustive: never = bind;
      return _exhaustive;
    }
  }
}

export function CopilotHost({ children }: { children: ReactNode }) {
  const bind = a0Bridge.agui;
  const [Kit, setKit] = useState<CopilotKitComponent | null>(null);

  useEffect(() => {
    if (bind.kind !== 'http') return;
    let cancelled = false;
    void import('@copilotkit/react-core')
      .then((mod) => {
        if (!cancelled) setKit(() => mod.CopilotKit as CopilotKitComponent);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [bind.kind]);

  switch (bind.kind) {
    case 'empty':
    case 'local':
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
    default: {
      const _exhaustive: never = bind;
      return _exhaustive;
    }
  }
}

export function MastraWell() {
  const bind = a0Bridge.agui;
  return (
    <section className="well" aria-label="CopilotKit stream">
      <p className="well-kicker">CopilotKit</p>
      <h2>Stream</h2>
      <p>{streamCaption(bind)}</p>
      <div data-field="stream" aria-label="Stream" />
    </section>
  );
}
