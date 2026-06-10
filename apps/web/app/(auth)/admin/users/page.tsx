'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Users,
  Loader2,
  Search,
  Plus,
  Trash2,
  Check,
  X,
} from 'lucide-react';
import {
  admin,
  ApiUserPersonas,
  ApiPersona,
} from '../../../../lib/api';
import AdminGuard from '../AdminGuard';

function statusBadge(status: string) {
  const map: Record<string, string> = {
    ACTIVE: 'text-green-700 bg-green-50',
    PENDING: 'text-amber-700 bg-amber-50',
    REVOKED: 'text-red-600 bg-red-50',
    EXPIRED: 'text-gray-500 bg-gray-100',
  };
  return map[status] ?? 'text-gray-500 bg-gray-100';
}

function AssignModal({
  userId,
  onClose,
  onAssigned,
}: {
  userId: string;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [personas, setPersonas] = useState<ApiPersona[] | null>(null);
  const [personaId, setPersonaId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    admin
      .listPersonas()
      .then((p) => setPersonas(p.filter((x) => x.status === 'ACTIVE')))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load personas'));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personaId) return;
    setSaving(true);
    setError(null);
    try {
      await admin.assignPersona(
        userId,
        personaId,
        expiresAt ? new Date(expiresAt).toISOString() : undefined,
      );
      onAssigned();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Assign persona</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Persona</label>
            <select
              value={personaId}
              onChange={(e) => setPersonaId(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
            >
              <option value="">Select a persona…</option>
              {personas?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.slug})
                </option>
              ))}
            </select>
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
              disabled={saving || !personaId}
              className="px-4 py-2 text-sm font-semibold bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-60 flex items-center gap-2"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Assign
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UsersInner() {
  const [userIdInput, setUserIdInput] = useState('');
  const [data, setData] = useState<ApiUserPersonas | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAssign, setShowAssign] = useState(false);

  const searchParams = useSearchParams();

  const runLookup = useCallback(async (identifier: string) => {
    const id = identifier.trim();
    if (!id) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await admin.userPersonas(id);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'User not found');
    } finally {
      setLoading(false);
    }
  }, []);

  const lookup = async (e?: React.FormEvent) => {
    e?.preventDefault();
    await runLookup(userIdInput);
  };

  // Deep-link support: /admin/users?lookup=<email-or-id> (used by the Users roster).
  useEffect(() => {
    const q = searchParams.get('lookup');
    if (q) {
      setUserIdInput(q);
      runLookup(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const refresh = () => {
    if (data) admin.userPersonas(data.user.id).then(setData).catch(() => {});
  };

  const revoke = async (personaId: string) => {
    if (!data) return;
    if (!confirm('Revoke this persona from the user?')) return;
    try {
      await admin.revokePersona(data.user.id, personaId);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke');
    }
  };

  const approve = async (personaId: string) => {
    if (!data) return;
    try {
      await admin.approvePersona(data.user.id, personaId);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
          <Users className="text-amber-600" size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">User access</h1>
          <p className="text-sm text-gray-500">
            Look up a user by email or ID and manage their persona assignments
          </p>
        </div>
      </div>

      <form onSubmit={lookup} className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={userIdInput}
            onChange={(e) => setUserIdInput(e.target.value)}
            placeholder="Email or User ID"
            className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
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

      {data && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="font-medium text-gray-900">
                {data.user.name || data.user.email}
              </p>
              <p className="text-xs text-gray-500">{data.user.email}</p>
              <p className="text-xs text-gray-400 font-mono mt-0.5">{data.user.id}</p>
            </div>
            <button
              onClick={() => setShowAssign(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-amber-500 text-white rounded-lg hover:bg-amber-600"
            >
              <Plus size={15} /> Assign persona
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {data.personas.map((p) => (
              <div
                key={p.personaId}
                className="flex items-center justify-between px-5 py-3 gap-3 flex-wrap"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 text-sm">{p.name}</span>
                    <span
                      className={`text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded ${statusBadge(
                        p.status,
                      )}`}
                    >
                      {p.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{p.slug}</p>
                  {p.expiresAt && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Expires {new Date(p.expiresAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {p.status === 'PENDING' && (
                    <button
                      onClick={() => approve(p.personaId)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 border border-green-200 rounded-lg hover:bg-green-50"
                    >
                      <Check size={13} /> Approve
                    </button>
                  )}
                  {p.status !== 'REVOKED' && (
                    <button
                      onClick={() => revoke(p.personaId)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                    >
                      <Trash2 size={13} /> Revoke
                    </button>
                  )}
                </div>
              </div>
            ))}
            {data.personas.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-gray-500">
                This user has no persona assignments.
              </p>
            )}
          </div>
        </div>
      )}

      {showAssign && data && (
        <AssignModal
          userId={data.user.id}
          onClose={() => setShowAssign(false)}
          onAssigned={() => {
            setShowAssign(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

export default function UsersPage() {
  return (
    <AdminGuard>
      <Suspense
        fallback={
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex justify-center">
            <Loader2 className="animate-spin text-amber-500" size={24} />
          </div>
        }
      >
        <UsersInner />
      </Suspense>
    </AdminGuard>
  );
}
