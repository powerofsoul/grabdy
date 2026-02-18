import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { CANVAS_OPS_QUEUE } from '../queue/queue.constants';

import { CanvasOpsProcessor } from './processors/canvas-ops.processor';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { SharedChatController } from './shared-chat.controller';
import { SharedChatService } from './shared-chat.service';

@Module({
  imports: [BullModule.registerQueue({ name: CANVAS_OPS_QUEUE })],
  controllers: [ChatController, SharedChatController],
  providers: [ChatService, SharedChatService, CanvasOpsProcessor],
  exports: [ChatService],
})
export class ChatModule {}
