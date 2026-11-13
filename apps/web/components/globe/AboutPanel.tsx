"use client";
// "About" button + dialog (header). Holds the old landing-page content: how it works and the roadmap.
// Native <dialog>: showModal() traps focus and Escape closes it.
import Link from "next/link";
import { useRef } from "react";

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

export function AboutPanel() {
  const ref = useRef<HTMLDialogElement>(null);
  const close = () => ref.current?.close();
  return (
    <>
      <button type="button" aria-haspopup="dialog" onClick={() => ref.current?.showModal()} className="rounded-md border border-line px-3 py-1 text-ink hover:bg-surface-2">
        About
      </button>
      {/* Click on the backdrop (the dialog element itself) closes; clicks inside land on the inner div. */}
      <dialog ref={ref} aria-labelledby="about-title" onClick={(e) => e.target === e.currentTarget && close()} className="m-auto max-h-[calc(100dvh-2rem)] w-[min(44rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface p-0 text-ink backdrop:bg-black/60">
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium tracking-wide text-accent uppercase">NASA Space Apps 2026 · Field Shift</p>
              <h2 id="about-title" className="mt-1 font-display text-2xl">
                About FieldTwin
              </h2>
            </div>
            <button type="button" onClick={close} className="rounded-md border border-line px-3 py-1 text-sm hover:bg-surface-2">
              Close
            </button>
          </div>
          <p className="mt-3 text-ink-muted">
            FieldTwin builds a 3D model of farmland from open elevation data, replays storms from the NASA POWER record on it, and compares rotations side by side. Results are relative comparisons, not predictions.
          </p>

          <h3 className="mt-6 font-display text-xl">How it works</h3>
          <ol className="mt-3 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <p className="font-mono text-sm text-ink-muted">Step {i + 1}</p>
                <h4 className="mt-1 font-semibold">{s.title}</h4>
                <p className="mt-1 text-sm text-ink-muted">{s.body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm text-ink-muted">
            Every number carries its unit and a label saying whether it was measured, derived, modeled, assumed, or is only relative.{" "}
            <Link href="/methods" onClick={close} className="text-accent underline underline-offset-2">
              Read the data and methods
            </Link>
            .
          </p>

          <h3 className="mt-6 font-display text-xl">Roadmap</h3>
          <p className="mt-1 text-sm text-ink-muted">Ideas we have not built. They do not work in this version.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {ROADMAP.map((r) => (
              <Card key={r.title} className="border-dashed bg-transparent">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-semibold">{r.title}</h4>
                  <span className="rounded border border-ink-muted px-1.5 text-xs font-semibold text-ink-muted">Not available yet</span>
                </div>
                <p className="mt-2 text-sm text-ink-muted">{r.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </dialog>
    </>
  );
}
