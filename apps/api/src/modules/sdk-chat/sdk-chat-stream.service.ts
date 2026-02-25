import { Injectable } from '@nestjs/common';

import { type DbId, packId } from '@grabdy/common';
import type { ChatAttachment, SdkChatSourceConfig } from '@grabdy/contracts';

import { THREAD_TITLE_MAX_LENGTH } from '../../config/constants';
import type { AttachmentContext } from '../agent/base-agent';

function hasErrorCode(err: unknown): err is Error & { code: string } {
  if (!(err instanceof Error) || !('code' in err)) return false;
  const candidate: { code: unknown } = err;
  return typeof candidate.code === 'string';
}
import { DbService } from '../../db/db.module';
import { SdkChatAgent } from '../agent/agents/sdk-chat-agent';

@Injectable()
export class SdkChatStreamService {
  constructor(
    private db: DbService,
    private sdkChatAgent: SdkChatAgent
  ) {}

  async findThread(
    sdkChatId: DbId<'SdkChat'>,
    externalUser: string,
    orgId: DbId<'Org'>
  ): Promise<DbId<'ChatThread'> | null> {
    const existing = await this.db.kysely
      .selectFrom('data.chat_threads')
      .select('id')
      .where('sdk_chat_id', '=', sdkChatId)
      .where('external_user_id', '=', externalUser)
      .where('org_id', '=', orgId)
      .orderBy('updated_at', 'desc')
      .executeTakeFirst();

    return existing?.id ?? null;
  }

  async findOrCreateThread(
    sdkChatId: DbId<'SdkChat'>,
    externalUser: string,
    orgId: DbId<'Org'>,
    message: string,
    threadId?: DbId<'ChatThread'>
  ): Promise<DbId<'ChatThread'>> {
    if (threadId) {
      // Update the existing thread timestamp, filtering by external_user_id to prevent cross-user access
      const updated = await this.db.kysely
        .updateTable('data.chat_threads')
        .set({ updated_at: new Date() })
        .where('id', '=', threadId)
        .where('org_id', '=', orgId)
        .where('sdk_chat_id', '=', sdkChatId)
        .where('external_user_id', '=', externalUser)
        .executeTakeFirst();

      if (updated.numUpdatedRows > 0n) {
        return threadId;
      }
      // Thread not found for this user, fall through to create a new one
    }

    // Look for existing thread for this SDK chat + external user
    const existing = await this.db.kysely
      .selectFrom('data.chat_threads')
      .select('id')
      .where('sdk_chat_id', '=', sdkChatId)
      .where('external_user_id', '=', externalUser)
      .where('org_id', '=', orgId)
      .orderBy('updated_at', 'desc')
      .executeTakeFirst();

    if (existing) {
      await this.db.kysely
        .updateTable('data.chat_threads')
        .set({ updated_at: new Date() })
        .where('id', '=', existing.id)
        .where('org_id', '=', orgId)
        .execute();
      return existing.id;
    }

    // Create new thread; catch unique violation from concurrent requests
    try {
      const thread = await this.db.kysely
        .insertInto('data.chat_threads')
        .values({
          id: packId('ChatThread', orgId),
          title: message.slice(0, THREAD_TITLE_MAX_LENGTH),
          org_id: orgId,
          membership_id: null,
          source: 'sdk',
          sdk_chat_id: sdkChatId,
          external_user_id: externalUser,
          updated_at: new Date(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return thread.id;
    } catch (err) {
      // Unique index violation (23505) means a concurrent request created the thread
      if (hasErrorCode(err) && err.code === '23505') {
        const retry = await this.db.kysely
          .selectFrom('data.chat_threads')
          .select('id')
          .where('sdk_chat_id', '=', sdkChatId)
          .where('external_user_id', '=', externalUser)
          .where('org_id', '=', orgId)
          .executeTakeFirstOrThrow();
        return retry.id;
      }
      throw err;
    }
  }

  async streamChat(
    sdkAuth: {
      orgId: DbId<'Org'>;
      sdkChatId: DbId<'SdkChat'>;
      externalUser: string;
      dataSourceConfig: SdkChatSourceConfig;
      systemPrompt: string | null;
    },
    message: string,
    options?: {
      threadId?: DbId<'ChatThread'>;
      attachments?: ChatAttachment[];
      attachmentContext?: AttachmentContext;
    }
  ) {
    const resolvedThreadId = await this.findOrCreateThread(
      sdkAuth.sdkChatId,
      sdkAuth.externalUser,
      sdkAuth.orgId,
      message,
      options?.threadId
    );

    // Extract collection IDs and data source IDs from config
    // Empty config = no data sources (user must explicitly select)
    const collectionIds = sdkAuth.dataSourceConfig
      .filter(
        (s): s is { type: 'COLLECTION'; collectionId: DbId<'Collection'> } =>
          s.type === 'COLLECTION'
      )
      .map((s) => s.collectionId);

    const dataSourceIds = sdkAuth.dataSourceConfig
      .filter(
        (s): s is { type: 'DATA_SOURCE'; dataSourceId: DbId<'DataSource'> } =>
          s.type === 'DATA_SOURCE'
      )
      .map((s) => s.dataSourceId);

    const ctx = this.sdkChatAgent.create({
      orgId: sdkAuth.orgId,
      collectionIds,
      dataSourceIds,
      systemPrompt: sdkAuth.systemPrompt,
      sdkChatId: sdkAuth.sdkChatId,
      externalUser: sdkAuth.externalUser,
    });

    return this.sdkChatAgent.stream(ctx, {
      threadId: resolvedThreadId,
      message,
      attachments: options?.attachments,
      attachmentContext: options?.attachmentContext,
    });
  }
}
