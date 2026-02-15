import { Injectable } from '@nestjs/common';

import type { IntegrationProvider } from '@grabdy/contracts';

import type { IntegrationConnector } from '../connector.interface';

import { SlackConnector } from './slack/slack.connector';

@Injectable()
export class ProviderRegistry {
  private readonly connectors: Map<string, IntegrationConnector>;

  constructor(slackConnector: SlackConnector) {
    this.connectors = new Map<string, IntegrationConnector>([
      ['SLACK', slackConnector],
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
