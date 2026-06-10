'use client';

import { useEffect, useState } from 'react';
import { ClipboardCheck, Loader2, Check, Inbox } from 'lucide-react';
import { admin, ApiPendingApproval } from '../../../../lib/api';
import AdminGuard from '../AdminGuard';

function ApprovalsInner() {
  const [items, setItems] = useState<ApiPendingApproval[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    setItems(null);
    admin
      .pendingApprovals()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  };

  useEffect(load, []);

  const approve = async (a: ApiPendingApproval) => {
    const key = `${a.userId}:${a.personaId}`;
    setBusy(key);
    setError(null);
    try {
      await admin.approvePersona(a.userId, a.personaId);
      setItems((prev) =>
        (prev ?? []).filter((x) => !(x.userId === a.userId && x.personaId === a.personaId)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to approve');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
          <ClipboardCheck className="text-amber-600" size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pending approvals</h1>
          <p className="text-sm text-gray-500">
            Provider signups awaiting vetting before their persona activates
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {items === null && !error ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-amber-600" size={24} />
        </div>
      ) : items && items.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {items.map((a) => {
            const key = `${a.userId}:${a.personaId}`;
            return (
              <div key={key} className="flex items-center justify-between px-5 py-4 gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 text-sm">
                    {a.user.name || a.user.email}
                  </p>
                  <p className="text-xs text-gray-500">{a.user.email}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Requesting <span className="font-medium text-gray-600">{a.personaName}</span>{' '}
                    · {new Date(a.assignedAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => approve(a)}
                  disabled={busy === key}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60"
                >
                  {busy === key ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Check size={15} />
                  )}
                  Approve
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-16 text-center">
          <Inbox className="mx-auto text-gray-300 mb-3" size={32} />
          <p className="text-sm text-gray-500">No pending approvals. You&apos;re all caught up.</p>
        </div>
      )}
    </div>
  );
}

export default function ApprovalsPage() {
  return (
    <AdminGuard>
      <ApprovalsInner />
    </AdminGuard>
  );
}
