// Scoped CSS for Future / Compare mode. Built from lib/farm-view/tokens.ts; same glass, type and radii as the
// farm view. Minimal on purpose: hairlines, 3–4 px bars, no glows.
import { color, font, radius, shadow } from "@/lib/farm-view/tokens";

export const FF_CSS = `
.ff-card { position: absolute; border-radius: ${radius.card}px; padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 9px; color: ${color.ink}; }
.ff-head { display: flex; align-items: center; gap: 8px; min-height: 28px; }
.ff-head-icon { display: inline-grid; color: ${color.inkSecondary}; }
.ff-title { margin: 0; font: 500 13px/18px ${font.sans}; flex: 1; }
.ff-headline { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.ff-big { font-weight: 500; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; line-height: 1.1; }
.ff-sub { font: 400 12px/16px ${font.sans}; color: ${color.inkSecondary}; }
.ff-p { margin: 0; font: 400 12.5px/17px ${font.sans}; color: ${color.inkSecondary}; }
.ff-label { font: 400 11px/14px ${font.sans}; color: ${color.inkSecondary}; letter-spacing: .01em; }
.ff-row { display: flex; justify-content: space-between; align-items: baseline; font: 400 12.5px/17px ${font.sans}; color: ${color.inkSecondary}; font-variant-numeric: tabular-nums; }
.ff-basis { display: inline-flex; align-items: center; height: 18px; padding: 0 6px; border-radius: 9px; border: 1px solid rgba(242,235,221,0.22); font: 400 10px/1 ${font.sans}; color: ${color.inkSecondary}; letter-spacing: .02em; }
.ff-synth { display: inline-flex; align-items: center; height: 20px; padding: 0 8px; border-radius: 10px; border: 1px dashed rgba(242,235,221,0.35); font: 400 11px/1 ${font.sans}; color: ${color.ink}; white-space: nowrap; }
.ff-bar { position: relative; flex: 1; background: rgba(242,235,221,0.18); }
.ff-bar-mark { position: absolute; width: 1px; background: ${color.ink}; }
.ff-hr { height: 1px; background: ${color.hairline}; border: 0; margin: 0; }
.ff-seg { display: flex; gap: 2px; padding: 3px; border-radius: 9999px; background: rgba(27,22,18,0.55); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid ${color.glassBorder}; }
.ff-seg .fv-seg { height: 28px; padding: 0 12px; font-size: 12.5px; }
.ff-menu { position: absolute; top: calc(100% + 8px); right: 0; width: 250px; border-radius: 14px; padding: 6px; z-index: 5; }
.ff-menu-group { font: 400 11px/14px ${font.sans}; color: ${color.inkSecondary}; padding: 8px 10px 4px; }
.ff-menu-item { display: flex !important; align-items: center; gap: 10px; width: 100%; height: 34px; padding: 0 10px !important; border-radius: 8px; font: 400 13px/16px ${font.sans}; color: ${color.ink}; text-align: left; }
.ff-menu-item:hover { background: ${color.fillHover} !important; }
.ff-menu-item[aria-checked="true"] { background: rgba(226,184,102,0.14) !important; }
.ff-lens-chip { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 4px 0 12px; border-radius: 9999px; background: rgba(226,184,102,0.16); border: 1px solid rgba(226,184,102,0.5); font: 500 13px/16px ${font.sans}; color: ${color.ink}; }
.ff-whatif { display: inline-flex; align-items: center; gap: 8px; height: 36px; padding: 0 14px 0 12px; border-radius: 9999px; font: 400 13px/16px ${font.sans}; }
.ff-whatif[data-active="true"] { background: rgba(226,184,102,0.16) !important; border-color: rgba(226,184,102,0.5) !important; }
.ff-slider { position: relative; height: 18px; touch-action: none; cursor: pointer; }
.ff-slider .track { position: absolute; left: 0; right: 0; top: 8px; height: 1px; background: rgba(242,235,221,0.45); }
.ff-slider .zero { position: absolute; top: 4px; width: 1px; height: 9px; background: ${color.inkMuted}; }
.ff-slider .fill { position: absolute; top: 8px; height: 1px; background: ${color.accent}; }
.ff-slider .knob { position: absolute; top: 3px; width: 12px; height: 12px; margin-left: -6px; border-radius: 6px; background: ${color.ink}; box-shadow: 0 0 0 3px rgba(242,235,221,0.14); }
.fv-root .ff-slider:focus-visible { outline: none; }
.ff-slider:focus-visible .knob { box-shadow: 0 0 0 3px ${color.focusRing}; }
.ff-tl-year { font: 400 40px/1 ${font.display}; letter-spacing: -0.02em; color: ${color.ink}; }
.ff-tl-meta { font: 400 13px/16px ${font.sans}; color: ${color.ink}; }
.ff-tl-tick { position: absolute; width: 1px; background: rgba(242,235,221,0.45); }
.ff-tl-lab { position: absolute; transform: translateX(-50%); font: 400 11.5px/14px ${font.sans}; color: #E4DBCB; white-space: nowrap; text-shadow: ${shadow.textOnMap}; }
.ff-tl-lab[data-sel="true"] { color: ${color.ink}; font-weight: 600; }
.ff-legend { display: flex; gap: 14px; font: 400 11px/14px ${font.sans}; color: #E4DBCB; white-space: nowrap; text-shadow: ${shadow.textOnMap}; }
.ff-legend > span { display: inline-flex; align-items: center; gap: 6px; }
.ff-pane-line { position: absolute; top: 0; bottom: 0; width: 1px; background: rgba(242,235,221,0.45); }
.ff-drawer { position: absolute; right: 0; top: 0; bottom: 0; width: 360px; background: #1E1915; border-left: 1px solid ${color.glassBorder}; padding: 18px 22px; display: flex; flex-direction: column; gap: 6px; color: ${color.ink}; }
.ff-link { font: 400 12px/16px ${font.sans}; color: ${color.ink}; text-decoration: underline; text-decoration-color: rgba(242,235,221,0.45); text-underline-offset: 3px; align-self: flex-start; }
`;
