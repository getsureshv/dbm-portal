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
 * Accela Construct API adapter — used for Dallas (DallasNow).
 *
 * Falls back to MockAdapter results when credentials are missing so the
 * demo page is always populated. Real implementation:
 *   1. POST https://auth.accela.com/oauth2/token  (client_credentials, env=Production / Sandbox)
 *   2. GET  https://apis.accela.com/v4/records?address=...&agency=DALLAS_TX
 *   3. Map record → NormalizedPermit
 *
 * Required env (set in Render):
 *   ACCELA_APP_ID
 *   ACCELA_APP_SECRET
 *   ACCELA_ENV=Production|Sandbox
 *   ACCELA_AGENCY=DALLAS_TX  (override per jurisdiction.adapterConfig if needed)
 */
@Injectable()
export class AccelaAdapter implements JurisdictionAdapter {
  readonly vendor = JurisdictionVendor.ACCELA;
  private readonly logger = new Logger(AccelaAdapter.name);
  private readonly appId = process.env.ACCELA_APP_ID;
  private readonly appSecret = process.env.ACCELA_APP_SECRET;
  private readonly env = process.env.ACCELA_ENV ?? 'Sandbox';
  private readonly fallback: MockAdapter;

  constructor(private readonly cfg: AdapterConfig) {
    this.fallback = new MockAdapter(cfg);
  }

  private hasCreds() {
    return Boolean(this.appId && this.appSecret);
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
    // TODO(day-3): real OAuth2 + records search. Skeleton:
    //   const token = await this.getToken();
    //   const res = await fetch(`https://apis.accela.com/v4/records?address=${encodeURIComponent(params.address)}&agency=${agency}`, {
    //     headers: { Authorization: `Bearer ${token}`, 'x-accela-environment': this.env },
    //   });
    //   const json = await res.json();
    //   return (json.result ?? []).map(this.mapRecord);
    this.logger.warn(
      `[accela:${this.cfg.slug}] adapter skeleton — returning mock until Day 3 wiring`,
    );
    return this.fallback.getPermitsByAddress(params);
  }

  async healthCheck() {
    if (!this.hasCreds()) {
      return { ok: false, detail: 'ACCELA_APP_ID / ACCELA_APP_SECRET unset' };
    }
    return { ok: true, detail: `accela ${this.env}` };
  }

  // Reserved for Day 3 implementation.
  // private mapRecord(r: any): NormalizedPermit { ... }

  // Reserved: token cache + refresh.
  // private async getToken(): Promise<string> { ... }
  private _unused(): PermitStatus {
    return PermitStatus.UNKNOWN;
  }
}
