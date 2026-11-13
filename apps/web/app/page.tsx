import Link from "next/link";

import { Card } from "@/components/ui/Card";

const STEPS = [
  { title: "Pick your land", body: "Start from a pre-built Fraser Valley site, or scan your own from a photo and a location. Elevation always comes from open data." },
  { title: "Replay a real storm", body: "Choose a storm from the NASA POWER record and watch where water runs and pools on a 3D model of the land." },
  { title: "Compare rotations", body: "Run the same storm on two crop rotations side by side. The difference shows on the land, with the evidence behind it." },
];

const ROADMAP = [
  { title: "Drone capture", body: "Building the model from drone imagery." },
  { title: "Video capture", body: "Building the model from a walk-around video." },
];

/** Decorative contour lines, drawn in code so the page needs no image download. */
function ContourHero() {
  const rings = [0, 1, 2, 3, 4, 5, 6, 7];
  return (
    <svg viewBox="0 0 400 300" aria-hidden className="h-full w-full">
      <rect width="400" height="300" fill="var(--surface-2)" />
      {rings.map((i) => (
        <ellipse key={i} cx={250 - i * 6} cy={130 + i * 4} rx={30 + i * 26} ry={18 + i * 16} transform={`rotate(-12 ${250 - i * 6} ${130 + i * 4})`} fill="none" stroke="var(--ink-muted)" strokeOpacity={0.25 + i * 0.05} strokeWidth={i % 4 === 0 ? 1.6 : 0.8} />
      ))}
      <path d="M40 270 C 110 230, 150 220, 205 160" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeDasharray="6 5" />
      <circle cx="40" cy="270" r="4" fill="var(--accent)" />
    </svg>
  );
}

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="grid items-center gap-10 py-16 md:grid-cols-[1.1fr_1fr] md:py-24">
        <div>
          <p className="text-sm font-medium tracking-wide text-accent uppercase">NASA Space Apps 2026 · Field Shift</p>
          <h1 className="mt-3 font-display text-4xl leading-tight text-ink md:text-5xl">See how the same real storm would move across your land under different crop rotations.</h1>
          <p className="mt-5 max-w-xl text-lg text-ink-muted">
            FieldTwin builds a 3D model of farmland from open elevation data, replays storms from the NASA POWER record on it, and compares rotations side by side. Results are relative comparisons, not predictions.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/explore" className="rounded-md bg-accent px-5 py-2.5 font-medium text-accent-ink hover:opacity-90">
              Try a Fraser Valley site
            </Link>
            <Link href="/scan" className="rounded-md border border-line bg-surface px-5 py-2.5 font-medium text-ink hover:bg-surface-2">
              Scan your own land
            </Link>
          </div>
        </div>
        <div className="aspect-[4/3] overflow-hidden rounded-lg border border-line">
          <ContourHero />
        </div>
      </section>

      <section aria-labelledby="how" className="border-t border-line py-14">
        <h2 id="how" className="font-display text-2xl text-ink">
          How it works
        </h2>
        <ol className="mt-6 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <p className="font-mono text-sm text-ink-muted">Step {i + 1}</p>
              <h3 className="mt-1 font-semibold text-ink">{s.title}</h3>
              <p className="mt-2 text-ink-muted">{s.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-ink-muted">
          Every number carries its unit and a label saying whether it was measured, derived, modeled, assumed, or is only relative.{" "}
          <Link href="/methods" className="text-accent underline underline-offset-2">
            Read the data and methods
          </Link>
          .
        </p>
      </section>

      <section aria-labelledby="roadmap" className="border-t border-line py-14">
        <h2 id="roadmap" className="font-display text-2xl text-ink">
          Roadmap
        </h2>
        <p className="mt-2 text-ink-muted">Ideas we have not built. They do not work in this version.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {ROADMAP.map((r) => (
            <Card key={r.title} className="border-dashed bg-transparent">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-ink">{r.title}</h3>
                <span className="rounded border border-ink-muted px-1.5 text-xs font-semibold text-ink-muted">Not available yet</span>
              </div>
              <p className="mt-2 text-ink-muted">{r.body}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
