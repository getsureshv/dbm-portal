'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { dm as dmApi, channels as channelsApi, tasks as tasksApi } from '../../lib/api';

// Notification bell in the top bar. Shows a live rollup count across the
// collaboration surfaces: unread direct messages + unread channel messages +
// open/overdue tasks assigned to the user. The badge only appears when there's
// something to surface \u2014 no always-on indicator. Clicking opens the Messages
// page. Updates in realtime via the DM + channel inbox SSE streams and the task
// stream, with a 30s polling fallback if SSE isn't available.
export default function NotificationBell() {
  const router = useRouter();
  const [dmUnread, setDmUnread] = useState(0);
  const [channelUnread, setChannelUnread] = useState(0);
  const [taskCount, setTaskCount] = useState(0);

  const refreshDms = useCallback(async () => {
    try {
      const threads = await dmApi.listThreads();
      setDmUnread(threads.reduce((sum, t) => sum + (t.unreadCount || 0), 0));
    } catch {
      // ignore transient errors; keep the last known count
    }
  }, []);

  const refreshChannels = useCallback(async () => {
    try {
      const list = await channelsApi.list();
      setChannelUnread(list.reduce((sum, c) => sum + (c.unreadCount || 0), 0));
    } catch {
      // ignore
    }
  }, []);

  const refreshTasks = useCallback(async () => {
    try {
      const counts = await tasksApi.counts();
      setTaskCount((counts.assignedOpen || 0) + (counts.overdue || 0));
    } catch {
      // ignore
    }
  }, []);

  const refreshAll = useCallback(() => {
    refreshDms();
    refreshChannels();
    refreshTasks();
  }, [refreshDms, refreshChannels, refreshTasks]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Realtime: subscribe to all three streams; each ping re-totals its slice.
  // Fall back to a single 30s poll of everything on SSE error / unsupported.
  useEffect(() => {
    const sources: EventSource[] = [];
    let poll: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (poll) return;
      poll = setInterval(refreshAll, 30000);
    };

    const dmEs = dmApi.streamInbox();
    if (dmEs) {
      dmEs.addEventListener('inbox', () => refreshDms());
      dmEs.onerror = () => {
        dmEs.close();
        startPolling();
      };
      sources.push(dmEs);
    } else {
      startPolling();
    }

    const chEs = channelsApi.streamInbox();
    if (chEs) {
      chEs.addEventListener('inbox', () => refreshChannels());
      chEs.onerror = () => {
        chEs.close();
        startPolling();
      };
      sources.push(chEs);
    } else {
      startPolling();
    }

    const tkEs = tasksApi.stream();
    if (tkEs) {
      tkEs.addEventListener('tasks-changed', () => refreshTasks());
      // backend may emit a generic message event too
      tkEs.onmessage = () => refreshTasks();
      tkEs.onerror = () => {
        tkEs.close();
        startPolling();
      };
      sources.push(tkEs);
    } else {
      startPolling();
    }

    return () => {
      sources.forEach((s) => s.close());
      if (poll) clearInterval(poll);
    };
  }, [refreshAll, refreshDms, refreshChannels, refreshTasks]);

  const unread = dmUnread + channelUnread + taskCount;
  const hasUnread = unread > 0;
  const label = unread > 99 ? '99+' : String(unread);

  const titleParts: string[] = [];
  if (dmUnread > 0) titleParts.push(`${dmUnread} message${dmUnread === 1 ? '' : 's'}`);
  if (channelUnread > 0)
    titleParts.push(`${channelUnread} channel update${channelUnread === 1 ? '' : 's'}`);
  if (taskCount > 0) titleParts.push(`${taskCount} task${taskCount === 1 ? '' : 's'}`);
  const title = hasUnread ? titleParts.join(' \u00b7 ') : 'Nothing new';

  return (
    <button
      onClick={() => router.push('/chat')}
      className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
      aria-label={hasUnread ? title : 'Notifications'}
      title={title}
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
