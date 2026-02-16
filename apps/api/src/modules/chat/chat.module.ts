import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { CANVAS_OPS_QUEUE } from '../queue/queue.constants';

import { CanvasOpsProcessor } from './processors/canvas-ops.processor';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [BullModule.registerQueue({ name: CANVAS_OPS_QUEUE })],
  controllers: [ChatController],
  providers: [ChatService, CanvasOpsProcessor],
  exports: [ChatService],
})
export class ChatModule {}
