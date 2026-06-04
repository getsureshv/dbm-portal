import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  CodeRule,
  Jurisdiction,
  JurisdictionVendor,
  Permit,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import {
  AdapterConfig,
  JurisdictionAdapter,
  NormalizedPermit,
} from './jurisdiction-adapter.interface';
import { MockAdapter } from './adapters/mock.adapter';
import { AccelaAdapter } from './adapters/accela.adapter';
import { ShovelsAdapter } from './adapters/shovels.adapter';
import { DallasOpenDataAdapter } from './adapters/dallas-opendata.adapter';

@Injectable()
export class JurisdictionsService {
  private readonly logger = new Logger(JurisdictionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** All jurisdictions, lightweight rows for dropdowns. */
  async list(): Promise<Jurisdiction[]> {
    return this.prisma.jurisdiction.findMany({
      orderBy: [{ state: 'asc' }, { name: 'asc' }],
    });
  }

  async getBySlug(slug: string): Promise<Jurisdiction> {
    const j = await this.prisma.jurisdiction.findUnique({ where: { slug } });
    if (!j) throw new NotFoundException(`jurisdiction "${slug}" not found`);
    return j;
  }

  /**
   * Resolve a free-text address to a jurisdiction. Demo-grade: matches
   * by ZIP prefix on Jurisdiction.zipPrefixes. Real geocoder is Phase 2+.
   */
  async resolveAddress(address: string): Promise<Jurisdiction | null> {
    const zipMatch = address.match(/\b(\d{5})(?:-\d{4})?\b/);
    if (!zipMatch) return null;
    const zip = zipMatch[1];
    const prefixes = [zip, zip.slice(0, 3)];
    const all = await this.prisma.jurisdiction.findMany();
    return (
      all.find((j) =>
        j.zipPrefixes.some((p) => prefixes.includes(p) || zip.startsWith(p)),
      ) ?? null
    );
  }

  /**
   * Fetch permits for an address, going through the right adapter and
   * caching results in the Permit table. Demo cache TTL = 24h via
   * AddressLookup.ttlSeconds.
   */
  async permitsByAddress(
    slug: string,
    address: string,
    opts: { limit?: number; force?: boolean } = {},
  ): Promise<{
    jurisdiction: Jurisdiction;
    permits: Permit[];
    cached: boolean;
    fetchedAt: Date;
  }> {
    const jurisdiction = await this.getBySlug(slug);
    const adapter = this.makeAdapter(jurisdiction);
    const limit = opts.limit ?? 25;

    // Cache check
    if (!opts.force) {
      const lookup = await this.prisma.addressLookup.findUnique({
        where: {
          address_jurisdictionId: {
            address,
            jurisdictionId: jurisdiction.id,
          },
        },
      });
      if (
        lookup &&
        Date.now() - lookup.lastSyncedAt.getTime() <
          lookup.ttlSeconds * 1000
      ) {
        const cached = await this.prisma.permit.findMany({
          where: { jurisdictionId: jurisdiction.id, address },
          orderBy: { issuedAt: 'desc' },
          take: limit,
        });
        return {
          jurisdiction,
          permits: cached,
          cached: true,
          fetchedAt: lookup.lastSyncedAt,
        };
      }
    }

    // Fresh fetch
    const raw = await adapter.getPermitsByAddress({ address, limit });
    const persisted = await this.persistPermits(jurisdiction.id, address, raw);
    await this.prisma.addressLookup.upsert({
      where: {
        address_jurisdictionId: {
          address,
          jurisdictionId: jurisdiction.id,
        },
      },
      create: {
        address,
        jurisdictionId: jurisdiction.id,
      },
      update: { lastSyncedAt: new Date() },
    });
    return {
      jurisdiction,
      permits: persisted,
      cached: false,
      fetchedAt: new Date(),
    };
  }

  /** Curated code rules for a jurisdiction, optionally filtered by scope tag. */
  async codeRules(slug: string, scope?: string): Promise<CodeRule[]> {
    const j = await this.getBySlug(slug);
    return this.prisma.codeRule.findMany({
      where: {
        jurisdictionId: j.id,
        ...(scope ? { scopeTags: { has: scope } } : {}),
      },
      orderBy: [{ codeFamily: 'asc' }, { section: 'asc' }],
    });
  }

  /** Health probe — runs every adapter's healthCheck. */
  async healthAll(): Promise<
    Array<{ slug: string; vendor: JurisdictionVendor; ok: boolean; detail?: string }>
  > {
    const js = await this.list();
    return Promise.all(
      js.map(async (j) => {
        const adapter = this.makeAdapter(j);
        const h = await adapter.healthCheck();
        return { slug: j.slug, vendor: j.vendor, ...h };
      }),
    );
  }

  // ── private ──────────────────────────────────────────────

  private makeAdapter(j: Jurisdiction): JurisdictionAdapter {
    const cfg: AdapterConfig = {
      jurisdictionId: j.id,
      slug: j.slug,
      config: (j.adapterConfig as Record<string, unknown> | null) ?? null,
    };
    switch (j.vendor) {
      case JurisdictionVendor.DALLAS_OPENDATA:
        return new DallasOpenDataAdapter(cfg);
      case JurisdictionVendor.ACCELA:
        return new AccelaAdapter(cfg);
      case JurisdictionVendor.SHOVELS:
        return new ShovelsAdapter(cfg);
      case JurisdictionVendor.MOCK:
      case JurisdictionVendor.ETRAKIT: // not yet implemented → mock
      case JurisdictionVendor.ILMS:    // not yet implemented → mock
      default:
        return new MockAdapter(cfg);
    }
  }

  private async persistPermits(
    jurisdictionId: string,
    address: string,
    permits: NormalizedPermit[],
  ): Promise<Permit[]> {
    const out: Permit[] = [];
    for (const p of permits) {
      const saved = await this.prisma.permit.upsert({
        where: {
          jurisdictionId_externalId: {
            jurisdictionId,
            externalId: p.externalId,
          },
        },
        create: {
          jurisdictionId,
          externalId: p.externalId,
          address,
          type: p.type,
          status: p.status,
          issuedAt: p.issuedAt,
          finalizedAt: p.finalizedAt,
          contractor: p.contractor,
          valuation: p.valuation as any,
          description: p.description,
          raw: p.raw as any,
        },
        update: {
          status: p.status,
          finalizedAt: p.finalizedAt,
          raw: p.raw as any,
          fetchedAt: new Date(),
        },
      });
      out.push(saved);
    }
    return out;
  }
}
