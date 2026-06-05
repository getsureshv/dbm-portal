import { PermitStatus } from '@prisma/client';
import {
  SocrataAdapter,
  mapRecordWith,
  mapStatusGeneric,
  parseDateGeneric,
  pick,
  normalizeAddressForQuery,
  stripLeadingNumber,
  SocrataFieldMap,
} from './socrata.adapter';

describe('SocrataAdapter (generic, config-driven)', () => {
  describe('pick', () => {
    it('returns the value for a single field ref', () => {
      expect(pick({ a: 'x' }, 'a')).toBe('x');
    });
    it('returns the first non-empty value for a multi-field ref', () => {
      expect(pick({ a: '', b: 'y' }, ['a', 'b'])).toBe('y');
      expect(pick({ a: '  ', b: null, c: 'z' }, ['a', 'b', 'c'])).toBe('z');
    });
    it('returns undefined when nothing matches or ref is null', () => {
      expect(pick({ a: 'x' }, 'missing')).toBeUndefined();
      expect(pick({ a: 'x' }, null)).toBeUndefined();
      expect(pick({ a: '' }, 'a')).toBeUndefined();
    });
    it('coerces non-string values to string', () => {
      expect(pick({ n: 12345 }, 'n')).toBe('12345');
    });
  });

  describe('mapStatusGeneric', () => {
    it.each([
      ['Finaled', PermitStatus.FINALIZED],
      ['Expired', PermitStatus.EXPIRED],
      ['cancelled', PermitStatus.CANCELLED],
      ['Under Review', PermitStatus.OPEN],
      ['Issued', PermitStatus.ISSUED],
      [undefined, PermitStatus.ISSUED],
    ])('maps "%s" → %s', (input, expected) => {
      expect(mapStatusGeneric(input as any)).toBe(expected);
    });
  });

  describe('parseDateGeneric', () => {
    it('parses MM/DD/YY and ISO', () => {
      expect(parseDateGeneric('10/24/19')!.getUTCFullYear()).toBe(2019);
      expect(parseDateGeneric('2023-08-01T00:00:00.000')!.getUTCFullYear()).toBe(
        2023,
      );
    });
    it('returns null for junk', () => {
      expect(parseDateGeneric('nope')).toBeNull();
      expect(parseDateGeneric(null)).toBeNull();
    });
  });

  describe('mapRecordWith — custom field map (a DIFFERENT Socrata city)', () => {
    // Simulate, say, a city whose columns are address/permitnum/issued/desc/etc.
    const cityFieldMap: SocrataFieldMap = {
      externalId: 'permitnum',
      type: 'worktype',
      status: 'current_status',
      issuedAt: 'issue_date',
      finalizedAt: 'final_date',
      contractor: 'contractor_name',
      valuation: 'job_value',
      description: 'descript',
      address: 'original_address1',
      zip: 'originalzip',
    };

    it('maps a record using entirely non-Dallas column names', () => {
      const raw = {
        permitnum: 'CITY-2024-001',
        worktype: 'Residential Addition',
        current_status: 'Final',
        issue_date: '2024-03-15T00:00:00.000',
        final_date: '2024-09-01T00:00:00.000',
        contractor_name: 'BUILD CO',
        job_value: '45000',
        descript: 'Rear addition',
        original_address1: '742 EVERGREEN TER',
        originalzip: '90210',
      };
      const m = mapRecordWith(raw, cityFieldMap, 'CITYX');
      expect(m.externalId).toBe('CITY-2024-001');
      expect(m.type).toBe('Residential Addition');
      expect(m.status).toBe(PermitStatus.FINALIZED);
      expect(m.issuedAt?.getUTCFullYear()).toBe(2024);
      expect(m.finalizedAt?.getUTCMonth()).toBe(8); // September
      expect(m.contractor).toBe('BUILD CO');
      expect(m.valuation).toBe(45000);
      expect(m.description).toBe('Rear addition');
      expect(m.address).toBe('742 EVERGREEN TER, 90210');
      expect(m.raw).toBe(raw);
    });

    it('synthesizes externalId with the configured prefix when id column missing', () => {
      const m = mapRecordWith(
        { original_address1: '1 NOWHERE' },
        cityFieldMap,
        'CITYX',
      );
      expect(m.externalId.startsWith('CITYX-')).toBe(true);
    });

    it('falls back through a multi-field type ref', () => {
      const fm: SocrataFieldMap = { type: ['permit_type', 'land_use'] };
      expect(mapRecordWith({ land_use: 'RESIDENTIAL' }, fm).type).toBe(
        'RESIDENTIAL',
      );
    });

    it('absent status column → ISSUED', () => {
      const m = mapRecordWith({ permit_number: 'X' }, {});
      expect(m.status).toBe(PermitStatus.ISSUED);
    });
  });

  describe('config-driven adapter behavior', () => {
    const baseCfg = (config: Record<string, unknown> | null) => ({
      jurisdictionId: 'jid',
      slug: 'somewhere-xx',
      config,
    });

    it('builds the SoQL URL from config (domain/datasetId/addressField)', async () => {
      const calls: string[] = [];
      const origFetch = (globalThis as any).fetch;
      (globalThis as any).fetch = (url: string) => {
        calls.push(url);
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      };
      try {
        const adapter = new SocrataAdapter(
          baseCfg({
            domain: 'data.cityx.gov',
            datasetId: 'abcd-1234',
            addressField: 'original_address1',
          }),
        );
        await adapter.getPermitsByAddress({ address: '742 Evergreen Ter, CityX' });
        expect(calls[0]).toContain('https://data.cityx.gov/resource/abcd-1234.json');
        expect(calls[0]).toContain('original_address1%20like');
      } finally {
        (globalThis as any).fetch = origFetch;
      }
    });

    it('maps fetched records via the config fieldMap', async () => {
      const origFetch = (globalThis as any).fetch;
      (globalThis as any).fetch = () =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                permitnum: 'CITY-9',
                worktype: 'Deck',
                issue_date: '06/15/22',
                original_address1: '742 EVERGREEN TER',
                job_value: '9000',
              },
            ]),
        });
      try {
        const adapter = new SocrataAdapter(
          baseCfg({
            domain: 'data.cityx.gov',
            datasetId: 'abcd-1234',
            addressField: 'original_address1',
            idPrefix: 'CITYX',
            fieldMap: {
              externalId: 'permitnum',
              type: 'worktype',
              issuedAt: 'issue_date',
              valuation: 'job_value',
              address: 'original_address1',
            },
          }),
        );
        const out = await adapter.getPermitsByAddress({
          address: '742 Evergreen Ter, CityX',
        });
        expect(out).toHaveLength(1);
        expect(out[0].externalId).toBe('CITY-9');
        expect(out[0].type).toBe('Deck');
        expect(out[0].valuation).toBe(9000);
      } finally {
        (globalThis as any).fetch = origFetch;
      }
    });

    it('falls back to mock when fetch throws', async () => {
      const origFetch = (globalThis as any).fetch;
      (globalThis as any).fetch = () => Promise.reject(new Error('network down'));
      try {
        const adapter = new SocrataAdapter(baseCfg(null));
        const out = await adapter.getPermitsByAddress({
          address: '742 Evergreen Ter, CityX',
        });
        expect(out.length).toBeGreaterThan(0);
        expect(out[0].externalId.startsWith('MOCK-')).toBe(true);
      } finally {
        (globalThis as any).fetch = origFetch;
      }
    });

    it('falls back to mock on empty address', async () => {
      const adapter = new SocrataAdapter(baseCfg(null));
      const out = await adapter.getPermitsByAddress({ address: '' });
      expect(out[0].externalId.startsWith('MOCK-')).toBe(true);
    });

    it('healthCheck ok on 200, not-ok on 503', async () => {
      const origFetch = (globalThis as any).fetch;
      (globalThis as any).fetch = () => Promise.resolve({ ok: true, status: 200 });
      try {
        const adapter = new SocrataAdapter(baseCfg(null));
        expect((await adapter.healthCheck()).ok).toBe(true);
      } finally {
        (globalThis as any).fetch = origFetch;
      }
      (globalThis as any).fetch = () => Promise.resolve({ ok: false, status: 503 });
      try {
        const adapter = new SocrataAdapter(baseCfg(null));
        const h = await adapter.healthCheck();
        expect(h.ok).toBe(false);
        expect(h.detail).toContain('503');
      } finally {
        (globalThis as any).fetch = origFetch;
      }
    });
  });

  describe('address helpers', () => {
    it('normalizeAddressForQuery upper-cases first comma chunk', () => {
      expect(normalizeAddressForQuery('742 Evergreen Ter, CityX, ST 90210')).toBe(
        '742 EVERGREEN TER',
      );
    });
    it('stripLeadingNumber drops the house number', () => {
      expect(stripLeadingNumber('742 EVERGREEN TER')).toBe('EVERGREEN TER');
    });
  });
});
