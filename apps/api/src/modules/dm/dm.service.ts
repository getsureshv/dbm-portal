import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { normalizeOriginal } from '../../common/translate-on-send';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Realtime DM events.
// - Thread channel (keyed by threadId): message create/update/delete inside a
//   single conversation, consumed by whoever has that thread open.
// - Inbox channel (keyed by userId): lightweight "your conversation list
//   changed" pings so the sidebar can re-sort / update unread badges live.
export type DmThreadEvent =
  | { type: 'created'; message: any }
  | { type: 'updated'; message: any }
  | { type: 'deleted'; messageId: string };

export type DmInboxEvent = { type: 'inbox'; threadId: string };

type Subscriber<T> = (event: T) => void;

@Injectable()
export class DmService {
  // Same in-process pub/sub approach as project chat: fine on a single Render
  // instance, and the client keeps a polling fallback so multi-instance stays
  // correct (just not instant) if we ever scale out.
  private threadSubscribers = new Map<string, Set<Subscriber<DmThreadEvent>>>();
  private inboxSubscribers = new Map<string, Set<Subscriber<DmInboxEvent>>>();

  constructor(
    private prisma: PrismaService,
    private attachments: AttachmentsService,
  ) {}

  // Shape attachments for the wire (no raw object URLs).
  private mapAttachments(list: any[] | undefined) {
    return (list ?? []).map((a) => this.attachments.toPublic(a));
  }

  private validateUuid(id: string) {
    if (!UUID_REGEX.test(id)) {
      throw new BadRequestException('Invalid ID format');
    }
  }

  // Order a pair of user ids canonically so each pair maps to exactly one row.
  private orderPair(a: string, b: string): { userAId: string; userBId: string } {
    return a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a };
  }

  // ---- pub/sub -------------------------------------------------------------

  subscribeToThread(
    threadId: string,
    subscriber: Subscriber<DmThreadEvent>,
  ): () => void {
    return this.addSubscriber(this.threadSubscribers, threadId, subscriber);
  }

  subscribeToInbox(
    userId: string,
    subscriber: Subscriber<DmInboxEvent>,
  ): () => void {
    return this.addSubscriber(this.inboxSubscribers, userId, subscriber);
  }

  private addSubscriber<T>(
    map: Map<string, Set<Subscriber<T>>>,
    key: string,
    subscriber: Subscriber<T>,
  ): () => void {
    let set = map.get(key);
    if (!set) {
      set = new Set();
      map.set(key, set);
    }
    set.add(subscriber);
    return () => {
      const current = map.get(key);
      if (!current) return;
      current.delete(subscriber);
      if (current.size === 0) map.delete(key);
    };
  }

  private publish<T>(map: Map<string, Set<Subscriber<T>>>, key: string, event: T) {
    const set = map.get(key);
    if (!set || set.size === 0) return;
    for (const subscriber of set) {
      try {
        subscriber(event);
      } catch {
        // ignore broken subscriber; cleaned up on disconnect
      }
    }
  }

  // ---- directory -----------------------------------------------------------

  // Everyone in the system is reachable. Returns all users except the caller,
  // with an optional case-insensitive name/email search.
  async listDirectory(currentUserId: string, search?: string) {
    const term = search?.trim();
    const users = await this.prisma.user.findMany({
      where: {
        id: { not: currentUserId },
        ...(term
          ? {
              OR: [
                { name: { contains: term, mode: 'insensitive' } },
                { email: { contains: term, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: { id: true, name: true, email: true, role: true },
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
      take: 50,
    });
    return users;
  }

  // ---- threads -------------------------------------------------------------

  // Get the existing thread with `otherUserId`, or create it. Returns the
  // thread plus the other participant's public profile.
  async getOrCreateThread(currentUserId: string, otherUserId: string) {
    this.validateUuid(otherUserId);
    if (otherUserId === currentUserId) {
      throw new BadRequestException('Cannot start a conversation with yourself');
    }

    const other = await this.prisma.user.findUnique({
      where: { id: otherUserId },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!other) throw new NotFoundException('User not found');

    const { userAId, userBId } = this.orderPair(currentUserId, otherUserId);
    const thread = await this.prisma.directThread.upsert({
      where: { userAId_userBId: { userAId, userBId } },
      create: { userAId, userBId },
      update: {},
    });

    return this.decorateThread(thread, currentUserId);
  }

  // List all conversations for the caller, most-recent first, each with the
  // other participant, a last-message preview, and an unread count.
  async listThreads(currentUserId: string) {
    const threads = await this.prisma.directThread.findMany({
      where: {
        OR: [{ userAId: currentUserId }, { userBId: currentUserId }],
        // Only surface threads that have at least one message OR were just
        // created by this user opening them (lastMessageAt null + brand new is
        // fine to show so the user sees the conversation they just opened).
      },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });

    return Promise.all(
      threads.map((t) => this.decorateThread(t, currentUserId, true)),
    );
  }

  // Resolve the "other" participant and unread state for a thread row.
  private async decorateThread(
    thread: {
      id: string;
      userAId: string;
      userBId: string;
      userALastRead: Date | null;
      userBLastRead: Date | null;
      lastMessageAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    },
    currentUserId: string,
    includePreview = false,
  ) {
    const isA = thread.userAId === currentUserId;
    const otherId = isA ? thread.userBId : thread.userAId;
    const lastRead = isA ? thread.userALastRead : thread.userBLastRead;

    const other = await this.prisma.user.findUnique({
      where: { id: otherId },
      select: { id: true, name: true, email: true, role: true },
    });

    // Unread = messages from the other person created after my lastRead.
    const unreadCount = await this.prisma.directMessage.count({
      where: {
        threadId: thread.id,
        senderId: { not: currentUserId },
        ...(lastRead ? { createdAt: { gt: lastRead } } : {}),
      },
    });

    let lastMessage: any = null;
    if (includePreview) {
      lastMessage = await this.prisma.directMessage.findFirst({
        where: { threadId: thread.id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          body: true,
          senderId: true,
          createdAt: true,
        },
      });
    }

    return {
      id: thread.id,
      otherUser: other,
      lastMessageAt: thread.lastMessageAt,
      unreadCount,
      lastMessage,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
    };
  }

  // Confirm the caller is one of the thread's two participants. Returns the row.
  private async getThreadForUserOrThrow(threadId: string, userId: string) {
    this.validateUuid(threadId);
    const thread = await this.prisma.directThread.findUnique({
      where: { id: threadId },
    });
    if (
      !thread ||
      (thread.userAId !== userId && thread.userBId !== userId)
    ) {
      // 404 (not 403) so we don't leak the existence of threads you're not in.
      throw new NotFoundException('Conversation not found');
    }
    return thread;
  }

  // ---- messages ------------------------------------------------------------

  // Oldest-first. `after` is a message id cursor for polling: returns messages
  // created strictly after that message.
  async listMessages(threadId: string, userId: string, after?: string) {
    await this.getThreadForUserOrThrow(threadId, userId);

    let createdAfter: Date | undefined;
    if (after) {
      this.validateUuid(after);
      const cursor = await this.prisma.directMessage.findUnique({
        where: { id: after },
        select: { createdAt: true, threadId: true },
      });
      if (cursor && cursor.threadId === threadId) {
        createdAfter = cursor.createdAt;
      }
    }

    const messages = await this.prisma.directMessage.findMany({
      where: {
        threadId,
        ...(createdAfter ? { createdAt: { gt: createdAfter } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: { select: { id: true, name: true, email: true } },
        attachments: { orderBy: { createdAt: 'asc' } },
      },
    });
    return messages.map((m) => ({
      ...m,
      attachments: this.mapAttachments(m.attachments),
    }));
  }

  async addMessage(
    threadId: string,
    userId: string,
    body: string,
    attachmentIds?: string[],
    original?: { originalBody?: string; originalLang?: string },
  ) {
    const thread = await this.getThreadForUserOrThrow(threadId, userId);

    const text = (body ?? '').trim();
    const hasAttachments = !!attachmentIds && attachmentIds.length > 0;
    if (!text && !hasAttachments) {
      throw new BadRequestException(
        'A message must have text or at least one attachment.',
      );
    }

    const { originalBody, originalLang } = normalizeOriginal(text, original);

    const message = await this.prisma.directMessage.create({
      data: { threadId, senderId: userId, body: text, originalBody, originalLang },
      include: { sender: { select: { id: true, name: true, email: true } } },
    });

    let linked: any[] = [];
    if (hasAttachments) {
      linked = await this.attachments.linkToMessage(attachmentIds!, userId, {
        directMessageId: message.id,
      });
    }
    const withAttachments = {
      ...message,
      attachments: this.mapAttachments(linked),
    };

    // Bump the thread's last-message marker and treat the sender as caught up.
    const isA = thread.userAId === userId;
    await this.prisma.directThread.update({
      where: { id: threadId },
      data: {
        lastMessageAt: message.createdAt,
        ...(isA
          ? { userALastRead: message.createdAt }
          : { userBLastRead: message.createdAt }),
      },
    });

    // Realtime fan-out: thread subscribers get the message; both participants'
    // inboxes get a ping so their conversation lists re-sort / re-badge.
    this.publish(this.threadSubscribers, threadId, {
      type: 'created',
      message: withAttachments,
    });
    this.publish(this.inboxSubscribers, thread.userAId, {
      type: 'inbox',
      threadId,
    });
    this.publish(this.inboxSubscribers, thread.userBId, {
      type: 'inbox',
      threadId,
    });

    return withAttachments;
  }

  private async getOwnMessageOrThrow(
    threadId: string,
    messageId: string,
    userId: string,
  ) {
    this.validateUuid(messageId);
    const message = await this.prisma.directMessage.findUnique({
      where: { id: messageId },
    });
    if (!message || message.threadId !== threadId) {
      throw new NotFoundException('Message not found');
    }
    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only modify your own messages');
    }
    return message;
  }

  async updateMessage(
    threadId: string,
    messageId: string,
    userId: string,
    body: string,
  ) {
    const thread = await this.getThreadForUserOrThrow(threadId, userId);
    await this.getOwnMessageOrThrow(threadId, messageId, userId);

    const message = await this.prisma.directMessage.update({
      where: { id: messageId },
      data: { body },
      include: {
        sender: { select: { id: true, name: true, email: true } },
        attachments: { orderBy: { createdAt: 'asc' } },
      },
    });
    const withAttachments = {
      ...message,
      attachments: this.mapAttachments(message.attachments),
    };

    this.publish(this.threadSubscribers, threadId, {
      type: 'updated',
      message: withAttachments,
    });
    this.publish(this.inboxSubscribers, thread.userAId, {
      type: 'inbox',
      threadId,
    });
    this.publish(this.inboxSubscribers, thread.userBId, {
      type: 'inbox',
      threadId,
    });

    return withAttachments;
  }

  async deleteMessage(threadId: string, messageId: string, userId: string) {
    const thread = await this.getThreadForUserOrThrow(threadId, userId);
    await this.getOwnMessageOrThrow(threadId, messageId, userId);

    await this.prisma.directMessage.delete({ where: { id: messageId } });

    this.publish(this.threadSubscribers, threadId, {
      type: 'deleted',
      messageId,
    });
    this.publish(this.inboxSubscribers, thread.userAId, {
      type: 'inbox',
      threadId,
    });
    this.publish(this.inboxSubscribers, thread.userBId, {
      type: 'inbox',
      threadId,
    });
  }

  // Mark the thread read up to now for the caller. Returns the new unread (0).
  async markRead(threadId: string, userId: string) {
    const thread = await this.getThreadForUserOrThrow(threadId, userId);
    const isA = thread.userAId === userId;
    await this.prisma.directThread.update({
      where: { id: threadId },
      data: isA ? { userALastRead: new Date() } : { userBLastRead: new Date() },
    });
    // Ping the caller's own inbox so their unread badge clears live across tabs.
    this.publish(this.inboxSubscribers, userId, { type: 'inbox', threadId });
    return { ok: true };
  }
}
