import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { AiParticipantService } from './ai-participant.service';
import { AiMentionDto } from './dto/ai-mention.dto';

@ApiTags('ai-participant')
@UseGuards(AuthGuard)
@Controller('ai')
export class AiParticipantController {
  constructor(private readonly aiParticipantService: AiParticipantService) {}

  @Post('projects/:projectId/mention')
  async mentionInProject(
    @Param('projectId') projectId: string,
    @Body() dto: AiMentionDto,
    @Req() req: any,
  ) {
    return this.aiParticipantService.respondInProject(
      projectId,
      req.userId,
      dto.prompt,
    );
  }

  @Post('channels/:channelId/mention')
  async mentionInChannel(
    @Param('channelId') channelId: string,
    @Body() dto: AiMentionDto,
    @Req() req: any,
  ) {
    return this.aiParticipantService.respondInChannel(
      channelId,
      req.userId,
      dto.prompt,
    );
  }
}
