import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { ChannelsModule } from '../channels/channels.module';
import { AiParticipantController } from './ai-participant.controller';
import { AiParticipantService } from './ai-participant.service';

@Module({
  imports: [AuthModule, ProjectsModule, ChannelsModule],
  controllers: [AiParticipantController],
  providers: [AiParticipantService],
})
export class AiParticipantModule {}
