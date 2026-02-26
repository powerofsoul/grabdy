import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE sdk.sdk_chats ADD COLUMN title TEXT;
    ALTER TABLE sdk.sdk_chats ADD COLUMN subtitle TEXT;
    ALTER TABLE sdk.sdk_chats ADD COLUMN placeholder TEXT;
    ALTER TABLE sdk.sdk_chats ADD COLUMN image_key TEXT;
    ALTER TABLE sdk.sdk_chats ADD COLUMN accent_color TEXT;
    ALTER TABLE sdk.sdk_chats ADD COLUMN primary_color TEXT;
    ALTER TABLE sdk.sdk_chats DROP COLUMN is_active;
    ALTER TABLE sdk.sdk_chats DROP COLUMN settings;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE sdk.sdk_chats DROP COLUMN IF EXISTS title;
    ALTER TABLE sdk.sdk_chats DROP COLUMN IF EXISTS subtitle;
    ALTER TABLE sdk.sdk_chats DROP COLUMN IF EXISTS placeholder;
    ALTER TABLE sdk.sdk_chats DROP COLUMN IF EXISTS image_key;
    ALTER TABLE sdk.sdk_chats DROP COLUMN IF EXISTS accent_color;
    ALTER TABLE sdk.sdk_chats DROP COLUMN IF EXISTS primary_color;
    ALTER TABLE sdk.sdk_chats ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE sdk.sdk_chats ADD COLUMN settings JSONB NOT NULL DEFAULT '{}';
  `.execute(db);
}
