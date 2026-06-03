import { ShovelsAdapter } from './shovels.adapter';

describe('ShovelsAdapter (fallback behavior)', () => {
  const realKey = process.env.SHOVELS_API_KEY;

  beforeEach(() => {
    delete process.env.SHOVELS_API_KEY;
  });
  afterAll(() => {
    if (realKey) process.env.SHOVELS_API_KEY = realKey;
  });

  it('falls back to mock when SHOVELS_API_KEY is missing', async () => {
    const adapter = new ShovelsAdapter({
      jurisdictionId: 'id',
      slug: 'flower-mound-tx',
      config: null,
    });
    const permits = await adapter.getPermitsByAddress({
      address: '4150 Garden Ridge Blvd, Flower Mound, TX 75022',
    });
    expect(permits.length).toBeGreaterThan(0);
    expect(permits[0].externalId).toMatch(/^MOCK-FLOWER-MOUND-TX-/);
  });

  it('healthCheck reports unset creds', async () => {
    const adapter = new ShovelsAdapter({
      jurisdictionId: 'id',
      slug: 'flower-mound-tx',
      config: null,
    });
    const h = await adapter.healthCheck();
    expect(h.ok).toBe(false);
    expect(h.detail).toMatch(/unset/i);
  });
});
