import { Module } from '@nestjs/common';

import { DataSourcesModule } from '../data-sources/data-sources.module';

import { SdkChatController } from './sdk-chat.controller';
import { SdkChatService } from './sdk-chat.service';
import { SdkChatStreamController } from './sdk-chat-stream.controller';
import { SdkChatStreamService } from './sdk-chat-stream.service';

@Module({
  imports: [DataSourcesModule],
  controllers: [SdkChatController, SdkChatStreamController],
  providers: [SdkChatService, SdkChatStreamService],
  exports: [SdkChatService],
})
export class SdkChatModule {}
