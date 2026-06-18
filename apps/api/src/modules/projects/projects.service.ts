import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { PermissionsService } from '../access/permissions.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import {
  scopePrismaWhere,
  DENY_ALL,
  type ScopeWhere,
} from '../access/scope-filter.helper';
import type { ScopeFilterDescriptor } from '../access/engine/permission-engine';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsService,
  ) {}

  private validateUuid(id: string) {
    if (!UUID_REGEX.test(id)) {
      throw new BadRequestException('Invalid project ID format');
    }
  }

  async createProject(userId: string, createProjectDto: CreateProjectDto) {
    const {
      title,
      type,
      zipCode,
      addressStreet,
      addressCity,
      addressState,
      companies,
    } = createProjectDto;

    // Keep only company rows that have at least a company name.
    const companyRows = (companies ?? [])
      .filter((c) => c.companyName && c.companyName.trim())
      .map((c) => ({
        companyName: c.companyName.trim(),
        companyWebsite: c.companyWebsite?.trim() || null,
        companyPhone: c.companyPhone?.trim() || null,
        contactFirstName: c.contactFirstName?.trim() || null,
        contactLastName: c.contactLastName?.trim() || null,
        contactTitle: c.contactTitle?.trim() || null,
        contactEmail: c.contactEmail?.trim() || null,
        contactPhone: c.contactPhone?.trim() || null,
        roleInProject: c.roleInProject?.trim() || null,
      }));

    const project = await this.prisma.project.create({
      data: {
        title,
        type,
        zipCode,
        addressStreet: addressStreet?.trim() || null,
        addressCity: addressCity?.trim() || null,
        addressState: addressState?.trim() || null,
        ownerId: userId,
        status: 'DISCOVERY',
        scopeCreationMode: 'AI_ASSISTED',
        scopeDocument: {
          create: {
            status: 'DRAFT',
            completenessPercent: 0,
          },
        },
        ...(companyRows.length
          ? { companies: { create: companyRows } }
          : {}),
      },
      include: {
        documents: true,
        scopeDocument: true,
        companies: true,
      },
    });

    return project;
  }

  async listProjects(userId: string) {
    return this.prisma.project.findMany({
      where: {
        ownerId: userId,
        deletedAt: null,
      },
      include: {
        documents: true,
        scopeDocument: true,
      },
    });
  }

  /**
   * FR-16 — list projects filtered by the caller's effective access scope.
   * The controller resolves the {@link ScopeFilterDescriptor} via the access
   * engine; this method turns it into a Prisma where-clause. For a backfilled
   * client (scope OWN) this is identical to {@link listProjects}; for an admin
   * (scope ALL) it returns every non-deleted project; granted record ids are
   * unioned in. No participation table exists yet, so ASSIGNED contributes
   * nothing for now.
   */
  async listProjectsScoped(userId: string, scope: ScopeFilterDescriptor) {
    const where: ScopeWhere = scopePrismaWhere(scope, {
      ownerField: 'ownerId',
      userId,
      participantRecordIds: [], // no project_invitations model yet
    });
    if (where === DENY_ALL) return [];

    return this.prisma.project.findMany({
      where: { deletedAt: null, ...(where as Record<string, any>) },
      include: {
        documents: true,
        scopeDocument: true,
      },
    });
  }

  /**
   * List projects available for providers to browse.
   * Returns all non-deleted projects (from all owners) with scope data.
   * Optionally filter by type and zipCode.
   */
  async listOpportunities(filters: {
    type?: string;
    zipCode?: string;
  }) {
    const where: any = {
      deletedAt: null,
    };

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.zipCode) {
      where.zipCode = filters.zipCode;
    }

    const projects = await this.prisma.project.findMany({
      where,
      include: {
        scopeDocument: {
          select: {
            completenessPercent: true,
            status: true,
            projectScope: true,
            timeline: true,
            preferredStartDate: true,
          },
        },
        owner: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return projects;
  }

  /**
   * Get a single opportunity (public view for providers).
   * Returns project + scope data + owner name. No ownership check.
   */
  async getOpportunity(id: string) {
    this.validateUuid(id);
    const project = await this.prisma.project.findUnique({
      where: { id, deletedAt: null },
      include: {
        scopeDocument: {
          select: {
            completenessPercent: true,
            status: true,
            projectScope: true,
            dimensions: true,
            materialGrade: true,
            timeline: true,
            milestones: true,
            specialConditions: true,
            preferredStartDate: true,
            siteConstraints: true,
            aestheticPreferences: true,
          },
        },
        owner: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Opportunity not found');
    }

    return project;
  }

  /**
   * Fetch a single project, honoring the central access model.
   *
   * Historically this enforced `project.ownerId === userId`, which silently
   * ignored record grants and admin scope — so a user the owner had explicitly
   * shared the project with (or an admin) was wrongly told "Not authorized".
   * The PermissionGuard on the route is the authoritative gate (read@project:
   * owner via OWN, grantee via record-grant, admin via ALL), but this method is
   * also called directly by mutation paths (update/delete/addDocument), so we
   * re-check here through the same engine rather than a bare owner comparison.
   *
   * @param requiredAction the action to authorize for (default 'read'). Mutation
   *   callers pass 'update'/'delete' so a read-only grantee can't slip through.
   */
  async getProject(
    id: string,
    userId: string,
    requiredAction: 'read' | 'update' | 'delete' = 'read',
  ) {
    this.validateUuid(id);
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        documents: true,
        scopeDocument: true,
        companies: { orderBy: { createdAt: 'asc' } },
        notes: {
          orderBy: { createdAt: 'desc' },
          include: {
            author: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Authorize against personas + record grants + admin scope — not ownerId
    // alone. participantIds is empty until a participation model exists.
    const allowed = await this.permissions.can(userId, requiredAction, 'project', {
      id: project.id,
      ownerId: project.ownerId,
      participantIds: [],
    });
    if (!allowed) {
      throw new ForbiddenException('Not authorized to access this project');
    }

    return project;
  }

  async updateProject(
    id: string,
    userId: string,
    updateProjectDto: UpdateProjectDto,
  ) {
    const project = await this.getProject(id, userId, 'update');

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return this.prisma.project.update({
      where: { id },
      data: updateProjectDto,
      include: {
        documents: true,
        scopeDocument: true,
      },
    });
  }

  async deleteProject(id: string, userId: string) {
    const project = await this.getProject(id, userId, 'delete');

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return this.prisma.project.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: {
        documents: true,
        scopeDocument: true,
      },
    });
  }

  async addDocument(
    id: string,
    userId: string,
    s3Key: string,
    filename: string,
    category: string,
  ) {
    // Adding a document mutates the project, so require update access.
    const project = await this.getProject(id, userId, 'update');

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return this.prisma.projectDocument.create({
      data: {
        projectId: id,
        uploadedById: userId,
        s3Key,
        filename,
        category: category as any,
      },
    });
  }

  // ── Notes / comments ────────────────────────────────────────────────────

  // List a project's notes newest-first, with author identity. Reading notes
  // only requires read access to the project.
  async listNotes(projectId: string, userId: string) {
    await this.getProject(projectId, userId, 'read');

    return this.prisma.projectNote.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });
  }

  // Add a note to a project. The author is the authenticated caller and the
  // timestamp is set by the database. Requires update access to the project.
  async addNote(projectId: string, userId: string, body: string) {
    await this.getProject(projectId, userId, 'update');

    return this.prisma.projectNote.create({
      data: {
        projectId,
        authorId: userId,
        body,
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });
  }

  // Load a note and confirm it belongs to the given project and that the caller
  // is its author. Only the author may edit or delete their own note.
  private async getOwnNoteOrThrow(
    projectId: string,
    noteId: string,
    userId: string,
  ) {
    this.validateUuid(projectId);
    this.validateUuid(noteId);

    const note = await this.prisma.projectNote.findUnique({
      where: { id: noteId },
    });
    if (!note || note.projectId !== projectId) {
      throw new NotFoundException('Note not found');
    }
    if (note.authorId !== userId) {
      throw new ForbiddenException('You can only modify your own notes');
    }
    return note;
  }

  // Edit a note's body. Author-only; the caller must also retain read access to
  // the project. updatedAt is refreshed by Prisma.
  async updateNote(
    projectId: string,
    noteId: string,
    userId: string,
    body: string,
  ) {
    await this.getProject(projectId, userId, 'read');
    await this.getOwnNoteOrThrow(projectId, noteId, userId);

    return this.prisma.projectNote.update({
      where: { id: noteId },
      data: { body },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });
  }

  // Delete a note. Author-only.
  async deleteNote(projectId: string, noteId: string, userId: string) {
    await this.getProject(projectId, userId, 'read');
    await this.getOwnNoteOrThrow(projectId, noteId, userId);

    await this.prisma.projectNote.delete({ where: { id: noteId } });
  }

  // ── Chat / messages ──────────────────────────────────────────────────────

  // List a project's chat messages oldest-first (thread order). The optional
  // `after` cursor returns only messages created strictly after that message,
  // so the client can poll for new ones without refetching the whole thread.
  async listMessages(projectId: string, userId: string, after?: string) {
    await this.getProject(projectId, userId, 'read');

    let createdAfter: Date | undefined;
    if (after) {
      this.validateUuid(after);
      const cursor = await this.prisma.projectMessage.findUnique({
        where: { id: after },
        select: { createdAt: true, projectId: true },
      });
      if (cursor && cursor.projectId === projectId) {
        createdAfter = cursor.createdAt;
      }
    }

    return this.prisma.projectMessage.findMany({
      where: {
        projectId,
        ...(createdAfter ? { createdAt: { gt: createdAfter } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });
  }

  // Post a message. Author is the authenticated caller; requires update access
  // to the project (i.e. a project member, not a read-only viewer).
  async addMessage(projectId: string, userId: string, body: string) {
    await this.getProject(projectId, userId, 'update');

    return this.prisma.projectMessage.create({
      data: { projectId, authorId: userId, body },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });
  }

  // Load a message and confirm it belongs to the project and the caller authored
  // it. Only the author may edit or delete their own message.
  private async getOwnMessageOrThrow(
    projectId: string,
    messageId: string,
    userId: string,
  ) {
    this.validateUuid(projectId);
    this.validateUuid(messageId);

    const message = await this.prisma.projectMessage.findUnique({
      where: { id: messageId },
    });
    if (!message || message.projectId !== projectId) {
      throw new NotFoundException('Message not found');
    }
    if (message.authorId !== userId) {
      throw new ForbiddenException('You can only modify your own messages');
    }
    return message;
  }

  // Edit a message body. Author-only.
  async updateMessage(
    projectId: string,
    messageId: string,
    userId: string,
    body: string,
  ) {
    await this.getProject(projectId, userId, 'read');
    await this.getOwnMessageOrThrow(projectId, messageId, userId);

    return this.prisma.projectMessage.update({
      where: { id: messageId },
      data: { body },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });
  }

  // Delete a message. Author-only.
  async deleteMessage(projectId: string, messageId: string, userId: string) {
    await this.getProject(projectId, userId, 'read');
    await this.getOwnMessageOrThrow(projectId, messageId, userId);

    await this.prisma.projectMessage.delete({ where: { id: messageId } });
  }
}
