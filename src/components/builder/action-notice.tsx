export function ActionNotice({
  title,
  detail,
}: {
  title: string;
  detail?: string;
}) {
  return (
    <div
      className="mb-4 rounded-lg border border-signal-may/35 bg-signal-may/10 px-4 py-3 text-sm text-ink-800"
      role="status"
      aria-live="polite"
    >
      <p className="font-medium text-ink-900">{title}</p>
      {detail ? (
        <p className="mt-1 text-xs leading-relaxed text-ink-600">{detail}</p>
      ) : null}
    </div>
  );
}
