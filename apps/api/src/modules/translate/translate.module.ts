import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TranslateController } from './translate.controller';
import { TranslateService } from './translate.service';

@Module({
  imports: [AuthModule],
  controllers: [TranslateController],
  providers: [TranslateService],
})
export class TranslateModule {}
