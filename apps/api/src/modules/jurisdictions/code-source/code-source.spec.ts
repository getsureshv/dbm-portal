import {
  citySlug,
  stateSlug,
  candidateSources,
  probeCodeSource,
  codeSourceFromConfig,
} from './code-source.resolver';
import {
  htmlToText,
  buildExtractionPrompt,
  parseExtractedRules,
  extractRules,
} from './code-rules.extractor';

describe('code-source.resolver', () => {
  it('slugifies city names and strips "City of" prefix', () => {
    expect(citySlug('City of Coppell')).toBe('coppell');
    expect(citySlug('Flower Mound', '-')).toBe('flower-mound');
    expect(citySlug('St. Louis')).toBe('st_louis');
  });

  it('maps known states and falls back to lowercase', () => {
    expect(stateSlug('TX')).toBe('texas');
    expect(stateSlug('zz')).toBe('zz');
  });

  it('builds municode + amlegal + ecode360 candidates in priority order', () => {
    const c = candidateSources('Coppell', 'TX');
    expect(c.map((x) => x.platform)).toEqual([
      'municode',
      'amlegal',
      'ecode360',
    ]);
    expect(c[0].url).toContain('library.municode.com/texas/coppell');
  });

  it('probeCodeSource returns the first OK candidate', async () => {
    const fakeFetch = (async (url: string) =>
      ({
        ok: String(url).includes('municode'),
      }) as Response) as unknown as typeof fetch;
    const src = await probeCodeSource('Coppell', 'TX', fakeFetch, 100);
    expect(src.platform).toBe('municode');
  });

  it('probeCodeSource falls back to unknown when nothing verifies', async () => {
    const fakeFetch = (async () =>
      ({ ok: false }) as Response) as unknown as typeof fetch;
    const src = await probeCodeSource('Nowhere', 'TX', fakeFetch, 100);
    expect(src.platform).toBe('unknown');
    expect(src.url).toContain('municode'); // best-effort guess
  });

  it('reads codeSource back from adapterConfig', () => {
    const cfg = { codeSource: { platform: 'municode', url: 'https://x' } };
    expect(codeSourceFromConfig(cfg)?.url).toBe('https://x');
    expect(codeSourceFromConfig(null)).toBeNull();
    expect(codeSourceFromConfig({ other: 1 })).toBeNull();
  });
});

describe('code-rules.extractor', () => {
  it('htmlToText strips tags, scripts, and decodes entities', () => {
    const html =
      '<style>x{}</style><h1>Decks</h1><p>Setback &gt; 5&nbsp;ft</p><script>bad()</script>';
    const txt = htmlToText(html);
    expect(txt).toContain('Decks');
    expect(txt).toContain('Setback > 5 ft');
    expect(txt).not.toContain('bad()');
    expect(txt).not.toContain('<');
  });

  it('buildExtractionPrompt includes scope and source url', () => {
    const p = buildExtractionPrompt('City of Coppell', 'kitchen', 'https://x', 'TEXT');
    expect(p).toContain('kitchen');
    expect(p).toContain('https://x');
    expect(p).toContain('JSON array');
  });

  it('parseExtractedRules parses valid JSON and de-dupes by section', () => {
    const raw = `Here you go: [
      {"codeFamily":"IRC","section":"R507.2","title":"Deck","body":"Setback rule.","scopeTags":["deck"]},
      {"codeFamily":"IRC","section":"R507.2","title":"Dup","body":"dup","scopeTags":["deck"]},
      {"codeFamily":"weird","section":"Sec 9","title":"Local","body":"city rule"}
    ]`;
    const rules = parseExtractedRules(raw, 'https://src', 'deck');
    expect(rules).toHaveLength(2);
    expect(rules[0].section).toBe('R507.2');
    expect(rules[1].codeFamily).toBe('LOCAL'); // invalid family coerced
    expect(rules[1].scopeTags).toEqual(['deck']); // fallback scope applied
  });

  it('parseExtractedRules returns [] on junk / missing fields', () => {
    expect(parseExtractedRules('no json here', 'u')).toEqual([]);
    expect(parseExtractedRules('[{"section":"x"}]', 'u')).toEqual([]); // missing title/body
    expect(parseExtractedRules('', 'u')).toEqual([]);
  });

  it('extractRules is a graceful no-op when anthropic is null', async () => {
    const out = await extractRules({
      anthropic: null,
      cityName: 'Coppell',
      scope: 'kitchen',
      sourceUrl: 'https://x',
    });
    expect(out).toEqual([]);
  });

  it('extractRules returns [] when source text is too short', async () => {
    const fakeFetch = (async () =>
      ({ ok: true, text: async () => '<p>tiny</p>' }) as Response) as unknown as typeof fetch;
    const fakeAnthropic = {
      messages: { create: async () => ({ content: [] }) },
    } as never;
    const out = await extractRules({
      anthropic: fakeAnthropic,
      cityName: 'Coppell',
      sourceUrl: 'https://x',
      fetchImpl: fakeFetch,
    });
    expect(out).toEqual([]);
  });

  it('extractRules parses a successful LLM response end-to-end', async () => {
    const longText = '<p>' + 'Building code section R507 deck requirements. '.repeat(20) + '</p>';
    const fakeFetch = (async () =>
      ({ ok: true, text: async () => longText }) as Response) as unknown as typeof fetch;
    const fakeAnthropic = {
      messages: {
        create: async () => ({
          content: [
            {
              type: 'text',
              text: '[{"codeFamily":"IRC","section":"R507.2","title":"Deck footings","body":"Footings required.","scopeTags":["deck"]}]',
            },
          ],
        }),
      },
    } as never;
    const out = await extractRules({
      anthropic: fakeAnthropic,
      cityName: 'Coppell',
      scope: 'deck',
      sourceUrl: 'https://x',
      fetchImpl: fakeFetch,
    });
    expect(out).toHaveLength(1);
    expect(out[0].section).toBe('R507.2');
    expect(out[0].sourceUrl).toBe('https://x');
  });
});
