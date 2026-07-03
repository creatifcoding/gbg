import { useRef, type CSSProperties } from 'react'
import { color, font, fontSize, fontWeight, radius, space } from '../tokens'

export interface FileInputProps {
  label: string
  accept?: string
  onSelect: (file: File) => void
  preview?: string
  placeholder?: string
}

export function FileInput({ label, accept, onSelect, preview, placeholder = 'Drop file or click to upload' }: FileInputProps) {
  const ref = useRef<HTMLInputElement>(null)

  const labelS: CSSProperties = { fontFamily: font.mono, fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: color.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: space[1] }
  const zoneS: CSSProperties = {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: space[2],
    padding: space[6], border: `2px dashed ${color.border}`, borderRadius: radius.lg,
    background: color.surfaceAlt, cursor: 'pointer', minHeight: 80, textAlign: 'center',
  }

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onSelect(f) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={labelS}>{label}</span>
      <div style={zoneS}
        onClick={() => ref.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        {preview ? (
          <img src={preview} alt="preview" style={{ maxHeight: 60, borderRadius: radius.sm }} />
        ) : (
          <span style={{ fontFamily: font.sans, fontSize: fontSize.sm, color: color.textMuted }}>📎 {placeholder}</span>
        )}
      </div>
      <input ref={ref} type="file" accept={accept} onChange={(e) => { const f = e.target.files?.[0]; if (f) onSelect(f) }} style={{ display: 'none' }} />
    </div>
  )
}
