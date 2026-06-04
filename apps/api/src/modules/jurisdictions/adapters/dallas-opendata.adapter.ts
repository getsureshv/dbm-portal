import { Logger } from '@nestjs/common';
import { JurisdictionVendor, PermitStatus } from '@prisma/client';
import {
  AdapterConfig,
  JurisdictionAdapter,
  NormalizedPermit,
  PermitSearchParams,
} from '../jurisdiction-adapter.interface';
import { MockAdapter } from './mock.adapter';

/**
 * Dallas OpenData (Socrata) adapter — REAL permit data, no auth.
 *
 *   Dataset: e7gq-4sah  "Building Permits"   (~56k rows; primary year 2019)
 *   Endpoint: https://www.dallasopendata.com/resource/e7gq-4sah.json
 *   SoQL docs: https://dev.socrata.com/docs/queries/
 *
 * We chose Dallas OpenData over the Accela Construct API for this demo
 * because the Construct API requires per-agency partnership credentials
 * (Dallas's "DALLASTX" agency is gated), while Socrata is fully public.
 * The Accela adapter is preserved in this codebase so a city using their
 * Citizen Access tenant can be wired without a rewrite.
 *
 * Adapter config (optional, set in Jurisdiction.adapterConfig):
 *   {
 *     "datasetId": "e7gq-4sah",
 *     "domain":    "www.dallasopendata.com",
 *     "appToken":  "<optional Socrata app token to raise rate limits>"
 *   }
 *
 * Env (optional, raises throttling thresholds):
 *   DALLAS_OPENDATA_APP_TOKEN
 *
 * Falls back to MockAdapter on any network/parse error so the demo never
 * shows a broken page.
 */

interface DallasOpenDataRecord {
  permit_number?: string;
  permit_type?: string;
  issued_date?: string;            // e.g. "10/24/19"
  permit_status?: string;          // NOT present in e7gq-4sah; kept for forward-compat with other Dallas datasets
  mapsco?: string;
  contractor?: string;
  value?: string;                  // money as string
  area?: string;
  work_description?: string;
  land_use?: string;
  street_address?: string;
  zip_code?: string;
}

export class DallasOpenDataAdapter implements JurisdictionAdapter {
  readonly vendor = JurisdictionVendor.DALLAS_OPENDATA;
  private readonly logger = new Logger(DallasOpenDataAdapter.name);

  // Defaults — overridable via adapterConfig
  private readonly datasetId: string;
  private readonly domain: string;
  private readonly appToken: string | undefined;

  constructor(private readonly cfg: AdapterConfig) {
    const c = (cfg.config ?? {}) as Record<string, string | undefined>;
    this.datasetId = c.datasetId ?? 'e7gq-4sah';
    this.domain = c.domain ?? 'www.dallasopendata.com';
    this.appToken = c.appToken ?? process.env.DALLAS_OPENDATA_APP_TOKEN;
  }

  async getPermitsByAddress(params: PermitSearchParams): Promise<NormalizedPermit[]> {
    try {
      const normalized = normalizeAddressForQuery(params.address);
      if (!normalized) {
        this.logger.warn(
          `Empty / unparseable address "${params.address}"; falling back to mock`,
        );
        return new MockAdapter(this.cfg).getPermitsByAddress(params);
      }

      const limit = Math.min(params.limit ?? 25, 200);
      const url = this.buildUrl(normalized, limit);
      const records = await this.fetchSocrata(url);

      if (records.length === 0) {
        // Try a looser match dropping the street number — handy when addresses
        // are formatted oddly upstream. Still real Dallas data.
        const looserAddress = stripLeadingNumber(normalized);
        if (looserAddress && looserAddress !== normalized) {
          const url2 = this.buildUrl(looserAddress, limit);
          const more = await this.fetchSocrata(url2);
          return more.map((r) => mapRecord(r));
        }
      }
      return records.map((r) => mapRecord(r));
    } catch (err) {
      this.logger.error(
        `Dallas OpenData fetch failed (${(err as Error).message}); falling back to mock`,
      );
      return new MockAdapter(this.cfg).getPermitsByAddress(params);
    }
  }

  async healthCheck(): Promise<{ ok: boolean; detail?: string }> {
    try {
      const url = `https://${this.domain}/resource/${this.datasetId}.json?$limit=1`;
      const res = await (globalThis as any).fetch(url, {
        headers: this.appToken ? { 'X-App-Token': this.appToken } : {},
        signal: timeoutSignal(5000),
      });
      if (!res.ok) {
        return { ok: false, detail: `Socrata HTTP ${res.status}` };
      }
      return { ok: true, detail: `dataset=${this.datasetId}` };
    } catch (err) {
      return { ok: false, detail: (err as Error).message };
    }
  }

  // ── private ──────────────────────────────────────────────

  private buildUrl(addressUpper: string, limit: number): string {
    // Socrata SoQL: case-sensitive LIKE on street_address. Dallas stores
    // addresses upper-case; we upper-case the query to match.
    const safe = addressUpper.replace(/'/g, "''");
    const where = `street_address like '%25${encodeURIComponent(safe)}%25'`;
    // NOTE: dataset e7gq-4sah does NOT expose a permit_status column; every row
    // in this dataset is an issued permit by definition. mapStatus(undefined)
    // therefore resolves to PermitStatus.ISSUED in mapRecord.
    const select =
      'permit_number,permit_type,issued_date,contractor,value,area,work_description,land_use,street_address,zip_code,mapsco';
    return (
      `https://${this.domain}/resource/${this.datasetId}.json` +
      `?$select=${select}` +
      `&$where=${where}` +
      `&$order=issued_date DESC` +
      `&$limit=${limit}`
    );
  }

  private async fetchSocrata(url: string): Promise<DallasOpenDataRecord[]> {
    const res = await (globalThis as any).fetch(url, {
      headers: this.appToken ? { 'X-App-Token': this.appToken } : {},
      signal: timeoutSignal(8000),
    });
    if (!res.ok) {
      throw new Error(`Socrata HTTP ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as DallasOpenDataRecord[];
    if (!Array.isArray(data)) {
      throw new Error(`Socrata returned non-array payload`);
    }
    return data;
  }
}

// ── exported helpers (also unit-tested) ──────────────────────────────────────

/**
 * Map Dallas OpenData status text → our internal PermitStatus enum.
 * The OpenData "Building Permits" dataset doesn't carry an explicit
 * lifecycle status, but `permit_status` is sometimes present in other
 * Dallas datasets. We err on the side of ISSUED because every row in
 * the building-permits dataset HAS an issued_date by definition.
 */
export function mapStatus(raw: string | null | undefined): PermitStatus {
  if (!raw) return PermitStatus.ISSUED;
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
  return PermitStatus.ISSUED;
}

/** Parse Socrata date strings like "10/24/19" → Date or null. */
export function parseIssuedDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  // Common formats: "MM/DD/YY", "MM/DD/YYYY", ISO "YYYY-MM-DDTHH:mm:ss.SSS"
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const mm = parseInt(m[1], 10);
    const dd = parseInt(m[2], 10);
    let yy = parseInt(m[3], 10);
    if (yy < 100) yy += yy < 50 ? 2000 : 1900;
    const d = new Date(Date.UTC(yy, mm - 1, dd));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function mapRecord(r: DallasOpenDataRecord): NormalizedPermit {
  const issuedAt = parseIssuedDate(r.issued_date);
  const status = mapStatus(r.permit_status);
  const fullAddress = [r.street_address, r.zip_code]
    .filter((s) => s && s.trim().length > 0)
    .join(', ');
  const valuation =
    r.value && /^-?\d+(\.\d+)?$/.test(r.value.trim())
      ? parseFloat(r.value)
      : null;

  return {
    externalId: r.permit_number?.trim() || `DALLAS-${hash(JSON.stringify(r))}`,
    address: fullAddress || (r.street_address ?? ''),
    type: r.permit_type ?? r.land_use ?? null,
    status,
    issuedAt,
    finalizedAt: status === PermitStatus.FINALIZED ? issuedAt : null,
    contractor: r.contractor ?? null,
    valuation,
    description: r.work_description ?? null,
    raw: r,
  };
}

/** Trim and upper-case for Socrata LIKE matching, drop trailing city/state/zip. */
export function normalizeAddressForQuery(raw: string): string {
  // Pull "1500 Marilla St" out of "1500 Marilla St, Dallas, TX 75201"
  const first = raw.split(',')[0]?.trim() ?? '';
  return first.toUpperCase();
}

export function stripLeadingNumber(addr: string): string {
  return addr.replace(/^\d+\s+/, '').trim();
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).toUpperCase();
}

function timeoutSignal(ms: number): AbortSignal {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}
