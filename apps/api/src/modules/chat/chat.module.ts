import { Module } from '@nestjs/common';

import { CanvasFunctions } from './canvas.functions';
import { CanvasService } from './canvas.service';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { SharedChatController } from './shared-chat.controller';
import { SharedChatService } from './shared-chat.service';

@Module({
  controllers: [ChatController, SharedChatController],
  providers: [ChatService, CanvasService, SharedChatService, CanvasFunctions],
  exports: [ChatService, CanvasService],
})
export class ChatModule {}
