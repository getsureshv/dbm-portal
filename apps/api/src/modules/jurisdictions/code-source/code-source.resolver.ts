/**
 * Code-source resolver (v2 — official-.gov-direct).
 *
 * #24 tried to auto-probe Municode/AmLegal/eCode360, but those are JS SPAs /
 * auth-gated / ToS-blocked and serve no code text to a server fetch. The
 * reliable, ToS-clean approach is to read each city's OWN published permit/
 * code pages on its .gov domain. Those pages (and the PDFs they link) are
 * plain HTML/PDF and fetch cleanly.
 *
 * A city's sources are resolved ONCE and cached on
 * Jurisdiction.adapterConfig.codeSources. We ship a small built-in registry so
 * configured cities work out of the box; adding a new city is a tiny config
 * entry (a few .gov URLs), never per-rule authoring.
 *
 * Everything here is PURE — no network. Fetching/extraction lives in the
 * extractor; persistence/caching lives in the service.
 */

export type CodeSourceKind = 'html' | 'pdf';

export interface CodeSourceDoc {
  url: string;
  kind: CodeSourceKind;
  /** Human label shown as the citation, e.g. "City of Coppell — Residential Remodel Guide". */
  label: string;
  /** Optional scope hints; when present, this doc is preferred for those scopes. */
  scopes?: string[];
}

export interface CodeSourcesConfig {
  /** The city's official domain, e.g. "coppelltx.gov". */
  domain?: string;
  docs: CodeSourceDoc[];
  resolvedAt?: string;
}

/** Infer html vs pdf from a URL (used when callers omit `kind`). */
export function inferKind(url: string): CodeSourceKind {
  return /\.pdf(\?|$)/i.test(url) ? 'pdf' : 'html';
}

/**
 * Built-in registry of official .gov code sources, keyed by jurisdiction slug.
 * This is CONFIG (a handful of authoritative URLs), not seeded rules — the
 * rules themselves are still fetched + extracted live and cached. Add a city
 * by dropping in its permit/code pages here (or via adapterConfig override).
 */
export const CODE_SOURCE_REGISTRY: Record<string, CodeSourcesConfig> = {
  'coppell-tx': {
    domain: 'coppelltx.gov',
    docs: [
      {
        url: 'https://www.coppelltx.gov/DocumentCenter/View/4954/Residential-Remodel',
        kind: 'pdf',
        label: 'City of Coppell — Residential Remodel Permit Guide',
        scopes: ['kitchen', 'bath', 'remodel', 'addition'],
      },
      {
        url: 'https://www.coppelltx.gov/209/Adopted-Codes-Ordinances',
        kind: 'html',
        label: 'City of Coppell — Adopted Codes & Ordinances',
      },
    ],
  },
};

/**
 * Resolve the code sources for a jurisdiction.
 * Priority: explicit adapterConfig.codeSources → built-in registry → null.
 */
export function resolveCodeSources(
  slug: string,
  adapterConfig: unknown,
): CodeSourcesConfig | null {
  const fromConfig = codeSourcesFromConfig(adapterConfig);
  if (fromConfig && fromConfig.docs.length > 0) return fromConfig;
  return CODE_SOURCE_REGISTRY[slug] ?? null;
}

/** Read + validate adapterConfig.codeSources, normalizing missing `kind`. */
export function codeSourcesFromConfig(
  adapterConfig: unknown,
): CodeSourcesConfig | null {
  if (
    !adapterConfig ||
    typeof adapterConfig !== 'object' ||
    !('codeSources' in adapterConfig)
  ) {
    return null;
  }
  const cs = (adapterConfig as Record<string, unknown>).codeSources;
  if (!cs || typeof cs !== 'object') return null;
  const rawDocs = (cs as Record<string, unknown>).docs;
  if (!Array.isArray(rawDocs)) return null;

  const docs: CodeSourceDoc[] = [];
  for (const d of rawDocs) {
    if (!d || typeof d !== 'object') continue;
    const url = (d as Record<string, unknown>).url;
    if (typeof url !== 'string' || !/^https?:\/\//.test(url)) continue;
    const label = (d as Record<string, unknown>).label;
    const kindRaw = (d as Record<string, unknown>).kind;
    const scopesRaw = (d as Record<string, unknown>).scopes;
    docs.push({
      url,
      kind:
        kindRaw === 'html' || kindRaw === 'pdf'
          ? (kindRaw as CodeSourceKind)
          : inferKind(url),
      label: typeof label === 'string' && label ? label : url,
      scopes: Array.isArray(scopesRaw)
        ? scopesRaw.filter((s): s is string => typeof s === 'string')
        : undefined,
    });
  }
  if (docs.length === 0) return null;
  const domain = (cs as Record<string, unknown>).domain;
  return {
    domain: typeof domain === 'string' ? domain : undefined,
    docs,
  };
}

/**
 * Order docs for a given scope: scope-tagged docs first (most specific),
 * then untagged/general docs. Keeps the most relevant source text at the top
 * of the LLM context window.
 */
export function orderDocsForScope(
  docs: CodeSourceDoc[],
  scope?: string,
): CodeSourceDoc[] {
  if (!scope) return [...docs];
  const matches = docs.filter((d) => d.scopes?.includes(scope));
  const rest = docs.filter((d) => !d.scopes?.includes(scope));
  return [...matches, ...rest];
}
