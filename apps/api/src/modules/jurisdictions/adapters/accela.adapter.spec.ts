import { PermitStatus } from '@prisma/client';
import { AccelaAdapter, mapStatus } from './accela.adapter';

describe('mapStatus (Accela record.status → PermitStatus)', () => {
  it.each([
    ['Finaled', PermitStatus.FINALIZED],
    ['Complete', PermitStatus.FINALIZED],
    ['Closed', PermitStatus.FINALIZED],
    ['Issued', PermitStatus.ISSUED],
    ['Approved', PermitStatus.ISSUED],
    ['Expired', PermitStatus.EXPIRED],
    ['Cancelled', PermitStatus.CANCELLED],
    ['Voided', PermitStatus.CANCELLED],
    ['Withdrawn', PermitStatus.CANCELLED],
    ['Submitted', PermitStatus.OPEN],
    ['Under Review', PermitStatus.OPEN],
    ['Pending', PermitStatus.OPEN],
    ['Received', PermitStatus.OPEN],
    ['Something Weird', PermitStatus.UNKNOWN],
    [undefined, PermitStatus.UNKNOWN],
  ])('"%s" → %s', (input, expected) => {
    expect(mapStatus(input as any)).toBe(expected);
  });
});

describe('AccelaAdapter (fallback behavior)', () => {
  const realAppId = process.env.ACCELA_APP_ID;
  const realSecret = process.env.ACCELA_APP_SECRET;

  beforeEach(() => {
    delete process.env.ACCELA_APP_ID;
    delete process.env.ACCELA_APP_SECRET;
  });
  afterAll(() => {
    if (realAppId) process.env.ACCELA_APP_ID = realAppId;
    if (realSecret) process.env.ACCELA_APP_SECRET = realSecret;
  });

  it('falls back to mock when credentials are missing', async () => {
    const adapter = new AccelaAdapter({
      jurisdictionId: 'id',
      slug: 'dallas-tx',
      config: { agency: 'DALLAS_TX' },
    });
    const permits = await adapter.getPermitsByAddress({
      address: '1500 Marilla St, Dallas, TX 75201',
    });
    expect(permits.length).toBeGreaterThan(0);
    expect(permits[0].externalId).toMatch(/^MOCK-/);
  });

  it('healthCheck reports unset creds', async () => {
    const adapter = new AccelaAdapter({
      jurisdictionId: 'id',
      slug: 'dallas-tx',
      config: null,
    });
    const h = await adapter.healthCheck();
    expect(h.ok).toBe(false);
    expect(h.detail).toMatch(/unset/i);
  });
});
