'use client';

/**
 * Permits & Codes — shared view used by:
 *   1. /projects/[id]/jurisdiction          (per-project, deep-linked from chat/scope)
 *   2. /permits                              (standalone, sidebar entry)
 *
 * Single source of truth for the lookup UI. Project-specific affordances
 * (e.g. "Back to project" link, project address pre-fill) are passed in
 * as props so the surface stays generic.
 */

import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Building2,
  FileText,
  Loader2,
  MapPin,
  Search,
} from 'lucide-react';
import {
  jurisdictions as jurisdictionsApi,
  ApiJurisdiction,
  ApiPermit,
  ApiCodeRule,
} from '../lib/api';

export const SCOPES = [
  { value: 'deck', label: 'Add a deck' },
  { value: 'adu', label: 'Build an ADU' },
  { value: 'kitchen', label: 'Kitchen remodel' },
  { value: 'solar', label: 'Solar panel install' },
] as const;

export type ScopeValue = (typeof SCOPES)[number]['value'];

function statusColor(status: ApiPermit['status']): string {
  switch (status) {
    case 'FINALIZED':
      return 'bg-green-100 text-green-800 ring-green-600/20';
    case 'ISSUED':
      return 'bg-blue-100 text-blue-800 ring-blue-600/20';
    case 'OPEN':
      return 'bg-amber-100 text-amber-800 ring-amber-600/20';
    case 'EXPIRED':
    case 'CANCELLED':
      return 'bg-red-100 text-red-700 ring-red-600/20';
    default:
      return 'bg-gray-100 text-gray-700 ring-gray-600/20';
  }
}

function familyColor(family: ApiCodeRule['codeFamily']): string {
  const map: Record<string, string> = {
    IRC: 'bg-teal-50 text-teal-700 ring-teal-600/20',
    IBC: 'bg-cyan-50 text-cyan-700 ring-cyan-600/20',
    IECC: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    NEC: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    IPC: 'bg-sky-50 text-sky-700 ring-sky-600/20',
    IMC: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
    LOCAL: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  };
  return map[family] ?? 'bg-gray-100 text-gray-700 ring-gray-600/20';
}

export interface PermitsCodesViewProps {
  /** Optional title override. Default: "City permits & code lookup" */
  title?: string;
  /** Optional subtitle override. */
  subtitle?: string;
  /** Optional slot rendered above the title (e.g. "Back to project" link). */
  topSlot?: React.ReactNode;
  /** Pre-fill the address input (e.g. from project.address or query param). */
  initialAddress?: string;
  /** Pre-select the jurisdiction by slug. If omitted, defaults to first in list. */
  initialSlug?: string;
  /** Pre-select scope. Default: 'deck'. */
  initialScope?: ScopeValue;
  /** Auto-trigger the permit lookup on mount if address + slug are present. */
  autoLookup?: boolean;
  /** Show suggested sample addresses below the form (for standalone /permits). */
  showSamples?: boolean;
  /** When true, hide the permits panel entirely (for public/unauth previews). */
  hidePermits?: boolean;
}

const SAMPLE_ADDRESSES: Array<{
  label: string;
  slug: string;
  address: string;
  scope: ScopeValue;
}> = [
  {
    label: 'Dallas — ADU on Cedar Springs',
    slug: 'dallas-tx',
    address: '2520 Cedar Springs Rd, Dallas TX 75201',
    scope: 'adu',
  },
  {
    label: 'Flower Mound — Kitchen remodel',
    slug: 'flower-mound-tx',
    address: '987 Spinks Rd, Flower Mound TX 75028',
    scope: 'kitchen',
  },
  {
    label: 'Houston — Backyard deck',
    slug: 'houston-tx',
    address: '1000 Main St, Houston TX 77002',
    scope: 'deck',
  },
];

export default function PermitsCodesView({
  title = 'City permits & code lookup',
  subtitle = 'Pull permits-by-address from local building departments and surface the code rules that apply.',
  topSlot,
  initialAddress = '',
  initialSlug,
  initialScope = 'deck',
  autoLookup = false,
  showSamples = false,
  hidePermits = false,
}: PermitsCodesViewProps) {
  const [allJurisdictions, setAllJurisdictions] = useState<ApiJurisdiction[]>([]);
  const [slug, setSlug] = useState<string>(initialSlug ?? '');
  const [address, setAddress] = useState<string>(initialAddress);
  const [scope, setScope] = useState<ScopeValue>(initialScope);

  const [permits, setPermits] = useState<ApiPermit[]>([]);
  const [rules, setRules] = useState<ApiCodeRule[]>([]);
  const [jurisdiction, setJurisdiction] = useState<ApiJurisdiction | null>(null);
  const [cached, setCached] = useState(false);
  const [loadingPermits, setLoadingPermits] = useState(false);
  const [loadingRules, setLoadingRules] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoLookupDone, setAutoLookupDone] = useState(false);

  // Load jurisdiction list once
  useEffect(() => {
    jurisdictionsApi
      .list()
      .then((js) => {
        setAllJurisdictions(js);
        if (js.length && !slug) setSlug(initialSlug ?? js[0].slug);
      })
      .catch((e) => setError(String(e?.message ?? e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load code rules whenever slug or scope changes
  useEffect(() => {
    if (!slug) return;
    setLoadingRules(true);
    jurisdictionsApi
      .codeRules(slug, scope)
      .then(setRules)
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => setLoadingRules(false));
  }, [slug, scope]);

  // Auto-lookup on mount when called with autoLookup + address + slug
  useEffect(() => {
    if (
      autoLookup &&
      !autoLookupDone &&
      !hidePermits &&
      slug &&
      address.trim().length > 5
    ) {
      setAutoLookupDone(true);
      lookupPermits();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLookup, slug, address, hidePermits]);

  async function lookupPermits() {
    if (!slug || !address) {
      setError('Pick a city and enter an address.');
      return;
    }
    setError(null);
    setLoadingPermits(true);
    try {
      const res = await jurisdictionsApi.permits(slug, address);
      setPermits(res.permits);
      setJurisdiction(res.jurisdiction);
      setCached(res.cached);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoadingPermits(false);
    }
  }

  function applySample(s: (typeof SAMPLE_ADDRESSES)[number]) {
    setSlug(s.slug);
    setAddress(s.address);
    setScope(s.scope);
    // useEffect on slug/scope will reload rules; we manually fire permit lookup
    setTimeout(() => lookupPermits(), 0);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* DEMO disclaimer banner — DO NOT REMOVE */}
      <div className="bg-amber-100 border-b border-amber-300 px-4 py-2 text-center text-sm text-amber-900">
        <AlertTriangle className="inline h-4 w-4 mr-1 -mt-0.5" />
        <strong>DEMO</strong> — City data may be sample, sandbox, or mock. Do not rely on for filing decisions.
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {topSlot}

        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <Building2 className="h-6 w-6 text-teal-700" />
            {title}
          </h1>
          <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
        </header>

        {/* Controls */}
        <div className="bg-white rounded-lg ring-1 ring-gray-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">City</label>
              <select
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              >
                {allJurisdictions.map((j) => (
                  <option key={j.slug} value={j.slug}>
                    {j.name} ({j.vendor})
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-6">
              <label className="block text-xs font-medium text-gray-700 mb-1">Address</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && lookupPermits()}
                  placeholder="1500 Marilla St, Dallas, TX 75201"
                  className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
              </div>
            </div>

            <div className="md:col-span-3 flex items-end">
              {!hidePermits ? (
                <button
                  onClick={lookupPermits}
                  disabled={loadingPermits}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
                >
                  {loadingPermits ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  Look up permits
                </button>
              ) : (
                <div className="text-[11px] text-gray-500 leading-snug">
                  Sign in for live permit history per address. Code rules below are free to browse.
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-gray-700">Project scope:</span>
            {SCOPES.map((s) => (
              <button
                key={s.value}
                onClick={() => setScope(s.value)}
                className={`text-xs px-3 py-1 rounded-full ring-1 transition ${
                  scope === s.value
                    ? 'bg-teal-700 text-white ring-teal-700'
                    : 'bg-white text-gray-700 ring-gray-300 hover:ring-teal-600'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {showSamples && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-gray-500">Try a sample:</span>
              {SAMPLE_ADDRESSES.map((s) => (
                <button
                  key={s.label}
                  onClick={() => applySample(s)}
                  className="text-[11px] px-2.5 py-1 rounded-full ring-1 ring-gray-300 text-gray-700 bg-white hover:ring-teal-600 hover:text-teal-700 transition"
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {error && (
            <div className="mt-3 text-sm text-red-700 bg-red-50 ring-1 ring-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div
          className={`grid grid-cols-1 ${
            hidePermits ? 'lg:grid-cols-1' : 'lg:grid-cols-5'
          } gap-6`}
        >
          {/* Permits panel */}
          {!hidePermits && (
            <section className="lg:col-span-3 bg-white rounded-lg ring-1 ring-gray-200">
              <header className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">
                    Permits{' '}
                    {jurisdiction && (
                      <span className="text-gray-500 font-normal">
                        — {jurisdiction.name}
                      </span>
                    )}
                  </h2>
                  {cached && (
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Cached result (24h TTL)
                    </p>
                  )}
                </div>
                <span className="text-xs text-gray-500">{permits.length} found</span>
              </header>

              <div className="divide-y divide-gray-100">
                {permits.length === 0 && !loadingPermits && (
                  <div className="px-4 py-12 text-center text-sm text-gray-500">
                    Enter an address above to look up permits.
                  </div>
                )}
                {permits.map((p) => (
                  <div key={p.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-gray-500">
                            {p.externalId}
                          </span>
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded-full ring-1 ring-inset ${statusColor(p.status)}`}
                          >
                            {p.status}
                          </span>
                        </div>
                        <div className="mt-1 text-sm font-medium text-gray-900">
                          {p.type ?? 'Permit'}
                        </div>
                        {p.description && (
                          <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">
                            {p.description}
                          </p>
                        )}
                        <div className="mt-1 text-xs text-gray-500 flex items-center gap-3 flex-wrap">
                          {p.issuedAt && (
                            <span>
                              Issued {new Date(p.issuedAt).toLocaleDateString()}
                            </span>
                          )}
                          {p.finalizedAt && (
                            <span>
                              Final {new Date(p.finalizedAt).toLocaleDateString()}
                            </span>
                          )}
                          {p.contractor && <span>{p.contractor}</span>}
                        </div>
                      </div>
                      {p.valuation && (
                        <div className="text-right shrink-0">
                          <div className="text-sm font-semibold text-gray-900">
                            ${Number(p.valuation).toLocaleString()}
                          </div>
                          <div className="text-[11px] text-gray-500">valuation</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Code rules panel */}
          <section
            className={`${
              hidePermits ? 'lg:col-span-1' : 'lg:col-span-2'
            } bg-white rounded-lg ring-1 ring-gray-200`}
          >
            <header className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="h-4 w-4 text-teal-700" />
                Code rules — {SCOPES.find((s) => s.value === scope)?.label}
              </h2>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Curated for{' '}
                {allJurisdictions.find((j) => j.slug === slug)?.name ?? 'this city'}
              </p>
            </header>
            <div className="divide-y divide-gray-100">
              {loadingRules && (
                <div className="px-4 py-8 text-center">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400 mx-auto" />
                </div>
              )}
              {!loadingRules && rules.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-gray-500">
                  No code rules curated yet for this scope.
                </div>
              )}
              {rules.map((r) => (
                <article key={r.id} className="px-4 py-3">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ring-1 ring-inset ${familyColor(r.codeFamily)}`}
                    >
                      {r.codeFamily}
                    </span>
                    <span className="font-mono text-xs text-gray-500">
                      {r.section}
                    </span>
                  </div>
                  <h3 className="text-sm font-medium text-gray-900">{r.title}</h3>
                  <p className="text-xs text-gray-700 mt-1 leading-relaxed">{r.body}</p>
                  {r.sourceUrl && (
                    <a
                      href={r.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-1.5 text-[11px] text-teal-700 hover:text-teal-800 underline"
                    >
                      Source
                    </a>
                  )}
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
