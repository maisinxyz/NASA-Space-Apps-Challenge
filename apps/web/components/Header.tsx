"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/ui/Badge";
import { mockExtrasEnabled } from "@/components/viewer/meta";
import { isMock, offline } from "@/lib/api/client";
import { usePresenter } from "@/lib/store";

import { AboutPanel } from "./globe/AboutPanel";

const NAV = [
  { href: "/explore", label: "Sites" },
  { href: "/scan", label: "Land Scan" },
  { href: "/viewer", label: "Viewer" },
  { href: "/simulate", label: "Simulate" },
  { href: "/lab", label: "Rotation Lab" },
  { href: "/methods", label: "Data & Methods" },
];

export function Header() {
  const path = usePathname();
  const presenter = usePresenter((s) => s.presenter);
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="font-display text-xl font-semibold tracking-tight text-ink">
          FieldTwin
        </Link>
        <nav aria-label="Main" className="flex flex-1 flex-wrap gap-x-4 gap-y-1 text-sm">
          {NAV.map((n) => {
            const current = path === n.href || path.startsWith(`${n.href}/`);
            return (
              <Link key={n.href} href={n.href} aria-current={current ? "page" : undefined} className={`border-b-2 py-0.5 ${current ? "border-accent text-ink" : "border-transparent text-ink-muted hover:text-ink"}`}>
                {n.label}
              </Link>
            );
          })}
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
