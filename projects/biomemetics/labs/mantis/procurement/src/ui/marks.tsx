export function Slot({ value }: { value: string | null }) {
  if (value === null || value === '') {
    return <span className="slot-empty" aria-label="empty" />;
  }
  return <span className="slot">{value}</span>;
}

export function Well({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  const empty = value === undefined || value === null || value === '';
  return (
    <span
      className="well"
      data-empty={empty ? 'true' : 'false'}
      aria-label={label}
    >
      {empty ? null : value}
    </span>
  );
}
