import type { ReactNode } from "react";

import { ApiError } from "@/lib/api/client";

/** Plain-language error with the API's hint and an optional retry. Never leave a blank area on failure. */
export function ErrorCard({ title = "Something went wrong", error, onRetry, children }: { title?: string; error: unknown; onRetry?: () => void; children?: ReactNode }) {
  const api = error instanceof ApiError ? error : null;
  const message = api?.message ?? (error instanceof Error ? error.message : String(error));
  return (
    <div role="alert" className="rounded-lg border border-danger/50 bg-surface p-4">
      <p className="font-semibold text-danger">
        <span aria-hidden>! </span>
        {title}
      </p>
      <p className="mt-1 text-sm text-ink">{message}</p>
      {api?.hint && <p className="mt-1 text-sm text-ink-muted">{api.hint}</p>}
      {api && <p className="mt-1 font-mono text-xs text-ink-muted">{api.code}</p>}
      {(onRetry || children) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {onRetry && (
            <button type="button" onClick={onRetry} className="rounded-md border border-line bg-surface-2 px-3 py-1.5 text-sm font-medium hover:bg-line">
              Try again
            </button>
          )}
          {children}
        </div>
      )}
    </div>
  );
}
