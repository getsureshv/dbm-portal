# Command Center — Future Development

Status: **Planned (not started).** Captured as a placeholder tab in the Messages
hub (`/chat` → "Command Center", shown with a "Soon" badge) so the direction is
visible in-product.

## Vision

A task-management command center that lives alongside messaging. The idea: keep
work, conversations, and follow-ups in one hub so users manage tasks without
leaving the place where the discussion happens.

This is the "command center" piece of the broader "Slack of sorts" messaging
roadmap:

- v1 — Project team chat ✅
- v2 — Realtime via SSE ✅
- v3 — Direct messages (talk to anyone) ✅
- (bell) — Live unread-DM indicator ✅
- **v6 — Command Center (task management) ← this doc**
- Other planned messaging: channels, AI participant (@mention assistant)

## Planned capabilities (initial scope)

1. **Tasks & assignments** — create tasks, assign to teammates, set due dates,
   track status (e.g. To do / In progress / Done) across all projects.
2. **Turn messages into tasks** — promote a direct message or a project comment
   into a tracked task in-place, preserving a link back to the conversation.
3. **Unified board** — one board / list view spanning projects, filterable by
   assignee, project, status, and due date.
4. **Reminders & follow-ups** — due-date reminders surfaced through the existing
   notification bell so nothing slips.

## Likely implementation sketch (to refine later)

- **Schema**: `Task` model (id, title, description?, status enum, dueAt?,
  assigneeId?, createdById, projectId? optional link, sourceMessageId? optional
  link to a ProjectMessage/DirectMessage, timestamps). Possibly a `TaskComment`
  or reuse existing notes pattern.
- **API**: new `tasks` module — CRUD, assign, status change, list with filters;
  reuse the in-process pub/sub + SSE pattern for realtime board updates.
- **Notifications**: feed unread/assigned/overdue counts into the notification
  bell (which today only counts unread DMs) so it becomes a true activity hub.
- **UI**: replace `CommandCenterPreview` in `apps/web/app/(auth)/chat/page.tsx`
  with the real board; "convert to task" actions in the chat bubble menus.

## Open questions

- Board vs. list as the default view?
- Are tasks always project-scoped, or can they be standalone/personal?
- Permissions: who can assign tasks to whom (tie into the existing record-grant
  / persona permission model)?
