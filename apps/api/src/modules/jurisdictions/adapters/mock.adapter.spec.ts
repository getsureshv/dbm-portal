import { MockAdapter } from './mock.adapter';

describe('MockAdapter', () => {
  const adapter = new MockAdapter({
    jurisdictionId: 'test-id',
    slug: 'dallas-tx',
    config: null,
  });

  it('returns deterministic results for the same address', async () => {
    const a = await adapter.getPermitsByAddress({ address: '1500 Marilla St, Dallas, TX 75201' });
    const b = await adapter.getPermitsByAddress({ address: '1500 Marilla St, Dallas, TX 75201' });
    expect(a.length).toBe(b.length);
    expect(a.map((p) => p.externalId)).toEqual(b.map((p) => p.externalId));
  });

  it('returns 2-4 permits regardless of address', async () => {
    const results = await Promise.all([
      adapter.getPermitsByAddress({ address: '100 Main St' }),
      adapter.getPermitsByAddress({ address: '7300 Long Prairie Rd' }),
      adapter.getPermitsByAddress({ address: 'foo bar' }),
    ]);
    for (const r of results) {
      expect(r.length).toBeGreaterThanOrEqual(2);
      expect(r.length).toBeLessThanOrEqual(4);
    }
  });

  it('respects the limit parameter', async () => {
    const result = await adapter.getPermitsByAddress({ address: 'x', limit: 2 });
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('permits have required normalized shape', async () => {
    const [p] = await adapter.getPermitsByAddress({ address: '100 Main St' });
    expect(p).toMatchObject({
      externalId: expect.any(String),
      address: expect.any(String),
      status: expect.any(String),
      raw: expect.any(Object),
    });
    expect(p.externalId).toMatch(/^MOCK-DALLAS-TX-/);
  });

  it('healthCheck reports ok', async () => {
    const h = await adapter.healthCheck();
    expect(h.ok).toBe(true);
  });
});
