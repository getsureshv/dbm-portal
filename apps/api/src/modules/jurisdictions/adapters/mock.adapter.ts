import { Injectable, Logger } from '@nestjs/common';
import { JurisdictionVendor, PermitStatus } from '@prisma/client';
import {
  AdapterConfig,
  JurisdictionAdapter,
  NormalizedPermit,
  PermitSearchParams,
} from '../jurisdiction-adapter.interface';

/**
 * Deterministic fake permits for demos and tests.
 * Used whenever a jurisdiction is configured with vendor=MOCK or a real
 * vendor adapter has no credentials wired yet.
 */
@Injectable()
export class MockAdapter implements JurisdictionAdapter {
  readonly vendor = JurisdictionVendor.MOCK;
  private readonly logger = new Logger(MockAdapter.name);

  constructor(private readonly cfg: AdapterConfig) {}

  async getPermitsByAddress(
    params: PermitSearchParams,
  ): Promise<NormalizedPermit[]> {
    const { address, limit = 10 } = params;
    this.logger.log(
      `[mock:${this.cfg.slug}] permits-by-address "${address}" limit=${limit}`,
    );
    const seed = hash(address + this.cfg.slug);
    const count = Math.min(limit, 2 + (seed % 3)); // 2-4 permits
    return Array.from({ length: count }, (_, i) =>
      this.makePermit(address, seed + i),
    );
  }

  async healthCheck() {
    return { ok: true, detail: 'mock adapter — no network calls' };
  }

  private makePermit(address: string, seed: number): NormalizedPermit {
    const types = [
      'Residential Deck',
      'Kitchen Remodel',
      'Solar PV Install',
      'Detached ADU',
      'Bathroom Remodel',
    ];
    const statuses: PermitStatus[] = [
      PermitStatus.ISSUED,
      PermitStatus.FINALIZED,
      PermitStatus.OPEN,
    ];
    const issued = new Date(2024, seed % 12, 1 + (seed % 27));
    const finalized =
      seed % 3 === 0
        ? new Date(issued.getTime() + (30 + (seed % 60)) * 86_400_000)
        : null;
    return {
      externalId: `MOCK-${this.cfg.slug.toUpperCase()}-${seed.toString(36).toUpperCase()}`,
      address,
      type: types[seed % types.length],
      status: statuses[seed % statuses.length],
      issuedAt: issued,
      finalizedAt: finalized,
      contractor: seed % 2 === 0 ? 'Acme Builders LLC' : null,
      valuation: 5000 + (seed % 50) * 1000,
      description: `Mock permit #${seed} for demo.`,
      raw: { mock: true, seed },
    };
  }
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
