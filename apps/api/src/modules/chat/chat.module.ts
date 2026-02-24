import { Module } from '@nestjs/common';

import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { SharedChatController } from './shared-chat.controller';
import { SharedChatService } from './shared-chat.service';

@Module({
  controllers: [ChatController, SharedChatController],
  providers: [ChatService, SharedChatService],
  exports: [ChatService],
})
export class ChatModule {}
