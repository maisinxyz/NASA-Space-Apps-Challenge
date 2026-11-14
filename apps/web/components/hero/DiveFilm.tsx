"use client";
// Dive film: a pre-rendered fly-through that plays over the live globe from the click while the camera cuts to the
// farm underneath, then dissolves into the live 3D farm. The clip was generated from two frames of this app (the whole-Earth view centred on
// the farm, and the farm's landing framing), so its first and last frames line up with what the globe draws underneath.
// The film is illustrative (AI-generated video, not imagery of the real route): the caption says so while it plays.
// Only farms listed in DIVE_FILMS have one; every other farm, reduced motion, or a clip that is not loaded in time,
// uses the procedural dive veil (Arrival.tsx) instead.
import { useEffect, useRef, useState } from "react";

export type DiveFilmSpec = {
  /** Tried in order; the first that loads is used. */
  sources: string[];
  /** Clip length, seconds (used only for the stall watchdog). */
  seconds: number;
};

/**
 * Agassiz: generated 2026-11-13 with Higgsfield (model minimax_h3_max, 832x480, 5.2 s, start + end keyframes captured
 * from this app at 16:9). agassiz-dive-2s.mp4 is a 1.71 s cut of that clip at its original speed (no speed-up): six
 * stretches kept with ffmpeg trim + concat (source seconds 0.30-0.70 globe, 1.05-1.25 clouds, 1.45-1.60 ocean,
 * 2.40-2.60 city, 3.15-3.40 trees, 4.60-end farm), so it still ends on the farm landing frame. The full clip stays in
 * public/hero/agassiz-dive.mp4. Local file only, so the demo works offline.
 */
export const DIVE_FILMS: Record<string, DiveFilmSpec> = {
  agassiz: {
    sources: ["/hero/agassiz-dive-2s.mp4"],
    seconds: 1.71,
  },
};

/** Dissolve from the live globe into the film, and from the film's last frame into the live farm, ms. */
// Click to interactive farm in 2 s: fade in + the 1.71 s film, then the dissolve (the panels arrive as it begins).
const FADE_IN_MS = 120;
const FADE_OUT_MS = 250;

type Stage = "idle" | "playing" | "leaving";

/**
 * Always mounted for a farm that has a film, so the clip is buffered before the click.
 * `run` = a dive to this farm is in progress and the film was ready when it began. `landed` = the live camera has
 * arrived. The film holds its last frame until both it has ended and the camera has landed, then dissolves.
 */
export function DiveFilm({
  spec,
  run,
  landed,
  onReady,
  onFinish,
  onFail,
}: {
  spec: DiveFilmSpec;
  run: boolean;
  landed: boolean;
  /** The clip is buffered enough to play through (or no longer is). */
  onReady(ready: boolean): void;
  /** The dissolve into the live farm has begun. */
  onFinish(): void;
  /** The clip could not play: fall back to the procedural dive. */
  onFail(): void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [ended, setEnded] = useState(false);
  const cb = useRef({ onFinish, onFail });
  cb.current = { onFinish, onFail };

  // Start on the click: the film covers the globe while the camera cuts to the farm underneath (Globe quickDive).
  useEffect(() => {
    const v = video.current;
    if (!run || !v) return;
    v.currentTime = 0;
    setStage("playing");
    v.play().catch(() => cb.current.onFail());
    // If playback stalls, treat the film as over so the arrival is never blocked.
    const watchdog = setTimeout(() => setEnded(true), (spec.seconds + 1) * 1000);
    return () => {
      clearTimeout(watchdog);
      v.pause();
      setStage("idle");
      setEnded(false);
    };
  }, [run, spec.seconds]);

  // Finish: last frame held until the live farm is ready underneath, then dissolve.
  useEffect(() => {
    if (stage !== "playing" || !ended || !landed) return;
    setStage("leaving");
    cb.current.onFinish();
  }, [stage, ended, landed]);

  const visible = stage === "playing";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <video
        ref={video}
        className="absolute inset-0 h-full w-full object-cover transition-opacity ease-in-out"
        style={{ opacity: visible ? 1 : 0, transitionDuration: `${visible ? FADE_IN_MS : stage === "leaving" ? FADE_OUT_MS : 0}ms` }}
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        onCanPlayThrough={() => onReady(true)}
        onEnded={() => setEnded(true)}
        onError={() => {
          onReady(false);
          if (run) cb.current.onFail();
        }}
      >
        {spec.sources.map((src, i) => (
          // The last source's failure is the clip's failure (errors on <source> do not reach the <video> handler).
          <source
            key={src}
            src={src}
            type="video/mp4"
            onError={
              i === spec.sources.length - 1
                ? () => {
                    onReady(false);
                    if (run) cb.current.onFail();
                  }
                : undefined
            }
          />
        ))}
      </video>
      <p
        className="absolute bottom-[7.5vh] left-[5vw] text-[11px] tracking-[0.04em] text-white/[0.7] transition-opacity duration-300 [text-shadow:0_1px_6px_#000]"
        style={{ opacity: visible ? 1 : 0 }}
      >
        Illustrative fly-in · AI-generated video
      </p>
    </div>
  );
}
