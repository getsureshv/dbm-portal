import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreateChannelDto } from './dto/channel.dto';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Realtime channel events.
// - Channel subscribers (keyed by channelId): message create/update/delete for
//   users who have that channel open.
// - Inbox subscribers (keyed by userId): lightweight "channel list changed"
//   pings so the sidebar can re-sort / update unread badges live.
export type ChannelMessageEvent =
  | { type: 'created'; message: any }
  | { type: 'updated'; message: any }
  | { type: 'deleted'; messageId: string };

export type ChannelInboxEvent = { type: 'inbox'; channelId: string };

type Subscriber<T> = (event: T) => void;

const USER_SELECT = { select: { id: true, name: true, email: true } } as const;

@Injectable()
export class ChannelsService {
  // In-process pub/sub — same pattern as DmService.
  private channelSubscribers = new Map<
    string,
    Set<Subscriber<ChannelMessageEvent>>
  >();
  private inboxSubscribers = new Map<
    string,
    Set<Subscriber<ChannelInboxEvent>>
  >();

  constructor(private prisma: PrismaService) {}

  private validateUuid(id: string) {
    if (!UUID_REGEX.test(id)) {
      throw new BadRequestException('Invalid ID format');
    }
  }

  // ---- pub/sub ---------------------------------------------------------------

  subscribeToChannel(
    channelId: string,
    subscriber: Subscriber<ChannelMessageEvent>,
  ): () => void {
    return this.addSubscriber(this.channelSubscribers, channelId, subscriber);
  }

  subscribeToInbox(
    userId: string,
    subscriber: Subscriber<ChannelInboxEvent>,
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

  private publish<T>(
    map: Map<string, Set<Subscriber<T>>>,
    key: string,
    event: T,
  ) {
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

  // Publish an inbox ping to every member of a channel.
  private async publishInboxToAllMembers(channelId: string) {
    const memberIds = await this.getMemberIds(channelId);
    for (const userId of memberIds) {
      this.publish(this.inboxSubscribers, userId, {
        type: 'inbox',
        channelId,
      });
    }
  }

  // ---- membership helpers ----------------------------------------------------

  /** Returns the list of user IDs who are members of the channel. */
  async getMemberIds(channelId: string): Promise<string[]> {
    const members = await this.prisma.channelMember.findMany({
      where: { channelId },
      select: { userId: true },
    });
    return members.map((m) => m.userId);
  }

  /** Throws 403/404 if the user is not a member of a private channel, or 404
   *  if the channel does not exist at all. */
  private async assertMemberOrThrow(channelId: string, userId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });
    if (!channel) throw new NotFoundException('Channel not found');

    const membership = await this.prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });

    if (channel.isPrivate && !membership) {
      throw new ForbiddenException('You are not a member of this channel');
    }
    return { channel, membership };
  }

  /** Like assertMemberOrThrow but always requires membership (for write ops). */
  private async requireMembership(channelId: string, userId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });
    if (!channel) throw new NotFoundException('Channel not found');

    const membership = await this.prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this channel');
    }
    return { channel, membership };
  }

  // ---- channels --------------------------------------------------------------

  async createChannel(userId: string, dto: CreateChannelDto) {
    const channel = await this.prisma.channel.create({
      data: {
        name: dto.name,
        description: dto.description,
        isPrivate: dto.isPrivate ?? false,
        createdById: userId,
      },
    });

    // Dedupe: always include the creator, plus any extra memberIds.
    const rawIds = [userId, ...(dto.memberIds ?? [])];
    const uniqueIds = [...new Set(rawIds)];

    await Promise.all(
      uniqueIds.map((id) =>
        this.prisma.channelMember.upsert({
          where: { channelId_userId: { channelId: channel.id, userId: id } },
          create: { channelId: channel.id, userId: id },
          update: {},
        }),
      ),
    );

    return this.prisma.channel.findUnique({
      where: { id: channel.id },
      include: {
        members: {
          include: { user: USER_SELECT },
        },
      },
    });
  }

  async listChannels(userId: string) {
    // All channels where the user is a member.
    const memberships = await this.prisma.channelMember.findMany({
      where: { userId },
      include: {
        channel: {
          include: {
            _count: { select: { members: true } },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { author: USER_SELECT },
            },
          },
        },
      },
    });

    // Build response, computing unreadCount per channel.
    const results = await Promise.all(
      memberships.map(async (m) => {
        const { channel, lastReadAt } = m;
        const lastMessage = channel.messages[0] ?? null;

        const unreadCount = await this.prisma.channelMessage.count({
          where: {
            channelId: channel.id,
            authorId: { not: userId },
            ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
          },
        });

        const sortKey =
          lastMessage?.createdAt ?? channel.createdAt;

        return {
          id: channel.id,
          name: channel.name,
          description: channel.description,
          isPrivate: channel.isPrivate,
          createdById: channel.createdById,
          createdAt: channel.createdAt,
          updatedAt: channel.updatedAt,
          memberCount: channel._count.members,
          lastMessage,
          unreadCount,
          _sortKey: sortKey,
        };
      }),
    );

    // Sort by latest activity descending.
    results.sort(
      (a, b) =>
        new Date(b._sortKey).getTime() - new Date(a._sortKey).getTime(),
    );

    return results.map(({ _sortKey, ...rest }) => rest);
  }

  async listPublicChannels(userId: string) {
    // Public channels where the user is NOT a member.
    const memberOfIds = await this.prisma.channelMember.findMany({
      where: { userId },
      select: { channelId: true },
    });
    const memberOfSet = memberOfIds.map((m) => m.channelId);

    const channels = await this.prisma.channel.findMany({
      where: {
        isPrivate: false,
        id: { notIn: memberOfSet.length > 0 ? memberOfSet : [''] },
      },
      include: {
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return channels.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      isPrivate: c.isPrivate,
      createdById: c.createdById,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      memberCount: c._count.members,
    }));
  }

  async getChannel(channelId: string, userId: string) {
    this.validateUuid(channelId);
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        members: {
          include: { user: USER_SELECT },
        },
      },
    });
    if (!channel) throw new NotFoundException('Channel not found');

    if (channel.isPrivate) {
      const membership = await this.prisma.channelMember.findUnique({
        where: { channelId_userId: { channelId, userId } },
      });
      if (!membership) {
        throw new ForbiddenException('You are not a member of this channel');
      }
    }

    return channel;
  }

  async joinChannel(channelId: string, userId: string) {
    this.validateUuid(channelId);
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });
    if (!channel) throw new NotFoundException('Channel not found');

    if (channel.isPrivate) {
      // Must already be invited (have an existing membership).
      const membership = await this.prisma.channelMember.findUnique({
        where: { channelId_userId: { channelId, userId } },
      });
      if (!membership) {
        throw new ForbiddenException(
          'Cannot join a private channel without an invitation',
        );
      }
      return { ok: true };
    }

    // Idempotent upsert for public channels.
    await this.prisma.channelMember.upsert({
      where: { channelId_userId: { channelId, userId } },
      create: { channelId, userId },
      update: {},
    });
    return { ok: true };
  }

  async leaveChannel(channelId: string, userId: string) {
    this.validateUuid(channelId);
    await this.prisma.channelMember.deleteMany({
      where: { channelId, userId },
    });
    return { ok: true };
  }

  async addMembers(
    channelId: string,
    userId: string,
    userIds: string[],
  ) {
    this.validateUuid(channelId);
    // Only existing members may add others.
    await this.requireMembership(channelId, userId);

    const unique = [...new Set(userIds)];
    await Promise.all(
      unique.map((id) =>
        this.prisma.channelMember.upsert({
          where: { channelId_userId: { channelId, userId: id } },
          create: { channelId, userId: id },
          update: {},
        }),
      ),
    );
    return { ok: true, added: unique.length };
  }

  // ---- messages --------------------------------------------------------------

  async listMessages(
    channelId: string,
    userId: string,
    after?: string,
  ) {
    this.validateUuid(channelId);
    await this.requireMembership(channelId, userId);

    let createdAfter: Date | undefined;
    if (after) {
      this.validateUuid(after);
      const cursor = await this.prisma.channelMessage.findUnique({
        where: { id: after },
        select: { createdAt: true, channelId: true },
      });
      if (cursor && cursor.channelId === channelId) {
        createdAfter = cursor.createdAt;
      }
    }

    return this.prisma.channelMessage.findMany({
      where: {
        channelId,
        ...(createdAfter ? { createdAt: { gt: createdAfter } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      include: { author: USER_SELECT },
    });
  }

  async addMessage(channelId: string, userId: string, body: string) {
    this.validateUuid(channelId);
    await this.requireMembership(channelId, userId);

    const message = await this.prisma.channelMessage.create({
      data: { channelId, authorId: userId, body, isAi: false },
      include: { author: USER_SELECT },
    });

    // Bump sender's lastReadAt so they don't see their own message as unread.
    await this.prisma.channelMember.update({
      where: { channelId_userId: { channelId, userId } },
      data: { lastReadAt: message.createdAt },
    });

    this.publish(this.channelSubscribers, channelId, {
      type: 'created',
      message,
    });
    await this.publishInboxToAllMembers(channelId);

    return message;
  }

  /** Used by the AI module to post an AI-generated message to a channel. */
  async addAiMessage(channelId: string, body: string) {
    this.validateUuid(channelId);

    const message = await this.prisma.channelMessage.create({
      data: { channelId, authorId: null, body, isAi: true },
      include: { author: USER_SELECT },
    });

    this.publish(this.channelSubscribers, channelId, {
      type: 'created',
      message,
    });
    await this.publishInboxToAllMembers(channelId);

    return message;
  }

  private async getOwnMessageOrThrow(
    channelId: string,
    messageId: string,
    userId: string,
  ) {
    this.validateUuid(messageId);
    const message = await this.prisma.channelMessage.findUnique({
      where: { id: messageId },
    });
    if (!message || message.channelId !== channelId) {
      throw new NotFoundException('Message not found');
    }
    if (message.authorId !== userId) {
      throw new ForbiddenException('You can only modify your own messages');
    }
    return message;
  }

  async updateMessage(
    channelId: string,
    messageId: string,
    userId: string,
    body: string,
  ) {
    this.validateUuid(channelId);
    await this.requireMembership(channelId, userId);
    await this.getOwnMessageOrThrow(channelId, messageId, userId);

    const message = await this.prisma.channelMessage.update({
      where: { id: messageId },
      data: { body },
      include: { author: USER_SELECT },
    });

    this.publish(this.channelSubscribers, channelId, {
      type: 'updated',
      message,
    });
    await this.publishInboxToAllMembers(channelId);

    return message;
  }

  async deleteMessage(
    channelId: string,
    messageId: string,
    userId: string,
  ) {
    this.validateUuid(channelId);
    await this.requireMembership(channelId, userId);
    await this.getOwnMessageOrThrow(channelId, messageId, userId);

    await this.prisma.channelMessage.delete({ where: { id: messageId } });

    this.publish(this.channelSubscribers, channelId, {
      type: 'deleted',
      messageId,
    });
    await this.publishInboxToAllMembers(channelId);
  }

  async markRead(channelId: string, userId: string) {
    this.validateUuid(channelId);
    await this.requireMembership(channelId, userId);

    await this.prisma.channelMember.update({
      where: { channelId_userId: { channelId, userId } },
      data: { lastReadAt: new Date() },
    });

    // Ping the caller's inbox so their unread badge clears live across tabs.
    this.publish(this.inboxSubscribers, userId, {
      type: 'inbox',
      channelId,
    });
    return { ok: true };
  }
}
