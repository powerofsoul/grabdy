import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('data.chat_threads').dropColumn('canvas_state').execute();
  await db.schema.alterTable('data.shared_chats').dropColumn('canvas_state_snapshot').execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('data.chat_threads')
    .addColumn('canvas_state', 'jsonb', (col) => col.defaultTo(null))
    .execute();
  await db.schema
    .alterTable('data.shared_chats')
    .addColumn('canvas_state_snapshot', 'jsonb', (col) => col.defaultTo(null))
    .execute();
}
