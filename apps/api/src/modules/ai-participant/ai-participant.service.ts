import { Injectable, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../../common/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { ChannelsService } from '../channels/channels.service';

const SYSTEM_PROMPT = `You are a helpful AI assistant embedded in a construction-project team chat for the DBM Portal. The DBM Portal helps property owners and construction providers collaborate on remodeling and construction projects.

Be concise, friendly, and helpful about construction project management, scope of work, permits, timelines, materials, and general construction questions. When users ask about specific codes or permits, remind them that the Jurisdictions tab has live permit data. Keep replies brief — 2-5 sentences unless more detail is clearly needed.`;

@Injectable()
export class AiParticipantService {
  private anthropic: Anthropic | null = null;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private projectsService: ProjectsService,
    private channelsService: ChannelsService,
  ) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
    } else {
      console.warn(
        'ANTHROPIC_API_KEY not configured — AI participant features will be unavailable',
      );
    }
  }

  async respondInProject(
    projectId: string,
    userId: string,
    prompt: string,
  ) {
    // Fallback: Anthropic not configured
    if (!this.anthropic) {
      return this.projectsService.addAiMessage(
        projectId,
        'The AI assistant is not configured. Please ask your administrator to set the ANTHROPIC_API_KEY environment variable.',
      );
    }

    // Build context from recent messages
    const recentMessages = await this.prisma.projectMessage.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 15,
      include: {
        author: { select: { name: true, email: true } },
      },
    });

    // Reverse to chronological order
    const chronological = recentMessages.reverse();

    const transcript = chronological
      .map((msg) => {
        if (msg.isAi) {
          return `Assistant: ${msg.body}`;
        }
        const name = msg.author?.name || msg.author?.email || 'Unknown';
        return `${name}: ${msg.body}`;
      })
      .join('\n');

    const userContent = transcript
      ? `Recent conversation:\n${transcript}\n\nUser's question: ${prompt}`
      : `User's question: ${prompt}`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
        stream: false,
      });

      const textBlock = response.content.find((b) => b.type === 'text');
      const text = textBlock && textBlock.type === 'text'
        ? textBlock.text
        : 'Sorry, I could not generate a response.';

      return this.projectsService.addAiMessage(projectId, text);
    } catch (err: any) {
      console.error('AI participant error (project):', err?.message ?? err);
      return this.projectsService.addAiMessage(
        projectId,
        'Sorry, I ran into an error while generating a response. Please try again.',
      );
    }
  }

  async respondInChannel(
    channelId: string,
    userId: string,
    prompt: string,
  ) {
    // Verify the user is a member of the channel
    const memberIds = await this.channelsService.getMemberIds(channelId);
    if (!memberIds.includes(userId)) {
      throw new ForbiddenException('You are not a member of this channel');
    }

    // Fallback: Anthropic not configured
    if (!this.anthropic) {
      return this.channelsService.addAiMessage(
        channelId,
        'The AI assistant is not configured. Please ask your administrator to set the ANTHROPIC_API_KEY environment variable.',
      );
    }

    // Build context from recent channel messages
    const recentMessages = await this.prisma.channelMessage.findMany({
      where: { channelId },
      orderBy: { createdAt: 'desc' },
      take: 15,
      include: {
        author: { select: { name: true, email: true } },
      },
    });

    // Reverse to chronological order
    const chronological = recentMessages.reverse();

    const transcript = chronological
      .map((msg) => {
        if (msg.isAi) {
          return `Assistant: ${msg.body}`;
        }
        const name = msg.author?.name || msg.author?.email || 'Unknown';
        return `${name}: ${msg.body}`;
      })
      .join('\n');

    const userContent = transcript
      ? `Recent conversation:\n${transcript}\n\nUser's question: ${prompt}`
      : `User's question: ${prompt}`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
        stream: false,
      });

      const textBlock = response.content.find((b) => b.type === 'text');
      const text = textBlock && textBlock.type === 'text'
        ? textBlock.text
        : 'Sorry, I could not generate a response.';

      return this.channelsService.addAiMessage(channelId, text);
    } catch (err: any) {
      console.error('AI participant error (channel):', err?.message ?? err);
      return this.channelsService.addAiMessage(
        channelId,
        'Sorry, I ran into an error while generating a response. Please try again.',
      );
    }
  }
}
