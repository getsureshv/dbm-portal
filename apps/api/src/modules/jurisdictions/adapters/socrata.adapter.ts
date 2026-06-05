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
 * Generic Socrata (Tyler Data & Insights) adapter — config-driven.
 *
 * Socrata powers hundreds of municipal/county open-data portals. They all
 * speak the same SoQL query API; what differs per city is only:
 *   - the host domain        (e.g. www.dallasopendata.com)
 *   - the dataset id          (e.g. e7gq-4sah)
 *   - the COLUMN NAMES         (street_address vs address vs site_address …)
 *   - the date format          (Socrata floating-timestamp vs MM/DD/YY …)
 *
 * So instead of writing a hand-coded adapter per city, this adapter takes a
 * `fieldMap` from Jurisdiction.adapterConfig and is reused for EVERY Socrata
 * city. Onboarding a new Socrata jurisdiction becomes a DB row, not a deploy.
 *
 *   Jurisdiction.adapterConfig (all optional; Dallas-flavored defaults shown):
 *   {
 *     "domain":    "www.dallasopendata.com",
 *     "datasetId": "e7gq-4sah",
 *     "appToken":  "<optional Socrata app token to raise rate limits>",
 *     "fieldMap": {
 *       "externalId":  "permit_number",
 *       "type":        ["permit_type", "land_use"],   // first non-empty wins
 *       "status":      "permit_status",               // optional; absent → ISSUED
 *       "issuedAt":    "issued_date",
 *       "finalizedAt": null,                            // optional column
 *       "contractor":  "contractor",
 *       "valuation":   "value",
 *       "description": "work_description",
 *       "address":     "street_address",               // also used for the WHERE clause
 *       "zip":         "zip_code"
 *     },
 *     "addressField": "street_address",                 // column to LIKE-match on
 *     "orderBy":      "issued_date DESC",
 *     "idPrefix":     "SOCRATA"                          // synthesized-id prefix
 *   }
 *
 * Env (optional, raises throttling thresholds, used when appToken not in config):
 *   SOCRATA_APP_TOKEN  (DALLAS_OPENDATA_APP_TOKEN still honored by the Dallas preset)
 *
 * Falls back to MockAdapter on any network/parse/empty-address error so the
 * UI never shows a broken page.
 */

export type FieldRef = string | string[] | null | undefined;

export interface SocrataFieldMap {
  externalId?: FieldRef;
  type?: FieldRef;
  status?: FieldRef;
  issuedAt?: FieldRef;
  finalizedAt?: FieldRef;
  contractor?: FieldRef;
  valuation?: FieldRef;
  description?: FieldRef;
  address?: FieldRef;
  zip?: FieldRef;
}

export interface SocrataAdapterOptions {
  vendor?: JurisdictionVendor;
  domain?: string;
  datasetId?: string;
  appToken?: string;
  fieldMap?: SocrataFieldMap;
  addressField?: string;
  orderBy?: string;
  idPrefix?: string;
}

/** Dallas-flavored defaults — keep the original behavior intact for the Dallas preset. */
export const DEFAULT_FIELD_MAP: Required<
  Pick<
    SocrataFieldMap,
    | 'externalId'
    | 'type'
    | 'status'
    | 'issuedAt'
    | 'contractor'
    | 'valuation'
    | 'description'
    | 'address'
    | 'zip'
  >
> = {
  externalId: 'permit_number',
  type: ['permit_type', 'land_use'],
  status: 'permit_status',
  issuedAt: 'issued_date',
  contractor: 'contractor',
  valuation: 'value',
  description: 'work_description',
  address: 'street_address',
  zip: 'zip_code',
};

const DEFAULTS = {
  domain: 'www.dallasopendata.com',
  datasetId: 'e7gq-4sah',
  addressField: 'street_address',
  orderBy: 'issued_date DESC',
  idPrefix: 'SOCRATA',
};

type SocrataRecord = Record<string, unknown>;

export class SocrataAdapter implements JurisdictionAdapter {
  readonly vendor: JurisdictionVendor;
  protected readonly logger: Logger;

  protected readonly domain: string;
  protected readonly datasetId: string;
  protected readonly appToken: string | undefined;
  protected readonly fieldMap: SocrataFieldMap;
  protected readonly addressField: string;
  protected readonly orderBy: string;
  protected readonly idPrefix: string;

  constructor(
    protected readonly cfg: AdapterConfig,
    options: SocrataAdapterOptions = {},
  ) {
    const c = (cfg.config ?? {}) as Record<string, unknown>;
    const cfgFieldMap = (c.fieldMap as SocrataFieldMap | undefined) ?? undefined;

    this.vendor = options.vendor ?? JurisdictionVendor.DALLAS_OPENDATA;
    this.domain = (c.domain as string) ?? options.domain ?? DEFAULTS.domain;
    this.datasetId =
      (c.datasetId as string) ?? options.datasetId ?? DEFAULTS.datasetId;
    this.appToken =
      (c.appToken as string) ??
      options.appToken ??
      process.env.SOCRATA_APP_TOKEN;
    this.fieldMap = { ...DEFAULT_FIELD_MAP, ...options.fieldMap, ...cfgFieldMap };
    this.addressField =
      (c.addressField as string) ??
      options.addressField ??
      (typeof this.fieldMap.address === 'string'
        ? this.fieldMap.address
        : DEFAULTS.addressField);
    this.orderBy = (c.orderBy as string) ?? options.orderBy ?? DEFAULTS.orderBy;
    this.idPrefix =
      (c.idPrefix as string) ?? options.idPrefix ?? DEFAULTS.idPrefix;
    this.logger = new Logger(`${this.constructor.name}`);
  }

  async getPermitsByAddress(
    params: PermitSearchParams,
  ): Promise<NormalizedPermit[]> {
    try {
      const normalized = normalizeAddressForQuery(params.address);
      if (!normalized) {
        this.logger.warn(
          `Empty / unparseable address "${params.address}"; falling back to mock`,
        );
        return new MockAdapter(this.cfg).getPermitsByAddress(params);
      }

      const limit = Math.min(params.limit ?? 25, 200);
      const records = await this.fetchSocrata(this.buildUrl(normalized, limit));

      if (records.length === 0) {
        const looser = stripLeadingNumber(normalized);
        if (looser && looser !== normalized) {
          const more = await this.fetchSocrata(this.buildUrl(looser, limit));
          return more.map((r) => this.mapRecord(r));
        }
      }
      return records.map((r) => this.mapRecord(r));
    } catch (err) {
      this.logger.error(
        `Socrata fetch failed (${(err as Error).message}); falling back to mock`,
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
      if (!res.ok) return { ok: false, detail: `Socrata HTTP ${res.status}` };
      return { ok: true, detail: `dataset=${this.datasetId}` };
    } catch (err) {
      return { ok: false, detail: (err as Error).message };
    }
  }

  /** Map one raw Socrata record using this adapter's field map. */
  protected mapRecord(r: SocrataRecord): NormalizedPermit {
    return mapRecordWith(r, this.fieldMap, this.idPrefix);
  }

  // ── private ──────────────────────────────────────────────

  protected buildUrl(addressUpper: string, limit: number): string {
    const safe = addressUpper.replace(/'/g, "''");
    const where = `${this.addressField} like '%25${encodeURIComponent(safe)}%25'`;
    return (
      `https://${this.domain}/resource/${this.datasetId}.json` +
      `?$where=${where}` +
      `&$order=${encodeURIComponent(this.orderBy)}` +
      `&$limit=${limit}`
    );
  }

  protected async fetchSocrata(url: string): Promise<SocrataRecord[]> {
    const res = await (globalThis as any).fetch(url, {
      headers: this.appToken ? { 'X-App-Token': this.appToken } : {},
      signal: timeoutSignal(8000),
    });
    if (!res.ok) {
      throw new Error(`Socrata HTTP ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as SocrataRecord[];
    if (!Array.isArray(data)) {
      throw new Error(`Socrata returned non-array payload`);
    }
    return data;
  }
}

// ── exported pure helpers (unit-tested; shared by presets) ───────────────────

/** Read the first non-empty value from a record for a (possibly multi-) field ref. */
export function pick(r: SocrataRecord, ref: FieldRef): string | undefined {
  if (!ref) return undefined;
  const keys = Array.isArray(ref) ? ref : [ref];
  for (const k of keys) {
    const v = r[k];
    if (v !== undefined && v !== null && String(v).trim().length > 0) {
      return String(v);
    }
  }
  return undefined;
}

/**
 * Map a status string → PermitStatus. Many Socrata permit datasets carry no
 * explicit lifecycle status; absent/blank therefore resolves to ISSUED.
 */
export function mapStatusGeneric(
  raw: string | null | undefined,
): PermitStatus {
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

/** Parse Socrata/legacy date strings → Date or null. */
export function parseDateGeneric(raw: string | null | undefined): Date | null {
  if (!raw) return null;
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

/** Generic record mapper driven by a field map. */
export function mapRecordWith(
  r: SocrataRecord,
  fieldMap: SocrataFieldMap,
  idPrefix = 'SOCRATA',
): NormalizedPermit {
  const fm = { ...DEFAULT_FIELD_MAP, ...fieldMap };
  const issuedAt = parseDateGeneric(pick(r, fm.issuedAt));
  const status = mapStatusGeneric(pick(r, fm.status));
  const street = pick(r, fm.address);
  const zip = pick(r, fm.zip);
  const fullAddress = [street, zip]
    .filter((s) => s && s.trim().length > 0)
    .join(', ');
  const rawValuation = pick(r, fm.valuation);
  const valuation =
    rawValuation && /^-?\d+(\.\d+)?$/.test(rawValuation.trim())
      ? parseFloat(rawValuation)
      : null;
  const finalizedFromCol = parseDateGeneric(pick(r, fm.finalizedAt));

  return {
    externalId:
      pick(r, fm.externalId) || `${idPrefix}-${hash(JSON.stringify(r))}`,
    address: fullAddress || (street ?? ''),
    type: pick(r, fm.type) ?? null,
    status,
    issuedAt,
    finalizedAt:
      finalizedFromCol ??
      (status === PermitStatus.FINALIZED ? issuedAt : null),
    contractor: pick(r, fm.contractor) ?? null,
    valuation,
    description: pick(r, fm.description) ?? null,
    raw: r,
  };
}

/** Trim + upper-case for Socrata LIKE matching, drop trailing city/state/zip. */
export function normalizeAddressForQuery(raw: string): string {
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
