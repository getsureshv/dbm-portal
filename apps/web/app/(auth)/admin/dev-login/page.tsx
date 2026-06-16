'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wand2, Loader2, LogIn, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../../../lib/auth-context';
import AdminGuard from '../AdminGuard';

/**
 * Dev Login (admin-only, local/dev only).
 *
 * This tool used to live on the public /login page as "Dev Quick Login".
 * It was moved here so the public portal stays clean for external testers.
 *
 * The nav entry that links here is only rendered when Firebase is NOT
 * configured (see app/(auth)/layout.tsx), so it never appears on the
 * production portal. As a second guard, this page also refuses to run
 * when Firebase IS configured.
 */

type DevUser = {
  email: string;
  uid: string;
  label: string;
  group: string;
};

// Seeded dev/test accounts. uid must match the firebase_uid stored in the DB
// (dev mock pattern). The backend accepts the JSON mock token only when
// NODE_ENV=development.
const DEV_USERS: DevUser[] = [
  { email: 'getsureshv.ai@gmail.com', uid: 'dev-getsureshv.ai@gmail.com', label: 'Admin (you)', group: 'Admin' },
  { email: 'owner@test.com', uid: 'test-owner-uid', label: 'Project Owner', group: 'Client' },
  { email: 'pro@test.com', uid: 'test-pro-uid', label: 'Provider', group: 'Providers' },
  { email: 'electrician@test.com', uid: 'test-pro-2', label: 'Electrician', group: 'Providers' },
  { email: 'plumber@test.com', uid: 'test-pro-3', label: 'Plumber', group: 'Providers' },
  { email: 'hvac@test.com', uid: 'test-pro-4', label: 'HVAC', group: 'Providers' },
  { email: 'roofer@test.com', uid: 'test-pro-5', label: 'Roofer', group: 'Providers' },
  { email: 'painter@test.com', uid: 'test-pro-6', label: 'Painter', group: 'Providers' },
  { email: 'flooring@test.com', uid: 'test-pro-7', label: 'Flooring', group: 'Providers' },
  { email: 'concrete@test.com', uid: 'test-pro-8', label: 'Concrete', group: 'Providers' },
  { email: 'landscape@test.com', uid: 'test-pro-9', label: 'Landscape', group: 'Providers' },
  { email: 'architect@test.com', uid: 'test-pro-10', label: 'Architect', group: 'Providers' },
  { email: 'cabinets@test.com', uid: 'test-pro-11', label: 'Cabinets', group: 'Providers' },
  { email: 'pool@test.com', uid: 'test-pro-12', label: 'Pool', group: 'Providers' },
  { email: 'lumber@test.com', uid: 'test-supplier-1', label: 'Lumber Supplier', group: 'Suppliers' },
  { email: 'hardware@test.com', uid: 'test-supplier-2', label: 'Hardware Supplier', group: 'Suppliers' },
];

function DevLoginInner() {
  const { devLogin, firebaseReady, user } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Hard stop: never allow this when Firebase auth is live.
  if (firebaseReady) {
    return (
      <div className="max-w-md mx-auto mt-24 text-center px-6">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="text-red-500" size={24} />
        </div>
        <h1 className="text-lg font-semibold text-gray-900">Disabled</h1>
        <p className="text-sm text-gray-500 mt-1">
          Dev Login is only available in local/development mode. Firebase auth is
          active in this environment.
        </p>
      </div>
    );
  }

  const loginAs = async (u: DevUser) => {
    setBusy(u.email);
    setError(null);
    try {
      await devLogin(u.email, u.uid);
      router.replace('/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
      setBusy(null);
    }
  };

  const groups = Array.from(new Set(DEV_USERS.map((u) => u.group)));

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
          <Wand2 className="text-amber-600" size={20} />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Dev Login</h1>
          <p className="text-sm text-gray-500">
            Switch your session to any seeded test account for local testing.
          </p>
        </div>
      </div>

      <div className="mb-6 flex items-center gap-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        <span className="font-semibold uppercase tracking-wide">Local only</span>
        <span className="text-amber-700">
          This tool is hidden on the production portal. You are currently signed in as{' '}
          <span className="font-semibold">{user?.email}</span>.
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group}>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
              {group}
            </h2>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {DEV_USERS.filter((u) => u.group === group).map((u) => (
                <button
                  key={u.email}
                  onClick={() => loginAs(u)}
                  disabled={!!busy}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-left transition hover:border-amber-400 hover:bg-amber-50 disabled:opacity-50"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-gray-900">
                      {u.label}
                    </span>
                    <span className="block truncate text-xs text-gray-500">
                      {u.email}
                    </span>
                  </span>
                  {busy === u.email ? (
                    <Loader2 className="shrink-0 animate-spin text-amber-600" size={16} />
                  ) : (
                    <LogIn className="shrink-0 text-gray-400" size={16} />
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DevLoginPage() {
  return (
    <AdminGuard>
      <DevLoginInner />
    </AdminGuard>
  );
}
