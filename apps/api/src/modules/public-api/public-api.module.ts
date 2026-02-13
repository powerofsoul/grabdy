import { Module } from '@nestjs/common';

import { CollectionsModule } from '../collections/collections.module';
import { RetrievalModule } from '../retrieval/retrieval.module';

import { PublicApiController } from './public-api.controller';

@Module({
  imports: [RetrievalModule, CollectionsModule],
  controllers: [PublicApiController],
})
export class PublicApiModule {}
