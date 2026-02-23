import { Module } from '@nestjs/common';

import { StorageModule } from '../storage/storage.module';

import { DocxExtractor } from './docx.extractor';
import { PdfExtractor } from './pdf.extractor';
import { TextExtractor } from './text.extractor';
import { XlsxExtractor } from './xlsx.extractor';

@Module({
  imports: [StorageModule],
  providers: [PdfExtractor, DocxExtractor, TextExtractor, XlsxExtractor],
  exports: [PdfExtractor, DocxExtractor, TextExtractor, XlsxExtractor],
})
export class ExtractorsModule {}
