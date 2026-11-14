"use client";
// Product header: wordmark, Methods & data, data badges, About, Presenter. In the farm twin it collapses to a slim
// one-line bar (farm name + the support-not-replace sentence) so the 3D farm gets the screen.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { Badge } from "@/components/ui/Badge";
import { SUPPORT_SENTENCE } from "@/components/ui/SupportBanner";
import { mockExtrasEnabled } from "@/components/viewer/meta";
import { isMock, offline } from "@/lib/api/client";
import { useChrome, usePresenter } from "@/lib/store";

import { AboutPanel } from "./globe/AboutPanel";

export function Header() {
  const onMethods = usePathname().startsWith("/methods");
  const presenter = usePresenter((s) => s.presenter);
  const twinFarm = useChrome((s) => s.twinFarm);
  const slim = !!twinFarm && !onMethods;
  useEffect(() => {
    document.documentElement.toggleAttribute("data-twin", slim);
  }, [slim]);

  const badges = (
    <>
      {offline && <span className="rounded border border-ink-muted px-2 py-0.5 text-xs font-medium text-ink">Offline: pre-built data</span>}
      {isMock && <Badge variant="mock" />}
      {(isMock || mockExtrasEnabled) && <span className="presenter-only rounded border border-ink-muted px-1.5 text-xs text-ink-muted">mock data</span>}
    </>
  );
  const presenterBtn = (cls: string) => (
    <button type="button" aria-pressed={presenter} onClick={() => usePresenter.setState({ presenter: !presenter })} className={cls}>
      Presenter mode{presenter ? ": on" : ""}
    </button>
  );

  if (slim) {
    return (
      <header className="theme-dark h-10 border-b border-white/10 bg-[#0b0d11] text-ink">
        <div className="flex h-full items-center gap-4 overflow-hidden px-4 text-sm whitespace-nowrap">
          <Link href="/" className="font-display text-base font-semibold tracking-tight">
            FieldTwin
          </Link>
          <span className="text-ink-muted" aria-hidden>
            /
          </span>
          <span className="font-medium">{twinFarm}</span>
          <p role="note" className="min-w-0 flex-1 truncate text-center text-xs text-ink-muted">
            {SUPPORT_SENTENCE}
          </p>
          {badges}
          <nav aria-label="Main">
            <Link href="/methods" className="text-ink-muted hover:text-ink">
              Methods &amp; data
            </Link>
          </nav>
          <AboutPanel />
          {presenterBtn("rounded-md border border-white/15 px-2 py-0.5 text-xs hover:bg-white/10")}
        </div>
      </header>
    );
  }

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
          {badges}
          <AboutPanel />
          {presenterBtn("rounded-md border border-line px-3 py-1 text-ink hover:bg-surface-2")}
        </div>
      </div>
    </header>
  );
}
