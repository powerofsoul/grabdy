import { Module } from '@nestjs/common';

import { CollectionsModule } from '../collections/collections.module';

import { PublicApiController } from './public-api.controller';
import { RetrievalService } from './retrieval.service';

@Module({
  imports: [CollectionsModule],
  controllers: [PublicApiController],
  providers: [RetrievalService],
  exports: [RetrievalService],
})
export class PublicApiModule {}
