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
 * Accela Construct API v4 adapter — used for Dallas (DallasNow).
 *
 *   Auth:    POST https://auth.accela.com/oauth2/token   (client_credentials)
 *   Search:  POST https://apis.accela.com/v4/search/records   (no end-user auth req'd)
 *
 * Env (set in Render):
 *   ACCELA_APP_ID
 *   ACCELA_APP_SECRET
 *   ACCELA_ENV            Production | Sandbox    (default: Sandbox)
 *   ACCELA_AGENCY         e.g. DALLAS_TX          (or set per-Jurisdiction in adapterConfig.agency)
 *
 * Falls back to MockAdapter when ACCELA_APP_ID/SECRET are missing so the
 * demo page is always populated.
 */

interface AccelaToken {
  access_token: string;
  expires_in: number;
  obtained_at: number; // ms epoch
}

interface AccelaRecord {
  id?: string;
  customId?: string;
  name?: string;
  type?: { value?: string; text?: string; alias?: string };
  status?: { value?: string; text?: string };
  openedDate?: string;
  completedDate?: string;
  totalJobCost?: number;
  totalJobValuation?: number;
  description?: string;
  shortNotes?: string;
  professionals?: Array<{
    businessName?: string;
    name?: string;
    firstName?: string;
    lastName?: string;
  }>;
  address?: {
    streetAddress?: string;
    city?: string;
    state?: { value?: string };
    postalCode?: string;
  };
  addresses?: Array<{
    streetAddress?: string;
    city?: string;
    state?: { value?: string };
    postalCode?: string;
  }>;
}

interface AccelaSearchResponse {
  status?: number;
  result?: AccelaRecord[];
  page?: { offset: number; limit: number; hasmore: boolean };
}

@Injectable()
export class AccelaAdapter implements JurisdictionAdapter {
  readonly vendor = JurisdictionVendor.ACCELA;
  private readonly logger = new Logger(AccelaAdapter.name);
  private readonly appId = process.env.ACCELA_APP_ID;
  private readonly appSecret = process.env.ACCELA_APP_SECRET;
  private readonly env = process.env.ACCELA_ENV ?? 'Sandbox';
  private readonly fallback: MockAdapter;

  // Static token cache shared across instances (one process).
  private static tokenCache: AccelaToken | null = null;

  constructor(private readonly cfg: AdapterConfig) {
    this.fallback = new MockAdapter(cfg);
  }

  private hasCreds(): boolean {
    return Boolean(this.appId && this.appSecret);
  }

  private get agency(): string {
    const fromCfg = (this.cfg.config as any)?.agency as string | undefined;
    return fromCfg ?? process.env.ACCELA_AGENCY ?? 'DALLAS_TX';
  }

  async getPermitsByAddress(
    params: PermitSearchParams,
  ): Promise<NormalizedPermit[]> {
    if (!this.hasCreds()) {
      this.logger.warn(
        `[accela:${this.cfg.slug}] no creds — falling back to mock`,
      );
      return this.fallback.getPermitsByAddress(params);
    }

    try {
      const token = await this.getToken();
      const records = await this.searchRecords(token, params.address, params.limit);
      const mapped = records.map((r) => this.mapRecord(r, params.address));
      this.logger.log(
        `[accela:${this.cfg.slug}] address="${params.address}" returned ${mapped.length}`,
      );
      return mapped;
    } catch (err: any) {
      this.logger.error(
        `[accela:${this.cfg.slug}] live call failed — falling back to mock: ${err?.message ?? err}`,
      );
      return this.fallback.getPermitsByAddress(params);
    }
  }

  async healthCheck() {
    if (!this.hasCreds()) {
      return { ok: false, detail: 'ACCELA_APP_ID / ACCELA_APP_SECRET unset' };
    }
    try {
      await this.getToken();
      return { ok: true, detail: `accela ${this.env} agency=${this.agency}` };
    } catch (err: any) {
      return { ok: false, detail: `token error: ${err?.message ?? err}` };
    }
  }

  // ── private ─────────────────────────────────────────────

  private async getToken(): Promise<string> {
    const cached = AccelaAdapter.tokenCache;
    if (
      cached &&
      Date.now() < cached.obtained_at + (cached.expires_in - 60) * 1000
    ) {
      return cached.access_token;
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.appId!,
      client_secret: this.appSecret!,
      scope: 'records search_records',
    });
    const res = await fetch('https://auth.accela.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) {
      throw new Error(`accela auth ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as {
      access_token: string;
      expires_in: number;
    };
    AccelaAdapter.tokenCache = {
      access_token: json.access_token,
      expires_in: json.expires_in,
      obtained_at: Date.now(),
    };
    return json.access_token;
  }

  private async searchRecords(
    token: string,
    address: string,
    limit = 25,
  ): Promise<AccelaRecord[]> {
    // Parse "1500 Marilla St, Dallas, TX 75201" → component filters
    const parts = address.split(',').map((s) => s.trim());
    const street = parts[0] ?? address;
    const streetMatch = street.match(/^(\d+)\s+(.+)$/);
    const streetNo = streetMatch?.[1];
    const streetName = streetMatch?.[2] ?? street;
    const zipMatch = address.match(/\b(\d{5})(?:-\d{4})?\b/);

    const filter: any = {};
    if (streetNo) filter.streetStart = Number(streetNo);
    if (streetName) filter.streetName = streetName.toUpperCase();
    if (zipMatch) filter.postalCode = zipMatch[1];

    const url = `https://apis.accela.com/v4/search/records?limit=${limit}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
        'x-accela-environment': this.env,
        'x-accela-agency': this.agency,
        'x-accela-appid': this.appId!,
      },
      body: JSON.stringify({ addresses: [filter] }),
    });
    if (!res.ok) {
      throw new Error(
        `accela search ${res.status}: ${(await res.text()).slice(0, 200)}`,
      );
    }
    const json = (await res.json()) as AccelaSearchResponse;
    return json.result ?? [];
  }

  private mapRecord(r: AccelaRecord, fallbackAddress: string): NormalizedPermit {
    const status = mapStatus(r.status?.value ?? r.status?.text);
    const valuation =
      typeof r.totalJobValuation === 'number'
        ? r.totalJobValuation
        : typeof r.totalJobCost === 'number'
          ? r.totalJobCost
          : null;
    const addr = r.address ?? r.addresses?.[0];
    const formatted = addr
      ? [addr.streetAddress, addr.city, addr.state?.value, addr.postalCode]
          .filter(Boolean)
          .join(', ')
      : fallbackAddress;
    const pro = r.professionals?.[0];
    const contractor: string | null =
      pro?.businessName ??
      pro?.name ??
      ([pro?.firstName, pro?.lastName].filter(Boolean).join(' ') || null);
    return {
      externalId: r.customId ?? r.id ?? `ACC-${Math.random().toString(36).slice(2, 10)}`,
      address: formatted,
      type: r.type?.alias ?? r.type?.text ?? r.type?.value ?? null,
      status,
      issuedAt: r.openedDate ? new Date(r.openedDate) : null,
      finalizedAt: r.completedDate ? new Date(r.completedDate) : null,
      contractor,
      valuation,
      description: r.description ?? r.shortNotes ?? null,
      raw: r,
    };
  }
}

export function mapStatus(s: string | undefined): PermitStatus {
  if (!s) return PermitStatus.UNKNOWN;
  const v = s.toLowerCase();
  if (v.includes('final') || v.includes('complete') || v.includes('closed'))
    return PermitStatus.FINALIZED;
  if (v.includes('issued') || v.includes('approved'))
    return PermitStatus.ISSUED;
  if (v.includes('expired')) return PermitStatus.EXPIRED;
  if (v.includes('cancel') || v.includes('void') || v.includes('withdrawn'))
    return PermitStatus.CANCELLED;
  if (
    v.includes('submitted') ||
    v.includes('received') ||
    v.includes('review') ||
    v.includes('open') ||
    v.includes('pending')
  )
    return PermitStatus.OPEN;
  return PermitStatus.UNKNOWN;
}
