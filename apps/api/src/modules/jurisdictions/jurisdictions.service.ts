import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import {
  CodeRule,
  Jurisdiction,
  JurisdictionVendor,
  Permit,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import {
  resolveCodeSources,
  orderDocsForScope,
} from './code-source/code-source.resolver';
import { extractRules } from './code-source/code-rules.extractor';
import {
  AdapterConfig,
  JurisdictionAdapter,
  NormalizedPermit,
} from './jurisdiction-adapter.interface';
import { MockAdapter } from './adapters/mock.adapter';
import { AccelaAdapter } from './adapters/accela.adapter';
import { ShovelsAdapter } from './adapters/shovels.adapter';
import { DallasOpenDataAdapter } from './adapters/dallas-opendata.adapter';
import { SocrataAdapter } from './adapters/socrata.adapter';

@Injectable()
export class JurisdictionsService {
  private readonly logger = new Logger(JurisdictionsService.name);

  private readonly anthropic: Anthropic | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly config?: ConfigService,
  ) {
    // Read from ConfigService when available (app runtime), falling back to
    // process.env so the key is picked up even if ConfigService isn't injected
    // (e.g. unit tests that only provide PrismaService). Avoid the
    // `.get<string>()` type-argument form here: on the optional `config?` type
    // it triggers TS2347 ("Untyped function calls may not accept type
    // arguments") and breaks `nest build`.
    const fromConfig = this.config?.get('ANTHROPIC_API_KEY') as string | undefined;
    const apiKey = fromConfig ?? process.env.ANTHROPIC_API_KEY;
    if (apiKey) this.anthropic = new Anthropic({ apiKey });
    else
      this.logger.warn(
        'ANTHROPIC_API_KEY not set — dynamic code-rule extraction disabled (seeded rules still served).',
      );
  }

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
   * by postal-code prefix on Jurisdiction.zipPrefixes, scoped to a single
   * country to prevent cross-country collisions (e.g. JP "100-0001" vs
   * US "100xx"). Real geocoder is Phase 3+.
   *
   * @param address Free-text address (must contain a 5-digit postal code for US match).
   * @param countryCode ISO 3166-1 alpha-2 country code. Defaults to 'US' for
   *                    backward compatibility — every existing caller passes
   *                    a US-shaped address today.
   */
  async resolveAddress(
    address: string,
    countryCode = 'US',
  ): Promise<Jurisdiction | null> {
    const zipMatch = address.match(/\b(\d{5})(?:-\d{4})?\b/);
    if (!zipMatch) return null;
    const zip = zipMatch[1];
    const prefixes = [zip, zip.slice(0, 3)];
    const all = await this.prisma.jurisdiction.findMany({
      where: { countryCode },
    });
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
        // Read cached permits by the externalIds captured for THIS lookup, not
        // by Permit.address. Zip-scoped vendors (Shovels) return the same
        // permits for many addresses, and each Permit row carries only one
        // address string, so an address match stranded the cache at 0 found.
        const cached = await this.prisma.permit.findMany({
          where: {
            jurisdictionId: jurisdiction.id,
            externalId: { in: lookup.permitExternalIds },
          },
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
    const externalIds = persisted.map((p) => p.externalId);
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
        permitExternalIds: externalIds,
      },
      update: { lastSyncedAt: new Date(), permitExternalIds: externalIds },
    });
    return {
      jurisdiction,
      permits: persisted,
      cached: false,
      fetchedAt: new Date(),
    };
  }

  /**
   * Code rules for a jurisdiction, optionally filtered by scope.
   *
   * Resolution order (no pre-seeding for new cities):
   *   1. Return existing CodeRule rows (seeded cities like Dallas, or rows we
   *      previously extracted and cached).
   *   2. If none exist for this scope AND the dynamic cache is stale/absent,
   *      fetch the city's published municipal code, extract scope-relevant
   *      rules with the LLM, persist them as CodeRule rows, stamp the
   *      CodeRuleLookup freshness marker, and return them.
   *   3. Degrade gracefully to [] (extraction off, source unreachable, etc.).
   */
  async codeRules(
    slug: string,
    scope?: string,
    force = false,
  ): Promise<CodeRule[]> {
    const j = await this.getBySlug(slug);
    const where = {
      jurisdictionId: j.id,
      ...(scope ? { scopeTags: { has: scope } } : {}),
    };
    const orderBy = [
      { codeFamily: 'asc' as const },
      { section: 'asc' as const },
    ];

    // When force=true, skip the seeded/cached short-circuit so we re-run a live
    // extraction (still respects nothing — overwrites via upsert). Seeded rows
    // are never deleted; force just refreshes dynamic ones.
    if (!force) {
      const existing = await this.prisma.codeRule.findMany({ where, orderBy });
      if (existing.length > 0) return existing;
    }

    // Nothing curated/cached for this scope — try a dynamic extraction unless a
    // recent attempt already ran (avoid hammering the source / LLM on every hit,
    // including the legitimate "source has no such rules" empty result).
    const fresh = await this.dynamicCodeRules(j, scope, force);
    if (fresh) return this.prisma.codeRule.findMany({ where, orderBy });
    return this.prisma.codeRule.findMany({ where, orderBy });
  }

  /**
   * Diagnostic: reports whether dynamic code-rule extraction is wired up at
   * runtime (Anthropic client initialized, env var present), what .gov sources
   * resolve for a slug, and the current cache marker. Safe to expose — returns
   * NO secret values (only booleans + counts + public source URLs).
   */
  async codeRulesStatus(slug?: string) {
    const base = {
      anthropicClientInitialized: this.anthropic !== null,
      anthropicEnvPresent: Boolean(process.env.ANTHROPIC_API_KEY),
      commit:
        process.env.RENDER_GIT_COMMIT ??
        process.env.GIT_COMMIT ??
        process.env.SOURCE_VERSION ??
        'unknown',
    };
    if (!slug) return base;
    try {
      const j = await this.getBySlug(slug);
      const sources = resolveCodeSources(j.slug, j.adapterConfig);
      const markers = await this.prisma.codeRuleLookup.findMany({
        where: { jurisdictionId: j.id },
      });
      const ruleCount = await this.prisma.codeRule.count({
        where: { jurisdictionId: j.id },
      });
      return {
        ...base,
        slug: j.slug,
        hasSource: Boolean(sources && sources.docs.length > 0),
        sourceDocs: sources?.docs.map((d) => ({ url: d.url, kind: d.kind })) ?? [],
        totalRuleCount: ruleCount,
        markers: markers.map((m) => ({
          scope: m.scope,
          ruleCount: m.ruleCount,
          lastSyncedAt: m.lastSyncedAt,
        })),
      };
    } catch (e) {
      return { ...base, slug, error: String(e) };
    }
  }

  /**
   * Fetch + extract + persist code rules for (jurisdiction, scope) from the
   * city's published source. Returns true if an extraction attempt ran (fresh
   * data may be 0 rules and still counts — the marker prevents re-hammering),
   * false if skipped because the cache is still fresh. Never throws.
   */
  private async dynamicCodeRules(
    j: Jurisdiction,
    scope?: string,
    force = false,
  ): Promise<boolean> {
    const scopeKey = scope ?? '';
    if (!force) {
      const marker = await this.prisma.codeRuleLookup.findUnique({
        where: {
          jurisdictionId_scope: { jurisdictionId: j.id, scope: scopeKey },
        },
      });
      if (
        marker &&
        Date.now() - marker.lastSyncedAt.getTime() < marker.ttlSeconds * 1000
      ) {
        return false; // cache fresh — don't re-fetch (even if it yielded 0)
      }
    }

    // Resolve the city's official .gov code sources (adapterConfig override
    // first, then the built-in registry). No SPA probing — these are direct
    // links to the city's own permit/code pages + PDFs.
    const sources = resolveCodeSources(j.slug, j.adapterConfig);
    if (!sources || sources.docs.length === 0) {
      // No source configured for this city yet. Stamp the marker so we don't
      // re-resolve every hit, and return (panel shows empty until a .gov
      // source is added to the registry/config — a tiny per-city config edit).
      await this.stampCodeRuleLookup(j.id, scopeKey, null, 0);
      this.logger.log(
        `dynamic code rules: ${j.slug} — no .gov source configured, skipping`,
      );
      return true;
    }

    const docs = orderDocsForScope(sources.docs, scope);
    const rules = await extractRules({
      anthropic: this.anthropic,
      cityName: j.name,
      scope,
      docs,
    });
    const primaryUrl = docs[0]?.url ?? null;

    // Persist extracted rules (upsert by the CodeRule unique key).
    for (const r of rules) {
      try {
        await this.prisma.codeRule.upsert({
          where: {
            jurisdictionId_codeFamily_section: {
              jurisdictionId: j.id,
              codeFamily: r.codeFamily,
              section: r.section,
            },
          },
          create: {
            jurisdictionId: j.id,
            codeFamily: r.codeFamily,
            section: r.section,
            title: r.title,
            body: r.body,
            scopeTags: r.scopeTags,
            sourceUrl: r.sourceUrl,
          },
          update: {
            title: r.title,
            body: r.body,
            scopeTags: r.scopeTags,
            sourceUrl: r.sourceUrl,
          },
        });
      } catch (e) {
        this.logger.warn(`codeRule upsert failed (${r.section}): ${e}`);
      }
    }

    // Stamp the freshness marker (records the attempt regardless of count).
    await this.stampCodeRuleLookup(j.id, scopeKey, primaryUrl, rules.length);
    this.logger.log(
      `dynamic code rules: ${j.slug} scope="${scopeKey}" → ${rules.length} from ${docs.length} .gov source(s)`,
    );
    return true;
  }

  /** Upsert the CodeRuleLookup freshness marker for (jurisdiction, scope). */
  private async stampCodeRuleLookup(
    jurisdictionId: string,
    scope: string,
    sourceUrl: string | null,
    ruleCount: number,
  ): Promise<void> {
    await this.prisma.codeRuleLookup.upsert({
      where: { jurisdictionId_scope: { jurisdictionId, scope } },
      create: { jurisdictionId, scope, sourceUrl, ruleCount },
      update: { lastSyncedAt: new Date(), sourceUrl, ruleCount },
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
      case JurisdictionVendor.SOCRATA:
        // Generic Socrata: domain/datasetId/fieldMap come from adapterConfig.
        return new SocrataAdapter(cfg, { vendor: JurisdictionVendor.SOCRATA });
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
