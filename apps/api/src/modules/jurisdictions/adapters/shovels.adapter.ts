import { Injectable, Logger } from '@nestjs/common';
import { JurisdictionVendor, PermitStatus } from '@prisma/client';
import {
  AdapterConfig,
  JurisdictionAdapter,
  NormalizedPermit,
  PermitSearchParams,
} from '../jurisdiction-adapter.interface';
import { MockAdapter } from './mock.adapter';

/**
 * Shovels.ai v2 adapter — used for Flower Mound (no native API) and as a
 * universal aggregator fallback.
 *
 * Recipe per actual Shovels v2 contract (verified June 2026):
 *   1) GET /v2/addresses/search?q=<full address>&size=1   → pick a geo_id
 *      (404 "No addresses found" is normal for sparse rural addresses;
 *       fall through to zip-code search below)
 *   2) If no address-level geo_id, extract a 5-digit zip from the input
 *      and use it directly as the geo_id (Shovels accepts zip codes,
 *      Shovels geo-IDs, FIPS county codes, or state abbreviations).
 *   3) GET /v2/permits/search?geo_id=...&permit_from=YYYY-MM-DD&permit_to=YYYY-MM-DD&size=N
 *
 * Env: SHOVELS_API_KEY
 * Header: X-API-Key
 *
 * The adapter falls back to MockAdapter on any failure so the demo never
 * shows a broken page.
 */

interface ShovelsAddressItem {
  geo_id?: string;
  name?: string;
  street_no?: string;
  street?: string;
  city?: string;
  state?: string;
  zip_code?: string;
}

interface ShovelsPermitAddress {
  street_no?: string;
  street?: string;
  city?: string;
  county?: string;
  zip_code?: string;
  zip_code_ext?: string;
  state?: string;
  jurisdiction?: string;
}

interface ShovelsPermit {
  id?: string;
  number?: string;            // permit number
  description?: string;
  type?: string;
  subtype?: string;
  status?: string;            // "active" | "issued" | "final" | "expired" | "cancelled" | ...
  file_date?: string;
  issue_date?: string;
  final_date?: string;
  job_value?: number | null;
  contractor_id?: string | null;
  address?: ShovelsPermitAddress;
  jurisdiction?: string;
}

interface ShovelsListResponse<T> {
  items?: T[];
  size?: number;
  next_cursor?: string | null;
  total_count?: number | null;
  // legacy / alt shape
  data?: T[];
}

@Injectable()
export class ShovelsAdapter implements JurisdictionAdapter {
  readonly vendor = JurisdictionVendor.SHOVELS;
  private readonly logger = new Logger(ShovelsAdapter.name);
  private readonly apiKey = process.env.SHOVELS_API_KEY;
  private readonly base = 'https://api.shovels.ai/v2';
  private readonly fallback: MockAdapter;

  constructor(private readonly cfg: AdapterConfig) {
    this.fallback = new MockAdapter(cfg);
  }

  private hasCreds(): boolean {
    return Boolean(this.apiKey);
  }

  async getPermitsByAddress(
    params: PermitSearchParams,
  ): Promise<NormalizedPermit[]> {
    if (!this.hasCreds()) {
      this.logger.warn(
        `[shovels:${this.cfg.slug}] no SHOVELS_API_KEY — falling back to mock`,
      );
      return this.fallback.getPermitsByAddress(params);
    }
    try {
      let geoId = await this.resolveAddressGeoId(params.address);
      let geoSource = 'address';
      if (!geoId) {
        const zip = extractZip(params.address);
        if (zip) {
          geoId = zip;
          geoSource = 'zip';
        }
      }
      if (!geoId) {
        this.logger.warn(
          `[shovels:${this.cfg.slug}] no geo_id or zip parseable from "${params.address}" — falling back to mock`,
        );
        return this.fallback.getPermitsByAddress(params);
      }
      const permits = await this.permitsByGeoId(geoId, params.limit ?? 25);
      const mapped = permits.map((p) => mapPermit(p, params.address));
      this.logger.log(
        `[shovels:${this.cfg.slug}] geo_id=${geoId} (${geoSource}) returned ${mapped.length}`,
      );
      // If a zip-level search yielded zero rows we have no real data; fall back.
      if (mapped.length === 0) {
        return this.fallback.getPermitsByAddress(params);
      }
      return mapped;
    } catch (err: any) {
      this.logger.error(
        `[shovels:${this.cfg.slug}] live call failed — falling back to mock: ${err?.message ?? err}`,
      );
      return this.fallback.getPermitsByAddress(params);
    }
  }

  async healthCheck() {
    if (!this.hasCreds()) {
      return { ok: false, detail: 'SHOVELS_API_KEY unset' };
    }
    try {
      // No dedicated health endpoint; probe a known-good zip lookup.
      const res = await fetch(`${this.base}/zipcodes/search?q=75028&size=1`, {
        headers: { 'X-API-Key': this.apiKey! },
      });
      return {
        ok: res.ok,
        detail: res.ok ? 'shovels live (v2)' : `zipcodes ${res.status}`,
      };
    } catch (err: any) {
      return { ok: false, detail: `shovels error: ${err?.message ?? err}` };
    }
  }

  // ── private ─────────────────────────────────────────────

  private async resolveAddressGeoId(address: string): Promise<string | null> {
    const url = `${this.base}/addresses/search?q=${encodeURIComponent(address)}&size=1`;
    const res = await fetch(url, {
      headers: { 'X-API-Key': this.apiKey! },
    });
    // 404 "No addresses found" is normal — treat as no-match rather than error
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`shovels addresses ${res.status}`);
    }
    const json = (await res.json()) as ShovelsListResponse<ShovelsAddressItem>;
    const list = json.items ?? json.data ?? [];
    return list[0]?.geo_id ?? null;
  }

  private async permitsByGeoId(
    geoId: string,
    limit: number,
  ): Promise<ShovelsPermit[]> {
    // Window the search to "last 5 years" — required by API.
    const to = new Date();
    const from = new Date();
    from.setFullYear(to.getFullYear() - 5);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const size = Math.min(Math.max(limit, 1), 100);
    const url =
      `${this.base}/permits/search` +
      `?geo_id=${encodeURIComponent(geoId)}` +
      `&permit_from=${fmt(from)}` +
      `&permit_to=${fmt(to)}` +
      `&size=${size}`;
    const res = await fetch(url, {
      headers: { 'X-API-Key': this.apiKey! },
    });
    if (res.status === 404) return [];
    if (!res.ok) {
      throw new Error(`shovels permits ${res.status}`);
    }
    const json = (await res.json()) as ShovelsListResponse<ShovelsPermit>;
    return json.items ?? json.data ?? [];
  }
}

// ── exported helpers (unit-tested) ─────────────────────────────────────────

/** Map Shovels status text → our internal PermitStatus enum. */
export function mapShovelsStatus(raw: string | null | undefined): PermitStatus {
  if (!raw) return PermitStatus.UNKNOWN;
  const s = raw.trim().toUpperCase();
  if (s.includes('FINAL') || s.includes('CLOSED') || s.includes('COMPLETE')) {
    return PermitStatus.FINALIZED;
  }
  if (s.includes('EXPIRED') || s.includes('VOID')) {
    return PermitStatus.EXPIRED;
  }
  if (
    s.includes('CANCEL') ||
    s.includes('REVOKED') ||
    s.includes('REJECTED') ||
    s.includes('DENIED')
  ) {
    return PermitStatus.CANCELLED;
  }
  if (s.includes('OPEN') || s.includes('APPLIED') || s.includes('REVIEW')) {
    return PermitStatus.OPEN;
  }
  // "active" and "issued" both map to ISSUED — permit is live
  if (s.includes('ACTIVE') || s.includes('ISSUED') || s.includes('PERMIT')) {
    return PermitStatus.ISSUED;
  }
  return PermitStatus.UNKNOWN;
}

/** Extract a 5-digit US ZIP code from a free-text address, or null. */
export function extractZip(addr: string | null | undefined): string | null {
  if (!addr) return null;
  const m = addr.match(/\b(\d{5})(?:-\d{4})?\b/);
  return m ? m[1] : null;
}

/** Format a Shovels address object → flat string. */
export function formatShovelsAddress(a: ShovelsPermitAddress | undefined): string {
  if (!a) return '';
  const street = [a.street_no, a.street].filter(Boolean).join(' ').trim();
  const cityState = [a.city, a.state].filter(Boolean).join(', ');
  const tail = [cityState, a.zip_code].filter(Boolean).join(' ');
  return [street, tail].filter(Boolean).join(', ');
}

export function mapPermit(
  p: ShovelsPermit,
  fallbackAddress: string,
): NormalizedPermit {
  const externalId = p.number ?? p.id ?? `SHV-${Math.random().toString(36).slice(2, 10)}`;
  const issued = p.issue_date ?? p.file_date;
  const subtype = p.subtype && p.type && !p.subtype.includes(p.type)
    ? `${p.type} — ${p.subtype}`
    : p.type ?? p.subtype ?? null;
  return {
    externalId,
    address: formatShovelsAddress(p.address) || fallbackAddress,
    type: subtype,
    status: mapShovelsStatus(p.status),
    issuedAt: issued ? new Date(issued) : null,
    finalizedAt: p.final_date ? new Date(p.final_date) : null,
    contractor: p.contractor_id ?? null,
    valuation: typeof p.job_value === 'number' ? p.job_value : null,
    description: p.description ?? null,
    raw: p as unknown as Record<string, unknown>,
  };
}

// Re-export for any consumer that imported the old name
export { mapShovelsStatus as mapStatus };

// Keep PermitStatus import live for type narrowing in tests
function _ts(_p?: PermitStatus): void {}
_ts();
