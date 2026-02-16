import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { ExtractorsModule } from '../extractors/extractors.module';
import { DATA_SOURCE_QUEUE } from '../queue/queue.constants';
import { StorageModule } from '../storage/storage.module';

import { DataSourceProcessor } from './data-source.processor';
import { DataSourcesController } from './data-sources.controller';
import { DataSourcesService } from './data-sources.service';

@Module({
  imports: [
    StorageModule,
    ExtractorsModule,
    BullModule.registerQueue({ name: DATA_SOURCE_QUEUE }),
  ],
  controllers: [DataSourcesController],
  providers: [DataSourcesService, DataSourceProcessor],
  exports: [DataSourcesService],
})
export class DataSourcesModule {}
