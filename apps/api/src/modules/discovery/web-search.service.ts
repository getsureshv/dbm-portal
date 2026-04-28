import { Injectable, Logger } from '@nestjs/common';

/**
 * Normalized vendor result returned from any external web-search provider.
 * Designed to be a stable contract — the UI binds to this shape, and we can
 * swap providers (Yelp → SerpAPI → Google Places) without touching the client.
 */
export interface WebVendor {
  id: string; // provider-prefixed id, e.g. "yelp:abc123"
  name: string;
  rating: number | null;
  reviewCount: number;
  phone: string | null;
  website: string | null; // canonical URL on the provider (e.g. yelp listing) or business website
  address: string | null; // formatted single-line
  city: string | null;
  state: string | null;
  zip: string | null;
  distanceMiles: number | null;
  categories: string[];
  imageUrl: string | null;
  source: 'yelp' | 'serpapi' | 'google-places' | 'overpass' | 'foursquare';
  sourceLabel: string; // human-friendly badge: "Yelp", "Google", etc.
}

export interface WebSearchParams {
  query?: string;
  zip?: string;
  category?: string;
  limit?: number;
}

export interface WebSearchResult {
  vendors: WebVendor[];
  provider: WebSearchProviderName;
  configured: boolean;
  message?: string;
}

export type WebSearchProviderName =
  | 'overpass'
  | 'foursquare'
  | 'yelp'
  | 'serpapi'
  | 'google-places';

/**
 * Provider contract — implement once per external service and register below.
 */
interface WebSearchProvider {
  readonly name: WebSearchProviderName;
  isConfigured(): boolean;
  search(params: WebSearchParams): Promise<WebVendor[]>;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  OpenStreetMap provider — Nominatim geocode + Overpass POI search          */
/*  Free, no API key, CC-licensed. Default provider.                          */
/* ────────────────────────────────────────────────────────────────────────── */

class OverpassProvider implements WebSearchProvider {
  readonly name = 'overpass' as const;
  private readonly logger = new Logger('OverpassProvider');
  private readonly userAgent =
    'DBM-Construction-Portal/1.0 (https://github.com/dbm)';

  // In-memory cache — Overpass public servers rate-limit aggressively (429).
  // Cache by zip+category+query for 10 minutes so a typical search session
  // hits the API at most once per unique query.
  private readonly cache = new Map<
    string,
    { vendors: WebVendor[]; expiresAt: number }
  >();
  private readonly cacheTtlMs = 10 * 60 * 1000;

  isConfigured(): boolean {
    return true; // No API key required
  }

  async search(params: WebSearchParams): Promise<WebVendor[]> {
    if (!params.zip) return [];

    const cacheKey = `${params.zip}|${params.category ?? ''}|${params.query ?? ''}|${params.limit ?? 10}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.vendors;
    }

    const geo = await this.geocodeZip(params.zip);
    if (!geo) {
      this.logger.warn(`Could not geocode ZIP ${params.zip}`);
      return [];
    }

    const radiusMeters = 16000; // ~10 miles
    const tagFilters = this.tagsForCategory(params.category);
    const limit = params.limit ?? 10;

    // Overpass QL: search nodes + ways with relevant construction tags within radius
    const queryParts: string[] = [];
    for (const tag of tagFilters) {
      queryParts.push(
        `node[${tag}](around:${radiusMeters},${geo.lat},${geo.lon});`,
      );
      queryParts.push(
        `way[${tag}](around:${radiusMeters},${geo.lat},${geo.lon});`,
      );
    }
    const query = `[out:json][timeout:25];(${queryParts.join('')});out center ${limit * 3};`;

    try {
      // Try the primary endpoint, then a mirror on 429/timeout. Public Overpass
      // servers rate-limit aggressively; the mirror is operated by the same
      // community and significantly reduces 429s.
      const endpoints = [
        'https://overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
      ];
      let res: Response | null = null;
      for (const endpoint of endpoints) {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': this.userAgent,
          },
          body: `data=${encodeURIComponent(query)}`,
        });
        if (res.ok) break;
        this.logger.warn(`${endpoint} returned ${res.status} — trying next mirror`);
      }
      if (!res || !res.ok) {
        return [];
      }
      const data = (await res.json()) as { elements?: OverpassElement[] };
      const vendors = this.normalize(data.elements ?? [], geo, params.query).slice(
        0,
        limit,
      );
      this.cache.set(cacheKey, {
        vendors,
        expiresAt: Date.now() + this.cacheTtlMs,
      });
      return vendors;
    } catch (err) {
      this.logger.error(`Overpass query failed: ${(err as Error).message}`);
      return [];
    }
  }

  private readonly geocodeCache = new Map<string, { lat: number; lon: number }>();

  private async geocodeZip(
    zip: string,
  ): Promise<{ lat: number; lon: number } | null> {
    const hit = this.geocodeCache.get(zip);
    if (hit) return hit;
    const url = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(zip)}&country=USA&format=json&limit=1`;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': this.userAgent },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as Array<{ lat: string; lon: string }>;
      if (!data.length) return null;
      const result = {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
      };
      this.geocodeCache.set(zip, result);
      return result;
    } catch {
      return null;
    }
  }

  /** Map our trade slug → relevant OSM tag filters. */
  private tagsForCategory(category?: string): string[] {
    const map: Record<string, string[]> = {
      electrician: ['"craft"="electrician"'],
      plumber: ['"craft"="plumber"'],
      roofer: ['"craft"="roofer"'],
      painter: ['"craft"="painter"'],
      carpenter: ['"craft"="carpenter"'],
      hvac: ['"craft"="hvac"'],
      'general-contractor': [
        '"office"="construction_company"',
        '"craft"="builder"',
      ],
      architect: ['"office"="architect"'],
      flooring: ['"craft"="floorer"', '"craft"="tiler"'],
      concrete: ['"craft"="stonemason"', '"craft"="plasterer"'],
      landscape: ['"craft"="gardener"', '"landuse"="garden_centre"'],
      cabinets: ['"craft"="carpenter"', '"shop"="furniture"'],
    };
    return (
      map[category ?? ''] ?? [
        '"craft"',
        '"office"="construction_company"',
        '"office"="architect"',
        '"shop"="hardware"',
        '"shop"="doityourself"',
      ]
    );
  }

  private normalize(
    elements: OverpassElement[],
    origin: { lat: number; lon: number },
    queryFilter?: string,
  ): WebVendor[] {
    const q = queryFilter?.toLowerCase().trim();
    return elements
      .filter((el) => el.tags?.name)
      .filter((el) => !q || el.tags!.name!.toLowerCase().includes(q))
      .map((el) => {
        const t = el.tags!;
        const lat = el.lat ?? el.center?.lat;
        const lon = el.lon ?? el.center?.lon;
        const distMiles =
          lat !== undefined && lon !== undefined
            ? this.haversineMiles(origin.lat, origin.lon, lat, lon)
            : null;
        const street = [t['addr:housenumber'], t['addr:street']]
          .filter(Boolean)
          .join(' ')
          .trim();
        const addressParts = [
          street,
          t['addr:city'],
          t['addr:state'],
          t['addr:postcode'],
        ].filter(Boolean) as string[];
        return {
          id: `osm:${el.type}/${el.id}`,
          name: t.name!,
          rating: null,
          reviewCount: 0,
          phone: t['contact:phone'] || t['phone'] || null,
          website: t['contact:website'] || t['website'] || null,
          address: addressParts.length ? addressParts.join(', ') : null,
          city: t['addr:city'] ?? null,
          state: t['addr:state'] ?? null,
          zip: t['addr:postcode'] ?? null,
          distanceMiles: distMiles,
          categories: this.deriveCategories(t),
          imageUrl: null,
          source: 'overpass' as const,
          sourceLabel: 'OpenStreetMap',
        };
      })
      .sort((a, b) => {
        const da = a.distanceMiles ?? Infinity;
        const db = b.distanceMiles ?? Infinity;
        return da - db;
      });
  }

  private haversineMiles(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 3958.7613; // Earth radius in miles
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(a));
  }

  private deriveCategories(tags: Record<string, string>): string[] {
    const out: string[] = [];
    for (const k of ['craft', 'office', 'shop', 'landuse']) {
      const v = tags[k];
      if (v) out.push(v.replace(/_/g, ' '));
    }
    return out;
  }
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Foursquare Places v3 provider                                             */
/*  Free Personal tier (sign up + key required).                              */
/* ────────────────────────────────────────────────────────────────────────── */

class FoursquareProvider implements WebSearchProvider {
  readonly name = 'foursquare' as const;
  private readonly logger = new Logger('FoursquareProvider');
  private readonly apiKey = process.env.FOURSQUARE_API_KEY || '';

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async search(params: WebSearchParams): Promise<WebVendor[]> {
    if (!this.isConfigured() || !params.zip) return [];

    const url = new URL('https://api.foursquare.com/v3/places/search');
    if (params.query) url.searchParams.set('query', params.query);
    url.searchParams.set('near', `${params.zip}, USA`);
    url.searchParams.set('limit', String(params.limit ?? 10));
    url.searchParams.set(
      'fields',
      'fsq_id,name,location,categories,tel,website,rating,stats,distance',
    );
    // Construction & Landscaping parent category id — narrows to relevant pros
    url.searchParams.set('categories', '11000');

    try {
      const res = await fetch(url.toString(), {
        headers: {
          Authorization: this.apiKey,
          Accept: 'application/json',
        },
      });
      if (!res.ok) {
        this.logger.warn(
          `Foursquare returned ${res.status}: ${await res.text()}`,
        );
        return [];
      }
      const data = (await res.json()) as { results?: FoursquarePlace[] };
      return (data.results ?? []).map((p) => this.normalize(p));
    } catch (err) {
      this.logger.error(`Foursquare query failed: ${(err as Error).message}`);
      return [];
    }
  }

  private normalize(p: FoursquarePlace): WebVendor {
    const loc = p.location ?? {};
    return {
      id: `fsq:${p.fsq_id}`,
      name: p.name,
      // Foursquare ratings are 0–10; convert to 0–5 to match our card.
      rating: typeof p.rating === 'number' ? p.rating / 2 : null,
      reviewCount: p.stats?.total_ratings ?? 0,
      phone: p.tel || null,
      website: p.website || null,
      address: loc.formatted_address || loc.address || null,
      city: loc.locality ?? null,
      state: loc.region ?? null,
      zip: loc.postcode ?? null,
      distanceMiles:
        typeof p.distance === 'number' ? p.distance / 1609.344 : null,
      categories: (p.categories ?? []).map((c) => c.name),
      imageUrl: null,
      source: 'foursquare',
      sourceLabel: 'Foursquare',
    };
  }
}

interface FoursquarePlace {
  fsq_id: string;
  name: string;
  tel?: string;
  website?: string;
  rating?: number;
  distance?: number;
  stats?: { total_ratings?: number };
  categories?: { id: number; name: string }[];
  location?: {
    formatted_address?: string;
    address?: string;
    locality?: string;
    region?: string;
    postcode?: string;
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Yelp Fusion provider (paid as of 2025; opt-in)                            */
/* ────────────────────────────────────────────────────────────────────────── */

class YelpProvider implements WebSearchProvider {
  readonly name = 'yelp' as const;
  private readonly logger = new Logger('YelpProvider');
  private readonly apiKey = process.env.YELP_API_KEY || '';

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async search(params: WebSearchParams): Promise<WebVendor[]> {
    if (!this.isConfigured()) return [];

    const url = new URL('https://api.yelp.com/v3/businesses/search');
    if (params.query) url.searchParams.set('term', params.query);
    if (params.zip) url.searchParams.set('location', params.zip);
    if (params.category) url.searchParams.set('categories', params.category);
    url.searchParams.set('limit', String(params.limit ?? 10));

    try {
      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        this.logger.warn(`Yelp returned ${res.status}: ${await res.text()}`);
        return [];
      }

      const data = (await res.json()) as YelpSearchResponse;
      return (data.businesses ?? []).map((b) => this.normalize(b));
    } catch (err) {
      this.logger.error(`Yelp search failed: ${(err as Error).message}`);
      return [];
    }
  }

  private normalize(b: YelpBusiness): WebVendor {
    const addressLine = [
      b.location?.address1,
      b.location?.city,
      b.location?.state,
      b.location?.zip_code,
    ]
      .filter(Boolean)
      .join(', ');
    return {
      id: `yelp:${b.id}`,
      name: b.name,
      rating: typeof b.rating === 'number' ? b.rating : null,
      reviewCount: b.review_count ?? 0,
      phone: b.display_phone || b.phone || null,
      website: b.url || null,
      address: addressLine || null,
      city: b.location?.city ?? null,
      state: b.location?.state ?? null,
      zip: b.location?.zip_code ?? null,
      distanceMiles:
        typeof b.distance === 'number' ? b.distance / 1609.344 : null,
      categories: (b.categories ?? []).map((c) => c.title),
      imageUrl: b.image_url || null,
      source: 'yelp',
      sourceLabel: 'Yelp',
    };
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  SerpAPI provider — STUB, drop in implementation when key is purchased.    */
/* ────────────────────────────────────────────────────────────────────────── */

class SerpApiProvider implements WebSearchProvider {
  readonly name = 'serpapi' as const;
  private readonly apiKey = process.env.SERP_API_KEY || '';

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async search(_params: WebSearchParams): Promise<WebVendor[]> {
    // TODO: hit https://serpapi.com/search.json?engine=google_local with this.apiKey
    // and map results.local_results[] into WebVendor[].
    return [];
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Google Places provider — STUB                                             */
/* ────────────────────────────────────────────────────────────────────────── */

class GooglePlacesProvider implements WebSearchProvider {
  readonly name = 'google-places' as const;
  private readonly apiKey = process.env.GOOGLE_PLACES_API_KEY || '';

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async search(_params: WebSearchParams): Promise<WebVendor[]> {
    // TODO: hit https://places.googleapis.com/v1/places:searchText
    // with X-Goog-Api-Key header, map results into WebVendor[].
    return [];
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Service                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

@Injectable()
export class WebSearchService {
  private readonly logger = new Logger(WebSearchService.name);
  private readonly providers: Record<WebSearchProviderName, WebSearchProvider> =
    {
      overpass: new OverpassProvider(),
      foursquare: new FoursquareProvider(),
      yelp: new YelpProvider(),
      serpapi: new SerpApiProvider(),
      'google-places': new GooglePlacesProvider(),
    };

  /** Resolve which provider to use based on env, defaulting to overpass (free, no key). */
  private resolveProvider(): WebSearchProvider {
    const requested = (process.env.WEB_SEARCH_PROVIDER ||
      'overpass') as WebSearchProviderName;
    return this.providers[requested] ?? this.providers.overpass;
  }

  async search(params: WebSearchParams): Promise<WebSearchResult> {
    const provider = this.resolveProvider();

    if (!provider.isConfigured()) {
      this.logger.log(
        `Web search provider "${provider.name}" not configured — returning empty result.`,
      );
      return {
        vendors: [],
        provider: provider.name,
        configured: false,
        message: `Web search via ${provider.name} is not configured. Set the appropriate API key in apps/api/.env.`,
      };
    }

    const vendors = await provider.search(params);
    return {
      vendors,
      provider: provider.name,
      configured: true,
    };
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Yelp response types (subset we use)                                       */
/* ────────────────────────────────────────────────────────────────────────── */

interface YelpSearchResponse {
  businesses?: YelpBusiness[];
  total?: number;
}

interface YelpBusiness {
  id: string;
  name: string;
  url?: string;
  image_url?: string;
  rating?: number;
  review_count?: number;
  phone?: string;
  display_phone?: string;
  distance?: number;
  categories?: { alias: string; title: string }[];
  location?: {
    address1?: string;
    city?: string;
    state?: string;
    zip_code?: string;
  };
}
