import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';

import { type DbId, dbIdSchema, extractOrgNumericId, packId } from '@grabdy/common';
import { sharedChatSnapshotSchema } from '@grabdy/contracts';
import { nanoid } from 'nanoid';

import { DbService } from '../../db/db.module';
import { AgentMemoryService } from '../agent/services/memory.service';

/** Matches image proxy URLs like /orgs/<orgId>/img/<imageId>. See also IMAGE_PROXY_RE in MessageRow.tsx. */
const IMAGE_URL_RE =
  /\/orgs\/[^/]+\/img\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;

const SHARE_TOKEN_LENGTH = 12;
const MAX_TOKEN_RETRIES = 3;

@Injectable()
export class SharedChatService {
  constructor(
    private db: DbService,
    private agentMemory: AgentMemoryService
  ) {}

  async createShare(
    orgId: DbId<'Org'>,
    threadId: DbId<'ChatThread'>,
    membershipId: DbId<'OrgMembership'>,
    options: { isPublic?: boolean }
  ) {
    const thread = await this.db.kysely
      .selectFrom('data.chat_threads')
      .leftJoin('sdk.bots', 'sdk.bots.id', 'data.chat_threads.bot_id')
      .select([
        'data.chat_threads.id',
        'data.chat_threads.title',
        'sdk.bots.accent_color',
        'sdk.bots.primary_color',
      ])
      .where('data.chat_threads.id', '=', threadId)
      .where('data.chat_threads.org_id', '=', orgId)
      .executeTakeFirst();

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    const messages = await this.agentMemory.getHistory(threadId);
    const messagesSnapshot = messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      sources: m.sources ?? null,
      thinkingTexts: m.thinkingTexts ?? null,
      durationMs: m.durationMs ?? null,
      createdAt: m.createdAt ? m.createdAt.toISOString() : new Date().toISOString(),
    }));

    const snapshotJson = JSON.stringify(messagesSnapshot);
    const isPublicVal = options.isPublic ?? false;

    // Extract image IDs from all message content
    const imageIdSet = new Set<DbId<'ExtractedImage'>>();
    for (const msg of messagesSnapshot) {
      let match: RegExpExecArray | null;
      IMAGE_URL_RE.lastIndex = 0;
      while ((match = IMAGE_URL_RE.exec(msg.content)) !== null) {
        const parsed = dbIdSchema('ExtractedImage').safeParse(match[1]);
        if (parsed.success) {
          imageIdSet.add(parsed.data);
        }
      }
    }
    const imageIds = [...imageIdSet];

    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_TOKEN_RETRIES; attempt++) {
      const shareToken = nanoid(SHARE_TOKEN_LENGTH);
      const id = packId('SharedChat', orgId);

      try {
        const row = await this.db.kysely
          .insertInto('data.shared_chats')
          .values({
            id,
            thread_id: threadId,
            org_id: orgId,
            membership_id: membershipId,
            title: thread.title,
            messages_snapshot: snapshotJson,
            share_token: shareToken,
            accent_color: thread.accent_color,
            primary_color: thread.primary_color,
            image_ids: imageIds,
            is_public: isPublicVal,
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        return {
          id: row.id,
          threadId: row.thread_id,
          title: row.title,
          shareToken: row.share_token,
          isPublic: row.is_public,
          revoked: row.revoked,
          createdAt: new Date(row.created_at).toISOString(),
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('share_token') && msg.includes('unique')) {
          lastError = err;
          continue;
        }
        throw err;
      }
    }

    throw lastError;
  }

  async getByToken(shareToken: string, viewerMembershipIds: DbId<'OrgMembership'>[]) {
    // org-safe: public share lookup by token, org unknown until token is resolved
    const row = await this.db.kysely
      .selectFrom('data.shared_chats')
      .select([
        'title',
        'messages_snapshot',
        'accent_color',
        'primary_color',
        'is_public',
        'org_id',
        'revoked',
        'created_at',
      ])
      .where('share_token', '=', shareToken)
      .where('revoked', '=', false)
      .executeTakeFirst();

    if (!row) {
      throw new NotFoundException('Shared chat not found');
    }

    // Private shares require the viewer to be a member of the same org
    if (!row.is_public) {
      if (viewerMembershipIds.length === 0) {
        throw new UnauthorizedException('Authentication required to view this shared chat');
      }
      const shareOrgNum = extractOrgNumericId(row.org_id);
      const hasAccess = viewerMembershipIds.some((mid) => extractOrgNumericId(mid) === shareOrgNum);
      if (!hasAccess) {
        throw new UnauthorizedException('You do not have access to this shared chat');
      }
    }

    const messagesSnapshot = Array.isArray(row.messages_snapshot)
      ? row.messages_snapshot
      : JSON.parse(row.messages_snapshot as string);

    return sharedChatSnapshotSchema.parse({
      title: row.title,
      accentColor: row.accent_color,
      primaryColor: row.primary_color,
      messages: messagesSnapshot,
      createdAt: new Date(row.created_at).toISOString(),
    });
  }

  async listShares(orgId: DbId<'Org'>, threadId: DbId<'ChatThread'>) {
    const rows = await this.db.kysely
      .selectFrom('data.shared_chats')
      .select(['id', 'thread_id', 'title', 'share_token', 'is_public', 'revoked', 'created_at'])
      .where('org_id', '=', orgId)
      .where('thread_id', '=', threadId)
      .orderBy('created_at', 'desc')
      .execute();

    return rows.map((row) => ({
      id: row.id,
      threadId: row.thread_id,
      title: row.title,
      shareToken: row.share_token,
      isPublic: row.is_public,
      revoked: row.revoked,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }

  async revokeShare(orgId: DbId<'Org'>, threadId: DbId<'ChatThread'>, shareId: DbId<'SharedChat'>) {
    const result = await this.db.kysely
      .updateTable('data.shared_chats')
      .set({ revoked: true })
      .where('id', '=', shareId)
      .where('org_id', '=', orgId)
      .where('thread_id', '=', threadId)
      .executeTakeFirst();

    if (result.numUpdatedRows === 0n) {
      throw new NotFoundException('Share not found');
    }
  }
}
