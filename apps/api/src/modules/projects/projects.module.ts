import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ScopePdfService } from './scope-pdf.service';
import { AuthModule } from '../auth/auth.module';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [AuthModule, UploadsModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ScopePdfService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
