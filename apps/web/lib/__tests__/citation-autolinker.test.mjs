/**
 * Standalone logic tests for the citation auto-linker (PR #19).
 *
 * The web package has no jest config yet, so these run directly under node:
 *   node apps/web/lib/__tests__/citation-autolinker.test.mjs
 *
 * They mirror the PURE logic in ../citation-autolinker.tsx (tokenizeCitations /
 * normalizeCitation / resolveCitationUrl). If a jest harness is added to
 * apps/web later, port these cases 1:1 against the real module export.
 */

import assert from 'node:assert';

// ---- mirror of citation-autolinker.tsx pure logic ----
const ICC_BASE = 'https://codes.iccsafe.org/content';
const NFPA_NEC = 'https://link.nfpa.org/free-access/publications/70/2023';

const CITATION_MAP = {
  'IRC R324': { url: `${ICC_BASE}/IRC2021P2/chapter-3-building-planning#IRC2021P2_Pt03_Ch03_SecR324` },
  'IRC R302.1': { url: `${ICC_BASE}/IRC2021P2/chapter-3-building-planning#IRC2021P2_Pt03_Ch03_SecR302.1` },
  'IRC R302': { url: `${ICC_BASE}/IRC2021P2/chapter-3-building-planning#IRC2021P2_Pt03_Ch03_SecR302` },
  'IRC R507': { url: `${ICC_BASE}/IRC2021P2/chapter-5-floors#IRC2021P2_Pt03_Ch05_SecR507` },
  'NEC Article 690': { url: NFPA_NEC },
  'NEC Article 210': { url: NFPA_NEC },
  'NEC 690.12': { url: NFPA_NEC },
  'NEC 210.8': { url: NFPA_NEC },
  'NEC 210.52': { url: NFPA_NEC },
};
const FAMILY_FALLBACK = {
  IRC: `${ICC_BASE}/IRC2021P2`,
  IBC: `${ICC_BASE}/IBC2021P1`,
  IECC: `${ICC_BASE}/IECC2021P1`,
  NEC: NFPA_NEC,
};
const CITATION_REGEX =
  /\b(?:(IRC|IBC|IECC)\s+([A-Z]?\d{2,4}(?:\.\d+){0,3})|(NEC)\s+(?:Article|Art\.?)?\s*(\d{2,4}(?:\.\d+){0,3}(?:\([A-Za-z0-9]+\))*))/g;

function normalizeCitation(family, section) {
  const fam = family.toUpperCase();
  const sec = section.trim().replace(/\s+/g, ' ');
  if (fam === 'NEC') {
    const isArticle = /^\d{2,4}$/.test(sec);
    return isArticle ? `NEC Article ${sec}` : `NEC ${sec}`;
  }
  return `${fam} ${sec}`;
}
function resolveCitationUrl(key, family) {
  if (CITATION_MAP[key]) return CITATION_MAP[key].url;
  const stripped = key.replace(/\([A-Za-z0-9]+\)/g, '');
  if (stripped !== key && CITATION_MAP[stripped]) return CITATION_MAP[stripped].url;
  const fam = family.toUpperCase();
  return FAMILY_FALLBACK[fam] ?? null;
}
function tokenizeCitations(body) {
  const segments = [];
  if (!body) return segments;
  let lastIndex = 0;
  CITATION_REGEX.lastIndex = 0;
  let match;
  while ((match = CITATION_REGEX.exec(body)) !== null) {
    const full = match[0];
    const start = match.index;
    if (start > lastIndex) segments.push({ type: 'text', value: body.slice(lastIndex, start) });
    const family = (match[1] ?? match[3] ?? '').toUpperCase();
    const section = match[2] ?? match[4] ?? '';
    const key = normalizeCitation(family, section);
    const url = resolveCitationUrl(key, family);
    if (url) segments.push({ type: 'link', value: full, url, key });
    else segments.push({ type: 'text', value: full });
    lastIndex = start + full.length;
    if (CITATION_REGEX.lastIndex === start) CITATION_REGEX.lastIndex++;
  }
  if (lastIndex < body.length) segments.push({ type: 'text', value: body.slice(lastIndex) });
  return segments;
}

// ---- tests ----
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; }
}

test('links a single IRC section', () => {
  const link = tokenizeCitations('comply with IRC R324.').find((s) => s.type === 'link');
  assert.strictEqual(link.value, 'IRC R324');
  assert.match(link.url, /SecR324/);
});

test('links both IRC and NEC in the real Dallas solar body', () => {
  const body = 'per IRC R324 the roof structure must support the PV dead load, and the electrical work must comply with NEC Article 690; fire-access setbacks of 3 ft apply.';
  const links = tokenizeCitations(body).filter((s) => s.type === 'link').map((s) => s.value);
  assert.deepStrictEqual(links, ['IRC R324', 'NEC Article 690']);
});

test('bare NEC article number normalizes to Article', () => {
  const link = tokenizeCitations('See NEC 690 for PV.').find((s) => s.type === 'link');
  assert.strictEqual(link.key, 'NEC Article 690');
});

test('NEC dotted section stays a section', () => {
  const link = tokenizeCitations('GFCI per NEC 690.12 is required.').find((s) => s.type === 'link');
  assert.strictEqual(link.key, 'NEC 690.12');
});

test('NEC section with parenthetical (real kitchen body) links via stripped key', () => {
  const body = 'per NEC 210.8(A)(6) all such receptacles must be GFCI-protected';
  const link = tokenizeCitations(body).find((s) => s.type === 'link');
  assert.ok(link, 'expected a link');
  assert.match(link.url, /nfpa/);
  assert.strictEqual(link.value, 'NEC 210.8(A)(6)');
});

test('NEC 210.52(C) (real Dallas kitchen body) links', () => {
  const link = tokenizeCitations('per NEC 210.52(C) receptacles must be placed').find((s) => s.type === 'link');
  assert.ok(link);
  assert.strictEqual(link.value, 'NEC 210.52(C)');
});

test('IRC subsection with dots links correctly (IRC R302.1)', () => {
  const link = tokenizeCitations('per IRC R302.1 that wall must be rated').find((s) => s.type === 'link');
  assert.strictEqual(link.value, 'IRC R302.1');
  assert.match(link.url, /SecR302\.1/);
});

test('IECC section falls back to family URL', () => {
  const link = tokenizeCitations('per IECC N1102.4.1 the envelope must be sealed').find((s) => s.type === 'link');
  assert.ok(link);
  assert.match(link.url, /IECC2021P1/);
});

test('unknown family stays plain text', () => {
  const segs = tokenizeCitations('Refer to ASTM E84 and ASCE 7 for loads.');
  assert.ok(segs.every((s) => s.type === 'text'));
});

test('local code refs are not linked (Dallas §51A)', () => {
  const segs = tokenizeCitations('per Dallas Development Code §51A-4.401, decks must observe a setback.');
  assert.ok(segs.every((s) => s.type === 'text'), 'local code should not link');
});

test('round-trip preserves the body text exactly', () => {
  const body = 'per IRC R324 and NEC Article 690 the system applies.';
  assert.strictEqual(tokenizeCitations(body).map((s) => s.value).join(''), body);
});

test('empty body returns no segments', () => {
  assert.deepStrictEqual(tokenizeCitations(''), []);
});

test('body with no citations returns a single text segment', () => {
  assert.deepStrictEqual(tokenizeCitations('Just plain guidance.'), [{ type: 'text', value: 'Just plain guidance.' }]);
});

console.log(`\n${passed} passed`);
