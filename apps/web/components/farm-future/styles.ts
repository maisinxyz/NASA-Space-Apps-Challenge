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
.ff-menu { position: absolute; top: calc(100% + 8px); left: 0; width: min(250px, calc(100vw - 32px)); max-height: 45dvh; overflow-y: auto; border-radius: 14px; padding: 6px; z-index: 5; }
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
.ff-tl-readout { --ff-yr: 40px; --ff-yr-w: calc(var(--ff-yr) * 5.2); --ff-meta-fs: 13px; --ff-meta-w: calc(var(--ff-meta-fs) * 16); --ff-c-play: 32px; --ff-c-tog: 132px; --ff-row: calc(var(--ff-yr) * 1.2); position: absolute; left: 0; right: 0; bottom: 82px; height: var(--ff-row); display: grid; grid-template-columns: var(--ff-c-play) var(--ff-yr-w) var(--ff-meta-w) var(--ff-c-tog) minmax(0, 1fr) auto; grid-template-rows: var(--ff-row); column-gap: 12px; row-gap: 0; align-items: center; }
.ff-tl-play { width: var(--ff-c-play); height: var(--ff-c-play); }
.ff-tl-year { display: block; width: var(--ff-yr-w); height: var(--ff-row); overflow: hidden; white-space: nowrap; text-align: left; font: 400 var(--ff-yr)/1 ${font.display}; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; color: ${color.ink}; }
.ff-tl-metabox { display: block; width: var(--ff-meta-w); height: 16px; overflow: hidden; white-space: nowrap; text-align: left; font: 400 var(--ff-meta-fs)/16px ${font.sans}; font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; color: ${color.ink}; }
.ff-tl-meta-short { display: none; }
.ff-tl-meta { font: 400 13px/16px ${font.sans}; color: ${color.ink}; }
.ff-tl-tick { position: absolute; width: 1px; background: rgba(242,235,221,0.45); }
.ff-tl-lab { position: absolute; transform: translateX(-50%); font: 400 11.5px/14px ${font.sans}; color: #E4DBCB; white-space: nowrap; text-shadow: ${shadow.textOnMap}; }
.ff-tl-lab[data-sel="true"] { color: ${color.ink}; font-weight: 600; }
/* Responsive tiers, keyed on the nearest container named fw (window body). Regular = base rules above. */
@container fw (max-width: 519px) {
  .ff-tl-readout { --ff-yr: clamp(24px, 5.5cqi, 28px); --ff-meta-w: calc(var(--ff-meta-fs) * 9.6); --ff-c-play: 40px; --ff-c-tog: 82px; --ff-row: calc(var(--ff-yr) * 1.2); bottom: 76px; height: 74px; grid-template-columns: var(--ff-c-play) var(--ff-meta-w) var(--ff-c-tog) minmax(0, 1fr) auto; grid-template-rows: var(--ff-row) 40px; column-gap: 8px; }
  .ff-tl-readout > * { grid-row: 2; }
  .ff-tl-readout > .ff-tl-year { grid-row: 1; grid-column: 1 / -1; }
  .ff-tl-readout .ff-seg { padding: 0; border: 0; }
  .ff-tl-readout .ff-seg .fv-seg { width: 40px; min-width: 40px; height: 40px; padding: 0; }
  .ff-tl-meta-long { display: none; }
  .ff-tl-meta-short { display: inline; }
}
@container fw (min-width: 900px) {
  .ff-tl-readout { --ff-yr: clamp(40px, 4cqi, 52px); --ff-meta-fs: 14px; padding: 0 12px; column-gap: 16px; }
}
.ff-legend { display: flex; gap: 14px; font: 400 11px/14px ${font.sans}; color: #E4DBCB; white-space: nowrap; text-shadow: ${shadow.textOnMap}; }
.ff-legend > span { display: inline-flex; align-items: center; gap: 6px; }
.ff-pane-line { position: absolute; top: 0; bottom: 0; width: 1px; background: rgba(242,235,221,0.45); }
.ff-drawer { position: absolute; right: 0; top: 0; bottom: 0; width: 360px; background: #1E1915; border-left: 1px solid ${color.glassBorder}; padding: 18px 22px; display: flex; flex-direction: column; gap: 6px; color: ${color.ink}; }
.ff-link { font: 400 12px/16px ${font.sans}; color: ${color.ink}; text-decoration: underline; text-decoration-color: rgba(242,235,221,0.45); text-underline-offset: 3px; align-self: flex-start; }
.ff-pills-col { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.ff-future-bar { display: flex !important; align-items: center; justify-content: space-between; width: 100%; height: 38px; padding: 0 14px !important; border-radius: 10px; background: rgba(27,22,18,0.75); }
.ff-future-bar:hover { background: rgba(242,235,221,0.12); border-color: rgba(242,235,221,0.24); }
.ff-future-bar-left { display: flex; align-items: center; gap: 10px; }
.ff-future-bar-left .l { font-size: 13px; font-weight: 500; color: #f2ebdd; }
.ff-future-bar-right { display: flex; align-items: baseline; gap: 6px; }
`;
