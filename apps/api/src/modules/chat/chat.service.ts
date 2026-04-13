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

// ─── Role-Specific Prompt Builder ──────────────────────────

function buildSystemPrompt(context: {
  role: string;
  userName: string;
  projectTitle: string;
  projectType: string;
  language: string;
  currentScope: Record<string, string | null>;
}): string {
  const { role, userName, projectTitle, projectType, language, currentScope } = context;

  const langInstruction =
    language && language !== 'en'
      ? `\n\nIMPORTANT: The user prefers ${getLanguageName(language)}. Respond in ${getLanguageName(language)}, but keep scope field values in English for contractor compatibility.`
      : '';

  const roleContext =
    role === 'OWNER'
      ? `You are speaking with ${userName}, the property OWNER. They may not know construction jargon — use plain, friendly language. Explain technical terms when you use them. Focus on what they want the space to look and feel like, their daily routines, and their budget comfort level.`
      : role === 'PROVIDER'
        ? `You are speaking with ${userName}, a construction PROVIDER. Use industry-standard terminology. Be direct and efficient — they understand trade language. Focus on specifications, tolerances, and technical requirements.`
        : `You are speaking with ${userName}. Be professional and clear.`;

  // Build a summary of what's already filled in
  const filledFields = Object.entries(currentScope)
    .filter(([, v]) => v)
    .map(([k, v]) => `  - ${k}: ${v}`)
    .join('\n');

  const scopeStatus = filledFields
    ? `\n\nScope fields already populated:\n${filledFields}\n\nDo NOT re-ask about information already captured above. Build on what you know.`
    : '\n\nNo scope fields have been filled yet. Start from the beginning.';

  return `You are the DBM AI Scope Architect — a Senior Construction Project Manager with 20+ years of experience. You interview clients to build a comprehensive, contractor-ready Scope of Work (SOW).

${roleContext}

PROJECT: "${projectTitle}" (${projectType})
${scopeStatus}
${langInstruction}

─── INTERVIEW STRUCTURE ───
Follow this 4-phase sequence. Move naturally between phases based on what the user shares:

Phase 1 — CORE SCOPE: What is the project? Gut renovation vs. cosmetic refresh vs. new addition? What spaces are involved?
Phase 2 — TECHNICALS: Dimensions, square footage, material grades, fixtures, appliances, structural changes.
Phase 3 — AESTHETICS & PURPOSE: Design style, color palette, desired feel, daily use patterns, inspiration.
Phase 4 — LOGISTICS: Preferred start date, timeline expectations, site access, pets/occupancy during work, budget range.

─── CONVERSATION RULES ───
1. Ask ONE focused question at a time. Never dump a list of questions.
2. Acknowledge what the user said before asking the next question. Show you listened.
3. Be warm, conversational, and encouraging — not robotic or clinical.
4. When the user gives vague answers ("something nice"), probe gently ("What does 'nice' look like to you — more modern and clean, or warm and classic?").
5. NEVER show raw JSON, code blocks, or technical markup to the user.
6. Keep responses concise — 2-4 sentences max, then your question.

─── SCOPE DATA EXTRACTION ───
When you gather enough info to populate a scope field, include a hidden extraction tag at the END of your response:

<scope_update field="fieldName">extracted value written for contractor clarity</scope_update>

Valid field names: projectScope, dimensions, materialGrade, timeline, milestones, specialConditions, preferredStartDate, siteConstraints, aestheticPreferences

Rules for extraction:
- Write values in professional, contractor-ready language (not the user's casual words)
- You can include multiple <scope_update> tags if the user gave enough info for several fields
- NEVER mention these tags or the extraction process to the user
- The tags must come AFTER your conversational response, never in the middle

─── EXAMPLE ───
User: "I want to redo my kitchen, it's about 12x15 and I hate the old laminate counters"

Your response:
"A 12×15 kitchen gives you great space to work with! And I totally understand wanting to ditch the laminate — it really dates a kitchen. Are you thinking of going with a natural stone like granite or quartz, or something more modern like a solid surface?"

<scope_update field="projectScope">Full kitchen renovation including countertop replacement. Existing laminate countertops to be removed and replaced.</scope_update>
<scope_update field="dimensions">Kitchen area approximately 12 ft × 15 ft (180 sq ft)</scope_update>`;
}

function getLanguageName(code: string): string {
  const map: Record<string, string> = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    zh: 'Chinese',
    hi: 'Hindi',
    ar: 'Arabic',
    pt: 'Portuguese',
    ko: 'Korean',
    ja: 'Japanese',
    de: 'German',
    it: 'Italian',
    vi: 'Vietnamese',
    tl: 'Tagalog',
    pl: 'Polish',
    ru: 'Russian',
  };
  return map[code] || code;
}

// ─── Service ───────────────────────────────────────────────

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
      // Load user profile for role-specific prompt
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          role: true,
          languagePreference: true,
        },
      });

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

      if (project.ownerId !== userId) {
        throw new HttpException('Unauthorized to access this project', HttpStatus.FORBIDDEN);
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

      if (!scopeDocument) {
        throw new NotFoundException('Failed to create scope document');
      }

      // Build role-aware system prompt with current scope state
      const systemPrompt = buildSystemPrompt({
        role: user?.role || 'OWNER',
        userName: user?.name || 'there',
        projectTitle: project.title,
        projectType: project.type,
        language: user?.languagePreference || 'en',
        currentScope: {
          projectScope: scopeDocument.projectScope,
          dimensions: scopeDocument.dimensions,
          materialGrade: scopeDocument.materialGrade,
          timeline: scopeDocument.timeline,
          milestones: scopeDocument.milestones,
          specialConditions: scopeDocument.specialConditions,
          preferredStartDate: scopeDocument.preferredStartDate || null,
          siteConstraints: scopeDocument.siteConstraints,
          aestheticPreferences: scopeDocument.aestheticPreferences,
        },
      });

      // Build conversation history from previous turns
      const conversationHistory: Anthropic.Messages.MessageParam[] =
        scopeDocument.interviewTurns
          .map((turn) => [
            { role: 'user' as const, content: turn.questionText },
            { role: 'assistant' as const, content: turn.answerText || '' },
          ])
          .flat();

      // Add current message
      conversationHistory.push({
        role: 'user' as const,
        content: userMessage,
      });

      // Stream response from Claude
      let fullResponse = '';

      const stream = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: conversationHistory,
        stream: true,
      });

      // Process stream — send text deltas but buffer scope_update tags
      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          const text = event.delta.text;
          fullResponse += text;

          // Send text delta to client (frontend will strip tags)
          res.write(
            `data: ${JSON.stringify({
              type: 'text_delta',
              content: text,
            })}\n\n`,
          );
        }
      }

      // Extract scope updates from the complete response
      const fieldUpdates = this.extractScopeUpdates(fullResponse);

      // Apply field updates to scope document
      for (const update of fieldUpdates) {
        await this.updateScopeDocumentField(
          scopeDocument.id,
          update.field,
          update.value,
        );
      }

      // Recalculate completeness
      if (fieldUpdates.length > 0) {
        await this.recalculateCompleteness(scopeDocument.id);
      }

      // Save conversation turn (store full response including tags for history)
      const nextTurnNumber = scopeDocument.interviewTurns.length + 1;
      await this.prisma.scopeInterviewTurn.create({
        data: {
          scopeDocumentId: scopeDocument.id,
          turnNumber: nextTurnNumber,
          questionText: userMessage,
          answerText: fullResponse,
          fieldPopulated: fieldUpdates.length > 0
            ? fieldUpdates.map((u) => u.field).join(',')
            : null,
        },
      });

      // Send completion event with field updates
      res.write(
        `data: ${JSON.stringify({
          type: 'complete',
          turnId: scopeDocument.id,
          fieldUpdates: fieldUpdates.map((u) => ({
            field: u.field,
            value: u.value,
          })),
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

  /**
   * Extract <scope_update field="...">value</scope_update> tags from response
   */
  private extractScopeUpdates(
    text: string,
  ): Array<{ field: string; value: string }> {
    const updates: Array<{ field: string; value: string }> = [];
    const regex = /<scope_update\s+field="(\w+)">([\s\S]*?)<\/scope_update>/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const field = match[1];
      const value = match[2].trim();
      if (field && value) {
        updates.push({ field, value });
      }
    }

    // Fallback: try old JSON format for backward compat
    if (updates.length === 0) {
      try {
        const jsonMatch = text.match(/\{\s*"type"\s*:\s*"field_update"[\s\S]*?\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.field && parsed.value) {
            updates.push({ field: parsed.field, value: parsed.value });
          }
        }
      } catch {
        // Not valid JSON, skip
      }
    }

    return updates;
  }

  /**
   * Recalculate scope completeness based on filled fields
   */
  private async recalculateCompleteness(scopeDocumentId: string): Promise<void> {
    const doc = await this.prisma.scopeDocument.findUnique({
      where: { id: scopeDocumentId },
    });
    if (!doc) return;

    const fields = [
      doc.projectScope,
      doc.dimensions,
      doc.materialGrade,
      doc.timeline,
      doc.milestones,
      doc.specialConditions,
      doc.preferredStartDate,
      doc.siteConstraints,
      doc.aestheticPreferences,
    ];

    const filled = fields.filter((f) => f !== null && f !== '').length;
    const percent = Math.round((filled / fields.length) * 100);

    await this.prisma.scopeDocument.update({
      where: { id: scopeDocumentId },
      data: {
        completenessPercent: percent,
        status: percent >= 65 ? 'IN_PROGRESS' : 'DRAFT',
      },
    });
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

    const conversations = await this.prisma.scopeDocument.findMany({
      where: { project: { ownerId: userId } },
      include: {
        project: { select: { id: true, title: true } },
        interviewTurns: {
          select: { id: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      take: limit + 1,
      skip,
      cursor: cursorObj,
      orderBy: { updatedAt: 'desc' },
    });

    const total = await this.prisma.scopeDocument.count({
      where: { project: { ownerId: userId } },
    });

    const hasNextPage = conversations.length > limit;
    const conversationList = hasNextPage
      ? conversations.slice(0, limit)
      : conversations;
    const nextCursor = hasNextPage
      ? conversationList[conversationList.length - 1]?.id
      : undefined;

    const formattedConversations = conversationList.map((conv) => ({
      id: conv.id,
      projectId: conv.projectId,
      projectName: conv.project.title,
      status: conv.status,
      lastUpdated: conv.updatedAt,
      lastTurnAt: conv.interviewTurns.length > 0 ? conv.interviewTurns[0].createdAt : null,
      turnCount: conv.interviewTurns.length,
    }));

    return { conversations: formattedConversations, nextCursor, total };
  }

  private async updateScopeDocumentField(
    scopeDocumentId: string,
    field: string,
    value: any,
  ): Promise<void> {
    const validFields: Record<string, string> = {
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

    const mappedField = validFields[field];
    if (!mappedField) return;

    const updateData: Record<string, any> = {};
    updateData[mappedField] = value;

    await this.prisma.scopeDocument.update({
      where: { id: scopeDocumentId },
      data: updateData,
    });
  }
}
