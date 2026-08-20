import type { SVGProps } from 'react';

type MarkProps = SVGProps<SVGSVGElement> & { readonly title?: string };

const svg = (props: MarkProps) => ({
  viewBox: '0 0 256 256',
  fill: 'none',
  xmlns: 'http://www.w3.org/2000/svg',
  'aria-hidden': props.title ? undefined : true,
  ...props,
});

export function DatabaseMark(props: MarkProps) {
  return (
    <svg {...svg(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <ellipse cx="128" cy="64" rx="80" ry="28" stroke="currentColor" strokeWidth="12" />
      <path d="M48 64v64c0 15.5 35.8 28 80 28s80-12.5 80-28V64" stroke="currentColor" strokeWidth="12" />
      <path d="M48 128v64c0 15.5 35.8 28 80 28s80-12.5 80-28v-64" stroke="currentColor" strokeWidth="12" />
    </svg>
  );
}

export function UploadMark(props: MarkProps) {
  return (
    <svg {...svg(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <path d="M128 208V72" stroke="currentColor" strokeWidth="12" strokeLinecap="square" />
      <path d="M80 120l48-48 48 48" stroke="currentColor" strokeWidth="12" strokeLinecap="square" strokeLinejoin="miter" />
      <path d="M48 208h160" stroke="currentColor" strokeWidth="12" strokeLinecap="square" />
    </svg>
  );
}

export function CrosshairMark(props: MarkProps) {
  return (
    <svg {...svg(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <circle cx="128" cy="128" r="72" stroke="currentColor" strokeWidth="10" />
      <path d="M128 40v32M128 184v32M40 128h32M184 128h32" stroke="currentColor" strokeWidth="10" strokeLinecap="square" />
      <circle cx="128" cy="128" r="6" fill="currentColor" />
    </svg>
  );
}

export function ShutterMark(props: MarkProps) {
  return (
    <svg {...svg(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <circle cx="128" cy="128" r="84" stroke="currentColor" strokeWidth="10" />
      <path
        d="M128 44l36 64H92zM212 128l-64 36v-72zM128 212l-36-64h72zM44 128l64-36v72z"
        stroke="currentColor"
        strokeWidth="8"
      />
    </svg>
  );
}

export function PinMark(props: MarkProps) {
  return (
    <svg {...svg(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <path
        d="M128 224s-72-80-72-120a72 72 0 1 1 144 0c0 40-72 120-72 120z"
        stroke="currentColor"
        strokeWidth="12"
      />
      <circle cx="128" cy="104" r="24" stroke="currentColor" strokeWidth="12" />
    </svg>
  );
}

export function CubeMark(props: MarkProps) {
  return (
    <svg {...svg(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <path d="M128 32l96 48v96l-96 48-96-48V80z" stroke="currentColor" strokeWidth="12" />
      <path d="M128 224V128M128 128L32 80M128 128l96-48" stroke="currentColor" strokeWidth="12" />
    </svg>
  );
}

export function PlusMark(props: MarkProps) {
  return (
    <svg {...svg(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <path d="M128 48v160M48 128h160" stroke="currentColor" strokeWidth="12" strokeLinecap="square" />
    </svg>
  );
}

export function GridMark(props: MarkProps) {
  return (
    <svg {...svg(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <rect x="40" y="40" width="72" height="72" stroke="currentColor" strokeWidth="12" />
      <rect x="144" y="40" width="72" height="72" stroke="currentColor" strokeWidth="12" />
      <rect x="40" y="144" width="72" height="72" stroke="currentColor" strokeWidth="12" />
      <rect x="144" y="144" width="72" height="72" stroke="currentColor" strokeWidth="12" />
    </svg>
  );
}

export function SlidersMark(props: MarkProps) {
  return (
    <svg {...svg(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <path d="M80 40v176M176 40v176" stroke="currentColor" strokeWidth="12" />
      <rect x="56" y="88" width="48" height="24" fill="currentColor" />
      <rect x="152" y="144" width="48" height="24" fill="currentColor" />
    </svg>
  );
}

export function DnaMark(props: MarkProps) {
  return (
    <svg {...svg(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <path d="M80 40c96 0 96 176 0 176" stroke="currentColor" strokeWidth="12" />
      <path d="M176 40c-96 0-96 176 0 176" stroke="currentColor" strokeWidth="12" />
      <path d="M88 88h80M88 128h80M88 168h80" stroke="currentColor" strokeWidth="10" />
    </svg>
  );
}

export function HexMark(props: MarkProps) {
  return (
    <svg {...svg(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <path d="M128 28l84 48v104l-84 48-84-48V76z" stroke="currentColor" strokeWidth="12" />
    </svg>
  );
}

export function TerminalMark(props: MarkProps) {
  return (
    <svg {...svg(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <rect x="32" y="48" width="192" height="160" stroke="currentColor" strokeWidth="12" />
      <path d="M64 96l32 24-32 24M112 144h48" stroke="currentColor" strokeWidth="12" strokeLinecap="square" />
    </svg>
  );
}

export function ViewportMark(props: MarkProps) {
  return (
    <svg {...svg(props)} viewBox="0 0 400 400">
      {props.title ? <title>{props.title}</title> : null}
      <circle cx="200" cy="200" r="70" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="200" cy="200" r="110" stroke="currentColor" strokeWidth="1" />
      <circle cx="200" cy="200" r="150" stroke="currentColor" strokeWidth="0.8" />
      <path d="M200 40l70 40v80l-70 40-70-40V80z" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="200" cy="200" r="4" fill="#34d399" />
    </svg>
  );
}
