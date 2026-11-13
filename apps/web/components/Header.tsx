"use client";
// Product header: wordmark, Methods & data, data badges, About, Presenter.
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/ui/Badge";
import { mockExtrasEnabled } from "@/components/viewer/meta";
import { isMock, offline } from "@/lib/api/client";
import { usePresenter } from "@/lib/store";

import { AboutPanel } from "./globe/AboutPanel";

export function Header() {
  const onMethods = usePathname().startsWith("/methods");
  const presenter = usePresenter((s) => s.presenter);
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="font-display text-xl font-semibold tracking-tight text-ink">
          FieldTwin
        </Link>
        <nav aria-label="Main" className="flex flex-1 flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href="/methods" aria-current={onMethods ? "page" : undefined} className={`border-b-2 py-0.5 ${onMethods ? "border-accent text-ink" : "border-transparent text-ink-muted hover:text-ink"}`}>
            Methods &amp; data
          </Link>
        </nav>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {offline && <span className="rounded border border-ink-muted px-2 py-0.5 text-xs font-medium text-ink">Offline: pre-built data</span>}
          {isMock && <Badge variant="mock" />}
          {(isMock || mockExtrasEnabled) && <span className="presenter-only rounded border border-ink-muted px-1.5 text-xs text-ink-muted">mock data</span>}
          <AboutPanel />
          <button type="button" aria-pressed={presenter} onClick={() => usePresenter.setState({ presenter: !presenter })} className="rounded-md border border-line px-3 py-1 text-ink hover:bg-surface-2">
            Presenter mode{presenter ? ": on" : ""}
          </button>
        </div>
      </div>
    </header>
  );
}
