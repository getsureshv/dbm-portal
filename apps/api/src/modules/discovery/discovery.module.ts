import { Module } from '@nestjs/common';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { WebSearchService } from './web-search.service';

@Module({
  controllers: [DiscoveryController],
  providers: [DiscoveryService, WebSearchService],
  exports: [DiscoveryService, WebSearchService],
})
export class DiscoveryModule {}
