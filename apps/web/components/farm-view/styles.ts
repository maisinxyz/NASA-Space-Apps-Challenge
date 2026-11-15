// Scoped CSS for the farm view, generated from lib/farm-view/tokens.ts so no value is retyped.
import { blur, color, font, layout, radius, shadow, type } from "@/lib/farm-view/tokens";

const t = (k: keyof typeof type) => `font: ${type[k].weight} ${type[k].size}px/${type[k].lineHeight}px ${font[type[k].family]};`;

export const FV_CSS = `
.fv-root { font-family: ${font.sans}; color: ${color.ink}; font-variant-numeric: tabular-nums; pointer-events: none; }
.fv-root :where(*) { box-sizing: border-box; }
.fv-root :where(button) { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; }
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
@media (prefers-reduced-motion: reduce) { .fv-root * { transition-duration: 0ms !important; } }
`;
