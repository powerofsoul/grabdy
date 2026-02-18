import { Injectable } from '@nestjs/common';

import type { IntegrationProvider } from '@grabdy/contracts';

import type { IntegrationConnector } from '../connector.interface';

import { GitHubConnector } from './github/github.connector';
import { LinearConnector } from './linear/linear.connector';
import { NotionConnector } from './notion/notion.connector';
import { SlackConnector } from './slack/slack.connector';

@Injectable()
export class ProviderRegistry {
  private readonly connectors: Map<string, IntegrationConnector>;

  constructor(
    slackConnector: SlackConnector,
    linearConnector: LinearConnector,
    gitHubConnector: GitHubConnector,
    notionConnector: NotionConnector
  ) {
    this.connectors = new Map<string, IntegrationConnector>([
      ['SLACK', slackConnector],
      ['LINEAR', linearConnector],
      ['GITHUB', gitHubConnector],
      ['NOTION', notionConnector],
    ]);
  }

  getConnector(provider: IntegrationProvider): IntegrationConnector {
    const connector = this.connectors.get(provider);
    if (!connector) {
      throw new Error(`No connector registered for provider: ${provider}`);
    }
    return connector;
  }

  hasConnector(provider: IntegrationProvider): boolean {
    return this.connectors.has(provider);
  }
}
