import { Module } from '@nestjs/common';

import { StorageModule } from '../storage/storage.module';

import { DataSourceCleanupProcessor } from './processors/cleanup.processor';
import { EmbeddingService } from './services/embedding.service';
import { CsvExtractor } from './sources/file/extractors/csv.extractor';
import { DocxExtractor } from './sources/file/extractors/docx.extractor';
import { ImageExtractor } from './sources/file/extractors/image.extractor';
import { PdfExtractor } from './sources/file/extractors/pdf.extractor';
import { TextExtractor } from './sources/file/extractors/text.extractor';
import { XlsxExtractor } from './sources/file/extractors/xlsx.extractor';
import { DataSourcesController } from './data-sources.controller';
import { DataSourcesService } from './data-sources.service';

@Module({
  imports: [StorageModule],
  controllers: [DataSourcesController],
  providers: [
    DataSourcesService,
    EmbeddingService,
    PdfExtractor,
    DocxExtractor,
    CsvExtractor,
    XlsxExtractor,
    TextExtractor,
    ImageExtractor,
    DataSourceCleanupProcessor,
  ],
  exports: [
    DataSourcesService,
    EmbeddingService,
    PdfExtractor,
    DocxExtractor,
    CsvExtractor,
    XlsxExtractor,
    TextExtractor,
    ImageExtractor,
  ],
})
export class DataSourcesModule {}
