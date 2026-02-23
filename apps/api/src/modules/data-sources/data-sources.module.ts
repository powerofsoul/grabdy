import { Module } from '@nestjs/common';

import { ExtractorsModule } from '../extractors/extractors.module';
import { StorageModule } from '../storage/storage.module';

import { DataSourceFunctions } from './data-source.functions';
import { DataSourcesController } from './data-sources.controller';
import { DataSourcesService } from './data-sources.service';

@Module({
  imports: [StorageModule, ExtractorsModule],
  controllers: [DataSourcesController],
  providers: [DataSourcesService, DataSourceFunctions],
  exports: [DataSourcesService],
})
export class DataSourcesModule {}
