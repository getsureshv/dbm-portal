'use client';

import { ShieldAlert, Loader2 } from 'lucide-react';
import { useAuth } from '../../../lib/auth-context';

/**
 * Client-side admin gate for the admin section (PR8). The API already enforces
 * the central can() check on every /admin/* route, so this is a UX convenience
 * (hide the screens, don't rely on it for security).
 */
export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center py-24">
        <Loader2 className="animate-spin text-amber-600" size={28} />
      </div>
    );
  }

  if (user?.role !== 'ADMIN') {
    return (
      <div className="max-w-md mx-auto mt-24 text-center px-6">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="text-red-500" size={24} />
        </div>
        <h1 className="text-lg font-semibold text-gray-900">Admins only</h1>
        <p className="text-sm text-gray-500 mt-1">
          You don&apos;t have permission to view this area.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
