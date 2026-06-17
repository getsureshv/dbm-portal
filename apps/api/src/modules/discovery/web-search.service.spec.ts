import { WebSearchService, WebVendor } from './web-search.service';

/**
 * Unit tests for the merge + dedupe behavior added when Google Places was
 * introduced. We don't hit any real network: we stub the private `providers`
 * map with fakes so the test is deterministic and offline.
 */

function vendor(partial: Partial<WebVendor>): WebVendor {
  return {
    id: 'x',
    name: 'Acme',
    rating: null,
    reviewCount: 0,
    phone: null,
    website: null,
    address: null,
    city: null,
    state: null,
    zip: null,
    distanceMiles: null,
    categories: [],
    imageUrl: null,
    source: 'overpass',
    sourceLabel: 'OpenStreetMap',
    ...partial,
  };
}

function fakeProvider(name: any, configured: boolean, vendors: WebVendor[]) {
  return {
    name,
    isConfigured: () => configured,
    search: async () => vendors,
  };
}

describe('WebSearchService merge mode', () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  function buildWith(providers: Record<string, any>): WebSearchService {
    const svc = new WebSearchService();
    // Override the private providers map with our fakes.
    (svc as any).providers = providers;
    return svc;
  }

  it('runs all configured providers and merges results', async () => {
    process.env.WEB_SEARCH_PROVIDER = 'merge';
    delete process.env.WEB_SEARCH_MERGE;

    const svc = buildWith({
      overpass: fakeProvider('overpass', true, [
        vendor({ id: 'osm:1', name: 'Bravo Electric', phone: '111-222-3333' }),
      ]),
      'google-places': fakeProvider('google-places', true, [
        vendor({
          id: 'gplaces:1',
          name: 'Charlie Plumbing',
          phone: '999-888-7777',
          rating: 4.5,
          reviewCount: 50,
          source: 'google-places',
          sourceLabel: 'Google',
        }),
      ]),
      foursquare: fakeProvider('foursquare', false, []),
      yelp: fakeProvider('yelp', false, []),
      serpapi: fakeProvider('serpapi', false, []),
    });

    const res = await svc.search({ zip: '75019' });
    expect(res.provider).toBe('merge');
    expect(res.configured).toBe(true);
    expect(res.vendors).toHaveLength(2);
    const names = res.vendors.map((v) => v.name).sort();
    expect(names).toEqual(['Bravo Electric', 'Charlie Plumbing']);
  });

  it('dedupes the same business by phone, keeping the richer record', async () => {
    process.env.WEB_SEARCH_PROVIDER = 'merge';

    const svc = buildWith({
      overpass: fakeProvider('overpass', true, [
        vendor({
          id: 'osm:1',
          name: 'Acme Roofing',
          phone: '(555) 123-4567',
        }),
      ]),
      'google-places': fakeProvider('google-places', true, [
        vendor({
          id: 'gplaces:1',
          name: 'Acme Roofing LLC',
          phone: '555-123-4567',
          rating: 4.8,
          reviewCount: 120,
          source: 'google-places',
          sourceLabel: 'Google',
        }),
      ]),
      foursquare: fakeProvider('foursquare', false, []),
      yelp: fakeProvider('yelp', false, []),
      serpapi: fakeProvider('serpapi', false, []),
    });

    const res = await svc.search({ zip: '75019' });
    expect(res.vendors).toHaveLength(1);
    // The Google record is richer (rating + reviews) so it wins.
    expect(res.vendors[0].sourceLabel).toBe('Google');
    expect(res.vendors[0].rating).toBe(4.8);
  });

  it('respects the WEB_SEARCH_MERGE allow-list', async () => {
    process.env.WEB_SEARCH_PROVIDER = 'merge';
    process.env.WEB_SEARCH_MERGE = 'google-places';

    const overpassSearch = jest.fn(async () => [vendor({ id: 'osm:1' })]);
    const svc = buildWith({
      overpass: { name: 'overpass', isConfigured: () => true, search: overpassSearch },
      'google-places': fakeProvider('google-places', true, [
        vendor({ id: 'gplaces:1', name: 'Only Google', source: 'google-places' }),
      ]),
      foursquare: fakeProvider('foursquare', true, []),
      yelp: fakeProvider('yelp', true, []),
      serpapi: fakeProvider('serpapi', true, []),
    });

    const res = await svc.search({ zip: '75019' });
    expect(overpassSearch).not.toHaveBeenCalled();
    expect(res.vendors.map((v) => v.name)).toEqual(['Only Google']);
  });

  it('falls back to overpass when no merge providers are configured', async () => {
    process.env.WEB_SEARCH_PROVIDER = 'merge';
    delete process.env.WEB_SEARCH_MERGE;

    const overpassSearch = jest.fn(async () => [
      vendor({ id: 'osm:1', name: 'Free Fallback' }),
    ]);
    const svc = buildWith({
      overpass: { name: 'overpass', isConfigured: () => true, search: overpassSearch },
      'google-places': fakeProvider('google-places', false, []),
      foursquare: fakeProvider('foursquare', false, []),
      yelp: fakeProvider('yelp', false, []),
      serpapi: fakeProvider('serpapi', false, []),
    });

    const res = await svc.search({ zip: '75019' });
    expect(overpassSearch).toHaveBeenCalled();
    expect(res.vendors.map((v) => v.name)).toEqual(['Free Fallback']);
  });

  it('single-provider mode still works (non-merge)', async () => {
    process.env.WEB_SEARCH_PROVIDER = 'google-places';

    const svc = buildWith({
      overpass: fakeProvider('overpass', true, [vendor({ id: 'osm:1' })]),
      'google-places': fakeProvider('google-places', true, [
        vendor({ id: 'gplaces:1', name: 'G', source: 'google-places' }),
      ]),
      foursquare: fakeProvider('foursquare', false, []),
      yelp: fakeProvider('yelp', false, []),
      serpapi: fakeProvider('serpapi', false, []),
    });

    const res = await svc.search({ zip: '75019' });
    expect(res.provider).toBe('google-places');
    expect(res.vendors.map((v) => v.name)).toEqual(['G']);
  });
});
