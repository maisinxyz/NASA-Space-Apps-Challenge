import Link from "next/link";

import type { Site, TerrainPackage } from "@/lib/api/types";

/** Who the data comes from, with licences. Full detail lives on /methods. */
export function Attribution({ terrain, site }: { terrain: TerrainPackage; site: Site | null }) {
  return (
    <section aria-labelledby="attr-h" className="text-xs text-ink-muted">
      <h2 id="attr-h" className="text-sm font-semibold text-ink">
        Data sources
      </h2>
      <ul className="mt-1 grid gap-1">
        {site?.attribution.map((a) => <li key={a}>{a}</li>)}
        {terrain.sources.map((s) => (
          <li key={`${s.role}-${s.name}`}>
            {s.name} ({s.role}), licence: {s.license}
          </li>
        ))}
        <li>
          Imagery: {terrain.texture.attribution}, licence: {terrain.texture.license}
        </li>
      </ul>
      <Link href="/methods" className="mt-2 inline-block text-accent underline underline-offset-2">
        Data &amp; Methods
      </Link>
    </section>
  );
}
