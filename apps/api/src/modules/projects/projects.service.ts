import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  private validateUuid(id: string) {
    if (!UUID_REGEX.test(id)) {
      throw new BadRequestException('Invalid project ID format');
    }
  }

  async createProject(userId: string, createProjectDto: CreateProjectDto) {
    const { title, type, zipCode } = createProjectDto;

    const project = await this.prisma.project.create({
      data: {
        title,
        type,
        zipCode,
        ownerId: userId,
        status: 'DISCOVERY',
        scopeCreationMode: 'AI_ASSISTED',
        scopeDocument: {
          create: {
            status: 'DRAFT',
            completenessPercent: 0,
          },
        },
      },
      include: {
        documents: true,
        scopeDocument: true,
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

  async getProject(id: string, userId: string) {
    this.validateUuid(id);
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        documents: true,
        scopeDocument: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.ownerId !== userId) {
      throw new ForbiddenException('Not authorized to access this project');
    }

    return project;
  }

  async updateProject(
    id: string,
    userId: string,
    updateProjectDto: UpdateProjectDto,
  ) {
    const project = await this.getProject(id, userId);

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
    const project = await this.getProject(id, userId);

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
    const project = await this.getProject(id, userId);

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
