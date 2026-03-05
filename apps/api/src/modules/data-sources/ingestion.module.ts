import { Module } from '@nestjs/common';

import { StorageModule } from '../storage/storage.module';

import { DataSourceCleanupProcessor } from './processors/cleanup.processor';
import { FileIngestionProcessor } from './processors/file-ingestion.processor';
import { FileIngestionService } from './sources/file/file-ingestion.service';
import { DataSourcesModule } from './data-sources.module';

const ingestionServices = [FileIngestionService];

const processors = [FileIngestionProcessor, DataSourceCleanupProcessor];

@Module({
  imports: [DataSourcesModule, StorageModule],
  providers: [...ingestionServices, ...processors],
})
export class IngestionModule {}
