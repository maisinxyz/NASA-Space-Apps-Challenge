// Window chrome for the farm screen. Matches the farm-view dark glass: #191713 panels, hairline borders, ink #f2ebdd.
// Each window body is a size container named `fw`, so panel content reflows with @container fw (...) queries.
export const WINDOW_CSS = `
.fw-off,.fw-off>.fw-body{display:contents}
.fw-win{position:absolute;left:0;top:0;box-sizing:border-box;display:flex;flex-direction:column;pointer-events:auto;
  background:rgba(25,23,19,.97);border:1px solid rgba(242,235,221,.15);border-radius:14px;
  box-shadow:0 12px 32px rgba(0,0,0,.38),0 1px 2px rgba(0,0,0,.25);color:#f2ebdd;will-change:transform;contain:layout}
.fw-win[hidden]{display:none}
.fw-win.fw-max{border-radius:10px}
.fw-win.fw-anim{transition:transform .22s cubic-bezier(.2,.9,.3,1),width .22s cubic-bezier(.2,.9,.3,1),height .22s cubic-bezier(.2,.9,.3,1)}
.fw-win.fw-live{user-select:none;-webkit-user-select:none}
.fw-titlebar{flex:none;display:flex;align-items:center;gap:6px;height:34px;padding:0 4px 0 8px;cursor:grab;touch-action:none;
  border-bottom:1px solid rgba(242,235,221,.1);border-radius:13px 13px 0 0;user-select:none;-webkit-user-select:none}
.fw-live .fw-titlebar{cursor:grabbing}
.fw-max .fw-titlebar{cursor:default}
.fw-titlebar:focus-visible{outline:2px solid #a3bfe9;outline-offset:-2px}
.fw-grip{display:grid;place-items:center;color:#8f8676;flex:none}
.fw-title{flex:1;min-width:0;margin:0;font:600 11px/1 inherit;letter-spacing:.06em;text-transform:uppercase;color:#c9bfae;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fw-btns{display:flex;gap:2px;flex:none}
.fw-btn{display:grid;place-items:center;width:28px;height:28px;min-height:0!important;padding:0;border:0;border-radius:8px;background:transparent;color:#c9bfae;cursor:pointer}
.fw-btn:hover{background:rgba(242,235,221,.1);color:#f2ebdd}
.fw-btn:focus-visible{outline:2px solid #a3bfe9;outline-offset:1px}
@media (pointer:coarse){.fw-titlebar{height:44px}.fw-btn{width:40px;height:40px}}
.fw-body{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;overflow:hidden;container-name:fw;container-type:inline-size}
/* Panel content used to place itself on the map; inside a window the frame owns position, size and glass. */
.fv-workspace .fw-win>.fw-body>:not(style){position:relative!important;inset:auto!important;left:auto!important;right:auto!important;
  top:auto!important;bottom:auto!important;width:auto!important;max-width:none!important;min-width:0!important;max-height:none!important;
  margin:0!important;transform:none!important;z-index:auto!important;pointer-events:auto!important;
  flex:1 1 auto;min-height:0;height:auto!important;overflow:auto;overscroll-behavior:contain;box-sizing:border-box}
.fv-workspace .fw-win>.fw-body>:not(style,[data-testid="horizon-tabs"]){box-shadow:none!important;border:0!important;border-radius:0!important;
  background:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
.fw-win[data-window="copilot"]{background:#191713}
/* The drawer's own heading and close button duplicate the title bar. */
.fv-workspace .fw-win .fv-drawer-head{display:none}
/* Timeline window: tabs on top, the fixed-height clock below; nothing stretches. */
.fv-workspace .fw-win[data-window="time"]>.fw-body{padding:6px 10px 8px;gap:6px}
.fv-workspace .fw-win[data-window="time"]>.fw-body>:not(style){flex:none;overflow:visible}
.fv-workspace .fw-win[data-window="time"]>.fw-body>[data-testid="future-timeline"],
.fv-workspace .fw-win[data-window="time"]>.fw-body>[data-testid="monthly-outlook"]{flex:1 1 auto;padding:0!important;min-height:150px}
.fv-workspace .fw-win[data-window="time"]>.fw-body>[data-testid="monthly-outlook"]{overflow:auto}
/* Resize handles: an ~8px invisible band on each edge, 14px squares on the corners. */
.fw-h{position:absolute;touch-action:none;z-index:2}
.fw-h-n,.fw-h-s{left:10px;right:10px;height:8px;cursor:ns-resize}.fw-h-n{top:-4px}.fw-h-s{bottom:-4px}
.fw-h-e,.fw-h-w{top:10px;bottom:10px;width:8px;cursor:ew-resize}.fw-h-w{left:-4px}.fw-h-e{right:-4px}
.fw-h-nw,.fw-h-ne,.fw-h-sw,.fw-h-se{width:14px;height:14px}
.fw-h-nw{left:-5px;top:-5px;cursor:nwse-resize}.fw-h-se{right:-5px;bottom:-5px;cursor:nwse-resize}
.fw-h-ne{right:-5px;top:-5px;cursor:nesw-resize}.fw-h-sw{left:-5px;bottom:-5px;cursor:nesw-resize}
@media (pointer:coarse){.fw-h-n,.fw-h-s{height:16px}.fw-h-n{top:-8px}.fw-h-s{bottom:-8px}.fw-h-e,.fw-h-w{width:16px}.fw-h-w{left:-8px}.fw-h-e{right:-8px}
  .fw-h-nw,.fw-h-ne,.fw-h-sw,.fw-h-se{width:24px;height:24px}}
@media (prefers-reduced-motion:reduce){.fw-win.fw-anim{transition:none}}
`;
