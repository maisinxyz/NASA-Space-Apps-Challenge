import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('@/components/farm/shared', async (original) => {
  const actual = await original<Record<string, unknown>>();
  const { FARMS, twinConfig } = await import('@/lib/farms');
  return { ...actual, useTwin: () => twinConfig(FARMS.find(f => f.tier === 'twin')!.id)! };
});
import { FarmView } from './FarmView';
import { FARMS, farmById, twinConfig } from '@/lib/farms';
import { useAppStore } from '@/lib/store';
const noop = () => {};
const html = () => renderToStaticMarkup(<FarmView farmName="Cornell" onBack={() => {}} onReset={() => {}} />);
describe('honest farm controls', () => {
  it('shows unavailable observations rather than hard-coded farm measurements', () => {
    const markup = html();
    expect(markup).toContain('Not available');
    expect(markup).not.toContain('64 mm');
    expect(markup).not.toContain('41%');
    expect(markup).not.toContain('0.48');
  });
  it('offers no fabricated assistant preview and shows no synthetic labels', () => {
    expect(html()).not.toContain('Ask Gus preview');
    expect(html()).not.toMatch(/[Ss]ynthetic/);
  });
  it('offers a hide-panels control and keeps secondary panels in rail tabs and Map tools in the left menu', () => {
    expect(html()).toContain('Hide panels');
    expect(html()).toMatch(/data-testid="action-map-tools"/);
    expect(html()).not.toContain('data-testid="rail-view"');
    for (const id of ['rail-conditions', 'field-report-toggle', 'rail-more'])
      expect(html()).toContain(`data-testid="${id}"`);
    expect(html()).toMatch(/<aside[^>]*id="farm-drawer"[^>]*hidden=""/);
  });
  it('keeps condition controls label-free and includes the reserved zone control', () => {
    const markup = renderToStaticMarkup(<FarmView farmName="Cornell" onBack={() => {}} onReset={() => {}} zoneControl={<span>Vulnerability zones</span>} />);
    expect(markup).not.toMatch(/[Ss]ynthetic/);
    expect(markup).toContain('Vulnerability zones');
  });
  it('does not offer an unrelated calendar outside comparison', () => {
    expect(html()).not.toContain('data-testid="timeline"');
  });
  it('disables unavailable analytical map layers', () => {
    expect(html()).toMatch(/<button[^>]*disabled=""[^>]*data-testid="layer-vigor"/);
    expect(html()).toMatch(/<button[^>]*disabled=""[^>]*data-testid="layer-moisture"/);
  });
});

describe('farm-specific content', () => {
  it.each(FARMS.filter((farm) => farm.tier === 'explore'))('renders explore-only $name without requiring a twin', (farm) => {
    useAppStore.setState({ farmId: farm.id, panelsHidden: false });
    const markup = renderToStaticMarkup(<FarmView farmName={farm.name} onBack={() => {}} onReset={() => {}} />);
    expect(markup).toContain('Explore only');
    expect(markup).not.toContain('Simulation available');
  });
  it('renders selectable fields as native buttons when the report starts open', () => {
    const farm = farmById('cornell-ruminant')!;
    const twin = twinConfig('cornell-ruminant')!;
    useAppStore.setState({ farmId: farm.id, panelsHidden: false });
    const sim = { farm, fields: twin.fields, cropA: undefined, cropB: undefined, pending: 0, runSource: 'fixture' as const, frame: null, getCamera: () => null };
    const markup = renderToStaticMarkup(<FarmView farmName={farm.name} onBack={() => {}} onReset={() => {}} sim={sim} initialReportOpen />);
    for (const field of twin.fields) {
      expect(markup).toContain(`class="fv-field-button">${field.name}</button>`);
    }
    expect(markup).toContain('No field measurements for this farm yet.');
  });

  it("renders persistent 'Show panels' button when panelsHidden is true", () => {
    useAppStore.setState({ farmId: "cornell-ruminant", globeView: "farm", panelsHidden: true });
    const html = renderToStaticMarkup(
      <FarmView farmName="Cornell Musgrave Research Farm" onBack={noop} onReset={noop} initialPanelsHidden={true} />
    );

    expect(html).toContain('data-testid="show-panels"');
    expect(html).toContain("Show panels");
    expect(html).toContain('aria-keyshortcuts="H"');
  });

  it("renders accessible WAI-ARIA tab/panel attributes in simulation tab", () => {
    useAppStore.setState({ farmId: "cornell-ruminant", globeView: "farm", panelsHidden: false });
    const farm = farmById("cornell-ruminant")!;
    const twin = twinConfig("cornell-ruminant")!;
    const simProps = {
      farm,
      fields: twin.fields,
      cropA: undefined,
      cropB: undefined,
      pending: 0,
      runSource: "fixture" as const,
      frame: null,
      getCamera: () => null,
    };

    const html = renderToStaticMarkup(
      <FarmView
        farmName={farm.name}
        onBack={noop}
        onReset={noop}
        sim={simProps}
        initialSim={{ open: true, section: "scenarios" }}
      />
    );

    expect(html).toContain('role="tablist"');
    expect(html).toContain('id="sim-tab-scenarios"');
    expect(html).toContain('aria-controls="sim-panel-scenarios"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('id="sim-panel-scenarios"');
    expect(html).toContain('aria-labelledby="sim-tab-scenarios"');
    expect(html).toContain('data-window="simulation"');
    expect(html).not.toMatch(/data-testid="sim-panel"[^>]*position:fixed/);
  });

  it("renders Vancouver demo primary actions for UBC Farm and KPU Langley", () => {
    useAppStore.setState({ farmId: "ubc-farm", globeView: "farm", panelsHidden: false });
    const ubcHtml = renderToStaticMarkup(
      <FarmView farmName="UBC Farm" farmId="ubc-farm" onBack={noop} onReset={noop} />
    );
    expect(ubcHtml).toContain('data-testid="action-compare-rotations"');
    expect(ubcHtml).toContain("Compare rotations");
    expect(ubcHtml).toContain('data-testid="action-map-tools"');
    expect(ubcHtml).toContain('data-testid="action-plan-rotations"');
    expect(ubcHtml).toContain('data-testid="copilot-open"');
    expect(ubcHtml).toContain("Ask Gus");
    expect(ubcHtml).toContain('data-surface="overview"');
    expect(ubcHtml).not.toContain('data-testid="rail-rotations"');
    expect(ubcHtml.match(/data-testid="action-compare-rotations"/g)).toHaveLength(1);

    useAppStore.setState({ farmId: "kpu-langley", globeView: "farm", panelsHidden: false });
    const kpuHtml = renderToStaticMarkup(
      <FarmView farmName="KPU School of Horticulture" farmId="kpu-langley" onBack={noop} onReset={noop} />
    );
    expect(kpuHtml).toContain('data-testid="action-explore-campus"');
    expect(kpuHtml).toContain("Explore campus");
    expect(kpuHtml).not.toContain('data-testid="rail-campus"');
  });
});
