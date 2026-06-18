'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageSquare,
  Search,
  Loader2,
  ArrowRight,
  Bot,
  Calendar,
  FileText,
  Sparkles,
  Send,
  Pencil,
  Trash2,
  Check,
  X,
  Users,
  Plus,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '../../../lib/auth-context';
import {
  projects as projectsApi,
  dm as dmApi,
} from '../../../lib/api';
import type {
  ApiProject,
  ApiDmThread,
  ApiDmMessage,
  ApiDmUser,
} from '../../../lib/api';

// ---- small shared helpers --------------------------------------------------

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMin = Math.round((now.getTime() - d.getTime()) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function userLabel(u: { name?: string | null; email: string } | null): string {
  if (!u) return 'Unknown user';
  return u.name?.trim() || u.email;
}

function userInitials(u: { name?: string | null; email: string } | null): string {
  if (!u) return '?';
  const base = u.name?.trim() || u.email;
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

// ---- page ------------------------------------------------------------------

type TopTab = 'dms' | 'ai';

export default function ChatPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TopTab>('dms');

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
        <p className="text-gray-500 mt-1">
          Direct messages with your team and AI Scope Architect conversations.
        </p>
      </div>

      {/* Top tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 mb-6">
        <button
          onClick={() => setTab('dms')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'dms'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <MessageSquare size={16} />
          Direct Messages
        </button>
        <button
          onClick={() => setTab('ai')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'ai'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Bot size={16} />
          AI Scope Architect
        </button>
      </div>

      {tab === 'dms' ? (
        <DirectMessages currentUserId={user?.id ?? null} />
      ) : (
        <ScopeLauncher />
      )}
    </div>
  );
}

// ---- Direct Messages -------------------------------------------------------

function DirectMessages({ currentUserId }: { currentUserId: string | null }) {
  const [threads, setThreads] = useState<ApiDmThread[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [showNewMessage, setShowNewMessage] = useState(false);

  const loadThreads = useCallback(async () => {
    try {
      const data = await dmApi.listThreads();
      setThreads(data);
    } catch {
      // ignore transient
    } finally {
      setLoadingThreads(false);
    }
  }, []);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  // Realtime inbox: re-fetch the conversation list whenever any thread changes
  // (new message in/out, read state). Falls back to 15s polling on SSE error.
  useEffect(() => {
    let es: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (poll) return;
      poll = setInterval(() => {
        loadThreads();
      }, 15000);
    };

    es = dmApi.streamInbox();
    if (!es) {
      startPolling();
    } else {
      es.addEventListener('inbox', () => loadThreads());
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
  }, [loadThreads]);

  const activeThread = threads.find((t) => t.id === activeThreadId) ?? null;

  const openThread = (threadId: string) => {
    setActiveThreadId(threadId);
    setShowNewMessage(false);
  };

  const handleStartedThread = async (thread: ApiDmThread) => {
    // Insert/replace in the list and open it.
    setThreads((prev) => {
      const exists = prev.some((t) => t.id === thread.id);
      return exists ? prev : [thread, ...prev];
    });
    setActiveThreadId(thread.id);
    setShowNewMessage(false);
    loadThreads();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 h-[640px]">
      {/* Conversation list */}
      <div
        className={`bg-white border border-gray-200 rounded-2xl flex flex-col overflow-hidden ${
          activeThreadId && 'hidden md:flex'
        }`}
      >
        <div className="p-3 border-b border-gray-100 flex items-center justify-between">
          <span className="font-semibold text-gray-900 text-sm">
            Conversations
          </span>
          <button
            onClick={() => {
              setShowNewMessage(true);
              setActiveThreadId(null);
            }}
            className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700"
          >
            <Plus size={14} />
            New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingThreads ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="animate-spin text-amber-500" size={22} />
            </div>
          ) : threads.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Users className="text-gray-300 mx-auto mb-2" size={28} />
              <p className="text-sm text-gray-500">No conversations yet.</p>
              <button
                onClick={() => setShowNewMessage(true)}
                className="mt-3 text-sm font-medium text-amber-600 hover:text-amber-700"
              >
                Start a new message
              </button>
            </div>
          ) : (
            threads.map((t) => {
              const isActive = t.id === activeThreadId;
              return (
                <button
                  key={t.id}
                  onClick={() => openThread(t.id)}
                  className={`w-full text-left px-3 py-3 flex items-start gap-3 border-b border-gray-50 transition-colors ${
                    isActive ? 'bg-amber-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                    {userInitials(t.otherUser)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-gray-900 text-sm truncate">
                        {userLabel(t.otherUser)}
                      </span>
                      {t.lastMessageAt && (
                        <span className="text-[11px] text-gray-400 flex-shrink-0">
                          {formatTimestamp(t.lastMessageAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="text-xs text-gray-500 truncate">
                        {t.lastMessage
                          ? (t.lastMessage.senderId === currentUserId
                              ? 'You: '
                              : '') + t.lastMessage.body
                          : 'No messages yet'}
                      </span>
                      {t.unreadCount > 0 && (
                        <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1.5 rounded-full bg-amber-500 text-white text-[11px] font-semibold flex items-center justify-center">
                          {t.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right pane: new-message picker, thread, or empty state */}
      <div
        className={`bg-white border border-gray-200 rounded-2xl flex flex-col overflow-hidden ${
          !activeThreadId && !showNewMessage && 'hidden md:flex'
        }`}
      >
        {showNewMessage ? (
          <NewMessagePicker
            onCancel={() => setShowNewMessage(false)}
            onStarted={handleStartedThread}
          />
        ) : activeThread ? (
          <ThreadView
            key={activeThread.id}
            thread={activeThread}
            currentUserId={currentUserId}
            onBack={() => setActiveThreadId(null)}
            onActivity={loadThreads}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mb-3">
              <MessageSquare className="text-amber-500" size={26} />
            </div>
            <p className="text-gray-900 font-medium">Select a conversation</p>
            <p className="text-gray-500 text-sm mt-1 max-w-xs">
              Choose someone from the list or start a new message to begin a
              direct conversation.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- New message: user directory picker ------------------------------------

function NewMessagePicker({
  onCancel,
  onStarted,
}: {
  onCancel: () => void;
  onStarted: (thread: ApiDmThread) => void;
}) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ApiDmUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const data = await dmApi.directory(search || undefined);
        if (active) setResults(data);
      } catch {
        if (active) setResults([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [search]);

  const start = async (userId: string) => {
    setStarting(userId);
    try {
      const thread = await dmApi.startThread(userId);
      onStarted(thread);
    } catch {
      setStarting(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-100 flex items-center gap-2">
        <button
          onClick={onCancel}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          aria-label="Cancel"
        >
          <X size={16} />
        </button>
        <span className="font-semibold text-gray-900 text-sm">New message</span>
      </div>
      <div className="p-3 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
          <input
            autoFocus
            type="text"
            placeholder="Search people by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-amber-500" size={20} />
          </div>
        ) : results.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-12">
            No matching people.
          </p>
        ) : (
          results.map((u) => (
            <button
              key={u.id}
              onClick={() => start(u.id)}
              disabled={starting === u.id}
              className="w-full text-left px-3 py-3 flex items-center gap-3 border-b border-gray-50 hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              <div className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                {userInitials(u)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {userLabel(u)}
                </p>
                {u.name && (
                  <p className="text-xs text-gray-400 truncate">{u.email}</p>
                )}
              </div>
              {starting === u.id ? (
                <Loader2 className="animate-spin text-amber-500" size={16} />
              ) : (
                <ArrowRight className="text-gray-300" size={16} />
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ---- Thread view -----------------------------------------------------------

function ThreadView({
  thread,
  currentUserId,
  onBack,
  onActivity,
}: {
  thread: ApiDmThread;
  currentUserId: string | null;
  onBack: () => void;
  onActivity: () => void;
}) {
  const threadId = thread.id;
  const [messages, setMessages] = useState<ApiDmMessage[]>([]);
  const messagesRef = useRef<ApiDmMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  messagesRef.current = messages;

  const scrollToBottom = (smooth = false) => {
    const el = scrollRef.current;
    if (el)
      el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  };

  // Initial load + mark read.
  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const data = await dmApi.listMessages(threadId);
        if (!active) return;
        setMessages(data);
        setTimeout(() => scrollToBottom(false), 0);
        await dmApi.markRead(threadId);
        onActivity();
      } catch {
        // ignore
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  // Realtime stream with polling fallback.
  useEffect(() => {
    let es: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;

    const apply = (msg: ApiDmMessage) => {
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === msg.id);
        if (idx === -1) return [...prev, msg];
        const next = [...prev];
        next[idx] = msg;
        return next;
      });
      setTimeout(() => scrollToBottom(true), 0);
      // A new inbound message means we should mark read (thread is open).
      if (msg.senderId !== currentUserId) {
        dmApi.markRead(threadId).then(onActivity).catch(() => {});
      }
    };

    const startPolling = () => {
      if (poll) return;
      poll = setInterval(async () => {
        const cur = messagesRef.current;
        const lastId = cur.length ? cur[cur.length - 1].id : undefined;
        try {
          const fresh = await dmApi.listMessages(threadId, lastId);
          if (fresh.length > 0) {
            setMessages((prev) => {
              const seen = new Set(prev.map((m) => m.id));
              return [...prev, ...fresh.filter((m) => !seen.has(m.id))];
            });
            setTimeout(() => scrollToBottom(true), 0);
            dmApi.markRead(threadId).then(onActivity).catch(() => {});
          }
        } catch {
          // transient
        }
      }, 5000);
    };

    es = dmApi.streamThread(threadId);
    if (!es) {
      startPolling();
    } else {
      es.addEventListener('created', (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          if (data?.message) apply(data.message);
        } catch {
          /* ignore */
        }
      });
      es.addEventListener('updated', (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          if (data?.message) apply(data.message);
        } catch {
          /* ignore */
        }
      });
      es.addEventListener('deleted', (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          if (data?.messageId) {
            setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
          }
        } catch {
          /* ignore */
        }
      });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, currentUserId]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setDraft('');
    try {
      const created = await dmApi.addMessage(threadId, body);
      setMessages((prev) =>
        prev.some((m) => m.id === created.id) ? prev : [...prev, created],
      );
      setTimeout(() => scrollToBottom(true), 0);
      onActivity();
    } catch {
      setDraft(body); // restore on failure
    } finally {
      setSending(false);
    }
  };

  const saveEdit = async (messageId: string) => {
    const body = editDraft.trim();
    if (!body) return;
    try {
      const updated = await dmApi.updateMessage(threadId, messageId, body);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? updated : m)),
      );
    } catch {
      // ignore
    } finally {
      setEditingId(null);
      setEditDraft('');
    }
  };

  const remove = async (messageId: string) => {
    try {
      await dmApi.deleteMessage(threadId, messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch {
      // ignore
    } finally {
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-gray-100 flex items-center gap-3">
        <button
          onClick={onBack}
          className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-semibold">
          {userInitials(thread.otherUser)}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">
            {userLabel(thread.otherUser)}
          </p>
          {thread.otherUser?.name && (
            <p className="text-xs text-gray-400 truncate">
              {thread.otherUser.email}
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-amber-500" size={22} />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="text-gray-300 mb-2" size={28} />
            <p className="text-sm text-gray-500">
              No messages yet. Say hello to {userLabel(thread.otherUser)}.
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const own = m.senderId === currentUserId;
            const edited = m.updatedAt !== m.createdAt;
            const isEditing = editingId === m.id;
            return (
              <div
                key={m.id}
                className={`flex items-end gap-2 group ${
                  own ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                <div className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">
                  {userInitials(m.sender)}
                </div>
                <div
                  className={`max-w-[75%] ${own ? 'items-end' : 'items-start'} flex flex-col`}
                >
                  {isEditing ? (
                    <div className="w-full">
                      <textarea
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        rows={2}
                        className="w-full text-sm border border-amber-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-amber-100"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            saveEdit(m.id);
                          }
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        autoFocus
                      />
                      <div className="flex gap-2 mt-1 justify-end">
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => saveEdit(m.id)}
                          className="text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 rounded px-2 py-1 inline-flex items-center gap-1"
                        >
                          <Check size={12} />
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words ${
                        own
                          ? 'bg-amber-500 text-white rounded-br-sm'
                          : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                      }`}
                    >
                      {m.body}
                    </div>
                  )}
                  <div
                    className={`flex items-center gap-2 mt-1 px-1 ${
                      own ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    <span className="text-[11px] text-gray-400">
                      {formatTimestamp(m.createdAt)}
                      {edited && ' (edited)'}
                    </span>
                    {own && !isEditing && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {confirmDeleteId === m.id ? (
                          <>
                            <button
                              onClick={() => remove(m.id)}
                              className="text-[11px] text-red-600 hover:text-red-700 font-medium"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-[11px] text-gray-400 hover:text-gray-600"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setEditingId(m.id);
                                setEditDraft(m.body);
                              }}
                              className="text-gray-400 hover:text-amber-600"
                              aria-label="Edit"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(m.id)}
                              className="text-gray-400 hover:text-red-600"
                              aria-label="Delete"
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={send}
        className="p-3 border-t border-gray-100 flex items-end gap-2"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(e);
            }
          }}
          rows={1}
          placeholder={`Message ${userLabel(thread.otherUser)}...`}
          className="flex-1 resize-none bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 max-h-32"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          className="bg-amber-500 text-white rounded-xl p-2.5 hover:bg-amber-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Send"
        >
          {sending ? (
            <Loader2 className="animate-spin" size={18} />
          ) : (
            <Send size={18} />
          )}
        </button>
      </form>
    </div>
  );
}

// ---- AI Scope Architect launcher (existing behavior) -----------------------

function ScopeLauncher() {
  const { user } = useAuth();
  const router = useRouter();
  const [projectList, setProjectList] = useState<ApiProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await projectsApi.list();
        setProjectList(data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = projectList.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase()),
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DISCOVERY':
        return 'bg-blue-100 text-blue-700';
      case 'BIDDING':
        return 'bg-amber-100 text-amber-700';
      case 'CONTRACTING':
        return 'bg-purple-100 text-purple-700';
      case 'EXECUTION':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getScopeProgress = (project: ApiProject) =>
    project.scopeDocument?.completenessPercent ?? 0;

  return (
    <div>
      <div className="relative mb-6">
        <Search className="absolute left-3 top-3 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 transition-colors"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-amber-500" size={28} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="text-amber-500" size={28} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {search ? 'No matching projects' : 'No conversations yet'}
          </h3>
          <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
            {search
              ? 'Try a different search term.'
              : 'Create a project and start talking to the AI Scope Architect to build your scope of work.'}
          </p>
          {!search && user?.role === 'OWNER' && (
            <button
              onClick={() => router.push('/projects/new')}
              className="inline-flex items-center gap-2 bg-amber-500 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-amber-600 transition-colors"
            >
              <Sparkles size={16} />
              Create a Project
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((project) => {
            const progress = getScopeProgress(project);
            const hasScope = progress > 0;
            const scopeStatus = project.scopeDocument?.status ?? 'DRAFT';

            return (
              <button
                key={project.id}
                onClick={() => router.push(`/projects/${project.id}/scope`)}
                className="w-full bg-white border border-gray-200 rounded-xl p-5 hover:border-amber-300 hover:shadow-md transition-all text-left group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-amber-100 transition-colors">
                      <Bot className="text-amber-600" size={20} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {project.title}
                      </h3>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${getStatusColor(project.status)}`}
                        >
                          {project.status}
                        </span>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Calendar size={12} />
                          {new Date(project.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                      {hasScope && (
                        <div className="flex items-center gap-2 mt-2.5">
                          <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">
                            {progress}% complete
                          </span>
                          {scopeStatus === 'COMPLETE' && (
                            <FileText size={12} className="text-green-500" />
                          )}
                        </div>
                      )}
                      {!hasScope && (
                        <p className="text-xs text-gray-400 mt-2">
                          Start a conversation to build your scope of work
                        </p>
                      )}
                    </div>
                  </div>
                  <ArrowRight
                    size={18}
                    className="text-gray-300 group-hover:text-amber-500 transition-colors flex-shrink-0 mt-2"
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
