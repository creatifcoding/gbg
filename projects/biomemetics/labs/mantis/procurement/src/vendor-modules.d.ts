declare module '@gbg/lab-ui' {
  import type {
    CSSProperties,
    ComponentPropsWithoutRef,
    ReactNode,
  } from 'react';

  export const VANTA_COLORS: {
    readonly surface: {
      readonly void: string;
      readonly base: string;
      readonly elevated: string;
      readonly raised: string;
      readonly border: string;
    };
    readonly text: {
      readonly primary: string;
      readonly secondary: string;
      readonly tertiary: string;
      readonly muted: string;
    };
    readonly accent: Record<string, string>;
  };

  export const VANTA_TYPOGRAPHY: {
    readonly family: {
      readonly mono: string;
      readonly grotesk: string;
      readonly sans: string;
      readonly data: string;
    };
    readonly size: Record<string, string>;
    readonly weight: Record<string, string>;
    readonly tracking: Record<string, string>;
  };

  export const VANTA_SPACING: {
    readonly unit: number;
    readonly '0': string;
    readonly px: string;
    readonly '0.5': string;
    readonly '1': string;
    readonly '1.5': string;
    readonly '2': string;
    readonly '2.5': string;
    readonly '3': string;
    readonly '4': string;
    readonly '5': string;
    readonly '6': string;
    readonly '8': string;
    readonly '10': string;
    readonly '12': string;
    readonly '16': string;
  };

  export const VANTA_BORDERS: {
    readonly style: { readonly default: string };
    readonly radius: { readonly none: string };
  };

  export const VANTA_ANIMATION: {
    readonly duration: { readonly fast: string };
    readonly easing: { readonly out: string };
  };

  export const chrome: {
    readonly color: {
      readonly void: string;
      readonly base: string;
      readonly elevated: string;
      readonly raised: string;
      readonly border: string;
      readonly primary: string;
      readonly secondary: string;
      readonly muted: string;
    };
    readonly font: { readonly sans: string; readonly mono: string };
    readonly type: {
      readonly size: Record<string, string>;
      readonly tracking: Record<string, string>;
      readonly weight: Record<string, string>;
    };
    readonly space: {
      readonly headerHeight: string;
      readonly gridHeight: string;
      readonly gap: string;
      readonly pillInlinePadding: string;
      readonly pillBlockPadding: string;
    };
    readonly radius: { readonly frame: string };
  };

  export function Grid(props: Record<string, unknown>): ReactNode;
  export function Table(props: {
    columns?: ReadonlyArray<{ accessorKey: string; header: string }>;
    data?: ReadonlyArray<Record<string, string>>;
    style?: CSSProperties;
  }): ReactNode;
  export function HeaderCell(params: unknown): ReactNode;
  export function SocketCell(params: unknown): ReactNode;
  export function ValueCell(params: unknown): ReactNode;
  export function KickerHeader(params: unknown): ReactNode;
  export function StatusCell(params: unknown): ReactNode;
  export function createVantaGridTheme(): unknown;
  export const vantaGridTheme: unknown;

  export function Socket(
    props: ComponentPropsWithoutRef<'div'> & {
      kind?: 'value' | 'media';
      children?: ReactNode;
    },
  ): ReactNode;
  export function Pill(props: {
    tone?: 'empty' | 'working' | 'raw' | 'filed' | 'dead';
    children?: string;
    style?: CSSProperties;
  }): ReactNode;
  export function Kicker(props: {
    children: string;
    size?: 10 | 11;
    tone?: 'muted' | 'dim';
    style?: CSSProperties;
  }): ReactNode;
  export function Label(props: { children: string; style?: CSSProperties }): ReactNode;
  export function Mono(props: {
    children?: ReactNode;
    size?: string;
    style?: CSSProperties;
  }): ReactNode;
  export function Sans(props: {
    children?: ReactNode;
    size?: string;
    style?: CSSProperties;
  }): ReactNode;
}

declare module '@tmnl/pct/procedures' {
  export function isProcedure(u: unknown): boolean;
}

declare module '@tmnl/msh/subject' {
  export const SubjectRegistry: unknown;
}

declare module '@tmnl/lnk/contracts' {
  export const Offset: unknown;
}
