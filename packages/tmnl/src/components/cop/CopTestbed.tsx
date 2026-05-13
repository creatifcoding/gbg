/**
 * COP Testbed — panel-free mode
 *
 * Route: /testbed/cop
 */

import { type FC } from 'react'

export const CopTestbed: FC = () => {
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#0a0a0a',
        color: '#c8e4d8',
        fontFamily: 'var(--tmnl-font-mono, monospace)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 16px',
          borderBottom: '1px solid rgba(200,228,216,0.1)',
          backgroundColor: 'rgba(200,228,216,0.02)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--tmnl-text-base, 16px)',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          COP
        </span>
        <span
          style={{
            fontSize: 'var(--tmnl-text-xs, 12px)',
            color: 'rgba(200,228,216,0.55)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Panel-free mode
        </span>
      </div>

      <div
        style={{
          flex: 1,
          padding: 16,
          overflowY: 'auto',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <div
          style={{
            width: 'min(900px, 100%)',
            border: '1px solid rgba(200,228,216,0.14)',
            background: 'rgba(200,228,216,0.03)',
            padding: 20,
          }}
        >
          <div
            style={{
              fontSize: 'var(--tmnl-text-sm, 14px)',
              color: '#c8e4d8',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 10,
            }}
          >
            Panels removed
          </div>
          <div
            style={{
              fontSize: