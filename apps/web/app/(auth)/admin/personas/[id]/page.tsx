'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  Lock,
  Save,
  Copy,
  Archive,
  X,
  AlertTriangle,
} from 'lucide-react';
import {
  admin,
  ApiPersona,
  ApiEntity,
  ApiPermissionRow,
  PermissionScope,
} from '../../../../../lib/api';
import AdminGuard from '../../AdminGuard';

const SCOPES: PermissionScope[] = ['ALL', 'OWN', 'ASSIGNED'];

// Working state: per-entity, a set of checked actions + a scope.
interface RowState {
  actions: Set<string>;
  scope: PermissionScope;
}

function buildInitialState(
  entities: ApiEntity[],
  permissions: ApiPermissionRow[],
): Record<string, RowState> {
  const byEntity = new Map(permissions.map((p) => [p.entity, p]));
  const state: Record<string, RowState> = {};
  for (const e of entities) {
    const existing = byEntity.get(e.key);
    state[e.key] = {
      actions: new Set(existing?.actions ?? []),
      scope: existing?.scope ?? 'ALL',
    };
  }
  return state;
}

function PersonaDetailInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [persona, setPersona] = useState<ApiPersona | null>(null);
  const [entities, setEntities] = useState<ApiEntity[] | null>(null);
  const [state, setState] = useState<Record<string, RowState>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [showClone, setShowClone] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = () => {
    setError(null);
    Promise.all([admin.getPersona(id), admin.listEntities()])
      .then(([p, ents]) => {
        setPersona(p);
        setEntities(ents);
        setState(buildInitialState(ents, p.permissions));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  };

  useEffect(load, [id]);

  const toggleAction = (entityKey: string, action: string) => {
    setState((prev) => {
      const row = prev[entityKey];
      const actions = new Set(row.actions);
      if (actions.has(action)) actions.delete(action);
      else actions.add(action);
      return { ...prev, [entityKey]: { ...row, actions } };
    });
  };

  const setScope = (entityKey: string, scope: PermissionScope) => {
    setState((prev) => ({ ...prev, [entityKey]: { ...prev[entityKey], scope } }));
  };

  // Rows with at least one checked action become the new matrix.
  const matrix: ApiPermissionRow[] = useMemo(
    () =>
      Object.entries(state)
        .filter(([, row]) => row.actions.size > 0)
        .map(([entity, row]) => ({
          entity,
          actions: Array.from(row.actions),
          scope: row.scope,
        })),
    [state],
  );

  const doSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await admin.replacePermissions(id, matrix);
      setConfirmSave(false);
      setNotice('Permission matrix saved.');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
      setConfirmSave(false);
    } finally {
      setSaving(false);
    }
  };

  const doArchive = async () => {
    const force = (persona?.holderCount ?? 0) > 0;
    if (
      !confirm(
        force
          ? `This persona has ${persona?.holderCount} holder(s). Archive anyway?`
          : 'Archive this persona?',
      )
    )
      return;
    try {
      await admin.archivePersona(id, force);
      router.push('/admin/personas');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to archive');
    }
  };

  if (error && !persona) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
        <Link href="/admin/personas" className="text-sm text-amber-700 mt-4 inline-block">
          ← Back to personas
        </Link>
      </div>
    );
  }

  if (!persona || !entities) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="animate-spin text-amber-600" size={24} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <Link
        href="/admin/personas"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft size={15} /> Personas
      </Link>

      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">{persona.name}</h1>
            {persona.isSystem && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                <Lock size={10} /> System
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5 font-mono">{persona.slug}</p>
          {persona.description && (
            <p className="text-sm text-gray-600 mt-1 max-w-xl">{persona.description}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            {persona.holderCount} holder(s) · base type {persona.baseType}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowClone(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Copy size={15} /> Clone
          </button>
          {!persona.isSystem && persona.status === 'ACTIVE' && (
            <button
              onClick={doArchive}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
            >
              <Archive size={15} /> Archive
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700 mb-4">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 text-sm">Permission matrix</h2>
          <span className="text-xs text-gray-400">
            Check the actions this persona may perform on each entity
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-2 font-medium">Entity</th>
                <th className="px-4 py-2 font-medium">Actions</th>
                <th className="px-4 py-2 font-medium w-40">Scope</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entities.map((e) => {
                const row = state[e.key];
                const hasActions = row && row.actions.size > 0;
                return (
                  <tr key={e.key} className="align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{e.label}</div>
                      <div className="text-xs text-gray-400 font-mono">{e.key}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                        {e.actions.map((action) => (
                          <label
                            key={action}
                            className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={row?.actions.has(action) ?? false}
                              onChange={() => toggleAction(e.key, action)}
                              className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                            />
                            {action}
                          </label>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={row?.scope ?? 'ALL'}
                        onChange={(ev) => setScope(e.key, ev.target.value as PermissionScope)}
                        disabled={!hasActions}
                        className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none disabled:bg-gray-50 disabled:text-gray-400"
                      >
                        {SCOPES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
          <button
            onClick={load}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            Reset
          </button>
          <button
            onClick={() => setConfirmSave(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-amber-500 text-white rounded-lg hover:bg-amber-600"
          >
            <Save size={15} /> Save matrix
          </button>
        </div>
      </div>

      {/* Save confirmation — full-replace is destructive */}
      {confirmSave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="text-amber-600" size={18} />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Replace permission matrix?</h2>
                <p className="text-sm text-gray-600 mt-1">
                  This fully replaces {persona.name}&apos;s {persona.permissions.length} existing
                  permission row(s) with {matrix.length} new row(s). Changes take effect within a
                  few minutes for all holders.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setConfirmSave(false)}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={doSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-60 flex items-center gap-2"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Replace matrix
              </button>
            </div>
          </div>
        </div>
      )}

      {showClone && (
        <ClonePersonaModal
          persona={persona}
          onClose={() => setShowClone(false)}
          onCloned={(newId) => router.push(`/admin/personas/${newId}`)}
        />
      )}
    </div>
  );
}

function ClonePersonaModal({
  persona,
  onClose,
  onCloned,
}: {
  persona: ApiPersona;
  onClose: () => void;
  onCloned: (id: string) => void;
}) {
  const [name, setName] = useState(`${persona.name} (copy)`);
  const [slug, setSlug] = useState(`${persona.slug}-copy`);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await admin.clonePersona(persona.id, { name, slug });
      onCloned(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clone');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Clone persona</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="px-5 py-4 space-y-4">
          <p className="text-sm text-gray-600">
            Creates a new CUSTOM persona with a copy of {persona.name}&apos;s permission matrix.
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Slug</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
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
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-60 flex items-center gap-2"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Clone
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PersonaDetailPage() {
  return (
    <AdminGuard>
      <PersonaDetailInner />
    </AdminGuard>
  );
}
