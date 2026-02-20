import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';

import { type DbId, extractOrgNumericId, packId } from '@grabdy/common';
import { canvasStateSchema, sharedChatSnapshotSchema } from '@grabdy/contracts';
import { nanoid } from 'nanoid';

import { DbService } from '../../db/db.module';
import { AgentMemoryService } from '../agent/services/memory.service';

const SHARE_TOKEN_LENGTH = 12;
const MAX_TOKEN_RETRIES = 3;

@Injectable()
export class SharedChatService {
  constructor(
    private db: DbService,
    private agentMemory: AgentMemoryService,
  ) {}

  async createShare(
    orgId: DbId<'Org'>,
    threadId: DbId<'ChatThread'>,
    membershipId: DbId<'OrgMembership'>,
    options: { isPublic?: boolean },
  ) {
    const thread = await this.db.kysely
      .selectFrom('data.chat_threads')
      .select(['id', 'title', 'canvas_state'])
      .where('id', '=', threadId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    const messages = await this.agentMemory.getHistory(threadId);
    const messagesSnapshot = messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      sources: null,
      createdAt: m.createdAt ? m.createdAt.toISOString() : new Date().toISOString(),
    }));

    const canvasState = thread.canvas_state
      ? canvasStateSchema.parse(thread.canvas_state)
      : null;

    const snapshotJson = JSON.stringify(messagesSnapshot);
    const canvasJson = canvasState ? JSON.stringify(canvasState) : null;
    const isPublicVal = options.isPublic ?? false;

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
            canvas_state_snapshot: canvasJson,
            share_token: shareToken,
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
        'canvas_state_snapshot',
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
      const hasAccess = viewerMembershipIds.some(
        (mid) => extractOrgNumericId(mid) === shareOrgNum,
      );
      if (!hasAccess) {
        throw new UnauthorizedException('You do not have access to this shared chat');
      }
    }

    const messagesSnapshot = Array.isArray(row.messages_snapshot)
      ? row.messages_snapshot
      : JSON.parse(row.messages_snapshot as string);

    const canvasSnapshot = row.canvas_state_snapshot
      ? (typeof row.canvas_state_snapshot === 'string'
          ? JSON.parse(row.canvas_state_snapshot)
          : row.canvas_state_snapshot)
      : null;

    return sharedChatSnapshotSchema.parse({
      title: row.title,
      messages: messagesSnapshot,
      canvasState: canvasSnapshot,
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

  async revokeShare(
    orgId: DbId<'Org'>,
    threadId: DbId<'ChatThread'>,
    shareId: DbId<'SharedChat'>,
  ) {
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
