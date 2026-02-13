import { Injectable } from '@nestjs/common';

import type { IntegrationProvider } from '../../../db/enums';
import type { IntegrationConnector } from '../connector.interface';

import { AsanaConnector } from './asana/asana.connector';
import { ConfluenceConnector } from './confluence/confluence.connector';
import { FigmaConnector } from './figma/figma.connector';
import { GitHubConnector } from './github/github.connector';
import { GoogleDriveConnector } from './google-drive/google-drive.connector';
import { JiraConnector } from './jira/jira.connector';
import { LinearConnector } from './linear/linear.connector';
import { NotionConnector } from './notion/notion.connector';
import { SlackConnector } from './slack/slack.connector';
import { TrelloConnector } from './trello/trello.connector';

@Injectable()
export class ProviderRegistry {
  private readonly connectors: Map<string, IntegrationConnector>;

  constructor(
    asanaConnector: AsanaConnector,
    confluenceConnector: ConfluenceConnector,
    figmaConnector: FigmaConnector,
    githubConnector: GitHubConnector,
    googleDriveConnector: GoogleDriveConnector,
    jiraConnector: JiraConnector,
    linearConnector: LinearConnector,
    notionConnector: NotionConnector,
    slackConnector: SlackConnector,
    trelloConnector: TrelloConnector,
  ) {
    this.connectors = new Map<string, IntegrationConnector>([
      ['ASANA', asanaConnector],
      ['CONFLUENCE', confluenceConnector],
      ['FIGMA', figmaConnector],
      ['GITHUB', githubConnector],
      ['GOOGLE_DRIVE', googleDriveConnector],
      ['JIRA', jiraConnector],
      ['LINEAR', linearConnector],
      ['NOTION', notionConnector],
      ['SLACK', slackConnector],
      ['TRELLO', trelloConnector],
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
