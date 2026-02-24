import { Module } from '@nestjs/common';

import { CanvasProcessor } from './canvas.processor';
import { CanvasService } from './canvas.service';

@Module({
  providers: [CanvasService, CanvasProcessor],
  exports: [CanvasService],
})
export class CanvasModule {}
