'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { dm as dmApi } from '../../lib/api';

// Notification bell in the top bar. Shows a live count of unread direct
// messages (summed across all conversations). The dot/badge only appears when
// there's something unread \u2014 no more always-on indicator. Clicking opens the
// Messages page. Updates in realtime via the DM inbox SSE stream, with a 30s
// polling fallback if SSE isn't available.
export default function NotificationBell() {
  const router = useRouter();
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const threads = await dmApi.listThreads();
      const total = threads.reduce((sum, t) => sum + (t.unreadCount || 0), 0);
      setUnread(total);
    } catch {
      // ignore transient errors; keep the last known count
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime: any inbox ping (new message, read-state change) re-totals the
  // unread count. Fall back to polling on SSE error / unsupported.
  useEffect(() => {
    let es: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (poll) return;
      poll = setInterval(refresh, 30000);
    };

    es = dmApi.streamInbox();
    if (!es) {
      startPolling();
    } else {
      es.addEventListener('inbox', () => refresh());
      es.onerror = () => {
        es?.close();
        es = null;
        startPolling();
      };
    }
    return () => {
      es?.close();
      if (poll) clearInterval(poll);
    };
  }, [refresh]);

  const hasUnread = unread > 0;
  const label = unread > 99 ? '99+' : String(unread);

  return (
    <button
      onClick={() => router.push('/chat')}
      className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
      aria-label={
        hasUnread ? `${unread} unread direct messages` : 'Notifications'
      }
      title={hasUnread ? `${unread} unread message${unread === 1 ? '' : 's'}` : 'No new messages'}
    >
      <Bell size={20} />
      {hasUnread && (
        <span
          className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-semibold leading-none flex items-center justify-center ${
            unread > 9 ? 'px-1' : ''
          }`}
        >
          {label}
        </span>
      )}
    </button>
  );
}
