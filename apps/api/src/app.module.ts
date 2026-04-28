import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { PrismaModule } from './common/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { ChatModule } from './modules/chat/chat.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(__dirname, '..', '..', '.env'),
        join(__dirname, '..', '.env'),
        '.env',
      ],
    }),
    PrismaModule,
    AuthModule,
    OnboardingModule,
    ProjectsModule,
    DiscoveryModule,
    UploadsModule,
    ChatModule,
    ProvidersModule,
    DocumentsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
