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
  LayoutGrid,
  Hash,
  Lock,
  AlertCircle,
  Calendar as CalendarIcon,
  Compass,
} from 'lucide-react';
import { useAuth } from '../../../lib/auth-context';
import {
  projects as projectsApi,
  dm as dmApi,
  channels as channelsApi,
  tasks as tasksApi,
  aiParticipant as aiApi,
} from '../../../lib/api';
import type {
  ApiProject,
  ApiDmThread,
  ApiDmMessage,
  ApiDmUser,
  ApiChannel,
  ApiChannelMessage,
  ApiTask,
  TaskStatus,
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

type TopTab = 'dms' | 'channels' | 'ai' | 'command';

const TABS: { key: TopTab; label: string; icon: typeof MessageSquare }[] = [
  { key: 'dms', label: 'Direct Messages', icon: MessageSquare },
  { key: 'channels', label: 'Channels', icon: Hash },
  { key: 'ai', label: 'AI Scope Architect', icon: Bot },
  { key: 'command', label: 'Command Center', icon: LayoutGrid },
];

export default function ChatPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TopTab>('dms');

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
        <p className="text-gray-500 mt-1">
          Direct messages, channels, AI conversations, and your task command
          center — all in one place.
        </p>
      </div>

      {/* Top tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                active
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={16} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'dms' ? (
        <DirectMessages currentUserId={user?.id ?? null} />
      ) : tab === 'channels' ? (
        <Channels currentUserId={user?.id ?? null} />
      ) : tab === 'ai' ? (
        <ScopeLauncher />
      ) : (
        <CommandCenter currentUserId={user?.id ?? null} />
      )}
    </div>
  );
}

// ---- Command Center (task management) --------------------------------------
// A real task board living alongside messages. Lists tasks grouped by status,
// supports create / assign / due-date / status changes / delete, filters by
// status & project, and updates in realtime via the tasks SSE stream.

const TASK_COLUMNS: { status: TaskStatus; label: string; accent: string }[] = [
  { status: 'TODO', label: 'To do', accent: 'bg-gray-400' },
  { status: 'IN_PROGRESS', label: 'In progress', accent: 'bg-blue-500' },
  { status: 'DONE', label: 'Done', accent: 'bg-green-500' },
];

function isOverdue(t: ApiTask): boolean {
  if (!t.dueAt || t.status === 'DONE') return false;
  return new Date(t.dueAt).getTime() < Date.now();
}

function formatDue(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year:
      new Date(iso).getFullYear() === new Date().getFullYear()
        ? undefined
        : 'numeric',
  });
}

function CommandCenter({ currentUserId }: { currentUserId: string | null }) {
  const [allTasks, setAllTasks] = useState<ApiTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [mineOnly, setMineOnly] = useState(false);
  const [people, setPeople] = useState<ApiDmUser[]>([]);
  const [projectOptions, setProjectOptions] = useState<ApiProject[]>([]);

  const load = useCallback(async () => {
    try {
      const data = await tasksApi.list();
      setAllTasks(data);
    } catch {
      // ignore transient
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // people directory (for assignee picker) + projects (for project picker)
    dmApi.directory().then(setPeople).catch(() => {});
    projectsApi.list().then(setProjectOptions).catch(() => {});
  }, [load]);

  // Realtime board updates.
  useEffect(() => {
    let es: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (poll) return;
      poll = setInterval(load, 15000);
    };
    es = tasksApi.stream();
    if (!es) {
      startPolling();
    } else {
      es.addEventListener('tasks-changed', () => load());
      es.onmessage = () => load();
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
  }, [load]);

  const filtered = allTasks.filter((t) => {
    if (projectFilter && t.projectId !== projectFilter) return false;
    if (mineOnly) {
      const isMine =
        t.assigneeId === currentUserId ||
        t.assignments.some((a) => a.userId === currentUserId);
      if (!isMine) return false;
    }
    return true;
  });

  const updateStatus = async (task: ApiTask, status: TaskStatus) => {
    setAllTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status } : t)),
    );
    try {
      await tasksApi.update(task.id, { status });
    } catch {
      load();
    }
  };

  const updateAssignees = async (task: ApiTask, assigneeIds: string[]) => {
    try {
      await tasksApi.update(task.id, { assigneeIds });
      load();
    } catch {
      // ignore
    }
  };

  const completePart = async (task: ApiTask, done: boolean) => {
    try {
      await tasksApi.complete(task.id, done);
      load();
    } catch {
      load();
    }
  };

  const forceComplete = async (task: ApiTask) => {
    try {
      await tasksApi.forceComplete(task.id);
      load();
    } catch {
      load();
    }
  };

  const remove = async (task: ApiTask) => {
    setAllTasks((prev) => prev.filter((t) => t.id !== task.id));
    try {
      await tasksApi.remove(task.id);
    } catch {
      load();
    }
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 bg-amber-500 text-white px-3.5 py-2 rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
        >
          <Plus size={16} />
          New task
        </button>

        <label className="inline-flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={mineOnly}
            onChange={(e) => setMineOnly(e.target.checked)}
            className="rounded border-gray-300 text-amber-500 focus:ring-amber-200"
          />
          Assigned to me
        </label>

        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 bg-white focus:outline-none focus:border-amber-500"
        >
          <option value="">All projects</option>
          {projectOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>

        <span className="text-xs text-gray-400 ml-auto">
          {filtered.length} task{filtered.length === 1 ? '' : 's'}
        </span>
      </div>

      {showCreate && (
        <CreateTaskForm
          people={people}
          projects={projectOptions}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-amber-500" size={28} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TASK_COLUMNS.map((col) => {
            const colTasks = filtered.filter((t) => t.status === col.status);
            return (
              <div
                key={col.status}
                className="bg-gray-50 border border-gray-200 rounded-2xl p-3 flex flex-col min-h-[200px]"
              >
                <div className="flex items-center gap-2 px-1 pb-3">
                  <span className={`w-2 h-2 rounded-full ${col.accent}`} />
                  <span className="text-sm font-semibold text-gray-700">
                    {col.label}
                  </span>
                  <span className="text-xs text-gray-400">
                    {colTasks.length}
                  </span>
                </div>
                <div className="space-y-2 flex-1">
                  {colTasks.length === 0 ? (
                    <p className="text-xs text-gray-400 px-1 py-4 text-center">
                      No tasks
                    </p>
                  ) : (
                    colTasks.map((t) => (
                      <TaskCard
                        key={t.id}
                        task={t}
                        people={people}
                        currentUserId={currentUserId}
                        onStatus={(s) => updateStatus(t, s)}
                        onAssignees={(ids) => updateAssignees(t, ids)}
                        onCompletePart={(done) => completePart(t, done)}
                        onForceComplete={() => forceComplete(t)}
                        onDelete={() => remove(t)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateTaskForm({
  people,
  projects,
  onClose,
  onCreated,
}: {
  people: ApiDmUser[];
  projects: ApiProject[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [projectId, setProjectId] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [saving, setSaving] = useState(false);

  const toggleAssignee = (id: string) => {
    setAssigneeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await tasksApi.create({
        title: title.trim(),
        description: description.trim() || undefined,
        assigneeIds,
        projectId: projectId || null,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      });
      onCreated();
    } catch {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="bg-white border border-amber-200 rounded-2xl p-4 mb-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">New task</p>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title"
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        rows={2}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
      />
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">
          Assign to{assigneeIds.length > 0 ? ` (${assigneeIds.length})` : ' (optional)'}
        </p>
        <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
          {people.length === 0 ? (
            <p className="text-xs text-gray-400 px-3 py-3">No people found.</p>
          ) : (
            people.map((u) => (
              <label
                key={u.id}
                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0"
              >
                <input
                  type="checkbox"
                  checked={assigneeIds.includes(u.id)}
                  onChange={() => toggleAssignee(u.id)}
                  className="rounded border-gray-300 text-amber-500 focus:ring-amber-200"
                />
                <span className="text-sm text-gray-700">{userLabel(u)}</span>
              </label>
            ))
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-2 text-gray-700 bg-white focus:outline-none focus:border-amber-500"
        >
          <option value="">No project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-2 text-gray-700 bg-white focus:outline-none focus:border-amber-500"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!title.trim() || saving}
          className="inline-flex items-center gap-1.5 bg-amber-500 text-white px-3.5 py-1.5 rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
        >
          {saving ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
          Create
        </button>
      </div>
    </form>
  );
}

function TaskCard({
  task,
  people,
  currentUserId,
  onStatus,
  onAssignees,
  onCompletePart,
  onForceComplete,
  onDelete,
}: {
  task: ApiTask;
  people: ApiDmUser[];
  currentUserId: string | null;
  onStatus: (s: TaskStatus) => void;
  onAssignees: (ids: string[]) => void;
  onCompletePart: (done: boolean) => void;
  onForceComplete: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editAssignees, setEditAssignees] = useState(false);
  const overdue = isOverdue(task);

  const assignments = task.assignments ?? [];
  const total = assignments.length;
  const doneCount = assignments.filter((a) => a.completedAt !== null).length;
  const isCreator = currentUserId != null && task.createdById === currentUserId;
  const myAssignment = assignments.find((a) => a.userId === currentUserId);
  const iAmDone = !!myAssignment?.completedAt;
  const allDone = total > 0 && doneCount === total;

  const toggleAssignee = (id: string) => {
    const ids = assignments.map((a) => a.userId);
    const next = ids.includes(id)
      ? ids.filter((x) => x !== id)
      : [...ids, id];
    onAssignees(next);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 group">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-900 break-words flex-1">
          {task.title}
        </p>
        {confirmDelete ? (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={onDelete}
              className="text-[11px] text-red-600 hover:text-red-700 font-medium"
            >
              Delete
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-[11px] text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-gray-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            aria-label="Delete task"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {task.description && (
        <p className="text-xs text-gray-500 mt-1 break-words">
          {task.description}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-2.5">
        {task.project && (
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
            <LayoutGrid size={10} />
            {task.project.title}
          </span>
        )}
        {task.dueAt && (
          <span
            className={`inline-flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 ${
              overdue
                ? 'bg-red-50 text-red-600'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            {overdue ? <AlertCircle size={10} /> : <CalendarIcon size={10} />}
            {formatDue(task.dueAt)}
          </span>
        )}
        {total > 0 && (
          <span
            className={`inline-flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 ${
              allDone
                ? 'bg-green-50 text-green-600'
                : 'bg-amber-50 text-amber-700'
            }`}
          >
            {allDone ? <Check size={10} /> : <Users size={10} />}
            {doneCount}/{total} done
          </span>
        )}
      </div>

      {/* Assignee avatars — completed assignees get a green ring + check. */}
      {total > 0 && (
        <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
          {assignments.map((a) => {
            const done = a.completedAt !== null;
            return (
              <span
                key={a.id}
                title={`${userLabel(a.user)}${done ? ' — done' : ' — pending'}`}
                className={`relative inline-flex items-center justify-center w-6 h-6 rounded-full text-[9px] font-semibold ${
                  done
                    ? 'bg-green-100 text-green-700 ring-1 ring-green-400'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {userInitials(a.user)}
                {done && (
                  <span className="absolute -bottom-0.5 -right-0.5 bg-green-500 text-white rounded-full w-3 h-3 flex items-center justify-center">
                    <Check size={8} />
                  </span>
                )}
              </span>
            );
          })}
        </div>
      )}

      {/* Action row */}
      <div className="flex flex-wrap items-center gap-2 mt-2.5">
        {myAssignment && (
          <button
            onClick={() => onCompletePart(!iAmDone)}
            className={`inline-flex items-center gap-1 text-[11px] rounded-md px-2 py-1 font-medium ${
              iAmDone
                ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                : 'bg-green-500 text-white hover:bg-green-600'
            }`}
          >
            <Check size={11} />
            {iAmDone ? 'Undo my part' : 'Mark my part done'}
          </button>
        )}
        {isCreator && total > 0 && !allDone && (
          <button
            onClick={onForceComplete}
            className="inline-flex items-center gap-1 text-[11px] rounded-md px-2 py-1 font-medium bg-navy text-white hover:bg-navy-dark"
          >
            <Check size={11} />
            Force complete
          </button>
        )}
        <button
          onClick={() => setEditAssignees((v) => !v)}
          className="inline-flex items-center gap-1 text-[11px] rounded-md px-2 py-1 text-gray-500 hover:bg-gray-100 ml-auto"
        >
          <Users size={11} />
          {total > 0 ? 'Edit' : 'Assign'}
        </button>
      </div>

      {/* Manual status control only matters for tasks with no assignees. */}
      {total === 0 && (
        <div className="flex items-center mt-2.5">
          <select
            value={task.status}
            onChange={(e) => onStatus(e.target.value as TaskStatus)}
            className="text-[11px] border border-gray-200 rounded-md px-1.5 py-1 text-gray-600 bg-white focus:outline-none focus:border-amber-500 ml-auto"
          >
            {TASK_COLUMNS.map((c) => (
              <option key={c.status} value={c.status}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Inline multi-assignee editor. */}
      {editAssignees && (
        <div className="mt-2 border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
          {people.length === 0 ? (
            <p className="text-xs text-gray-400 px-3 py-3">No people found.</p>
          ) : (
            people.map((u) => {
              const checked = assignments.some((a) => a.userId === u.id);
              return (
                <label
                  key={u.id}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleAssignee(u.id)}
                    className="rounded border-gray-300 text-amber-500 focus:ring-amber-200"
                  />
                  <span className="text-xs text-gray-700">{userLabel(u)}</span>
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ---- Channels (v4) ---------------------------------------------------------
// Group / topic rooms. Left rail lists my channels + a discover view to join
// public ones and a create form. Right pane is a realtime message thread that
// supports @assistant / @ai mentions to bring in the AI participant.

function Channels({ currentUserId }: { currentUserId: string | null }) {
  const [myChannels, setMyChannels] = useState<ApiChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'discover' | 'create'>('list');

  const load = useCallback(async () => {
    try {
      setMyChannels(await channelsApi.list());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime inbox refresh.
  useEffect(() => {
    let es: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (poll) return;
      poll = setInterval(load, 15000);
    };
    es = channelsApi.streamInbox();
    if (!es) {
      startPolling();
    } else {
      es.addEventListener('inbox', () => load());
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
  }, [load]);

  const active = myChannels.find((c) => c.id === activeId) ?? null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 h-[640px]">
      {/* Left rail */}
      <div
        className={`bg-white border border-gray-200 rounded-2xl flex flex-col overflow-hidden ${
          activeId && 'hidden md:flex'
        }`}
      >
        <div className="p-3 border-b border-gray-100 flex items-center justify-between">
          <span className="font-semibold text-gray-900 text-sm">Channels</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView('discover')}
              className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              <Compass size={14} />
              Discover
            </button>
            <button
              onClick={() => setView('create')}
              className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700"
            >
              <Plus size={14} />
              New
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="animate-spin text-amber-500" size={22} />
            </div>
          ) : myChannels.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Hash className="text-gray-300 mx-auto mb-2" size={28} />
              <p className="text-sm text-gray-500">No channels yet.</p>
              <button
                onClick={() => setView('create')}
                className="mt-3 text-sm font-medium text-amber-600 hover:text-amber-700"
              >
                Create a channel
              </button>
            </div>
          ) : (
            myChannels.map((c) => {
              const isActive = c.id === activeId;
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setActiveId(c.id);
                    setView('list');
                  }}
                  className={`w-full text-left px-3 py-3 flex items-start gap-3 border-b border-gray-50 transition-colors ${
                    isActive ? 'bg-amber-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                    {c.isPrivate ? <Lock size={16} /> : <Hash size={16} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-gray-900 text-sm truncate">
                        {c.name}
                      </span>
                      {c.lastMessage && (
                        <span className="text-[11px] text-gray-400 flex-shrink-0">
                          {formatTimestamp(c.lastMessage.createdAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="text-xs text-gray-500 truncate">
                        {c.lastMessage
                          ? (c.lastMessage.isAi ? 'AI: ' : '') +
                            c.lastMessage.body
                          : c.description || 'No messages yet'}
                      </span>
                      {(c.unreadCount ?? 0) > 0 && (
                        <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1.5 rounded-full bg-amber-500 text-white text-[11px] font-semibold flex items-center justify-center">
                          {c.unreadCount}
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

      {/* Right pane */}
      <div
        className={`bg-white border border-gray-200 rounded-2xl flex flex-col overflow-hidden ${
          !activeId && view === 'list' && 'hidden md:flex'
        }`}
      >
        {view === 'create' ? (
          <CreateChannelForm
            onCancel={() => setView('list')}
            onCreated={(ch) => {
              setMyChannels((prev) =>
                prev.some((c) => c.id === ch.id) ? prev : [ch, ...prev],
              );
              setActiveId(ch.id);
              setView('list');
              load();
            }}
          />
        ) : view === 'discover' ? (
          <DiscoverChannels
            myIds={myChannels.map((c) => c.id)}
            onCancel={() => setView('list')}
            onJoined={(ch) => {
              setMyChannels((prev) =>
                prev.some((c) => c.id === ch.id) ? prev : [ch, ...prev],
              );
              setActiveId(ch.id);
              setView('list');
              load();
            }}
          />
        ) : active ? (
          <ChannelView
            key={active.id}
            channel={active}
            currentUserId={currentUserId}
            onBack={() => setActiveId(null)}
            onActivity={load}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mb-3">
              <Hash className="text-amber-500" size={26} />
            </div>
            <p className="text-gray-900 font-medium">Select a channel</p>
            <p className="text-gray-500 text-sm mt-1 max-w-xs">
              Pick a channel from the list, discover public ones to join, or
              create a new one. Mention @assistant in any channel to bring in
              the AI.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function CreateChannelForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (ch: ApiChannel) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [people, setPeople] = useState<ApiDmUser[]>([]);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dmApi.directory().then(setPeople).catch(() => {});
  }, []);

  const toggleMember = (id: string) => {
    setMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const ch = await channelsApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
        isPrivate,
        memberIds: memberIds.length ? memberIds : undefined,
      });
      onCreated(ch);
    } catch {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-100 flex items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          aria-label="Cancel"
        >
          <X size={16} />
        </button>
        <span className="font-semibold text-gray-900 text-sm">New channel</span>
      </div>
      <div className="p-4 space-y-3 flex-1 overflow-y-auto">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Channel name (e.g. design, permits-team)"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
        />
        <label className="inline-flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            className="rounded border-gray-300 text-amber-500 focus:ring-amber-200"
          />
          Private channel (invite only)
        </label>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">
            Add members (optional)
          </p>
          <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
            {people.length === 0 ? (
              <p className="text-xs text-gray-400 px-3 py-3">No people found.</p>
            ) : (
              people.map((u) => (
                <label
                  key={u.id}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0"
                >
                  <input
                    type="checkbox"
                    checked={memberIds.includes(u.id)}
                    onChange={() => toggleMember(u.id)}
                    className="rounded border-gray-300 text-amber-500 focus:ring-amber-200"
                  />
                  <span className="text-sm text-gray-700">{userLabel(u)}</span>
                </label>
              ))
            )}
          </div>
        </div>
      </div>
      <div className="p-3 border-t border-gray-100 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!name.trim() || saving}
          className="inline-flex items-center gap-1.5 bg-amber-500 text-white px-3.5 py-1.5 rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
        >
          {saving ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
          Create
        </button>
      </div>
    </form>
  );
}

function DiscoverChannels({
  myIds,
  onCancel,
  onJoined,
}: {
  myIds: string[];
  onCancel: () => void;
  onJoined: (ch: ApiChannel) => void;
}) {
  const [list, setList] = useState<ApiChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);

  useEffect(() => {
    channelsApi
      .discover()
      .then(setList)
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, []);

  const join = async (id: string) => {
    setJoining(id);
    try {
      const ch = await channelsApi.join(id);
      onJoined(ch);
    } catch {
      setJoining(null);
    }
  };

  const available = list.filter((c) => !myIds.includes(c.id));

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
        <span className="font-semibold text-gray-900 text-sm">
          Discover channels
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-amber-500" size={20} />
          </div>
        ) : available.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-12">
            No public channels to join right now.
          </p>
        ) : (
          available.map((c) => (
            <div
              key={c.id}
              className="px-3 py-3 flex items-center gap-3 border-b border-gray-50"
            >
              <div className="w-9 h-9 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center flex-shrink-0">
                <Hash size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {c.name}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {c.description ||
                    `${c.memberCount ?? 0} member${
                      (c.memberCount ?? 0) === 1 ? '' : 's'
                    }`}
                </p>
              </div>
              <button
                onClick={() => join(c.id)}
                disabled={joining === c.id}
                className="text-xs font-medium text-amber-600 hover:text-amber-700 disabled:opacity-50 flex items-center gap-1"
              >
                {joining === c.id ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <Plus size={14} />
                )}
                Join
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ChannelView({
  channel,
  currentUserId,
  onBack,
  onActivity,
}: {
  channel: ApiChannel;
  currentUserId: string | null;
  onBack: () => void;
  onActivity: () => void;
}) {
  const channelId = channel.id;
  const [messages, setMessages] = useState<ApiChannelMessage[]>([]);
  const messagesRef = useRef<ApiChannelMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  messagesRef.current = messages;

  const scrollToBottom = (smooth = false) => {
    const el = scrollRef.current;
    if (el)
      el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const data = await channelsApi.listMessages(channelId);
        if (!active) return;
        setMessages(data);
        setTimeout(() => scrollToBottom(false), 0);
        await channelsApi.markRead(channelId);
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
  }, [channelId]);

  useEffect(() => {
    let es: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;

    const apply = (msg: ApiChannelMessage) => {
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === msg.id);
        if (idx === -1) return [...prev, msg];
        const next = [...prev];
        next[idx] = msg;
        return next;
      });
      if (msg.isAi) setAiThinking(false);
      setTimeout(() => scrollToBottom(true), 0);
      channelsApi.markRead(channelId).then(onActivity).catch(() => {});
    };

    const startPolling = () => {
      if (poll) return;
      poll = setInterval(async () => {
        const cur = messagesRef.current;
        const lastId = cur.length ? cur[cur.length - 1].id : undefined;
        try {
          const fresh = await channelsApi.listMessages(channelId, lastId);
          if (fresh.length > 0) {
            setMessages((prev) => {
              const seen = new Set(prev.map((m) => m.id));
              return [...prev, ...fresh.filter((m) => !seen.has(m.id))];
            });
            if (fresh.some((m) => m.isAi)) setAiThinking(false);
            setTimeout(() => scrollToBottom(true), 0);
            channelsApi.markRead(channelId).then(onActivity).catch(() => {});
          }
        } catch {
          // transient
        }
      }, 5000);
    };

    es = channelsApi.streamChannel(channelId);
    if (!es) {
      startPolling();
    } else {
      const handle = (e: Event) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          if (data?.message) apply(data.message);
        } catch {
          /* ignore */
        }
      };
      es.addEventListener('created', handle);
      es.addEventListener('updated', handle);
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
  }, [channelId]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setDraft('');
    const mentionsAi = /@(assistant|ai)\b/i.test(body);
    try {
      const created = await channelsApi.addMessage(channelId, body);
      setMessages((prev) =>
        prev.some((m) => m.id === created.id) ? prev : [...prev, created],
      );
      setTimeout(() => scrollToBottom(true), 0);
      onActivity();
      if (mentionsAi) {
        setAiThinking(true);
        aiApi
          .mentionInChannel(channelId, body)
          .then((aiMsg) => {
            setMessages((prev) =>
              prev.some((m) => m.id === aiMsg.id) ? prev : [...prev, aiMsg],
            );
            setAiThinking(false);
            setTimeout(() => scrollToBottom(true), 0);
          })
          .catch(() => setAiThinking(false));
      }
    } catch {
      setDraft(body);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-100 flex items-center gap-3">
        <button
          onClick={onBack}
          className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
          {channel.isPrivate ? <Lock size={16} /> : <Hash size={16} />}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">
            {channel.name}
          </p>
          {channel.description && (
            <p className="text-xs text-gray-400 truncate">
              {channel.description}
            </p>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-amber-500" size={22} />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Hash className="text-gray-300 mb-2" size={28} />
            <p className="text-sm text-gray-500">
              This is the start of #{channel.name}. Say hello — or mention
              @assistant to bring in the AI.
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const own = !m.isAi && m.authorId === currentUserId;
            return (
              <div
                key={m.id}
                className={`flex items-end gap-2 ${
                  own ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0 ${
                    m.isAi
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {m.isAi ? <Bot size={14} /> : userInitials(m.author)}
                </div>
                <div
                  className={`max-w-[75%] ${
                    own ? 'items-end' : 'items-start'
                  } flex flex-col`}
                >
                  {!own && (
                    <span className="text-[11px] text-gray-400 px-1 mb-0.5">
                      {m.isAi ? 'AI Assistant' : userLabel(m.author)}
                    </span>
                  )}
                  <div
                    className={`rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words ${
                      m.isAi
                        ? 'bg-amber-50 text-gray-900 border border-amber-100 rounded-bl-sm'
                        : own
                          ? 'bg-amber-500 text-white rounded-br-sm'
                          : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                    }`}
                  >
                    {m.body}
                  </div>
                  <span className="text-[11px] text-gray-400 mt-1 px-1">
                    {formatTimestamp(m.createdAt)}
                  </span>
                </div>
              </div>
            );
          })
        )}
        {aiThinking && (
          <div className="flex items-center gap-2 text-gray-400 text-xs px-1">
            <Bot size={14} className="text-amber-500" />
            <Loader2 className="animate-spin" size={12} />
            AI Assistant is thinking…
          </div>
        )}
      </div>

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
          placeholder={`Message #${channel.name}  \u2014  @assistant for AI`}
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
