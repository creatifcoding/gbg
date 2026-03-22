import { useCallback, useState } from 'react';
import { VANTA_COLORS, VANTA_TYPOGRAPHY } from '@/components/portal';
import type { ErrorState } from '../hooks';

export function ErrorPanel({ error }: { error: ErrorState | null }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!error) return;
    const payload = `${error.context}\n${error.message}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    }
  }, [error]);

  if (!error) return null;

  return (
    <div
      style={{
        marginTop: 10,
        padding: '10px 12px',
        borderRadius: 8,
        border: `1px solid ${VANTA_COLORS.accent.roseMuted}`,
        background: 'rgba(251, 113, 133, 0.08)',
      }}
    >
      <div className="flex items-center justify-between" style={{ gap: 12 }}>
        <span
          style={{
            ...VANTA_TYPOGRAPHY.preset.label,
            fontSize: 'var(--tmnl-text-xs, 12px)',
            color: VANTA_COLORS.accent.rose,
          }}
        >
          ERROR
        </span>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            ...VANTA_TYPOGRAPHY.preset.label,
            fontSize: 'var(--tmnl-text-xs, 12px)',
            color: copied
              ? VANTA_COLORS.accent.emerald
              : VANTA_COLORS.text.muted,
            border: `1px solid ${VANTA_COLORS.surface.border}`,
            background: 'transparent',
            borderRadius: 6,
            padding: '4px 10px',
            cursor: 'pointer',
          }}
        >
          {copied ? 'COPIED' : 'COPY'}
        </button>
      </div>
      <pre
        style={{
          marginTop: 8,
          whiteSpace: 'pre-wrap',
          fontFamily: VANTA_TYPOGRAPHY.family.mono,
          fontSize: 'var(--tmnl-text-xs, 12px)',
          color: VANTA_COLORS.text.secondary,
          userSelect: 'text',
        }}
      >
        {error.context}
        {'\n'}
        {error.message}
      </pre>
    </div>
  );
}
