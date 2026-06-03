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
 * Shovels.ai adapter — used for Flower Mound (no native API) and as a
 * universal aggregator fallback.
 *
 * Real implementation:
 *   GET https://api.shovels.ai/v2/permits?address=...&jurisdiction=Flower%20Mound,TX
 *   Header: X-API-Key: <key>
 *
 * Required env:
 *   SHOVELS_API_KEY
 */
@Injectable()
export class ShovelsAdapter implements JurisdictionAdapter {
  readonly vendor = JurisdictionVendor.SHOVELS;
  private readonly logger = new Logger(ShovelsAdapter.name);
  private readonly apiKey = process.env.SHOVELS_API_KEY;
  private readonly fallback: MockAdapter;

  constructor(private readonly cfg: AdapterConfig) {
    this.fallback = new MockAdapter(cfg);
  }

  private hasCreds() {
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
    // TODO(day-4): real call. Skeleton:
    //   const res = await fetch(`https://api.shovels.ai/v2/permits?address=${encodeURIComponent(params.address)}&jurisdiction=${this.cfg.slug}`,
    //     { headers: { 'X-API-Key': this.apiKey! } });
    //   const json = await res.json();
    //   return (json.data ?? []).map(this.mapPermit);
    this.logger.warn(
      `[shovels:${this.cfg.slug}] adapter skeleton — returning mock until Day 4 wiring`,
    );
    return this.fallback.getPermitsByAddress(params);
  }

  async healthCheck() {
    if (!this.hasCreds()) {
      return { ok: false, detail: 'SHOVELS_API_KEY unset' };
    }
    return { ok: true, detail: 'shovels live' };
  }

  private _unused(): PermitStatus {
    return PermitStatus.UNKNOWN;
  }
}
