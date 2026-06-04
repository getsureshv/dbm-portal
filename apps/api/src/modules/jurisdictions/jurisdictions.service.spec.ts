import { Test, TestingModule } from '@nestjs/testing';
import { JurisdictionsService } from './jurisdictions.service';
import { PrismaService } from '../../common/prisma.service';

/**
 * Unit tests for the country-aware resolver added in the i18n-foundations
 * pass. We don't exercise the adapter or permit-cache paths here — those are
 * integration-level.
 */
describe('JurisdictionsService — resolveAddress (country-aware)', () => {
  let service: JurisdictionsService;
  let findMany: jest.Mock;

  // Fixture: 3 US Texas jurisdictions + 1 hypothetical JP jurisdiction whose
  // zipPrefixes collide with Dallas/Houston if country is ignored.
  const usDallas = {
    id: 'us-dallas',
    slug: 'dallas-tx',
    name: 'City of Dallas',
    state: 'TX',
    countryCode: 'US',
    zipPrefixes: ['752', '753'],
  };
  const usHouston = {
    id: 'us-houston',
    slug: 'houston-tx',
    name: 'City of Houston',
    state: 'TX',
    countryCode: 'US',
    zipPrefixes: ['770', '771', '772'],
  };
  const jpChiyoda = {
    id: 'jp-chiyoda',
    slug: 'chiyoda-jp',
    name: 'Chiyoda City',
    state: 'TYO',
    countryCode: 'JP',
    // Tokyo Chiyoda postal codes start with "100" — would collide with a
    // hypothetical US "100xx" if we didn't filter by country.
    zipPrefixes: ['100'],
  };

  beforeEach(async () => {
    findMany = jest.fn();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        JurisdictionsService,
        {
          provide: PrismaService,
          useValue: { jurisdiction: { findMany } },
        },
      ],
    }).compile();
    service = moduleRef.get(JurisdictionsService);
  });

  it('resolves a US ZIP to a US jurisdiction (default countryCode)', async () => {
    findMany.mockResolvedValueOnce([usDallas, usHouston]);
    const j = await service.resolveAddress('123 Main St, Dallas TX 75201');
    expect(findMany).toHaveBeenCalledWith({ where: { countryCode: 'US' } });
    expect(j?.slug).toBe('dallas-tx');
  });

  it('returns null when ZIP is missing from the address', async () => {
    findMany.mockResolvedValueOnce([usDallas]);
    const j = await service.resolveAddress('no zip here');
    expect(j).toBeNull();
  });

  it('returns null when ZIP prefix does not match any country jurisdiction', async () => {
    findMany.mockResolvedValueOnce([usDallas, usHouston]);
    // 90210 is US but not in our seed (Beverly Hills) — should not match.
    const j = await service.resolveAddress('Somewhere CA 90210');
    expect(j).toBeNull();
  });

  it('JP postal codes (NNN-NNNN format) are not yet supported by the demo resolver', async () => {
    // The current demo regex only matches 5 contiguous digits (US ZIP). JP
    // "100-0001" doesn't match — documented Phase 3 work (per-country postal
    // parsers). This test pins that limitation so a future change to the
    // regex is intentional.
    findMany.mockImplementation(({ where: { countryCode } }) =>
      Promise.resolve(
        [usDallas, usHouston, jpChiyoda].filter(
          (j) => j.countryCode === countryCode,
        ),
      ),
    );
    const j = await service.resolveAddress('Chiyoda Tokyo 100-0001', 'JP');
    expect(j).toBeNull();
  });

  it('country-scopes the search: a US "100" prefix would not see JP rows', async () => {
    // Imagine someone adds a hypothetical US ZIP-prefix "100" jurisdiction
    // later — JP rows must never leak into US queries.
    findMany.mockImplementation(({ where: { countryCode } }) =>
      Promise.resolve(
        [usDallas, usHouston, jpChiyoda].filter(
          (j) => j.countryCode === countryCode,
        ),
      ),
    );
    // No US match for "10001" in this fixture → null. The key assertion is
    // that JP Chiyoda is NOT returned even though its prefix "100" matches.
    const j = await service.resolveAddress('New York NY 10001', 'US');
    expect(j).toBeNull();
  });

  it('still resolves Flower Mound by 5-digit ZIP (75022)', async () => {
    const usFM = {
      id: 'us-fm',
      slug: 'flower-mound-tx',
      name: 'Town of Flower Mound',
      state: 'TX',
      countryCode: 'US',
      zipPrefixes: ['75022', '75028'],
    };
    findMany.mockResolvedValueOnce([usDallas, usFM, usHouston]);
    const j = await service.resolveAddress('1 Main, Flower Mound TX 75022');
    expect(j?.slug).toBe('flower-mound-tx');
  });
});
