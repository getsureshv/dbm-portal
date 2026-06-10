'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Shield,
  Loader2,
  Plus,
  Lock,
  ChevronRight,
  X,
} from 'lucide-react';
import { admin, ApiPersona } from '../../../../lib/api';
import AdminGuard from '../AdminGuard';

function CreatePersonaModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [baseType, setBaseType] = useState('CUSTOM');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await admin.createPersona({ name, slug, description, baseType, requiresApproval });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create persona');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">New persona</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug)
                  setSlug(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/^-|-$/g, ''),
                  );
              }}
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
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Base type</label>
            <select
              value={baseType}
              onChange={(e) => setBaseType(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
            >
              {['CUSTOM', 'CLIENT', 'PROFESSIONAL', 'SUPPLIER', 'FREIGHT', 'SERVICE_PROVIDER'].map(
                (t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ),
              )}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={requiresApproval}
              onChange={(e) => setRequiresApproval(e.target.checked)}
              className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            Requires admin approval before activation
          </label>
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
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PersonasInner() {
  const [personas, setPersonas] = useState<ApiPersona[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = () => {
    setPersonas(null);
    admin
      .listPersonas()
      .then(setPersonas)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  };

  useEffect(load, []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
            <Shield className="text-amber-600" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Personas</h1>
            <p className="text-sm text-gray-500">
              Roles and their permission matrices
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-amber-500 text-white rounded-lg hover:bg-amber-600"
        >
          <Plus size={16} />
          New persona
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {personas === null && !error ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-amber-600" size={24} />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {personas?.map((p) => (
            <Link
              key={p.id}
              href={`/admin/personas/${p.id}`}
              className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{p.name}</span>
                  {p.isSystem && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                      <Lock size={10} /> System
                    </span>
                  )}
                  {p.status === 'ARCHIVED' && (
                    <span className="text-[10px] font-medium uppercase tracking-wide text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                      Archived
                    </span>
                  )}
                  {p.requiresApproval && (
                    <span className="text-[10px] font-medium uppercase tracking-wide text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                      Approval
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5 font-mono">{p.slug}</p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span className="text-xs text-gray-500">
                  {p.holderCount} holder{p.holderCount === 1 ? '' : 's'}
                </span>
                <span className="text-xs text-gray-500">
                  {p.permissions.length} perm{p.permissions.length === 1 ? '' : 's'}
                </span>
                <ChevronRight size={16} className="text-gray-400" />
              </div>
            </Link>
          ))}
          {personas?.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-gray-500">No personas yet.</p>
          )}
        </div>
      )}

      {showCreate && (
        <CreatePersonaModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
    </div>
  );
}

export default function PersonasPage() {
  return (
    <AdminGuard>
      <PersonasInner />
    </AdminGuard>
  );
}
