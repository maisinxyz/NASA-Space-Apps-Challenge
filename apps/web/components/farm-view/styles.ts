// Scoped CSS for the farm view, generated from lib/farm-view/tokens.ts so no value is retyped.
import { blur, color, font, layout, radius, shadow, type } from "@/lib/farm-view/tokens";

const t = (k: keyof typeof type) => `font: ${type[k].weight} ${type[k].size}px/${type[k].lineHeight}px ${font[type[k].family]};`;

export const FV_CSS = `
.fv-root { font-family: ${font.sans}; color: ${color.ink}; font-variant-numeric: tabular-nums; pointer-events: none; }
.fv-root :where(*) { box-sizing: border-box; }
@layer base { .fv-root :where(button) { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; } }
.fv-root :where(*) { scrollbar-width: thin; scrollbar-color: rgba(242,235,221,.26) transparent; }
.fv-root ::-webkit-scrollbar { width: 8px; height: 8px; }
.fv-root ::-webkit-scrollbar-track { background: transparent; }
.fv-root ::-webkit-scrollbar-thumb { background: rgba(242,235,221,.26); border-radius: 8px; border: 2px solid transparent; background-clip: padding-box; }
.fv-root :focus-visible { outline: 2px solid ${color.focusRing}; outline-offset: 2px; }
.fv-root .fv-auto { pointer-events: auto; }
.fv-glass { background: ${color.glass}; backdrop-filter: blur(${blur.glass}px); -webkit-backdrop-filter: blur(${blur.glass}px); border: 1px solid ${color.glassBorder}; box-shadow: ${shadow.glass}; }
.fv-onmap { text-shadow: ${shadow.textOnMap}; }
.fv-display { font-family: ${font.display}; }
.fv-back { ${t("backLink")} display: inline-flex; align-items: center; gap: 4px; height: 28px; color: ${color.ink}; text-decoration: none; }
.fv-back:hover { text-decoration: underline; }
.fv-title { ${t("farmTitle")} font-family: ${font.display}; margin: 4px 0 0; color: ${color.ink}; }
.fv-sub { ${t("subtitle")} margin: 2px 0 0; color: ${color.ink}; opacity: .9; }
.fv-bar { display: flex; align-items: center; height: ${layout.layerBar.height}px; padding: ${layout.layerBar.pad}px; border-radius: ${radius.pill}px; }
.fv-seg { ${t("segment")} height: ${layout.layerBar.segHeight}px; padding: 0 ${layout.layerBar.segPadX}px; border-radius: ${radius.segment}px; color: ${color.inkSecondary}; border: 1px solid transparent !important; display: inline-flex; align-items: center; gap: 6px; transition: background-color 120ms, color 120ms; }
.fv-seg:hover { color: ${color.ink}; background: ${color.fillHover}; }
.fv-seg:active { background: ${color.fillPressed}; }
.fv-seg[aria-checked="true"], .fv-seg[aria-selected="true"] { color: ${color.ink}; background: ${color.fillActive}; border-color: ${color.glassBorder} !important; }
.fv-div { width: 1px; height: 16px; background: ${color.glassBorder}; margin: 0 6px; }
.fv-icon { width: ${layout.layerBar.resetSize}px; height: ${layout.layerBar.resetSize}px; border-radius: 50%; display: inline-grid; place-items: center; color: ${color.inkSecondary}; transition: background-color 120ms, color 120ms; }
.fv-icon:hover { color: ${color.ink}; background: ${color.fillHover}; }
.fv-pill { height: ${layout.pillRow.height}px; padding: 0 ${layout.pillRow.padR}px 0 ${layout.pillRow.padL}px; border-radius: ${radius.pill}px; display: inline-flex; align-items: center; gap: ${layout.pillRow.iconGap}px; white-space: nowrap; transition: border-color 120ms; }
.fv-pill:hover { border-color: rgba(242,235,221,.24); }
.fv-pill .l { ${t("pillLabel")} color: ${color.inkSecondary}; transition: color 120ms; }
.fv-pill:hover .l { color: ${color.ink}; }
.fv-pill .v { ${t("pillValue")} color: ${color.ink}; margin-left: ${layout.pillRow.valueGap - layout.pillRow.iconGap}px; }
.fv-report { width: ${layout.report.width}px; border-radius: ${radius.card}px; padding: ${layout.report.padTop}px ${layout.report.padX}px ${layout.report.padBottom}px; }
.fv-rtitle { ${t("reportTitle")} font-family: ${font.display}; margin: 0; }
.fv-sum { ${t("body")} color: ${color.inkSecondary}; margin: 6px 0 0; }
.fv-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
.fv-table th { ${t("tableHead")} color: ${color.inkSecondary}; height: 18px; text-align: right; font-weight: 400; border-bottom: 1px solid ${color.hairline}; padding: 0; }
.fv-table th:first-child, .fv-table td:first-child { text-align: left; }
.fv-table th:last-child, .fv-table td:last-child { text-align: left; }
.fv-table td { ${t("tableCell")} height: ${layout.report.rowHeight}px; text-align: right; padding: 0; border-bottom: 1px solid ${color.hairline}; }
.fv-table tr:last-child td { border-bottom: 0; }
.fv-table td.n { ${t("tableName")} color: ${color.ink}; }
.fv-table td.s { color: ${color.inkSecondary}; }
.fv-row { cursor: pointer; transition: background-color 120ms; }
.fv-row:hover { background: ${color.fillHover}; }
.fv-row:focus-visible { outline: 2px solid ${color.focusRing}; outline-offset: -2px; }
.fv-diamond { display: inline-block; width: 7px; height: 7px; background: ${color.stress}; transform: rotate(45deg); margin-right: 8px; vertical-align: 1px; }
.fv-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ${color.neutralDot}; margin-right: 8px; vertical-align: 1px; }
.fv-cap { ${t("caption")} color: ${color.inkSecondary}; }
.fv-tab { width: ${layout.reportTab.width}px; height: ${layout.reportTab.height}px; border-radius: 0 ${radius.tab}px ${radius.tab}px 0; border-left: 0 !important; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; transition: background-color 120ms; }
.fv-tab:hover { background: ${color.fillHover}; }
.fv-tab .t { ${t("pillLabel")} writing-mode: vertical-rl; transform: rotate(180deg); color: ${color.ink}; }
.fv-twin { width: ${layout.twinButton.size}px; height: ${layout.twinButton.size}px; border-radius: 50%; display: grid; place-items: center; color: ${color.ink}; transition: border-color 120ms; }
.fv-twin:hover { border-color: rgba(242,235,221,.24); }
.fv-pill[aria-expanded="true"] { border-color: rgba(242,235,221,.24); background: ${color.fillActive}; }
.fv-pill[aria-expanded="true"] .l { color: ${color.ink}; }
.fv-card { width: ${layout.card.width}px; padding: ${layout.card.pad}px; border-radius: ${radius.card}px; }
.fv-chead { display: flex; align-items: center; gap: 8px; height: 28px; color: ${color.inkSecondary}; }
.fv-chead h2 { ${t("cardTitle")} color: ${color.ink}; margin: 0; }
.fv-big { display: flex; align-items: baseline; gap: 8px; margin: 12px 0 0; }
.fv-big .b { ${t("cardBig")} color: ${color.ink}; }
.fv-big .u { ${t("cardUnit")} color: ${color.inkSecondary}; }
.fv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
.fv-grid > div { display: grid; gap: 2px; }
.fv-grid .v { font: 500 18px/22px ${font.sans}; color: ${color.ink}; }
.fv-grid .n { ${t("caption")} font-size: 12px; color: ${color.inkSecondary}; }
.fv-legend { width: ${layout.legend.width}px; padding: ${layout.legend.pad}px; border-radius: ${radius.card}px; }
.fv-legend h2 { ${t("cardTitle")} color: ${color.ink}; margin: 0; }
.fv-legend .bar { height: ${layout.legend.barHeight}px; border-radius: ${radius.legendBar}px; margin-top: 10px; }
.fv-legend .ends { display: flex; justify-content: space-between; margin-top: 4px; }
.fv-twinpill { display: flex; align-items: center; gap: 12px; }
.fv-twinpill .logo { display: grid; place-items: center; border-radius: 50%; color: ${color.ink}; flex: none; }
.fv-twinpill input { ${t("twinInput")} flex: 1; min-width: 0; background: none; border: 0; outline: none; color: ${color.ink}; }
.fv-twinpill input::placeholder { color: ${color.inkSecondary}; }
.fv-twinpill .send { display: grid; place-items: center; border-radius: 50%; flex: none; }
.fv-twinpill .send:disabled { cursor: default; }
.fv-twinpill .spin { width: 14px; height: 14px; border-radius: 50%; border: 2px solid ${color.accentInk}; border-right-color: transparent; animation: fv-spin 700ms linear infinite; }
.fv-answer { width: ${layout.twinAnswer.width}px; max-height: ${layout.twinAnswer.maxHeight}px; overflow-y: auto; padding: ${layout.twinAnswer.pad}px; border-radius: ${radius.card}px; }
.fv-answer .q { ${t("twinBubble")} margin: 12px 0 0 auto; width: fit-content; max-width: 80%; padding: 8px 12px; border-radius: ${radius.bubble}px; background: ${color.bubble}; border: 1px solid ${color.bubbleBorder}; }
.fv-answer .a { ${t("twinAnswer")} margin: 14px 0 0; color: ${color.ink}; }
.fv-answer .caret { display: inline-block; width: 2px; height: 16px; margin-left: 3px; vertical-align: -2px; background: ${color.ink}; animation: fv-blink 1s steps(1) infinite; }
.fv-answer .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.fv-answer .chip { ${t("twinChip")} height: 28px; padding: 0 12px; border-radius: ${radius.chip}px; border: 1px solid ${color.bubbleBorder}; transition: background-color 120ms; }
.fv-answer .chip:hover { background: ${color.fillHover}; }
@keyframes fv-blink { 50% { opacity: 0; } }
.fv-month { ${t("monthLabel")} font-family: ${font.display}; color: ${color.ink}; }
.fv-meta { ${t("dateMeta")} color: ${color.ink}; opacity: .9; }
.fv-mtick { ${t("monthTick")} position: absolute; transform: translateX(-50%); color: ${color.inkSecondary}; white-space: nowrap; }
.fv-mtick[data-sel="true"] { color: ${color.ink}; font-weight: 600; }
.fv-credit { ${t("caption")} color: ${color.ink}; opacity: .8; }
.fv-stats { border-radius: ${radius.card}px; padding: 4px; }
.fv-stats .cells { display: flex; }
.fv-stat { display: grid; gap: 2px; padding: 7px 12px 8px; border-radius: 12px; text-align: left; white-space: nowrap; transition: background-color 120ms; }
.fv-stat + .fv-stat { box-shadow: -1px 0 0 ${color.hairline}; }
.fv-stat:hover { background: ${color.fillHover}; }
.fv-stat[aria-expanded="true"], .fv-stat[aria-pressed="true"] { background: ${color.fillActive}; box-shadow: none; }
.fv-stat .l { display: flex; align-items: center; gap: 5px; font: 400 11.5px/14px ${font.sans}; color: ${color.inkSecondary}; }
.fv-stat .v { font: 500 15px/20px ${font.sans}; color: ${color.ink}; }
.fv-stat .d { font: 400 11px/14px ${font.sans}; color: ${color.inkSecondary}; margin-left: 5px; }
.fv-stats .foot { ${t("caption")} font-size: 11px; color: ${color.inkSecondary}; margin: 4px 0 0; padding: 5px 12px 3px; border-top: 1px solid ${color.hairline}; }
.fv-group { display: inline-flex; align-items: center; height: 40px; padding: 4px; border-radius: ${radius.pill}px; }
.fv-group .fv-pill { height: 32px; background: none; border: 1px solid transparent; box-shadow: none; backdrop-filter: none; -webkit-backdrop-filter: none; padding: 0 12px; }
.fv-group .fv-pill:hover { background: ${color.fillHover}; }
.fv-group .fv-pill[aria-expanded="true"] { background: ${color.fillActive}; border-color: ${color.glassBorder}; }
.fv-group .fv-div { margin: 0 2px; }
.fv-group .ff-menu { background: rgba(27,22,18,.97); }
.fv-status { ${t("caption")} color: ${color.ink}; margin-left: 10px; }
.fv-zone > div { max-width: 280px; background: ${color.glass}; backdrop-filter: blur(${blur.glass}px); -webkit-backdrop-filter: blur(${blur.glass}px); border: 1px solid ${color.glassBorder}; box-shadow: ${shadow.glass}; border-radius: ${radius.card}px; padding: 10px 14px; color: ${color.ink}; font: 400 12px/16px ${font.sans}; }
.fv-zone label { font: 500 13px/18px ${font.sans}; gap: 10px; cursor: pointer; }
.fv-zone p, .fv-zone span { color: ${color.inkSecondary}; }
.fv-root input[type="checkbox"] { appearance: none; -webkit-appearance: none; flex: none; width: 16px; height: 16px; margin: 0; border-radius: 5px; border: 1px solid rgba(242,235,221,.42); background: rgba(242,235,221,.04) center / 12px 12px no-repeat; cursor: pointer; transition: background-color 120ms, border-color 120ms; }
.fv-root input[type="checkbox"]:hover { border-color: ${color.ink}; }
.fv-root input[type="checkbox"]:checked { background-color: ${color.accent}; border-color: ${color.accent}; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='none' stroke='%232A2117' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M2.5 6.3 5 8.7l4.5-5.2'/%3E%3C/svg%3E"); }
.fv-root input[type="checkbox"]:disabled { opacity: .4; cursor: default; }
.fv-zone input[type="checkbox"] { position: relative; width: 30px; height: 18px; border-radius: 9px; background: rgba(242,235,221,.14); border-color: transparent; background-image: none !important; }
.fv-zone input[type="checkbox"]::before { content: ""; position: absolute; left: 2px; top: 2px; width: 12px; height: 12px; border-radius: 50%; background: ${color.ink}; transition: transform 160ms cubic-bezier(.23,1,.32,1); }
.fv-zone input[type="checkbox"]:checked::before { transform: translateX(12px); background: ${color.accentInk}; }
.fv-sim { color: ${color.ink}; text-shadow: none; }
.fv-group, .fv-stats, .fv-zone { text-shadow: none; }
.fv-sim .fv-hud-btn { min-height: 28px; padding: 0 12px; border-radius: ${radius.pill}px; border: 1px solid ${color.glassBorder}; background: ${color.fillHover}; color: ${color.inkSecondary}; font: 500 12.5px/16px ${font.sans}; transition: background-color 120ms, color 120ms, border-color 120ms; }
.fv-sim .fv-hud-btn:hover:not(:disabled) { background: ${color.fillPressed}; color: ${color.ink}; border-color: rgba(242,235,221,.24); }
.fv-sim .fv-hud-btn:disabled { opacity: .4; cursor: default; }
.fv-sim .fv-hud-btn.fv-hud-on, .fv-sim .fv-hud-btn[aria-pressed="true"] { background: ${color.ink}; border-color: ${color.ink}; color: ${color.accentInk}; font-weight: 600; }
.fv-sim .fv-hud-btn kbd { border-color: currentColor; opacity: .6; }
.fv-sim select { appearance: none; -webkit-appearance: none; min-height: 32px; width: 100%; padding: 0 32px 0 12px; border-radius: 10px; border: 1px solid ${color.glassBorder}; color: ${color.ink}; font: 400 13px/18px ${font.sans}; cursor: pointer; background: rgba(242,235,221,.06) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23C9BFAE' stroke-width='1.8' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") right 10px center / 14px 14px no-repeat; transition: border-color 120ms; }
.fv-sim select:hover:not(:disabled) { border-color: rgba(242,235,221,.28); }
.fv-sim select:disabled { opacity: .5; cursor: default; }
.fv-sim select option { background: #1B1612; color: ${color.ink}; }
.fv-sim input[type="number"] { appearance: textfield; -moz-appearance: textfield; min-height: 28px; border-radius: 8px; border: 1px solid ${color.glassBorder}; background: rgba(242,235,221,.06); color: ${color.ink}; }
.fv-sim input[type="number"]::-webkit-inner-spin-button, .fv-sim input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.fv-sim input[type="range"] { appearance: none; -webkit-appearance: none; height: 18px; background: transparent; cursor: pointer; margin: 0; }
.fv-sim input[type="range"]::-webkit-slider-runnable-track { height: 2px; border-radius: 1px; background: rgba(242,235,221,.38); }
.fv-sim input[type="range"]::-moz-range-track { height: 2px; border-radius: 1px; background: rgba(242,235,221,.38); }
.fv-sim input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; margin-top: -6px; border-radius: 50%; border: 0; background: ${color.ink}; box-shadow: 0 0 0 3px rgba(242,235,221,.14); }
.fv-sim input[type="range"]::-moz-range-thumb { width: 14px; height: 14px; border-radius: 50%; border: 0; background: ${color.ink}; box-shadow: 0 0 0 3px rgba(242,235,221,.14); }
.fv-sim input[type="range"]:disabled { opacity: .4; cursor: default; }
.fv-sim .glass { background: rgba(242,235,221,.04); border: 1px solid ${color.hairline}; border-radius: 12px; box-shadow: none; backdrop-filter: none; -webkit-backdrop-filter: none; padding: 12px; }
.fv-sim .fv-h { margin: 0 0 6px; font: 500 11.5px/16px ${font.sans}; letter-spacing: .02em; text-transform: none; color: ${color.inkSecondary}; }
.fv-sim .fv-chip { border: 1px solid ${color.glassBorder}; border-radius: ${radius.pill}px; padding: 0 7px; font: 400 10.5px/16px ${font.sans}; color: ${color.inkSecondary}; }
.fv-sim .fv-sc-card { border: 1px solid ${color.hairline}; border-radius: 12px; background: rgba(242,235,221,.04); padding: 10px 12px; transition: background-color 120ms, border-color 120ms; }
.fv-sim .fv-sc-card:hover { background: ${color.fillHover}; border-color: rgba(242,235,221,.24); }
.fv-sim .fv-read { margin: 0; }
.fv-sim .fv-read dt, .fv-sim .fv-read dd { padding: 6px 0; border-bottom: 1px solid ${color.hairline}; margin: 0; }
.fv-sim .fv-read dt { color: ${color.inkSecondary}; }
.fv-sim .fv-read > :nth-last-child(-n+2) { border-bottom: 0; }
.fv-sim summary { list-style: none; display: flex; align-items: center; gap: 6px; cursor: pointer; font: 500 12px/16px ${font.sans}; color: ${color.inkSecondary}; }
.fv-sim summary::-webkit-details-marker { display: none; }
.fv-sim summary::before { content: ""; width: 6px; height: 6px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(-45deg); transition: transform 120ms; }
.fv-sim details[open] > summary::before { transform: rotate(45deg); }
.fv-sim summary:hover { color: ${color.ink}; }
@media (prefers-reduced-motion: reduce) { .fv-root * { transition-duration: 0ms !important; } }
`;
