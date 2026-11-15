/** Desktop workspace geometry: one left navigation, one right inspector, one bottom time region. */
export const DESKTOP_WORKSPACE_CSS = `
.fv-workspace{--nav-width:256px;--content-left:288px;--inspector-width:360px;--time-space:210px;}
.fv-workspace[data-horizon="none"]{--time-space:48px;}
.fv-workspace[data-horizon="months"]{--time-space:260px;}
.fv-workspace .fv-heading{position:absolute;left:16px;top:16px;bottom:32px;width:var(--nav-width);overflow:auto;overscroll-behavior:contain;pointer-events:auto;background:rgba(25,23,19,.96);border:1px solid rgba(242,235,221,.15);border-radius:16px;padding:18px;box-sizing:border-box;z-index:32;}
.fv-workspace .fv-title-block{width:100%;max-width:100%;text-shadow:none;pointer-events:auto;}
.fv-workspace .fv-title{font-size:25px;line-height:1.16;margin:14px 0 8px;letter-spacing:-.025em;}
.fv-workspace .fv-sub{font-size:12px;line-height:1.5;color:#c9bfae;white-space:normal;margin:0 0 16px;}
.fv-workspace .fv-back{font-size:12px;padding:0;min-height:32px;}
.fv-workspace .fv-action-row{display:grid;gap:5px;pointer-events:auto;}
.fv-workspace .fv-action-row>.fv-seg{width:100%;min-width:0;justify-content:flex-start;text-align:left;padding:10px 12px!important;min-height:40px;height:auto;border-radius:9px;box-sizing:border-box;background:rgba(255,255,255,.045);box-shadow:none;}
.fv-workspace .fv-action-row>.fv-seg:hover{background:rgba(255,255,255,.11);}
.fv-workspace .fv-rail{position:static;transform:none;margin-top:16px;padding-top:12px;border-top:1px solid rgba(242,235,221,.12);display:grid;gap:3px;}
.fv-workspace .fv-rail-tab{width:100%;min-height:34px;display:flex;justify-content:flex-start;padding:8px 10px;border-radius:8px;border:0;background:transparent;box-shadow:none;}
.fv-workspace .fv-rail-tab .t{writing-mode:horizontal-tb;font-size:12px;color:#c9bfae;}
.fv-workspace .fv-overview{margin:20px 0 16px;padding-top:15px;border-top:1px solid rgba(242,235,221,.12);}
.fv-workspace .fv-overview h2{font:600 12px/1.4 inherit;margin:0 0 4px;}
.fv-workspace .fv-overview p{font-size:11px;color:#c9bfae;line-height:1.45;margin:4px 0 10px;}
.fv-workspace .fv-overview dl{margin:0;display:grid;gap:10px;}
.fv-workspace .fv-overview dl>div{display:flex;justify-content:space-between;align-items:baseline;gap:8px;}
.fv-workspace .fv-overview dt{font-size:11px;color:#c9bfae;}
.fv-workspace .fv-overview dd{margin:0;font-size:13px;white-space:nowrap;font-variant-numeric:tabular-nums;}
.fv-workspace [data-testid="mode-switch"]{display:grid;grid-template-columns:1fr 1fr;width:100%!important;border-radius:9px;box-sizing:border-box;}
.fv-workspace [data-testid="mode-switch"] .fv-seg{font-size:11px;white-space:normal;padding:4px;}
.fv-workspace .fv-analysis-options{margin-top:12px;}
.fv-workspace .fv-analysis-options>summary,.fv-workspace .fv-cap>summary{font-size:11px;color:#c9bfae;cursor:pointer;}
.fv-workspace .fv-analysis-options>div{display:grid!important;gap:5px!important;}
.fv-workspace .fv-analysis-options .fv-pill{width:100%;min-width:0;white-space:normal;height:auto;min-height:34px;padding:7px 8px;justify-content:flex-start;box-sizing:border-box;}
.fv-workspace .fv-analysis-options .fv-pill .v{overflow-wrap:anywhere;font-size:11px;}
.fv-workspace .fv-analysis-options .ff-menu{position:relative;top:auto;width:100%;box-sizing:border-box;}
.fv-workspace .fv-cap{font-size:11px;line-height:1.5;}
.fv-workspace .fv-drawer,.fv-workspace .fv-drawer[data-future="true"]{top:16px;right:16px;bottom:var(--time-space);width:var(--inspector-width);max-height:none;box-sizing:border-box;background:rgba(25,23,19,.97);border-radius:16px;padding:18px;}
.fv-workspace[data-wide="true"] .fv-drawer{left:var(--content-left);right:16px;width:auto;}
.fv-workspace [data-testid="forecast-panel"],.fv-workspace [data-testid="soil-panel"],.fv-workspace [data-testid="lens-card"],.fv-workspace [data-testid="whatif-card"]{left:auto!important;right:16px!important;top:16px!important;bottom:var(--time-space)!important;width:var(--inspector-width)!important;max-height:none!important;box-sizing:border-box;overflow:auto;background:rgba(25,23,19,.97);z-index:30;}
.fv-workspace [data-testid="copilot-panel"]{left:auto!important;right:16px!important;top:16px!important;bottom:var(--time-space)!important;width:var(--inspector-width)!important;box-sizing:border-box;background:#191713;}
.fv-workspace [data-testid="rotation-planner"]{left:var(--content-left);right:16px;top:16px;bottom:32px;grid-template-columns:minmax(240px,280px) minmax(0,1fr);gap:10px;}
.fv-workspace [data-testid="rotation-planner"] section{min-width:0;}
.fv-workspace [data-testid="rotation-planner"] input[type=search]{box-sizing:border-box;}
.fv-workspace [data-testid="future-timeline"],.fv-workspace [data-testid="monthly-outlook"]{left:var(--content-left)!important;right:56px!important;bottom:32px!important;}
.fv-workspace [data-testid="future-timeline"]{background:rgba(25,23,19,.94);border-radius:14px;padding:12px;box-sizing:border-box;}
.fv-workspace [data-testid="future-timeline"] .ff-tl-year{font-size:30px;}
.fv-workspace [data-testid="future-timeline"] .ff-legend{display:none;}
.fv-workspace [data-testid="monthly-outlook"]{height:210px!important;box-sizing:border-box;overflow:auto;}
.fv-workspace [data-testid="horizon-tabs"]{left:var(--content-left)!important;bottom:calc(var(--time-space) - 12px)!important;}
.fv-workspace [data-testid="whatif-pill"]{display:none;}
.fv-workspace[data-surface="planner"] [data-testid="future-timeline"],.fv-workspace[data-surface="planner"] [data-testid="monthly-outlook"],.fv-workspace[data-surface="planner"] [data-testid="horizon-tabs"]{display:none;}
.fv-workspace .map2d-tools{right:34px!important;top:158px;bottom:auto!important;width:324px!important;box-sizing:border-box;max-height:calc(100% - var(--time-space) - 174px);overflow:auto;z-index:35!important;background:#25221b;}
.fv-workspace .map2d-popover{left:var(--content-left)!important;top:16px!important;box-sizing:border-box;max-height:calc(100% - var(--time-space) - 16px);overflow:auto;}
.fv-workspace .map2d-analysis{left:auto!important;right:16px!important;top:16px!important;bottom:var(--time-space)!important;width:360px!important;max-height:none!important;box-sizing:border-box;overflow:auto;}
.fv-workspace .ff-drawer{top:16px;right:16px;bottom:var(--time-space);width:360px;box-sizing:border-box;border-radius:16px;z-index:35;}
.fv-workspace [data-testid="compare-view"]>section{left:var(--content-left)!important;right:16px!important;top:16px!important;bottom:var(--time-space)!important;max-height:none!important;}
.fv-workspace [data-testid="compare-exit"]{left:var(--content-left)!important;top:auto!important;bottom:calc(var(--time-space) - 10px)!important;}
.fv-workspace :is(button,a,summary,input,select,textarea):focus-visible{outline:2px solid #a3bfe9;outline-offset:3px;}
`;
