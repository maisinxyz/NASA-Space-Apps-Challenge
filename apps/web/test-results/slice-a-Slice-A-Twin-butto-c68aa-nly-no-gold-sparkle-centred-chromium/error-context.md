# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: slice-a.spec.ts >> Slice A >> Twin button: 60px round, logo only (no gold sparkle), centred
- Location: e2e/farm-view/slice-a.spec.ts:59:3

# Error details

```
Error: Channel closed
```

```
Error: locator.waitFor: Test ended.
Call log:
  - waiting for getByTestId('timeline') to be visible

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [active]:
    - generic [ref=e4]:
      - generic [ref=e5]:
        - navigation [ref=e7]:
          - button [disabled] [ref=e8]:
            - img "previous" [ref=e9]
          - generic [ref=e11]:
            - generic [ref=e12]: 1/
            - text: "1"
          - button [disabled] [ref=e13]:
            - img "next" [ref=e14]
        - link "Next.js 15.5.29 (outdated) Webpack" [ref=e17] [cursor=pointer]:
          - /url: https://nextjs.org/docs/messages/version-staleness
          - generic "An outdated version detected (latest is 16.4.6), upgrade is highly recommended!" [ref=e20]: Next.js 15.5.29 (outdated)
          - generic [ref=e21]: Webpack
      - dialog "Runtime Error" [ref=e23]:
        - generic [ref=e26]:
          - generic [ref=e27]:
            - generic [ref=e28]:
              - generic [ref=e29]: Runtime Error
              - generic [ref=e31]:
                - button "Copy Error Info" [ref=e32] [cursor=pointer]
                - button "No related documentation found" [disabled] [ref=e35]
                - link "Learn more about enabling Node.js inspector for server code with Chrome DevTools" [ref=e38] [cursor=pointer]:
                  - /url: https://nextjs.org/docs/app/building-your-application/configuring/debugging#server-side-code
            - paragraph [ref=e48]: No twin config for farm "agroscope-reckenholz"
          - generic [ref=e49]:
            - generic [ref=e50]:
              - paragraph [ref=e52]:
                - generic [ref=e57]: components/farm/shared.tsx (13:20) @ useTwin
                - button "Open in editor" [ref=e58] [cursor=pointer]
              - generic [ref=e63]:
                - generic [ref=e64]: 11 | const farmId = useAppStore((s) => s.farmId);
                - generic [ref=e65]: 12 | const twin = twinConfig(farmId);
                - generic [ref=e66]: "> 13 | if (!twin) throw new Error(`No twin config for farm \"${farmId}\"`);"
                - generic [ref=e67]: "| ^"
                - generic [ref=e68]: 14 | return twin;
                - generic [ref=e69]: "15 | }"
                - generic [ref=e70]: 16 |
            - generic [ref=e71]:
              - generic [ref=e72]:
                - paragraph [ref=e73]:
                  - text: Call Stack
                  - generic [ref=e74]: "18"
                - button "Show 14 ignore-listed frame(s)" [ref=e75] [cursor=pointer]
              - generic [ref=e78]:
                - generic [ref=e79]:
                  - text: useTwin
                  - button "Open useTwin in editor" [ref=e80] [cursor=pointer]
                - text: components/farm/shared.tsx (13:20)
              - generic [ref=e83]:
                - generic [ref=e84]:
                  - text: FarmView
                  - button "Open FarmView in editor" [ref=e85] [cursor=pointer]
                - text: components/farm-view/FarmView.tsx (45:23)
              - generic [ref=e88]:
                - generic [ref=e89]:
                  - text: GlobeHome
                  - button "Open GlobeHome in editor" [ref=e90] [cursor=pointer]
                - text: components/globe/GlobeHome.tsx (729:11)
              - generic [ref=e93]:
                - generic [ref=e94]:
                  - text: Home
                  - button "Open Home in editor" [ref=e95] [cursor=pointer]
                - text: app/page.tsx (5:10)
        - generic [ref=e98]:
          - generic [ref=e99]: "1"
          - generic [ref=e100]: "2"
    - generic [ref=e105] [cursor=pointer]:
      - button "Open Next.js Dev Tools" [ref=e106]
      - generic [ref=e110]:
        - button "Open issues overlay" [ref=e111]:
          - generic [ref=e112]:
            - generic [aria-hidden] [ref=e113]: "0"
            - generic [ref=e114]: "1"
          - generic [ref=e115]: Issue
        - button "Collapse issues badge" [ref=e116]
  - 'heading "Application error: a client-side exception has occurred while loading localhost (see the browser console for more information)." [level=2] [ref=e121]'
```

# Test source

```ts
  1  | import type { Page } from "@playwright/test";
  2  | 
  3  | /** Route to the farm view. TODO(Oscar): confirm; today it is the globe dive (#farm=…). */
  4  | export const FARM_URL = process.env.FARM_VIEW_URL ?? "/#farm=agroscope-reckenholz";
  5  | 
  6  | /**
  7  |  * data-testid contract the tester needs from the coder (not yet agreed):
  8  |  *  layer-satellite|layer-vigor|layer-moisture, reset-view, condition-pill-{rainfall|moisture|vigor|heat},
  9  |  *  card-{rainfall|moisture|vigor|heat}, card-fold-{…}, field-popover, field-report, field-report-toggle,
  10 |  *  field-report-row-{slug}, twin-button, twin-pill, twin-input, twin-send, twin-answer, twin-close,
  11 |  *  twin-chip-show-on-map, twin-chip-why-main, timeline, timeline-handle, timeline-track, date-label,
  12 |  *  success-ring, legend.
  13 |  */
  14 | export const tid = (page: Page, id: string) => page.getByTestId(id);
  15 | 
  16 | /** Dev-only sound call log. Needs Oscar to push {name, t} to window.__soundLog inside lib/ui/sound.ts when NEXT_PUBLIC_E2E=1. */
  17 | export async function soundLog(page: Page): Promise<{ name: string; t: number }[]> {
  18 |   return page.evaluate(() => (window as any).__soundLog ?? []);
  19 | }
  20 | export const clearSoundLog = (page: Page) => page.evaluate(() => { (window as any).__soundLog = []; });
  21 | 
  22 | export async function openFarm(page: Page) {
  23 |   await page.addInitScript(() => { (window as any).__soundLog = []; });
  24 |   await page.goto(FARM_URL);
> 25 |   await tid(page, "timeline").waitFor();
     |                               ^ Error: locator.waitFor: Test ended.
  26 | }
  27 | 
  28 | /** Count visible pop-ups: condition cards + field popover + Twin answer. Rule: never more than 1. */
  29 | export async function openPopupCount(page: Page) {
  30 |   return page.evaluate(() =>
  31 |     ["card-rainfall", "card-moisture", "card-vigor", "card-heat", "field-popover", "twin-answer", "twin-pill"].filter((id) => {
  32 |       const el = document.querySelector(`[data-testid="${id}"]`);
  33 |       return !!el && getComputedStyle(el).visibility !== "hidden" && (el as HTMLElement).offsetParent !== null;
  34 |     }).length,
  35 |   );
  36 | }
  37 | 
  38 | export const handleX = async (page: Page) => (await tid(page, "timeline-handle").boundingBox())!.x;
  39 | 
```