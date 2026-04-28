import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { ProjectsService } from './projects.service';
import { ScopePdfService } from './scope-pdf.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@ApiTags('Projects')
@Controller('projects')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class ProjectsController {
  constructor(
    private projectsService: ProjectsService,
    private scopePdfService: ScopePdfService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new project' })
  async createProject(
    @Req() req: any,
    @Body() createProjectDto: CreateProjectDto,
  ) {
    const userId = req.userId;
    return this.projectsService.createProject(userId, createProjectDto);
  }

  @Get()
  @ApiOperation({ summary: "List caller's projects" })
  async listProjects(@Req() req: any) {
    const userId = req.userId;
    return this.projectsService.listProjects(userId);
  }

  @Get('opportunities')
  @ApiOperation({ summary: 'List available projects for providers to browse' })
  async listOpportunities(
    @Query('type') type?: string,
    @Query('zipCode') zipCode?: string,
  ) {
    return this.projectsService.listOpportunities({ type, zipCode });
  }

  @Get('opportunities/:id')
  @ApiOperation({ summary: 'Get a single opportunity detail (provider view)' })
  async getOpportunity(@Param('id') id: string) {
    return this.projectsService.getOpportunity(id);
  }

  @Post(':id/scope/generate-pdf')
  @ApiOperation({ summary: 'Generate a Scope of Work PDF and upload to S3' })
  async generateScopePdf(@Req() req: any, @Param('id') id: string) {
    const userId = req.userId;
    return this.scopePdfService.generatePdf(id, userId);
  }

  @Get(':id/scope/pdf')
  @ApiOperation({ summary: 'Download the generated Scope of Work PDF' })
  async downloadScopePdf(
    @Req() req: any,
    @Res() res: Response,
    @Param('id') id: string,
  ) {
    const userId = req.userId;
    const { buffer, filename } = await this.scopePdfService.getPdf(id, userId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project by ID with documents and scopeDocument' })
  async getProject(@Req() req: any, @Param('id') id: string) {
    const userId = req.userId;
    return this.projectsService.getProject(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update mutable project fields' })
  async updateProject(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    const userId = req.userId;
    return this.projectsService.updateProject(id, userId, updateProjectDto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft delete a project' })
  async deleteProject(@Req() req: any, @Param('id') id: string) {
    const userId = req.userId;
    await this.projectsService.deleteProject(id, userId);
  }

  @Post(':id/documents')
  @ApiOperation({ summary: 'Record a document upload' })
  async addDocument(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      s3Key: string;
      filename: string;
      category: string;
    },
  ) {
    const userId = req.userId;

    if (!body.s3Key || !body.filename || !body.category) {
      throw new BadRequestException(
        's3Key, filename, and category are required',
      );
    }

    return this.projectsService.addDocument(
      id,
      userId,
      body.s3Key,
      body.filename,
      body.category,
    );
  }
}
