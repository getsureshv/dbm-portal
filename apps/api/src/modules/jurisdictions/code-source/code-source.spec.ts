import {
  inferKind,
  codeSourcesFromConfig,
  resolveCodeSources,
  orderDocsForScope,
  CODE_SOURCE_REGISTRY,
  type CodeSourceDoc,
} from './code-source.resolver';
import {
  htmlToText,
  pdfBufferToText,
  buildExtractionPrompt,
  parseExtractedRules,
  fetchDocsText,
  extractRules,
} from './code-rules.extractor';

describe('code-source.resolver', () => {
  it('inferKind detects pdf vs html', () => {
    expect(inferKind('https://x/doc.pdf')).toBe('pdf');
    expect(inferKind('https://x/doc.PDF?v=2')).toBe('pdf');
    expect(inferKind('https://x/page')).toBe('html');
    expect(inferKind('https://x/209/Adopted-Codes')).toBe('html');
  });

  it('codeSourcesFromConfig reads + validates adapterConfig.codeSources', () => {
    const cfg = {
      codeSources: {
        domain: 'example.gov',
        docs: [
          { url: 'https://example.gov/a.pdf', label: 'A' },
          { url: 'https://example.gov/b', kind: 'html', label: 'B', scopes: ['kitchen'] },
        ],
      },
    };
    const out = codeSourcesFromConfig(cfg);
    expect(out?.domain).toBe('example.gov');
    expect(out?.docs).toHaveLength(2);
    expect(out?.docs[0].kind).toBe('pdf'); // inferred from .pdf
    expect(out?.docs[1].kind).toBe('html'); // explicit
    expect(out?.docs[1].scopes).toEqual(['kitchen']);
  });

  it('codeSourcesFromConfig returns null on missing/invalid input', () => {
    expect(codeSourcesFromConfig(null)).toBeNull();
    expect(codeSourcesFromConfig({ other: 1 })).toBeNull();
    expect(codeSourcesFromConfig({ codeSources: {} })).toBeNull();
    expect(codeSourcesFromConfig({ codeSources: { docs: [] } })).toBeNull();
    // doc with non-http url is dropped → empty → null
    expect(
      codeSourcesFromConfig({ codeSources: { docs: [{ url: 'ftp://x', label: 'x' }] } }),
    ).toBeNull();
  });

  it('codeSourcesFromConfig falls back label to url when missing', () => {
    const out = codeSourcesFromConfig({
      codeSources: { docs: [{ url: 'https://x/a.pdf' }] },
    });
    expect(out?.docs[0].label).toBe('https://x/a.pdf');
  });

  it('resolveCodeSources: config override beats registry, then registry, then null', () => {
    const override = resolveCodeSources('coppell-tx', {
      codeSources: { docs: [{ url: 'https://override/x.pdf', label: 'O' }] },
    });
    expect(override?.docs[0].url).toBe('https://override/x.pdf');

    const registry = resolveCodeSources('coppell-tx', null);
    expect(registry?.domain).toBe('coppelltx.gov');
    expect(registry?.docs.length).toBeGreaterThan(0);

    expect(resolveCodeSources('nowhere-zz', null)).toBeNull();
  });

  it('registry coppell-tx has both a scoped pdf and a general html doc', () => {
    const c = CODE_SOURCE_REGISTRY['coppell-tx'];
    const pdf = c.docs.find((d) => d.kind === 'pdf');
    const html = c.docs.find((d) => d.kind === 'html');
    expect(pdf?.scopes).toContain('kitchen');
    expect(html).toBeTruthy();
  });

  it('orderDocsForScope puts scope-tagged docs first', () => {
    const docs: CodeSourceDoc[] = [
      { url: 'https://a', kind: 'html', label: 'General' },
      { url: 'https://b', kind: 'pdf', label: 'Kitchen', scopes: ['kitchen'] },
    ];
    const ordered = orderDocsForScope(docs, 'kitchen');
    expect(ordered[0].label).toBe('Kitchen');
    expect(ordered[1].label).toBe('General');
    // no scope → original order preserved
    expect(orderDocsForScope(docs).map((d) => d.label)).toEqual([
      'General',
      'Kitchen',
    ]);
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

  it('pdfBufferToText extracts text from an uncompressed content stream (dependency-free)', () => {
    const content =
      'BT /F1 12 Tf 72 700 Td (Kitchen permit required) Tj T* (GFCI outlets near sink) Tj ET';
    const pdf = ['%PDF-1.4', 'stream', content, 'endstream', '%%EOF'].join('\n');
    const txt = pdfBufferToText(Buffer.from(pdf, 'latin1'));
    expect(txt).toContain('Kitchen permit required');
    expect(txt).toContain('GFCI outlets near sink');
  });

  it('pdfBufferToText returns empty string on non-pdf garbage (never throws)', () => {
    expect(pdfBufferToText(Buffer.from('not a pdf at all'))).toBe('');
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
      docs: [{ url: 'https://x', kind: 'html', label: 'X' }],
    });
    expect(out).toEqual([]);
  });

  it('fetchDocsText skips short/failed docs and keeps good ones', async () => {
    const longText = 'Building code text. '.repeat(40);
    const fakeFetch = (async (url: string) =>
      ({
        ok: true,
        headers: { get: () => 'text/html' },
        text: async () =>
          String(url).includes('good') ? `<p>${longText}</p>` : '<p>tiny</p>',
      }) as Response) as unknown as typeof fetch;
    const docs: CodeSourceDoc[] = [
      { url: 'https://good', kind: 'html', label: 'Good' },
      { url: 'https://short', kind: 'html', label: 'Short' },
    ];
    const out = await fetchDocsText(docs, fakeFetch);
    expect(out).toHaveLength(1);
    expect(out[0].url).toBe('https://good');
  });

  it('extractRules with docs fetches + extracts per-doc and keeps source urls', async () => {
    const longText = 'Building code section R507 deck requirements. '.repeat(20);
    const fakeFetch = (async () =>
      ({
        ok: true,
        headers: { get: () => 'text/html' },
        text: async () => `<p>${longText}</p>`,
      }) as Response) as unknown as typeof fetch;
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
      docs: [{ url: 'https://city.gov/a', kind: 'html', label: 'A' }],
      fetchImpl: fakeFetch,
    });
    expect(out).toHaveLength(1);
    expect(out[0].section).toBe('R507.2');
    expect(out[0].sourceUrl).toBe('https://city.gov/a');
  });

  it('extractRules de-dupes across multiple docs by family|section', async () => {
    const longText = 'Building code section. '.repeat(40);
    const fakeFetch = (async () =>
      ({
        ok: true,
        headers: { get: () => 'text/html' },
        text: async () => `<p>${longText}</p>`,
      }) as Response) as unknown as typeof fetch;
    const fakeAnthropic = {
      messages: {
        create: async () => ({
          content: [
            {
              type: 'text',
              text: '[{"codeFamily":"IRC","section":"R314.3","title":"Smoke","body":"Smoke alarms.","scopeTags":["kitchen"]}]',
            },
          ],
        }),
      },
    } as never;
    const out = await extractRules({
      anthropic: fakeAnthropic,
      cityName: 'Coppell',
      scope: 'kitchen',
      docs: [
        { url: 'https://city.gov/a', kind: 'html', label: 'A' },
        { url: 'https://city.gov/b', kind: 'html', label: 'B' },
      ],
      fetchImpl: fakeFetch,
    });
    // both docs return the same section → de-duped to 1
    expect(out).toHaveLength(1);
    expect(out[0].sourceUrl).toBe('https://city.gov/a'); // first doc wins
  });

  it('extractRules returns [] when no docs and no sourceUrl', async () => {
    const fakeAnthropic = { messages: { create: async () => ({ content: [] }) } } as never;
    const out = await extractRules({ anthropic: fakeAnthropic, cityName: 'Coppell' });
    expect(out).toEqual([]);
  });
});
