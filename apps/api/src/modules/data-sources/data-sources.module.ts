import { Module } from '@nestjs/common';

import { StorageModule } from '../storage/storage.module';

import { CsvExtractor } from './csv/csv.extractor';
import { DsCsvProcessor } from './csv/csv.processor';
import { DocxExtractor } from './docx/docx.extractor';
import { DsDocxProcessor } from './docx/docx.processor';
import { ImageExtractor } from './image/image.extractor';
import { DsImageProcessor } from './image/image.processor';
import { DsMessagesProcessor } from './messages/messages.processor';
import { PdfExtractor } from './pdf/pdf.extractor';
import { DsPdfProcessor } from './pdf/pdf.processor';
import { EmbeddingService } from './pipeline/embedding.service';
import { DataSourcePipelineService } from './pipeline/pipeline.service';
import { DataSourceCleanupProcessor } from './processors/cleanup.processor';
import { TextExtractor } from './text/text.extractor';
import { DsTextProcessor } from './text/text.processor';
import { XlsxExtractor } from './xlsx/xlsx.extractor';
import { DsXlsxProcessor } from './xlsx/xlsx.processor';
import { DataSourceDispatchService } from './data-source-dispatch.service';
import { DataSourcesController } from './data-sources.controller';
import { DataSourcesService } from './data-sources.service';

@Module({
  imports: [StorageModule],
  controllers: [DataSourcesController],
  providers: [
    DataSourcesService,
    DataSourceDispatchService,
    EmbeddingService,
    DataSourcePipelineService,
    PdfExtractor,
    DocxExtractor,
    CsvExtractor,
    XlsxExtractor,
    TextExtractor,
    ImageExtractor,
    DsPdfProcessor,
    DsDocxProcessor,
    DsCsvProcessor,
    DsXlsxProcessor,
    DsTextProcessor,
    DsImageProcessor,
    DsMessagesProcessor,
    DataSourceCleanupProcessor,
  ],
  exports: [DataSourcesService, DataSourceDispatchService],
})
export class DataSourcesModule {}
