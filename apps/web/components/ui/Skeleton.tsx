/** Placeholder block while data loads. Announces "Loading" once via the label. */
export function Skeleton({ className = "h-4 w-full", label }: { className?: string; label?: string }) {
  return (
    <div role={label ? "status" : undefined} aria-label={label} aria-hidden={label ? undefined : true} className={`motion-safe:animate-pulse rounded bg-surface-2 ${className}`} />
  );
}
