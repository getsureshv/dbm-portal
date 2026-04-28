import {
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import Anthropic from '@anthropic-ai/sdk';

@Injectable()
export class DocumentsService {
  private anthropic: Anthropic | null = null;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private uploadsService: UploadsService,
  ) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
    } else {
      console.warn(
        'ANTHROPIC_API_KEY not configured — document scanning features will be unavailable',
      );
    }
  }

  async scanDocument(
    documentId: string,
    userId: string,
  ): Promise<{ id: string; filename: string; extractedText: string }> {
    if (!this.anthropic) {
      throw new HttpException(
        'AI document scanning is not configured. Set ANTHROPIC_API_KEY to enable.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    // Fetch the document with project relation for ownership check
    const doc = await this.prisma.projectDocument.findUnique({
      where: { id: documentId },
      include: {
        project: { select: { ownerId: true } },
      },
    });

    if (!doc) {
      throw new NotFoundException('Document not found');
    }

    if (doc.project.ownerId !== userId) {
      throw new ForbiddenException('You do not have access to this document');
    }

    // Return cached extraction if available
    if (doc.extractedText) {
      return {
        id: doc.id,
        filename: doc.filename,
        extractedText: doc.extractedText,
      };
    }

    // Download file from S3
    let body: Buffer;
    let contentType: string;
    try {
      const obj = await this.uploadsService.getObject(doc.s3Key);
      body = obj.body;
      contentType = obj.contentType;
    } catch (err: any) {
      const code = err?.name || err?.Code || err?.$metadata?.httpStatusCode;
      if (code === 'NoSuchKey' || code === 404) {
        throw new NotFoundException(
          'File missing in storage. The original upload is no longer available — please re-upload.',
        );
      }
      throw new HttpException(
        `Failed to read file from storage: ${err?.message || 'unknown error'}`,
        HttpStatus.BAD_GATEWAY,
      );
    }

    // Determine file type from content type or filename extension
    const isPdf =
      contentType === 'application/pdf' ||
      doc.filename.toLowerCase().endsWith('.pdf');
    const isImage =
      contentType.startsWith('image/') ||
      /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.filename);

    if (!isPdf && !isImage) {
      throw new HttpException(
        'Unsupported file type for scanning. Only PDF and image files are supported.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const base64Data = body.toString('base64');

    // Build the content blocks for Claude
    // Note: The SDK types (v0.30.1) don't include 'document' blocks,
    // but the API supports them. We use 'any' for PDF document blocks.
    const contentBlocks: any[] = [];

    if (isPdf) {
      contentBlocks.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: base64Data,
        },
      });
    } else {
      // Determine the image media type
      let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' =
        'image/jpeg';
      if (contentType === 'image/png' || doc.filename.toLowerCase().endsWith('.png')) {
        mediaType = 'image/png';
      } else if (contentType === 'image/gif' || doc.filename.toLowerCase().endsWith('.gif')) {
        mediaType = 'image/gif';
      } else if (contentType === 'image/webp' || doc.filename.toLowerCase().endsWith('.webp')) {
        mediaType = 'image/webp';
      }

      contentBlocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: base64Data,
        },
      });
    }

    contentBlocks.push({
      type: 'text',
      text: 'Please extract all text and information from this document.',
    });

    // Call Claude API
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system:
        'You are a construction document analyst. Extract all text content from this document. Organize the extracted information clearly with headings. For construction documents, identify: project details, scope items, specifications, quantities, costs, dates, parties involved, and any terms or conditions. Return the extracted text in a clean, readable format.',
      messages: [
        {
          role: 'user',
          content: contentBlocks,
        },
      ],
    });

    // Extract text from the response
    const extractedText = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as { type: 'text'; text: string }).text)
      .join('\n');

    // Save extracted text to database
    await this.prisma.projectDocument.update({
      where: { id: documentId },
      data: { extractedText },
    });

    return {
      id: doc.id,
      filename: doc.filename,
      extractedText,
    };
  }

  async getDocumentText(
    documentId: string,
    userId: string,
  ): Promise<{ id: string; filename: string; extractedText: string | null }> {
    const doc = await this.prisma.projectDocument.findUnique({
      where: { id: documentId },
      include: {
        project: { select: { ownerId: true } },
      },
    });

    if (!doc) {
      throw new NotFoundException('Document not found');
    }

    if (doc.project.ownerId !== userId) {
      throw new ForbiddenException('You do not have access to this document');
    }

    return {
      id: doc.id,
      filename: doc.filename,
      extractedText: doc.extractedText,
    };
  }

  async deleteDocument(documentId: string, userId: string): Promise<void> {
    const doc = await this.prisma.projectDocument.findUnique({
      where: { id: documentId },
      include: { project: { select: { ownerId: true } } },
    });

    if (!doc) {
      throw new NotFoundException('Document not found');
    }
    if (doc.project.ownerId !== userId) {
      throw new ForbiddenException('You do not have access to this document');
    }

    // Best-effort S3 delete — DB row is removed even if S3 cleanup fails
    try {
      await this.uploadsService.deleteObject(doc.s3Key);
    } catch (err: any) {
      console.warn(
        `Failed to delete S3 object ${doc.s3Key}: ${err?.message || err}`,
      );
    }

    await this.prisma.projectDocument.delete({ where: { id: documentId } });
  }

  /**
   * Use Claude to parse the document's extracted text into structured
   * ScopeDocument fields, then upsert the project's scope document.
   * Detects whether the document is actually a scope-of-work — if not,
   * returns a hint without modifying any data.
   */
  async convertToScope(
    documentId: string,
    userId: string,
  ): Promise<{
    isScopeDocument: boolean;
    confidence: number;
    reason?: string;
    scope?: {
      id: string;
      projectId: string;
      completenessPercent: number;
      filledFields: string[];
    };
  }> {
    if (!this.anthropic) {
      throw new HttpException(
        'AI document conversion is not configured. Set ANTHROPIC_API_KEY to enable.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const doc = await this.prisma.projectDocument.findUnique({
      where: { id: documentId },
      include: { project: { select: { id: true, ownerId: true } } },
    });

    if (!doc) {
      throw new NotFoundException('Document not found');
    }
    if (doc.project.ownerId !== userId) {
      throw new ForbiddenException('You do not have access to this document');
    }

    // Ensure we have extracted text — scan first if not
    let extractedText = doc.extractedText;
    if (!extractedText) {
      const scan = await this.scanDocument(documentId, userId);
      extractedText = scan.extractedText;
    }
    if (!extractedText || extractedText.trim().length === 0) {
      throw new HttpException(
        'No extractable text found in document.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const SCOPE_FIELDS = [
      'projectScope',
      'dimensions',
      'materialGrade',
      'timeline',
      'milestones',
      'specialConditions',
      'preferredStartDate',
      'siteConstraints',
      'aestheticPreferences',
    ];

    const systemPrompt = `You analyze construction documents and extract structured Scope of Work data.

Given a document's extracted text, decide whether it describes a construction project's scope of work (specs, materials, timeline, site conditions, etc.) versus an unrelated document (invoice, photo caption, license, contract boilerplate, marketing).

If it IS a scope document, populate as many of the following fields as the text supports. Use null for any field the text does not clearly describe — DO NOT invent.

Fields:
- projectScope: 1–3 paragraphs summarizing the work: zones, primary deliverables, square footage covered.
- dimensions: explicit measurements (areas, lengths, counts of fixtures, etc.) as a short list.
- materialGrade: materials and finishes (e.g. "20mm travertine pavers, cedar 2×6 framing, Pentair LED pool lights").
- timeline: total duration and any phasing summary.
- milestones: ordered phases or milestones with dates/weeks.
- specialConditions: HOA rules, code requirements, easements, soil/site constraints affecting work.
- preferredStartDate: target start date if stated; otherwise null.
- siteConstraints: drainage, utilities, access, demo, existing conditions.
- aestheticPreferences: design style, color palette, finish preferences.

Respond with ONLY valid JSON, no prose, no code fences:
{
  "isScopeDocument": boolean,
  "confidence": number between 0 and 1,
  "reason": "short explanation if not a scope document, otherwise null",
  "fields": {
    "projectScope": string|null,
    "dimensions": string|null,
    "materialGrade": string|null,
    "timeline": string|null,
    "milestones": string|null,
    "specialConditions": string|null,
    "preferredStartDate": string|null,
    "siteConstraints": string|null,
    "aestheticPreferences": string|null
  }
}`;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Filename: ${doc.filename}\n\nExtracted text:\n\n${extractedText.slice(0, 60000)}`,
        },
      ],
    });

    const raw = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('\n')
      .trim();

    let parsed: any;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      throw new HttpException(
        'AI returned an unparseable response. Please try again.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const isScopeDocument = parsed.isScopeDocument === true;
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence ?? 0)));

    if (!isScopeDocument) {
      return {
        isScopeDocument: false,
        confidence,
        reason: parsed.reason || 'Document does not appear to describe a scope of work.',
      };
    }

    // Build update payload from non-null fields only
    const fieldData: Record<string, string> = {};
    const filledFields: string[] = [];
    for (const field of SCOPE_FIELDS) {
      const value = parsed.fields?.[field];
      if (typeof value === 'string' && value.trim().length > 0) {
        fieldData[field] = value.trim();
        filledFields.push(field);
      }
    }

    const completenessPercent = Math.round(
      (filledFields.length / SCOPE_FIELDS.length) * 100,
    );

    // Upsert scope document
    const scope = await this.prisma.scopeDocument.upsert({
      where: { projectId: doc.project.id },
      create: {
        projectId: doc.project.id,
        status: completenessPercent >= 65 ? 'COMPLETE' : 'IN_PROGRESS',
        completenessPercent,
        ...fieldData,
      },
      update: {
        status: completenessPercent >= 65 ? 'COMPLETE' : 'IN_PROGRESS',
        completenessPercent,
        ...fieldData,
      },
    });

    return {
      isScopeDocument: true,
      confidence,
      scope: {
        id: scope.id,
        projectId: scope.projectId,
        completenessPercent: scope.completenessPercent,
        filledFields,
      },
    };
  }
}
