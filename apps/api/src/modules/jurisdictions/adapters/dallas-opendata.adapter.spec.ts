import { PermitStatus } from '@prisma/client';
import {
  DallasOpenDataAdapter,
  mapRecord,
  mapStatus,
  normalizeAddressForQuery,
  parseIssuedDate,
  stripLeadingNumber,
} from './dallas-opendata.adapter';

describe('DallasOpenDataAdapter helpers', () => {
  describe('mapStatus', () => {
    it.each([
      ['Finaled', PermitStatus.FINALIZED],
      ['CLOSED', PermitStatus.FINALIZED],
      ['Complete', PermitStatus.FINALIZED],
      ['Expired', PermitStatus.EXPIRED],
      ['VOID', PermitStatus.EXPIRED],
      ['cancelled', PermitStatus.CANCELLED],
      ['Revoked', PermitStatus.CANCELLED],
      ['Rejected', PermitStatus.CANCELLED],
      ['Denied', PermitStatus.CANCELLED],
      ['Open', PermitStatus.OPEN],
      ['Applied', PermitStatus.OPEN],
      ['Under Review', PermitStatus.OPEN],
      ['Issued', PermitStatus.ISSUED],
      ['', PermitStatus.ISSUED],
      [null, PermitStatus.ISSUED],
      [undefined, PermitStatus.ISSUED],
      ['unknown gibberish', PermitStatus.ISSUED],
    ])('maps "%s" → %s', (input, expected) => {
      expect(mapStatus(input as any)).toBe(expected);
    });
  });

  describe('parseIssuedDate', () => {
    it('parses MM/DD/YY with 2-digit year (post-2000)', () => {
      const d = parseIssuedDate('10/24/19')!;
      expect(d.getUTCFullYear()).toBe(2019);
      expect(d.getUTCMonth()).toBe(9); // October = 9
      expect(d.getUTCDate()).toBe(24);
    });
    it('parses MM/DD/YYYY', () => {
      const d = parseIssuedDate('03/15/2024')!;
      expect(d.getUTCFullYear()).toBe(2024);
    });
    it('parses ISO date', () => {
      const d = parseIssuedDate('2023-08-01T00:00:00.000')!;
      expect(d.getUTCFullYear()).toBe(2023);
    });
    it('returns null for empty/invalid', () => {
      expect(parseIssuedDate(null)).toBeNull();
      expect(parseIssuedDate('')).toBeNull();
      expect(parseIssuedDate('not a date')).toBeNull();
    });
    it('treats 2-digit YY < 50 as 20YY', () => {
      const d = parseIssuedDate('06/15/24')!;
      expect(d.getUTCFullYear()).toBe(2024);
    });
    it('treats 2-digit YY >= 50 as 19YY', () => {
      const d = parseIssuedDate('06/15/85')!;
      expect(d.getUTCFullYear()).toBe(1985);
    });
  });

  describe('normalizeAddressForQuery', () => {
    it('upper-cases and trims to first comma chunk', () => {
      expect(normalizeAddressForQuery('1500 Marilla St, Dallas, TX 75201')).toBe(
        '1500 MARILLA ST'.toUpperCase(),
      );
    });
    it('handles already-uppercase input', () => {
      expect(normalizeAddressForQuery('1500 MARILLA ST')).toBe('1500 MARILLA ST');
    });
  });

  describe('stripLeadingNumber', () => {
    it('removes leading street number', () => {
      expect(stripLeadingNumber('1500 MARILLA ST')).toBe('MARILLA ST');
    });
    it('returns input unchanged when no leading number', () => {
      expect(stripLeadingNumber('MARILLA ST')).toBe('MARILLA ST');
    });
  });

  describe('mapRecord', () => {
    it('maps a real-shaped Dallas OpenData record', () => {
      const raw = {
        permit_number: '1910245004',
        permit_type: 'Electrical (EL) Commercial  Alteration',
        issued_date: '10/24/19',
        contractor: 'WIRED UP ELECTRIC',
        value: '4500',
        area: '0',
        work_description: 'TWO GENERATORS',
        land_use: 'COMMERCIAL AMUSEMENT (OUTSIDE)',
        street_address: '1500 MARILLA ST',
        zip_code: '75201',
      };
      const mapped = mapRecord(raw);
      expect(mapped.externalId).toBe('1910245004');
      expect(mapped.type).toBe('Electrical (EL) Commercial  Alteration');
      expect(mapped.status).toBe(PermitStatus.ISSUED);
      expect(mapped.issuedAt?.getUTCFullYear()).toBe(2019);
      expect(mapped.address).toBe('1500 MARILLA ST, 75201');
      expect(mapped.contractor).toBe('WIRED UP ELECTRIC');
      expect(mapped.valuation).toBe(4500);
      expect(mapped.description).toBe('TWO GENERATORS');
      expect(mapped.raw).toBe(raw);
    });

    it('falls back to a synthesized externalId when permit_number is missing', () => {
      const raw = { street_address: '99 NOWHERE LN', permit_type: 'X' };
      const mapped = mapRecord(raw);
      expect(mapped.externalId.startsWith('DALLAS-')).toBe(true);
    });

    it('handles missing valuation gracefully', () => {
      const raw = { permit_number: 'X', value: undefined };
      expect(mapRecord(raw).valuation).toBeNull();
    });

    it('treats land_use as type when permit_type is absent', () => {
      const raw = { permit_number: 'X', land_use: 'RESIDENTIAL' };
      expect(mapRecord(raw).type).toBe('RESIDENTIAL');
    });
  });

  describe('getPermitsByAddress fallback', () => {
    const cfg = { jurisdictionId: 'jid', slug: 'dallas-tx', config: null };

    it('falls back to mock when fetch throws', async () => {
      const origFetch = (globalThis as any).fetch;
      (globalThis as any).fetch = () => Promise.reject(new Error('network down'));
      try {
        const adapter = new DallasOpenDataAdapter(cfg);
        const out = await adapter.getPermitsByAddress({
          address: '1500 Marilla St, Dallas, TX 75201',
        });
        expect(out.length).toBeGreaterThan(0);
        expect(out[0].externalId.startsWith('MOCK-')).toBe(true);
      } finally {
        (globalThis as any).fetch = origFetch;
      }
    });

    it('falls back to mock when address is empty', async () => {
      const adapter = new DallasOpenDataAdapter(cfg);
      const out = await adapter.getPermitsByAddress({ address: '' });
      expect(out[0].externalId.startsWith('MOCK-')).toBe(true);
    });

    it('returns mapped records when fetch returns array', async () => {
      const origFetch = (globalThis as any).fetch;
      (globalThis as any).fetch = () =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                permit_number: 'REAL-1',
                permit_type: 'Residential Deck',
                issued_date: '06/15/19',
                street_address: '1500 MARILLA ST',
                zip_code: '75201',
                value: '12000',
                contractor: 'ACME DECKS',
              },
            ]),
        });
      try {
        const adapter = new DallasOpenDataAdapter(cfg);
        const out = await adapter.getPermitsByAddress({
          address: '1500 Marilla St, Dallas, TX 75201',
        });
        expect(out).toHaveLength(1);
        expect(out[0].externalId).toBe('REAL-1');
        expect(out[0].type).toBe('Residential Deck');
        expect(out[0].valuation).toBe(12000);
      } finally {
        (globalThis as any).fetch = origFetch;
      }
    });

    it('healthCheck returns ok=true on 200', async () => {
      const origFetch = (globalThis as any).fetch;
      (globalThis as any).fetch = () => Promise.resolve({ ok: true, status: 200 });
      try {
        const adapter = new DallasOpenDataAdapter(cfg);
        const h = await adapter.healthCheck();
        expect(h.ok).toBe(true);
      } finally {
        (globalThis as any).fetch = origFetch;
      }
    });

    it('healthCheck returns ok=false on non-2xx', async () => {
      const origFetch = (globalThis as any).fetch;
      (globalThis as any).fetch = () => Promise.resolve({ ok: false, status: 503 });
      try {
        const adapter = new DallasOpenDataAdapter(cfg);
        const h = await adapter.healthCheck();
        expect(h.ok).toBe(false);
        expect(h.detail).toContain('503');
      } finally {
        (globalThis as any).fetch = origFetch;
      }
    });
  });
});
