"use client";
// Twin (design-spec §2.8): round logo button -> input pill -> thinking -> streamed answer card with chips.
// Answers are mocked from sample data (lib/farm-view/twin-mock.ts) and labelled "Sample answer".
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { color, layout, motion as m, zIndex } from "@/lib/farm-view/tokens";
import { TWIN_THINK_MS, twinAnswer, type TwinAnswer } from "@/lib/farm-view/twin-mock";
import { sound } from "@/lib/ui/sound";

import { FvButton } from "./FvButton";
import { ArrowUp, Logo, X } from "./icons";

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];
type Turn = { q: string; a: TwinAnswer; words: number; thinking: boolean };

export function Twin({ bottom, onPlantingComparison }: { bottom?: number; onPlantingComparison?: () => void }) {
  const reduced = !!useReducedMotion();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [turn, setTurn] = useState<Turn | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clear, []);

  const close = () => {
    clear();
    setOpen(false);
    setTurn(null);
    setText("");
    sound.close();
    requestAnimationFrame(() => btn.current?.focus());
  };
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const ask = (q: string) => {
    q = q.trim();
    if (!q) return;
    clear();
    const a = twinAnswer(q);
    const total = a.answer.split(" ").length;
    setText("");
    setTurn({ q, a, words: 0, thinking: true });
    timers.current.push(
      setTimeout(() => {
        if (reduced) return setTurn({ q, a, words: total, thinking: false });
        setTurn({ q, a, words: 0, thinking: false });
        for (let i = 1; i <= total; i++) timers.current.push(setTimeout(() => setTurn((t) => t && { ...t, words: i }), i * m.streamWordMs));
      }, TWIN_THINK_MS),
    );
  };

  const thinking = !!turn?.thinking;
  const done = !!turn && !thinking && turn.words >= turn.a.answer.split(" ").length;
  const P = layout.twinPill;

  return (
    <div style={{ position: "absolute", left: "50%", bottom: bottom ?? layout.twinButton.bottom, transform: "translateX(-50%)", zIndex: zIndex.twin, display: "grid", justifyItems: "center" }}>
      <AnimatePresence>
        {open && turn && (
          <motion.section
            key="answer"
            data-testid="twin-answer"
            aria-label="Twin answer"
            aria-live="polite"
            className="fv-glass fv-answer fv-auto"
            style={{ position: "absolute", bottom: P.height + 10, transformOrigin: "bottom center" }}
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: m.popFromScale, y: m.twinAnswerRiseY }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: m.popEnterMs / 1000, ease: EASE_OUT } }}
            exit={{ opacity: 0, transition: { duration: m.popExitMs / 1000 } }}
          >
            <div style={{ display: "flex", alignItems: "center" }}>
              <span className="fv-cap">Twin · Synthetic preview (not this farm’s measurements)</span>
              <FvButton className="fv-icon" style={{ width: 24, height: 24, marginLeft: "auto" }} aria-label="Close Twin" onClick={close}>
                <X size={14} />
              </FvButton>
            </div>
            <p className="q">{turn.q}</p>
            {thinking ? (
              <p className="fv-sum">{turn.a.status}</p>
            ) : (
              <p className="a">
                {turn.a.answer.split(" ").slice(0, turn.words).join(" ")}
                {!done && <span className="caret" aria-hidden />}
              </p>
            )}
            {done && turn.a.chips.length > 0 && (
              <div className="chips">
                {turn.a.chips.map((c, i) => (
                  <motion.div key={c} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: (i * m.staggerMs) / 1000 }}>
                    <FvButton className="chip" onClick={() => ask(c)}>{c}</FvButton>
                  </motion.div>
                ))}
              </div>
            )}
            {done && turn.a.plantingComparison && onPlantingComparison && (
              <FvButton className="chip" onClick={() => {
                close();
                onPlantingComparison();
              }}>Open planting comparison</FvButton>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      <LayoutGroup>
        {open ? (
          <motion.form
            layoutId="twin-shell"
            className="fv-glass fv-twinpill fv-auto"
            style={{ width: P.width, height: P.height, borderRadius: P.height / 2, padding: P.pad }}
            transition={m.twinMorph}
            onSubmit={(e) => {
              e.preventDefault();
              if (!thinking) ask(text);
            }}
          >
            <FvButton className="logo" aria-label="Close Twin" onClick={close} style={{ width: P.send, height: P.send }}>
              <Logo size={P.icon} spin={thinking && !reduced} />
            </FvButton>
            <motion.input
              autoFocus
              aria-label="Ask the synthetic preview"
              placeholder="Ask the synthetic preview"
              value={text}
              disabled={thinking}
              onChange={(e) => setText(e.target.value)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: 0.06, duration: 0.12 } }}
            />
            <FvButton
              type="submit"
              className="send"
              aria-label="Send"
              disabled={!text.trim() || thinking}
              tapSound={text.trim() ? "tap" : "none"}
              style={{ width: P.send, height: P.send, background: color.accent, opacity: text.trim() || thinking ? 1 : 0.4, color: color.accentInk }}
            >
              {thinking ? <span className="spin" aria-hidden /> : <ArrowUp size={16} />}
            </FvButton>
          </motion.form>
        ) : (
          <motion.div layoutId="twin-shell" transition={m.twinMorph} style={{ borderRadius: layout.twinButton.size / 2 }}>
            <FvButton
              ref={btn}
              className="fv-glass fv-twin fv-auto"
              aria-label="Ask Twin preview"
              aria-expanded={false}
              data-testid="twin-button"
              onClick={() => {
                setOpen(true);
                sound.pop();
              }}
            >
              <Logo size={layout.twinButton.icon} />
              <span className="sr-only">Synthetic preview</span>
            </FvButton>
          </motion.div>
        )}
      </LayoutGroup>
    </div>
  );
}
