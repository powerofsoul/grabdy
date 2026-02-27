import { Module } from '@nestjs/common';

import { DataSourcesModule } from '../data-sources/data-sources.module';
import { GitHubModule } from '../data-sources/sources/github/github.module';
import { LinearModule } from '../data-sources/sources/linear/linear.module';
import { NotionModule } from '../data-sources/sources/notion/notion.module';
import { SlackModule } from '../data-sources/sources/slack/slack.module';

import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { ProviderRegistry } from './provider-registry';

@Module({
  imports: [DataSourcesModule, SlackModule, GitHubModule, LinearModule, NotionModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, ProviderRegistry],
  exports: [IntegrationsService, ProviderRegistry],
})
export class IntegrationsModule {}
