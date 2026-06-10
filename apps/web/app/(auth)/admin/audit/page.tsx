'use client';

import { useEffect, useState, useCallback } from 'react';
import { ScrollText, Loader2, Filter, ChevronDown, ChevronRight } from 'lucide-react';
import { admin, ApiAuditEntry } from '../../../../lib/api';
import AdminGuard from '../AdminGuard';

function actionColor(action: string) {
  if (action.includes('revoked') || action.includes('archived')) return 'text-red-600 bg-red-50';
  if (action.includes('created') || action.includes('assigned') || action.includes('approved'))
    return 'text-green-700 bg-green-50';
  if (action.includes('updated') || action.includes('replaced')) return 'text-amber-700 bg-amber-50';
  return 'text-gray-600 bg-gray-100';
}

function AuditRow({ entry }: { entry: ApiAuditEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="px-5 py-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          {open ? (
            <ChevronDown size={15} className="text-gray-400 shrink-0" />
          ) : (
            <ChevronRight size={15} className="text-gray-400 shrink-0" />
          )}
          <span
            className={`text-[11px] font-medium px-1.5 py-0.5 rounded shrink-0 ${actionColor(
              entry.action,
            )}`}
          >
            {entry.action}
          </span>
          <span className="text-sm text-gray-700 truncate">
            {entry.subjectType}
            <span className="text-gray-400 font-mono"> / {entry.subjectId}</span>
          </span>
        </div>
        <span className="text-xs text-gray-400 shrink-0">
          {new Date(entry.at).toLocaleString()}
        </span>
      </button>
      {open && (
        <div className="mt-3 ml-7 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
              Actor
            </p>
            <p className="text-xs font-mono text-gray-600">{entry.actorId ?? 'system'}</p>
          </div>
          <div />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
              Before
            </p>
            <pre className="text-[11px] bg-gray-50 rounded-lg p-2 overflow-x-auto text-gray-600 max-h-48">
              {entry.before ? JSON.stringify(entry.before, null, 2) : '—'}
            </pre>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
              After
            </p>
            <pre className="text-[11px] bg-gray-50 rounded-lg p-2 overflow-x-auto text-gray-600 max-h-48">
              {entry.after ? JSON.stringify(entry.after, null, 2) : '—'}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function AuditInner() {
  const [entries, setEntries] = useState<ApiAuditEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ action: '', subjectType: '', actorId: '' });
  const [applied, setApplied] = useState(filters);

  const fetchPage = useCallback(
    async (reset: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const res = await admin.audit({
          action: applied.action || undefined,
          subjectType: applied.subjectType || undefined,
          actorId: applied.actorId || undefined,
          cursor: reset ? undefined : cursor ?? undefined,
          limit: 50,
        });
        setEntries((prev) => (reset ? res.items : [...prev, ...res.items]));
        setCursor(res.nextCursor);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load audit log');
      } finally {
        setLoading(false);
      }
    },
    [applied, cursor],
  );

  // Reload from scratch whenever applied filters change.
  useEffect(() => {
    setEntries([]);
    setCursor(null);
    fetchPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
          <ScrollText className="text-amber-600" size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Audit log</h1>
          <p className="text-sm text-gray-500">
            Append-only record of every access-control change
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="flex items-center gap-2 mb-3 text-sm font-medium text-gray-700">
          <Filter size={15} className="text-gray-400" /> Filters
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
            placeholder="Action (e.g. persona.updated)"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
          />
          <input
            value={filters.subjectType}
            onChange={(e) => setFilters({ ...filters, subjectType: e.target.value })}
            placeholder="Subject type (e.g. persona)"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
          />
          <input
            value={filters.actorId}
            onChange={(e) => setFilters({ ...filters, actorId: e.target.value })}
            placeholder="Actor ID"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
          />
        </div>
        <div className="flex justify-end gap-2 mt-3">
          <button
            onClick={() => {
              const cleared = { action: '', subjectType: '', actorId: '' };
              setFilters(cleared);
              setApplied(cleared);
            }}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            Clear
          </button>
          <button
            onClick={() => setApplied(filters)}
            className="px-4 py-2 text-sm font-semibold bg-amber-500 text-white rounded-lg hover:bg-amber-600"
          >
            Apply
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {entries.map((e) => (
          <AuditRow key={e.id} entry={e} />
        ))}
        {entries.length === 0 && !loading && (
          <p className="px-5 py-12 text-center text-sm text-gray-500">No audit entries found.</p>
        )}
        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-amber-600" size={22} />
          </div>
        )}
      </div>

      {cursor && !loading && (
        <div className="flex justify-center mt-4">
          <button
            onClick={() => fetchPage(false)}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}

export default function AuditPage() {
  return (
    <AdminGuard>
      <AuditInner />
    </AdminGuard>
  );
}
