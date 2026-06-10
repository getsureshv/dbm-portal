'use client';

import { useEffect, useState } from 'react';
import {
  KeyRound,
  Loader2,
  Search,
  Plus,
  X,
  User as UserIcon,
  Shield,
  Crown,
  Ticket,
} from 'lucide-react';
import {
  admin,
  ApiEntity,
  ApiAccessPrincipal,
  ApiRecordGrant,
} from '../../../../lib/api';
import AdminGuard from '../AdminGuard';

function sourceMeta(source: string) {
  switch (source) {
    case 'OWNER':
      return { label: 'Owner', Icon: Crown, cls: 'text-amber-700 bg-amber-50' };
    case 'PARTICIPANT':
      return { label: 'Participant', Icon: UserIcon, cls: 'text-blue-700 bg-blue-50' };
    case 'PERSONA_SCOPE':
      return { label: 'Persona scope', Icon: Shield, cls: 'text-purple-700 bg-purple-50' };
    case 'GRANT':
      return { label: 'Record grant', Icon: Ticket, cls: 'text-green-700 bg-green-50' };
    default:
      return { label: source, Icon: KeyRound, cls: 'text-gray-600 bg-gray-100' };
  }
}

function GrantModal({
  entity,
  recordId,
  entities,
  onClose,
  onGranted,
}: {
  entity: string;
  recordId: string;
  entities: ApiEntity[];
  onClose: () => void;
  onGranted: () => void;
}) {
  const [granteeType, setGranteeType] = useState<'USER' | 'PERSONA'>('USER');
  const [granteeId, setGranteeId] = useState('');
  const [actions, setActions] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entityDef = entities.find((e) => e.key === entity);
  const availableActions = entityDef?.actions ?? [];

  const toggle = (a: string) => {
    setActions((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a);
      else next.add(a);
      return next;
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!granteeId || actions.size === 0 || !reason.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await admin.createRecordGrant({
        entity,
        recordId,
        granteeType,
        granteeId: granteeId.trim(),
        actions: Array.from(actions),
        reason: reason.trim(),
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      });
      onGranted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to issue grant');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Issue record grant</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="px-5 py-4 space-y-4">
          <p className="text-xs text-gray-500">
            Granting access to <span className="font-mono">{entity}</span> /{' '}
            <span className="font-mono">{recordId}</span>
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Grantee type</label>
            <div className="flex gap-2">
              {(['USER', 'PERSONA'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setGranteeType(t)}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg border ${
                    granteeType === t
                      ? 'border-amber-500 bg-amber-50 text-amber-700 font-medium'
                      : 'border-gray-300 text-gray-600'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {granteeType === 'USER' ? 'User ID' : 'Persona ID'}
            </label>
            <input
              value={granteeId}
              onChange={(e) => setGranteeId(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Actions</label>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {availableActions.map((a) => (
                <label key={a} className="flex items-center gap-1.5 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={actions.has(a)}
                    onChange={() => toggle(a)}
                    className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  />
                  {a}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Reason</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              placeholder="Why this grant is needed"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Expires at (optional)
            </label>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !granteeId || actions.size === 0 || !reason.trim()}
              className="px-4 py-2 text-sm font-semibold bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-60 flex items-center gap-2"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Issue grant
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RecordAccessInner() {
  const [entities, setEntities] = useState<ApiEntity[]>([]);
  const [entity, setEntity] = useState('project');
  const [recordId, setRecordId] = useState('');
  const [principals, setPrincipals] = useState<ApiAccessPrincipal[] | null>(null);
  const [grants, setGrants] = useState<ApiRecordGrant[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGrant, setShowGrant] = useState(false);
  const [queried, setQueried] = useState<{ entity: string; recordId: string } | null>(null);

  useEffect(() => {
    admin
      .listEntities()
      .then((e) => {
        setEntities(e);
        if (e.length && !e.some((x) => x.key === 'project')) setEntity(e[0].key);
      })
      .catch(() => {});
  }, []);

  const lookup = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const id = recordId.trim();
    if (!id) return;
    setLoading(true);
    setError(null);
    setPrincipals(null);
    setGrants(null);
    try {
      const [p, g] = await Promise.all([
        admin.whoCanAccess(entity, id),
        admin.listRecordGrants(entity, id),
      ]);
      setPrincipals(p);
      setGrants(g);
      setQueried({ entity, recordId: id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lookup failed');
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    if (queried) {
      admin.whoCanAccess(queried.entity, queried.recordId).then(setPrincipals).catch(() => {});
      admin.listRecordGrants(queried.entity, queried.recordId).then(setGrants).catch(() => {});
    }
  };

  const revokeGrant = async (id: string) => {
    if (!confirm('Revoke this record grant?')) return;
    try {
      await admin.revokeRecordGrant(id);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke');
    }
  };

  const supportsGrants = entities.find((e) => e.key === (queried?.entity ?? entity))
    ?.supportsRecordGrants;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
          <KeyRound className="text-amber-600" size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Record access</h1>
          <p className="text-sm text-gray-500">
            See who can reach a specific record and issue targeted grants
          </p>
        </div>
      </div>

      <form onSubmit={lookup} className="flex gap-2 mb-6 flex-wrap">
        <select
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
        >
          {entities.map((e) => (
            <option key={e.key} value={e.key}>
              {e.label}
            </option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={recordId}
            onChange={(e) => setRecordId(e.target.value)}
            placeholder="Record ID"
            className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm font-mono focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm font-semibold bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-60 flex items-center gap-2"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          Look up
        </button>
      </form>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {principals && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 text-sm">Who can access</h2>
              {supportsGrants && (
                <button
                  onClick={() => setShowGrant(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold bg-amber-500 text-white rounded-lg hover:bg-amber-600"
                >
                  <Plus size={14} /> Issue grant
                </button>
              )}
            </div>
            <div className="divide-y divide-gray-100">
              {principals.map((pr, i) => {
                const meta = sourceMeta(pr.source);
                const MetaIcon = meta.Icon;
                return (
                  <div key={i} className="flex items-center justify-between px-5 py-3 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded ${meta.cls}`}
                      >
                        <MetaIcon size={11} /> {meta.label}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{pr.label}</p>
                        <p className="text-xs text-gray-400 font-mono truncate">
                          {pr.principalType}: {pr.principalId}
                        </p>
                      </div>
                    </div>
                    {pr.actions && pr.actions.length > 0 && (
                      <span className="text-xs text-gray-500 shrink-0">
                        {pr.actions.join(', ')}
                      </span>
                    )}
                  </div>
                );
              })}
              {principals.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-gray-500">
                  No principals have access to this record.
                </p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 text-sm">Explicit grants</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {grants?.map((g) => (
                <div key={g.id} className="flex items-center justify-between px-5 py-3 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900">
                      <span className="font-mono text-xs text-gray-500">{g.granteeType}</span>{' '}
                      {g.granteeId}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {g.actions.join(', ')}
                      {g.reason ? ` · ${g.reason}` : ''}
                      {g.expiresAt
                        ? ` · expires ${new Date(g.expiresAt).toLocaleDateString()}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded ${
                        g.status === 'ACTIVE'
                          ? 'text-green-700 bg-green-50'
                          : 'text-gray-500 bg-gray-100'
                      }`}
                    >
                      {g.status}
                    </span>
                    {g.status === 'ACTIVE' && (
                      <button
                        onClick={() => revokeGrant(g.id)}
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {grants?.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-gray-500">
                  No explicit grants on this record.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {showGrant && queried && (
        <GrantModal
          entity={queried.entity}
          recordId={queried.recordId}
          entities={entities}
          onClose={() => setShowGrant(false)}
          onGranted={() => {
            setShowGrant(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

export default function RecordAccessPage() {
  return (
    <AdminGuard>
      <RecordAccessInner />
    </AdminGuard>
  );
}
