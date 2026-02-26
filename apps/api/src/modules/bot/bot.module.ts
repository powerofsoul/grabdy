import { Module } from '@nestjs/common';

import { ChatModule } from '../chat/chat.module';
import { DataSourcesModule } from '../data-sources/data-sources.module';
import { StorageModule } from '../storage/storage.module';

import { BotController } from './bot.controller';
import { BotService } from './bot.service';
import { SdkChatStreamController } from './sdk-chat-stream.controller';
import { SdkChatStreamService } from './sdk-chat-stream.service';

@Module({
  imports: [DataSourcesModule, ChatModule, StorageModule],
  controllers: [BotController, SdkChatStreamController],
  providers: [BotService, SdkChatStreamService],
  exports: [BotService],
})
export class BotModule {}
