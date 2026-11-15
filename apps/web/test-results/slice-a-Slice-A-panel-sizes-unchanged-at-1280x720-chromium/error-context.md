# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: slice-a.spec.ts >> Slice A >> panel sizes unchanged at 1280x720
- Location: e2e/farm-view/slice-a.spec.ts:53:3

# Error details

```
Test timeout of 180000ms exceeded while running "beforeEach" hook.
```

```
Error: page.goto: Test timeout of 180000ms exceeded.
Call log:
  - navigating to "http://localhost:3000/#farm=agroscope-reckenholz", waiting until "load"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "Skip to content" [ref=e2] [cursor=pointer]:
    - /url: "#main"
  - generic [ref=e3]:
    - banner [ref=e4]:
      - generic [ref=e5]:
        - link "FieldTwin" [ref=e6] [cursor=pointer]:
          - /url: /
        - navigation "Main" [ref=e7]:
          - link "Methods & data" [ref=e8] [cursor=pointer]:
            - /url: /methods
          - link "Learn" [ref=e9] [cursor=pointer]:
            - /url: /learn
        - generic [ref=e10]:
          - generic "Development fixture data. Not real. Must never reach the demo." [ref=e11]: mock
          - button "About" [ref=e12]
          - button "Presenter mode" [ref=e13]
    - note [ref=e14]: This tool supports, and does not replace, local agronomic expertise.
  - main [ref=e15]:
    - generic [ref=e16]:
      - generic [ref=e17]:
        - heading "See how the same storm moves across real farmland under different crop rotations." [level=1] [ref=e18]
        - paragraph [ref=e19]: "Best on a larger screen: the 3D globe is shown on screens at least 768 px wide."
        - region "Research farms and farmland" [ref=e20]:
          - heading "Research farms and farmland" [level=2] [ref=e21]
          - list [ref=e22]:
            - listitem [ref=e23]:
              - button "Cornell University Ruminant Center United States Full digital twin" [ref=e24]:
                - generic [ref=e25]: Cornell University Ruminant Center
                - generic [ref=e26]:
                  - text: United States
                  - generic [ref=e27]: Full digital twin
            - listitem [ref=e28]:
              - button "Beltsville Agricultural Research Center United States Full digital twin" [ref=e29]:
                - generic [ref=e30]: Beltsville Agricultural Research Center
                - generic [ref=e31]:
                  - text: United States
                  - generic [ref=e32]: Full digital twin
            - listitem [ref=e33]:
              - button "Oakville Grade area, Napa Valley (near the UC Davis Oakville Experimental Vineyard) United States Explore only" [ref=e34]:
                - generic [ref=e35]: Oakville Grade area, Napa Valley (near the UC Davis Oakville Experimental Vineyard)
                - generic [ref=e36]:
                  - text: United States
                  - generic [ref=e37]: Explore only
            - listitem [ref=e38]:
              - button "Unifarm, Wageningen University & Research Netherlands Explore only" [ref=e39]:
                - generic [ref=e40]: Unifarm, Wageningen University & Research
                - generic [ref=e41]:
                  - text: Netherlands
                  - generic [ref=e42]: Explore only
            - listitem [ref=e43]:
              - button "UBC Farm, University of British Columbia Canada Explore only" [ref=e44]:
                - generic [ref=e45]: UBC Farm, University of British Columbia
                - generic [ref=e46]:
                  - text: Canada
                  - generic [ref=e47]: Explore only
            - listitem [ref=e48]:
              - button "Experiment Farm, Hokkaido University Japan Explore only" [ref=e49]:
                - generic [ref=e50]: Experiment Farm, Hokkaido University
                - generic [ref=e51]:
                  - text: Japan
                  - generic [ref=e52]: Explore only
            - listitem [ref=e53]:
              - button "Institute for Sustainable Agro-ecosystem Services (ISAS), University of Tokyo Japan Explore only" [ref=e54]:
                - generic [ref=e55]: Institute for Sustainable Agro-ecosystem Services (ISAS), University of Tokyo
                - generic [ref=e56]:
                  - text: Japan
                  - generic [ref=e57]: Explore only
            - listitem [ref=e58]:
              - button "Agroscope Reckenholz research station Switzerland Explore only" [ref=e59]:
                - generic [ref=e60]: Agroscope Reckenholz research station
                - generic [ref=e61]:
                  - text: Switzerland
                  - generic [ref=e62]: Explore only
            - listitem [ref=e63]:
              - button "South Farms, University of Illinois Urbana-Champaign United States Explore only" [ref=e64]:
                - generic [ref=e65]: South Farms, University of Illinois Urbana-Champaign
                - generic [ref=e66]:
                  - text: United States
                  - generic [ref=e67]: Explore only
            - listitem [ref=e68]:
              - button "Waite Campus, University of Adelaide Australia Explore only" [ref=e69]:
                - generic [ref=e70]: Waite Campus, University of Adelaide
                - generic [ref=e71]:
                  - text: Australia
                  - generic [ref=e72]: Explore only
            - listitem [ref=e73]:
              - button "Viikki Research Farm, University of Helsinki Finland Explore only" [ref=e74]:
                - generic [ref=e75]: Viikki Research Farm, University of Helsinki
                - generic [ref=e76]:
                  - text: Finland
                  - generic [ref=e77]: Explore only
            - listitem [ref=e78]:
              - button "INTA Castelar research centre (CNIA) Argentina Explore only" [ref=e79]:
                - generic [ref=e80]: INTA Castelar research centre (CNIA)
                - generic [ref=e81]:
                  - text: Argentina
                  - generic [ref=e82]: Explore only
            - listitem [ref=e83]:
              - button "Experimental Farm, National Taiwan University Taiwan Explore only" [ref=e84]:
                - generic [ref=e85]: Experimental Farm, National Taiwan University
                - generic [ref=e86]:
                  - text: Taiwan
                  - generic [ref=e87]: Explore only
            - listitem [ref=e88]:
              - button "Vineyard estates near Pirque, Santiago Metropolitan Region Chile Explore only" [ref=e89]:
                - generic [ref=e90]: Vineyard estates near Pirque, Santiago Metropolitan Region
                - generic [ref=e91]:
                  - text: Chile
                  - generic [ref=e92]: Explore only
      - paragraph [ref=e93]: The 3D globe is not shown on small screens. Use the farm list.
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
> 24 |   await page.goto(FARM_URL);
     |              ^ Error: page.goto: Test timeout of 180000ms exceeded.
  25 |   await tid(page, "timeline").waitFor();
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