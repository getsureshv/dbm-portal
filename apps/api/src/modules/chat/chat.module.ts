import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { AuthModule } from '../auth/auth.module';
import { JurisdictionsModule } from '../jurisdictions/jurisdictions.module';

@Module({
  imports: [ConfigModule, AuthModule, JurisdictionsModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
