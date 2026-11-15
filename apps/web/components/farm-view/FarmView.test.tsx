import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('@/components/farm/shared', async (original) => {
  const actual = await original<Record<string, unknown>>();
  const { FARMS, twinConfig } = await import('@/lib/farms');
  return { ...actual, useTwin: () => twinConfig(FARMS.find(f => f.tier === 'twin')!.id)! };
});
import { FarmView } from './FarmView';
const html = () => renderToStaticMarkup(<FarmView farmName="Cornell" onBack={() => {}} onReset={() => {}} />);
describe('honest farm controls', () => {
  it('shows unavailable observations rather than hard-coded farm measurements', () => {
    const markup = html();
    expect(markup).toContain('Not available');
    expect(markup).not.toContain('64 mm');
    expect(markup).not.toContain('41%');
    expect(markup).not.toContain('0.48');
  });
  it('does not offer an inactive Ask Twin button', () => {
    expect(html()).not.toContain('aria-label="Ask Twin"');
  });
  it('does not offer an unrelated calendar outside comparison', () => {
    expect(html()).not.toContain('data-testid="timeline"');
  });
  it('disables unavailable analytical map layers', () => {
    expect(html()).toMatch(/<button[^>]*disabled=""[^>]*data-testid="layer-vigor"/);
    expect(html()).toMatch(/<button[^>]*disabled=""[^>]*data-testid="layer-moisture"/);
  });
});
