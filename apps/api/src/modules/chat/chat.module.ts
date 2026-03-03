import { Module } from '@nestjs/common';

import { CollectionsModule } from '../collections/collections.module';
import { DataSourcesModule } from '../data-sources/data-sources.module';
import { StorageModule } from '../storage/storage.module';

import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatAttachmentService } from './chat-attachment.service';
import { SharedChatController } from './shared-chat.controller';
import { SharedChatService } from './shared-chat.service';

@Module({
  imports: [StorageModule, DataSourcesModule, CollectionsModule],
  controllers: [ChatController, SharedChatController],
  providers: [ChatService, SharedChatService, ChatAttachmentService],
  exports: [ChatService, ChatAttachmentService],
})
export class ChatModule {}
