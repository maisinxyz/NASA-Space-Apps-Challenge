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
const html = () => renderToStaticMarkup(<FarmView farmName="Cornell" onBack={() => {}} onReset={() => {}} />);
describe('honest farm controls', () => {
  it('shows unavailable observations rather than hard-coded farm measurements', () => {
    const markup = html();
    expect(markup).toContain('Not available');
    expect(markup).not.toContain('64 mm');
    expect(markup).not.toContain('41%');
    expect(markup).not.toContain('0.48');
  });
  it('offers a clearly identified synthetic preview assistant', () => {
    expect(html()).toContain('aria-label="Ask Twin preview"');
    expect(html()).toContain('Synthetic preview');
  });
  it('offers explicit panel and farm control toggles', () => {
    expect(html()).toContain('Hide panels');
    expect(html()).toContain('Hide farm controls');
  });
  it('marks condition controls as synthetic and includes the reserved zone control', () => {
    const markup = renderToStaticMarkup(<FarmView farmName="Cornell" onBack={() => {}} onReset={() => {}} zoneControl={<span>Vulnerability zones</span>} />);
    expect(markup).toContain('Synthetic preview · not this farm’s measurements');
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
});
