import type { CSSProperties, ReactNode } from 'react';
import { chrome } from '../../lib/chrome.js';
import { Kicker } from '../Kicker.js';
import { Label } from '../Label.js';
import { Mono } from '../Mono.js';
import { Pill } from '../Pill.js';
import { Sans } from '../Sans.js';
import { Socket } from '../Socket.js';

const frame: CSSProperties = {
  boxSizing: 'border-box',
  border: `1px solid ${chrome.color.charcoal300}`,
  borderRadius: chrome.radius.frame,
  background: chrome.color.void,
};

export function LabUiTestbed() {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        minHeight: '100vh',
        background: chrome.color.charcoal600,
        color: chrome.color.textmain,
        fontFamily: chrome.font.sans,
      }}
    >
      <aside
        style={{
          ...frame,
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          width: chrome.space.railWidth,
          maxWidth: '100%',
          borderColor: chrome.color.charcoal300,
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            boxSizing: 'border-box',
            height: chrome.space.headerHeight,
            paddingInline: chrome.space.cardPadding,
            borderBottom: `1px solid ${chrome.color.charcoal300}`,
          }}
        >
          <Kicker size={11}>lab ui // chrome</Kicker>
        </header>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: chrome.space.gap,
            padding: chrome.space.cardPadding,
          }}
        >
          <Card />
          <Card />
        </div>
      </aside>
      <main
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          flex: 1,
          minWidth: chrome.space.railWidth,
          alignContent: 'flex-start',
          background: chrome.color.charcoal600,
        }}
      >
        <section
          style={{
            ...frame,
            display: 'flex',
            flex: '1 1 20rem',
            flexDirection: 'column',
            gap: chrome.space.gap,
            padding: chrome.space.cardPadding,
          }}
        >
          <Kicker>type samples</Kicker>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'baseline',
              gap: chrome.space.gap,
            }}
          >
            <Kicker>kicker</Kicker>
            <Label>label</Label>
            <Mono>mono</Mono>
            <Sans>sans</Sans>
          </div>
        </section>
        <aside
          style={{
            ...frame,
            display: 'flex',
            flexDirection: 'column',
            flex: '1 1 20rem',
          }}
        >
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              boxSizing: 'border-box',
              height: chrome.space.headerHeight,
              paddingInline: chrome.space.cardPadding,
              background: chrome.color.void,
              borderBottom: `1px solid ${chrome.color.charcoal300}`,
            }}
          >
            <Kicker>inspector</Kicker>
          </header>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: chrome.space.gap,
              padding: chrome.space.cardPadding,
            }}
          >
            <Row label="classification" />
            <Row label="locality" />
            <Row label="tags" />
          </div>
        </aside>
      </main>
    </div>
  );
}

function Card() {
  return (
    <div
      style={{
        ...frame,
        display: 'flex',
        flexDirection: 'column',
        gap: chrome.space.gap,
        padding: chrome.space.cardPadding,
        background: chrome.color.charcoal500,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: chrome.space.gap,
        }}
      >
        <Field label="title">
          <Socket />
        </Field>
        <Field label="status">
          <Pill />
        </Field>
      </div>
      <Field label="media">
        <Socket kind="media" />
      </Field>
      <Field label="claim">
        <Socket />
      </Field>
      <Field label="locality">
        <Socket />
      </Field>
      <Field label="tags">
        <Socket />
      </Field>
    </div>
  );
}

function Row({ label }: { readonly label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: chrome.space.gap,
        borderBottom: `1px solid ${chrome.color.charcoal300}`,
        paddingBottom: chrome.space.cardPadding,
      }}
    >
      <Label>{label}</Label>
      <Socket style={{ flex: 1 }} />
    </div>
  );
}

function Field({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: chrome.space.pillInlinePadding,
      }}
    >
      <Label>{label}</Label>
      {children}
    </div>
  );
}
