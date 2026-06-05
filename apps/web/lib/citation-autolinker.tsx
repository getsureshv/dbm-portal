'use client';

/**
 * citation-autolinker — inline IRC/IBC/IECC/NEC citation linker (PR #19).
 *
 * Converts code citations that appear *inside a rule body* (plain text) into
 * clickable links to the official, free, no-login code viewers. No schema
 * change: the seed already stores bodies like "…must comply with IRC R324 and
 * NEC Article 690…"; this scans that text and links the recognized mentions.
 *
 *   IRC / IBC / IECC → ICC public viewer (codes.iccsafe.org), deep anchor when
 *                      known, else the code's landing page.
 *   NEC              → NFPA free read-only viewer (link.nfpa.org).
 *   Anything else    → left as plain text (never emit a broken link).
 *
 * Pure logic (tokenizeCitations / normalizeCitation / resolveCitationUrl) is
 * separated from the React renderer so it can be unit-tested without a DOM.
 * See lib/__tests__/citation-autolinker.test.mjs.
 */

import React from 'react';

export interface CitationTarget {
  url: string;
  label?: string;
}

// Free, public, no-login viewers.
const ICC_BASE = 'https://codes.iccsafe.org/content';
const NFPA_NEC = 'https://link.nfpa.org/free-access/publications/70/2023';

/**
 * Hand-curated deep anchors. Take priority over the family-level fallback so
 * high-value sections land exactly. Keys are normalized: "<FAMILY> <section>".
 */
export const CITATION_MAP: Record<string, CitationTarget> = {
  // IRC (2021)
  'IRC R324': { url: `${ICC_BASE}/IRC2021P2/chapter-3-building-planning#IRC2021P2_Pt03_Ch03_SecR324` },
  'IRC R302.1': { url: `${ICC_BASE}/IRC2021P2/chapter-3-building-planning#IRC2021P2_Pt03_Ch03_SecR302.1` },
  'IRC R302': { url: `${ICC_BASE}/IRC2021P2/chapter-3-building-planning#IRC2021P2_Pt03_Ch03_SecR302` },
  'IRC R507': { url: `${ICC_BASE}/IRC2021P2/chapter-5-floors#IRC2021P2_Pt03_Ch05_SecR507` },
  // NEC (2020/2023 read-only viewer)
  'NEC Article 690': { url: NFPA_NEC, label: 'NEC Article 690' },
  'NEC Article 210': { url: NFPA_NEC, label: 'NEC Article 210' },
  'NEC 690.12': { url: NFPA_NEC, label: 'NEC 690.12' },
  'NEC 210.8': { url: NFPA_NEC, label: 'NEC 210.8' },
  'NEC 210.52': { url: NFPA_NEC, label: 'NEC 210.52' },
};

// Family-level fallback when a specific section isn't curated above.
const FAMILY_FALLBACK: Record<string, string> = {
  IRC: `${ICC_BASE}/IRC2021P2`,
  IBC: `${ICC_BASE}/IBC2021P1`,
  IECC: `${ICC_BASE}/IECC2021P1`,
  NEC: NFPA_NEC,
};

/**
 * Matches the families we link. Two alternatives:
 *   - IRC/IBC/IECC: optional letter + digits + optional dotted subsections
 *       "IRC R324", "IRC R302.1", "IBC 1015.2", "IECC N1102.4"
 *   - NEC: optional "Article"/"Art." prefix, then digits + optional dotted parts
 *       "NEC Article 690", "NEC 690.12", "NEC 210.52(C)"  (parenthetical kept)
 */
const CITATION_REGEX =
  /\b(?:(IRC|IBC|IECC)\s+([A-Z]?\d{2,4}(?:\.\d+){0,3})|(NEC)\s+(?:Article|Art\.?)?\s*(\d{2,4}(?:\.\d+){0,3}(?:\([A-Za-z0-9]+\))*))/g;

/** Normalize a raw match to a CITATION_MAP key. */
export function normalizeCitation(family: string, section: string): string {
  const fam = family.toUpperCase();
  const sec = section.trim().replace(/\s+/g, ' ');
  if (fam === 'NEC') {
    // Bare "690" (no dot, no paren) → an Article; otherwise a section.
    const isArticle = /^\d{2,4}$/.test(sec);
    return isArticle ? `NEC Article ${sec}` : `NEC ${sec}`;
  }
  return `${fam} ${sec}`;
}

export function resolveCitationUrl(key: string, family: string): string | null {
  if (CITATION_MAP[key]) return CITATION_MAP[key].url;
  // Try stripping a parenthetical (e.g. "NEC 210.52(C)" → "NEC 210.52").
  const stripped = key.replace(/\([A-Za-z0-9]+\)/g, '');
  if (stripped !== key && CITATION_MAP[stripped]) return CITATION_MAP[stripped].url;
  const fam = family.toUpperCase();
  return FAMILY_FALLBACK[fam] ?? null;
}

export interface CitationSegment {
  type: 'text' | 'link';
  value: string;
  url?: string;
  key?: string;
}

/** Split body text into ordered text/link segments. Pure; unit-testable. */
export function tokenizeCitations(body: string): CitationSegment[] {
  const segments: CitationSegment[] = [];
  if (!body) return segments;
  let lastIndex = 0;
  CITATION_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = CITATION_REGEX.exec(body)) !== null) {
    const full = match[0];
    const start = match.index;
    if (start > lastIndex) {
      segments.push({ type: 'text', value: body.slice(lastIndex, start) });
    }
    const family = (match[1] ?? match[3] ?? '').toUpperCase();
    const section = match[2] ?? match[4] ?? '';
    const key = normalizeCitation(family, section);
    const url = resolveCitationUrl(key, family);
    if (url) segments.push({ type: 'link', value: full, url, key });
    else segments.push({ type: 'text', value: full });
    lastIndex = start + full.length;
    if (CITATION_REGEX.lastIndex === start) CITATION_REGEX.lastIndex++;
  }
  if (lastIndex < body.length) {
    segments.push({ type: 'text', value: body.slice(lastIndex) });
  }
  return segments;
}

/**
 * React renderer — drop-in replacement for a plain `{rule.body}` text node.
 * Usage:  <AutoLinkedBody text={r.body} className="..." />
 */
export function AutoLinkedBody({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const segments = tokenizeCitations(text);
  return (
    <p className={className}>
      {segments.map((seg, i) =>
        seg.type === 'link' ? (
          <a
            key={i}
            href={seg.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-700 hover:text-teal-800 underline decoration-dotted underline-offset-2"
            title={`Open ${seg.key} in the official code viewer`}
          >
            {seg.value}
          </a>
        ) : (
          <React.Fragment key={i}>{seg.value}</React.Fragment>
        ),
      )}
    </p>
  );
}

export default AutoLinkedBody;
