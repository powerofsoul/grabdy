import { Module } from '@nestjs/common';

import { StorageModule } from '../storage/storage.module';

import { DataSourceCleanupProcessor } from './processors/cleanup.processor';
import { ClassificationService } from './services/classification.service';
import { EmbeddingService } from './services/embedding.service';
import { EnrichmentService } from './services/enrichment.service';
import { PipelineService } from './services/pipeline.service';
import { CsvExtractor } from './sources/file/extractors/csv.extractor';
import { DocxExtractor } from './sources/file/extractors/docx.extractor';
import { EmailExtractor } from './sources/file/extractors/email.extractor';
import { ImageExtractor } from './sources/file/extractors/image.extractor';
import { MsgExtractor } from './sources/file/extractors/msg.extractor';
import { PdfExtractor } from './sources/file/extractors/pdf.extractor';
import { PdfAnnotationExtractor } from './sources/file/extractors/pdf-annotation.extractor';
import { PstExtractor } from './sources/file/extractors/pst.extractor';
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
    PipelineService,
    ClassificationService,
    EnrichmentService,
    PdfExtractor,
    PdfAnnotationExtractor,
    DocxExtractor,
    CsvExtractor,
    XlsxExtractor,
    TextExtractor,
    ImageExtractor,
    EmailExtractor,
    MsgExtractor,
    PstExtractor,
    DataSourceCleanupProcessor,
  ],
  exports: [
    DataSourcesService,
    EmbeddingService,
    PipelineService,
    ClassificationService,
    EnrichmentService,
    PdfExtractor,
    PdfAnnotationExtractor,
    DocxExtractor,
    CsvExtractor,
    XlsxExtractor,
    TextExtractor,
    ImageExtractor,
    EmailExtractor,
    MsgExtractor,
    PstExtractor,
  ],
})
export class DataSourcesModule {}
