import { createContext, useContext, useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { NuCmdkShellMode } from '../types';
import { NU_CMDK_TOKENS } from '../tokens';

export interface ModeBandProps {
  readonly mode: NuCmdkShellMode;
  readonly statusText: string;
  readonly path?: ReadonlyArray<string>;
}

export interface ModeBandRootProps {
  readonly mode: NuCmdkShellMode;
  readonly statusText: string;
  readonly path?: ReadonlyArray<string>;
  readonly children: ReactNode;
}

export interface ModeBandPathProps {
  readonly path?: ReadonlyArray<string>;
  readonly children?: ReactNode;
}

export interface ModeBandSegmentProps {
  readonly segment: string;
  readonly active?: boolean;
}

export interface ModeBandSeparatorProps {
  readonly children?: ReactNode;
}

export interface ModeBandStatusProps {
  readonly text?: string;
}

interface ModeBandContextValue {
  readonly mode: NuCmdkShellMode;
  readonly statusText: string;
  readonly path: ReadonlyArray<string>;
}

const defaultPath = ['System', 'Data Grid', 'Global Search'] as const;

const ModeBandContext = createContext<ModeBandContextValue | null>(null);

const rootStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '6px 10px 5px',
  borderBottom: `1px solid ${NU_CMDK_TOKENS.border.subtle}`,
  fontFamily: NU_CMDK_TOKENS.typography.family.heading,
  fontSize: NU_CMDK_TOKENS.typography.size.xs,
  color: NU_CMDK_TOKENS.text.tertiary,
  letterSpacing: '0.08em',
  textTransform: 'none',
  background: NU_CMDK_TOKENS.surface.band,
};

const pathStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '5px',
};

const separatorStyle: CSSProperties = {
  opacity: 0.55,
};

const statusStyle: CSSProperties = {
  fontSize: NU_CMDK_TOKENS.typography.size.xs,
  color: NU_CMDK_TOKENS.text.muted,
};

function useModeBandContext(): ModeBandContextValue {
  const ctx = useContext(ModeBandContext);
  if (!ctx) {
    throw new Error(
      'ModeBand compound components must be used inside ModeBand.Root'
    );
  }
  return ctx;
}

function ModeBandRoot({
  mode,
  statusText,
  path = defaultPath,
  children,
}: ModeBandRootProps) {
  const value = useMemo<ModeBandContextValue>(
    () => ({ mode, statusText, path }),
    [mode, statusText, path]
  );

  return (
    <ModeBandContext.Provider value={value}>
      <div
        style={rootStyle}
        data-band="mode"
        data-slot="mode-root"
        data-mode={mode}
      >
        {children}
      </div>
    </ModeBandContext.Provider>
  );
}

function ModeBandSeparator({ children = ' /' }: ModeBandSeparatorProps) {
  return (
    <span style={separatorStyle} data-slot="mode-separator">
      {children}
    </span>
  );
}

function ModeBandSegment({ segment, active = false }: ModeBandSegmentProps) {
  return (
    <span
      style={{
        color: active
          ? NU_CMDK_TOKENS.accent.cyan
          : NU_CMDK_TOKENS.text.tertiary,
      }}
      data-slot="mode-segment"
      data-state={active ? 'active' : 'inactive'}
    >
      {segment}
    </span>
  );
}

function ModeBandPath({ path, children }: ModeBandPathProps) {
  const ctx = useModeBandContext();
  const segments = path ?? ctx.path;

  if (children) {
    return (
      <div style={pathStyle} data-slot="mode-path">
        {children}
      </div>
    );
  }

  return (
    <div style={pathStyle} data-slot="mode-path">
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        return (
          <span
            key={`${segment}-${index}`}
            style={{ display: 'inline-flex', alignItems: 'center' }}
          >
            {index > 0 ? <ModeBandSeparator /> : null}
            <ModeBandSegment segment={segment} active={isLast} />
          </span>
        );
      })}
    </div>
  );
}

function ModeBandStatus({ text }: ModeBandStatusProps) {
  const ctx = useModeBandContext();
  return (
    <span style={statusStyle} data-slot="mode-status">
      {text ?? ctx.statusText}
    </span>
  );
}

function ModeBandBase({ mode, statusText, path = defaultPath }: ModeBandProps) {
  return (
    <ModeBandRoot mode={mode} statusText={statusText} path={path}>
      <ModeBandPath />
      <ModeBandStatus />
    </ModeBandRoot>
  );
}

type ModeBandCompound = ((props: ModeBandProps) => JSX.Element) & {
  Root: typeof ModeBandRoot;
  Path: typeof ModeBandPath;
  Segment: typeof ModeBandSegment;
  Separator: typeof ModeBandSeparator;
  Status: typeof ModeBandStatus;
};

export const ModeBand = Object.assign(ModeBandBase, {
  Root: ModeBandRoot,
  Path: ModeBandPath,
  Segment: ModeBandSegment,
  Separator: ModeBandSeparator,
  Status: ModeBandStatus,
}) as ModeBandCompound;
