import { PermitStatus } from '@prisma/client';
import {
  ShovelsAdapter,
  extractZip,
  formatShovelsAddress,
  mapShovelsStatus,
  mapPermit,
} from './shovels.adapter';

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

describe('Shovels helpers', () => {
  describe('mapShovelsStatus', () => {
    it('returns UNKNOWN when null/undefined/empty', () => {
      expect(mapShovelsStatus(null)).toBe(PermitStatus.UNKNOWN);
      expect(mapShovelsStatus(undefined)).toBe(PermitStatus.UNKNOWN);
      expect(mapShovelsStatus('')).toBe(PermitStatus.UNKNOWN);
    });
    it('maps Shovels lifecycle terms correctly', () => {
      expect(mapShovelsStatus('active')).toBe(PermitStatus.ISSUED);
      expect(mapShovelsStatus('issued')).toBe(PermitStatus.ISSUED);
      expect(mapShovelsStatus('final')).toBe(PermitStatus.FINALIZED);
      expect(mapShovelsStatus('finalized')).toBe(PermitStatus.FINALIZED);
      expect(mapShovelsStatus('CLOSED')).toBe(PermitStatus.FINALIZED);
      expect(mapShovelsStatus('expired')).toBe(PermitStatus.EXPIRED);
      expect(mapShovelsStatus('cancelled')).toBe(PermitStatus.CANCELLED);
      expect(mapShovelsStatus('revoked')).toBe(PermitStatus.CANCELLED);
      expect(mapShovelsStatus('open')).toBe(PermitStatus.OPEN);
      expect(mapShovelsStatus('under review')).toBe(PermitStatus.OPEN);
    });
    it('falls back to UNKNOWN for unknown strings', () => {
      expect(mapShovelsStatus('weird-thing')).toBe(PermitStatus.UNKNOWN);
    });
  });

  describe('extractZip', () => {
    it('finds a 5-digit zip in a free-text address', () => {
      expect(extractZip('100 Parker Sq, Flower Mound, TX 75028')).toBe('75028');
      expect(extractZip('Flower Mound TX 75022-1234')).toBe('75022');
    });
    it('returns null when no zip is present', () => {
      expect(extractZip('Flower Mound, TX')).toBeNull();
      expect(extractZip(null)).toBeNull();
      expect(extractZip(undefined)).toBeNull();
    });
  });

  describe('formatShovelsAddress', () => {
    it('joins parts cleanly', () => {
      const out = formatShovelsAddress({
        street_no: '4116',
        street: 'REMINGTON PARK CT',
        city: 'FLOWER MOUND',
        state: 'TX',
        zip_code: '75028',
      });
      expect(out).toBe('4116 REMINGTON PARK CT, FLOWER MOUND, TX 75028');
    });
    it('handles missing parts', () => {
      expect(formatShovelsAddress(undefined)).toBe('');
      expect(formatShovelsAddress({})).toBe('');
    });
  });

  describe('mapPermit', () => {
    it('maps a real-shape Shovels permit', () => {
      const out = mapPermit(
        {
          id: '0d64a36a46ff8636',
          number: 'WH26-02927',
          description: 'Water heater replacement',
          type: 'Water heater',
          subtype: 'Replacement',
          status: 'active',
          file_date: '2026-05-22',
          issue_date: '2026-05-22',
          final_date: '2026-06-01',
          job_value: null,
          address: {
            street_no: '4116',
            street: 'REMINGTON PARK CT',
            city: 'FLOWER MOUND',
            state: 'TX',
            zip_code: '75028',
          },
          jurisdiction: 'FLOWER MOUND',
        },
        'fallback addr',
      );
      expect(out.externalId).toBe('WH26-02927');
      expect(out.type).toBe('Water heater — Replacement');
      expect(out.status).toBe(PermitStatus.ISSUED);
      expect(out.issuedAt?.toISOString().slice(0, 10)).toBe('2026-05-22');
      expect(out.finalizedAt?.toISOString().slice(0, 10)).toBe('2026-06-01');
      expect(out.address).toContain('REMINGTON PARK CT');
    });
    it('falls back to provided address when permit address is missing', () => {
      const out = mapPermit({ number: 'X', status: 'final' }, 'fallback');
      expect(out.address).toBe('fallback');
      expect(out.status).toBe(PermitStatus.FINALIZED);
    });
  });
});
