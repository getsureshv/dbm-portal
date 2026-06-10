'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Loader2, Search, ChevronRight, ShieldAlert } from 'lucide-react';
import { admin, ApiUserListItem } from '../../../../lib/api';
import AdminGuard from '../AdminGuard';

const ROLE_FILTERS = [
  { value: 'ALL', label: 'All roles' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'OWNER', label: 'Owner / Client' },
  { value: 'PROVIDER', label: 'Provider' },
];

function roleBadge(role: string | null) {
  const map: Record<string, string> = {
    ADMIN: 'text-amber-700 bg-amber-50 border border-amber-200',
    OWNER: 'text-blue-700 bg-blue-50 border border-blue-200',
    PROVIDER: 'text-emerald-700 bg-emerald-50 border border-emerald-200',
  };
  return map[role ?? ''] ?? 'text-gray-500 bg-gray-100 border border-gray-200';
}

function UsersListInner() {
  const router = useRouter();
  const [users, setUsers] = useState<ApiUserListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('ALL');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await admin.listUsers();
      setUsers(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Client-side filtering for instant feedback (the API also supports server-side filters).
  const filtered = useMemo(() => {
    if (!users) return [];
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (role !== 'ALL' && u.role !== role) return false;
      if (!q) return true;
      return (
        u.email.toLowerCase().includes(q) ||
        (u.name ?? '').toLowerCase().includes(q)
      );
    });
  }, [users, search, role]);

  const openUser = (u: ApiUserListItem) => {
    router.push(`/admin/users?lookup=${encodeURIComponent(u.email)}`);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
          <Users className="text-amber-600" size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500">
            Everyone registered in the portal — click a user to manage their personas
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-5">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email or name"
            className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
          />
        </div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none bg-white"
        >
          {ROLE_FILTERS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4 flex items-center gap-2">
          <ShieldAlert size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-amber-500" size={24} />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="hidden sm:grid grid-cols-12 gap-3 px-5 py-2.5 bg-gray-50 border-b border-gray-100 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            <div className="col-span-5">User</div>
            <div className="col-span-2">Role</div>
            <div className="col-span-4">Personas</div>
            <div className="col-span-1 text-right">Joined</div>
          </div>
          <div className="divide-y divide-gray-100">
            {filtered.map((u) => (
              <button
                key={u.id}
                onClick={() => openUser(u)}
                className="w-full text-left grid grid-cols-1 sm:grid-cols-12 gap-1 sm:gap-3 px-5 py-3.5 hover:bg-amber-50/40 transition-colors items-center group"
              >
                <div className="sm:col-span-5 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">
                    {u.name || u.email}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{u.email}</p>
                </div>
                <div className="sm:col-span-2">
                  <span
                    className={`inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${roleBadge(
                      u.role,
                    )}`}
                  >
                    {u.role ?? '—'}
                  </span>
                  {u.providerType && (
                    <span className="block text-[11px] text-gray-400 mt-0.5">
                      {u.providerType}
                    </span>
                  )}
                </div>
                <div className="sm:col-span-4 flex flex-wrap gap-1.5 items-center">
                  {u.personas.filter((p) => p.status === 'ACTIVE').length === 0 &&
                  u.pendingCount === 0 ? (
                    <span className="text-xs text-gray-400">No personas</span>
                  ) : (
                    <>
                      {u.personas
                        .filter((p) => p.status === 'ACTIVE')
                        .map((p) => (
                          <span
                            key={p.personaId}
                            className="text-[11px] font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded"
                          >
                            {p.name}
                          </span>
                        ))}
                      {u.pendingCount > 0 && (
                        <span className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                          {u.pendingCount} pending
                        </span>
                      )}
                    </>
                  )}
                </div>
                <div className="sm:col-span-1 flex items-center justify-between sm:justify-end gap-2">
                  <span className="text-xs text-gray-400">
                    {new Date(u.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <ChevronRight
                    size={16}
                    className="text-gray-300 group-hover:text-amber-500"
                  />
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-5 py-12 text-center text-sm text-gray-500">
                {users && users.length > 0
                  ? 'No users match your filters.'
                  : 'No users found.'}
              </p>
            )}
          </div>
        </div>
      )}

      {users && (
        <p className="text-xs text-gray-400 mt-3">
          Showing {filtered.length} of {users.length} user
          {users.length === 1 ? '' : 's'}
        </p>
      )}
    </div>
  );
}

export default function UsersListPage() {
  return (
    <AdminGuard>
      <UsersListInner />
    </AdminGuard>
  );
}
