/**
 * Code-source resolver — figures out WHERE a city publishes its municipal code,
 * with zero per-city hand-seeding. Most US cities host on one of three
 * platforms (Municode, eCode360/General Code, American Legal). We build
 * candidate URLs from the city name and probe them; the first that responds
 * 200 wins and gets cached on Jurisdiction.adapterConfig.codeSource.
 *
 * Everything in this file is PURE except `probeCodeSource`, which does HTTP.
 * The pure helpers are unit-tested without network access.
 */

export type CodePlatform = 'municode' | 'ecode360' | 'amlegal' | 'unknown';

export interface CodeSource {
  platform: CodePlatform;
  /** Landing/library URL for the jurisdiction's code. */
  url: string;
  /** Human label, e.g. "Municode Library". */
  label: string;
}

/** Stored on Jurisdiction.adapterConfig.codeSource once resolved. */
export interface CodeSourceConfig {
  platform: CodePlatform;
  url: string;
  /** ISO date the source was last resolved/verified. */
  resolvedAt?: string;
}

/**
 * Slugify a city name the way each platform tends to. Municode and amlegal
 * use lowercased, underscore- or hyphen-joined client names; eCode360 uses a
 * short alpha code we can't derive, so we only build a search URL there.
 */
export function citySlug(
  cityName: string,
  joiner: '_' | '-' = '_',
): string {
  return cityName
    .toLowerCase()
    .replace(/^(city|town|village|county)\s+of\s+/i, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, joiner);
}

/** US state code → Municode/amlegal state path segment (lowercase full slug). */
const STATE_SLUG: Record<string, string> = {
  TX: 'texas',
  CA: 'california',
  FL: 'florida',
  NY: 'new_york',
  IL: 'illinois',
  WA: 'washington',
  CO: 'colorado',
  GA: 'georgia',
  AZ: 'arizona',
  NC: 'north_carolina',
  OH: 'ohio',
  MI: 'michigan',
  PA: 'pennsylvania',
  VA: 'virginia',
  MA: 'massachusetts',
  TN: 'tennessee',
  OR: 'oregon',
  NV: 'nevada',
  MN: 'minnesota',
  MO: 'missouri',
};

export function stateSlug(state: string): string {
  return STATE_SLUG[state.toUpperCase()] ?? state.toLowerCase();
}

/**
 * Build candidate code-source URLs for a city, ordered by how common the
 * platform is for US municipalities. We return several so the probe can try
 * each; the first 200 wins.
 */
export function candidateSources(
  cityName: string,
  state: string,
): CodeSource[] {
  const muniSlug = citySlug(cityName, '_');
  const amlegalSlug = citySlug(cityName, '_');
  const st = stateSlug(state);
  const stAbbr = state.toLowerCase();

  return [
    {
      platform: 'municode',
      label: 'Municode Library',
      url: `https://library.municode.com/${st}/${muniSlug}/codes/code_of_ordinances`,
    },
    {
      platform: 'amlegal',
      label: 'American Legal Code Library',
      url: `https://codelibrary.amlegal.com/codes/${amlegalSlug}${stAbbr}/latest/overview`,
    },
    {
      platform: 'ecode360',
      label: 'eCode360 (General Code)',
      // eCode360 has no derivable per-city path; use its search entry point.
      url: `https://www.generalcode.com/source-library/?search=${encodeURIComponent(
        `${cityName} ${state}`,
      )}`,
    },
  ];
}

/**
 * Probe candidate sources over HTTP and return the first that responds OK.
 * Falls back to the Municode candidate (most common) tagged 'unknown' if none
 * verify, so callers always get a best-effort URL to hand the extractor.
 *
 * @param fetchImpl injectable for tests; defaults to global fetch.
 */
export async function probeCodeSource(
  cityName: string,
  state: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 6000,
): Promise<CodeSource> {
  const candidates = candidateSources(cityName, state);

  for (const cand of candidates) {
    // eCode360 search page isn't a deterministic code root — skip probing,
    // only use it as a last-resort labelled link.
    if (cand.platform === 'ecode360') continue;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetchImpl(cand.url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.ok) return cand;
    } catch {
      // network error / timeout / abort — try next candidate
    }
  }

  // Nothing verified — return the most-common platform as a best-effort guess.
  return { ...candidates[0], platform: 'unknown' };
}

/** Read a previously-resolved code source from adapterConfig, if present. */
export function codeSourceFromConfig(
  adapterConfig: unknown,
): CodeSourceConfig | null {
  if (
    adapterConfig &&
    typeof adapterConfig === 'object' &&
    'codeSource' in adapterConfig
  ) {
    const cs = (adapterConfig as Record<string, unknown>).codeSource;
    if (
      cs &&
      typeof cs === 'object' &&
      'platform' in cs &&
      'url' in cs &&
      typeof (cs as Record<string, unknown>).url === 'string'
    ) {
      return cs as CodeSourceConfig;
    }
  }
  return null;
}
