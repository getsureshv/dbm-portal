import { Injectable, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma.service';
import { Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';

export interface ListConversationsParams {
  userId: string;
  cursor?: string;
  limit: number;
}

const SCOPE_ARCHITECT_SYSTEM_PROMPT = `You are the DBM AI Scope Architect — a Senior Construction Project Manager. Your job is to interview the client to build a complete Scope of Work.

Follow this 4-step sequence:
1. Identify the Core — understand if this is a gut renovation vs a specific repair/upgrade
2. Extract Technicals — gather dimensions, square footage, material grades, specifications
3. Understand the Why — learn about aesthetic preferences, desired vibe, functional needs
4. Define Logistics — determine start dates, timeline preferences, site constraints, access issues

Guidelines:
- Ask ONE question at a time
- Be warm but professional
- Listen carefully and dig deeper when needed
- After each answer, determine which ScopeDocument field(s) to update
- Return a JSON tool call with field name and new value
- Build incrementally toward a complete scope

When you have gathered enough information to populate a field, return a JSON response:
{
  "type": "field_update",
  "field": "fieldName",
  "value": "extracted value or structured data",
  "nextQuestion": "Your warm follow-up question"
}

Keep responses concise and conversational. Your goal is to extract actionable project details that contractors can use for estimation and planning.`;

@Injectable()
export class ChatService {
  private anthropic: Anthropic | null = null;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
    } else {
      console.warn('ANTHROPIC_API_KEY not configured — AI chat features will be unavailable');
    }
  }

  async streamScopeArchitectResponse(
    userId: string,
    projectId: string,
    userMessage: string,
    res: Response,
  ): Promise<void> {
    if (!this.anthropic) {
      res.status(503).json({ error: 'AI chat is not configured. Set ANTHROPIC_API_KEY to enable.' });
      return;
    }
    try {
      // Load project and existing scope document
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        include: {
          scopeDocument: {
            include: {
              interviewTurns: {
                orderBy: { turnNumber: 'asc' },
              },
            },
          },
        },
      });

      if (!project) {
        throw new HttpException('Project not found', HttpStatus.NOT_FOUND);
      }

      // Check ownership using ownerId field
      if (project.ownerId !== userId) {
        throw new HttpException(
          'Unauthorized to access this project',
          HttpStatus.FORBIDDEN,
        );
      }

      let scopeDocument = project.scopeDocument;

      // Create scope document if it doesn't exist
      if (!scopeDocument) {
        scopeDocument = await this.prisma.scopeDocument.create({
          data: {
            projectId,
            status: 'DRAFT',
          },
          include: {
            interviewTurns: true,
          },
        });
      }

      // Verify scopeDocument was created successfully
      if (!scopeDocument) {
        throw new NotFoundException('Failed to create scope document');
      }

      // Build conversation history from previous turns
      const conversationHistory: Anthropic.Messages.MessageParam[] =
        scopeDocument.interviewTurns.map((turn) => [
          {
            role: 'user' as const,
            content: turn.questionText,
          },
          {
            role: 'assistant' as const,
            content: turn.answerText || '',
          },
        ]).flat();

      // Add current message
      conversationHistory.push({
        role: 'user' as const,
        content: userMessage,
      });

      // Stream response from Claude
      let fullResponse = '';
      let fieldUpdates: any[] = [];

      const stream = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: SCOPE_ARCHITECT_SYSTEM_PROMPT,
        messages: conversationHistory,
        stream: true,
      });

      // Process stream and send to client
      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          const text = event.delta.text;
          fullResponse += text;

          // Send text delta to client
          res.write(
            `data: ${JSON.stringify({
              type: 'text_delta',
              content: text,
            })}\n\n`,
          );
        }
      }

      // Try to parse field updates from response
      try {
        const jsonMatch = fullResponse.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.type === 'field_update') {
            fieldUpdates.push(parsed);
            // Update scope document with extracted field
            await this.updateScopeDocumentField(
              scopeDocument.id,
              parsed.field,
              parsed.value,
            );
          }
        }
      } catch (parseError) {
        // Response might not contain structured data, which is fine
      }

      // Determine next turn number
      const nextTurnNumber = scopeDocument.interviewTurns.length + 1;

      // Save conversation turn with correct field names
      await this.prisma.scopeInterviewTurn.create({
        data: {
          scopeDocumentId: scopeDocument.id,
          turnNumber: nextTurnNumber,
          questionText: userMessage,
          answerText: fullResponse,
          fieldPopulated: fieldUpdates.length > 0 ? fieldUpdates[0].field : null,
        },
      });

      // Send final response with metadata
      res.write(
        `data: ${JSON.stringify({
          type: 'complete',
          turnId: scopeDocument.id,
          fieldUpdates,
        })}\n\n`,
      );

      res.end();
    } catch (error: any) {
      if (!res.headersSent) {
        throw error;
      }
      res.write(
        `data: ${JSON.stringify({
          type: 'error',
          error: error.message,
        })}\n\n`,
      );
      res.end();
    }
  }

  async listUserConversations(
    params: ListConversationsParams,
  ): Promise<{
    conversations: any[];
    nextCursor?: string;
    total: number;
  }> {
    const { userId, cursor, limit } = params;

    const skip = cursor ? 1 : 0;
    const cursorObj = cursor ? { id: cursor } : undefined;

    // Get scope documents (conversations) for user's projects
    const conversations = await this.prisma.scopeDocument.findMany({
      where: {
        project: {
          ownerId: userId,
        },
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
          },
        },
        interviewTurns: {
          select: {
            id: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
      take: limit + 1,
      skip,
      cursor: cursorObj,
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Get total count
    const total = await this.prisma.scopeDocument.count({
      where: {
        project: {
          ownerId: userId,
        },
      },
    });

    // Handle pagination
    const hasNextPage = conversations.length > limit;
    const conversationList = hasNextPage
      ? conversations.slice(0, limit)
      : conversations;
    const nextCursor = hasNextPage
      ? conversationList[conversationList.length - 1]?.id
      : undefined;

    // Map to response format
    const formattedConversations = conversationList.map((conv) => ({
      id: conv.id,
      projectId: conv.projectId,
      projectName: conv.project.title,
      status: conv.status,
      lastUpdated: conv.updatedAt,
      lastTurnAt:
        conv.interviewTurns.length > 0
          ? conv.interviewTurns[0].createdAt
          : null,
      turnCount: conv.interviewTurns.length,
    }));

    return {
      conversations: formattedConversations,
      nextCursor,
      total,
    };
  }

  private async updateScopeDocumentField(
    scopeDocumentId: string,
    field: string,
    value: any,
  ): Promise<void> {
    const updateData: any = {};

    // Map field names to scope document fields
    const fieldMapping: Record<string, string> = {
      projectScope: 'projectScope',
      dimensions: 'dimensions',
      materialGrade: 'materialGrade',
      timeline: 'timeline',
      milestones: 'milestones',
      specialConditions: 'specialConditions',
      preferredStartDate: 'preferredStartDate',
      siteConstraints: 'siteConstraints',
      aestheticPreferences: 'aestheticPreferences',
    };

    const mappedField = fieldMapping[field] || field;
    if (mappedField) {
      updateData[mappedField] = value;
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.scopeDocument.update({
        where: { id: scopeDocumentId },
        data: updateData,
      });
    }
  }
}
