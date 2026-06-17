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
}
