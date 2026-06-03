import { Injectable, Logger } from '@nestjs/common';
import { JurisdictionVendor, PermitStatus } from '@prisma/client';
import {
  AdapterConfig,
  JurisdictionAdapter,
  NormalizedPermit,
  PermitSearchParams,
} from '../jurisdiction-adapter.interface';
import { MockAdapter } from './mock.adapter';
import { mapStatus } from './accela.adapter';

/**
 * Shovels.ai v2 adapter — used for Flower Mound (no native API) and as a
 * universal aggregator fallback.
 *
 * Three-step recipe per Shovels docs:
 *   1) GET /v2/addresses/search?address=...           → pick a geo_id
 *   2) GET /v2/permits/search?geo_id=...&permit_from=YYYY-MM-DD&permit_to=YYYY-MM-DD
 *
 * Env: SHOVELS_API_KEY
 */

interface ShovelsAddress {
  geo_id?: string;
  address_formatted?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
}

interface ShovelsPermit {
  id?: string;
  permit_number?: string;
  permit_id?: string;
  address?: string;
  formatted_address?: string;
  permit_type?: string;
  type?: string;
  status?: string;
  file_date?: string;
  issue_date?: string;
  final_date?: string;
  fee?: number;
  valuation?: number;
  description?: string;
  contractor_name?: string;
  contractor?: { name?: string };
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
      const geoId = await this.resolveGeoId(params.address);
      if (!geoId) {
        this.logger.warn(
          `[shovels:${this.cfg.slug}] no geo_id match for "${params.address}" — falling back to mock`,
        );
        return this.fallback.getPermitsByAddress(params);
      }
      const permits = await this.permitsByGeoId(geoId, params.limit ?? 25);
      const mapped = permits.map((p) => this.mapPermit(p, params.address));
      this.logger.log(
        `[shovels:${this.cfg.slug}] geo_id=${geoId} returned ${mapped.length}`,
      );
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
      const res = await fetch(`${this.base}/meta`, {
        headers: { 'X-API-Key': this.apiKey! },
      });
      return {
        ok: res.ok,
        detail: res.ok ? 'shovels live' : `meta ${res.status}`,
      };
    } catch (err: any) {
      return { ok: false, detail: `shovels error: ${err?.message ?? err}` };
    }
  }

  // ── private ─────────────────────────────────────────────

  private async resolveGeoId(address: string): Promise<string | null> {
    const url = `${this.base}/addresses/search?address=${encodeURIComponent(address)}`;
    const res = await fetch(url, {
      headers: { 'X-API-Key': this.apiKey! },
    });
    if (!res.ok) {
      throw new Error(`shovels addresses ${res.status}`);
    }
    const json = (await res.json()) as { items?: ShovelsAddress[]; data?: ShovelsAddress[] };
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
    const url = `${this.base}/permits/search?geo_id=${encodeURIComponent(geoId)}&permit_from=${fmt(from)}&permit_to=${fmt(to)}&size=${limit}`;
    const res = await fetch(url, {
      headers: { 'X-API-Key': this.apiKey! },
    });
    if (!res.ok) {
      throw new Error(`shovels permits ${res.status}`);
    }
    const json = (await res.json()) as {
      items?: ShovelsPermit[];
      data?: ShovelsPermit[];
    };
    return json.items ?? json.data ?? [];
  }

  private mapPermit(p: ShovelsPermit, fallbackAddress: string): NormalizedPermit {
    const externalId =
      p.permit_number ?? p.id ?? p.permit_id ?? `SHV-${Math.random().toString(36).slice(2, 10)}`;
    const issued = p.issue_date ?? p.file_date;
    return {
      externalId,
      address: p.formatted_address ?? p.address ?? fallbackAddress,
      type: p.permit_type ?? p.type ?? null,
      status: mapStatus(p.status),
      issuedAt: issued ? new Date(issued) : null,
      finalizedAt: p.final_date ? new Date(p.final_date) : null,
      contractor: p.contractor?.name ?? p.contractor_name ?? null,
      valuation: typeof p.valuation === 'number' ? p.valuation : null,
      description: p.description ?? null,
      raw: p,
    };
  }
}

// Re-export so tests can import mapStatus from either adapter cleanly
export { mapStatus } from './accela.adapter';

// Unused helper to silence ts-unused warnings if PermitStatus is shaken away
function _ts(_p?: PermitStatus): void {}
_ts();
